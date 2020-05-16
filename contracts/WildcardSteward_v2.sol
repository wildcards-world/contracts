pragma solidity 0.5.15;
import "./ERC721Patronage_v1.sol";
import "./MintManager_v2.sol";


contract WildcardSteward_v2 is Initializable {
    /*
    This smart contract collects patronage from current owner through a Harberger tax model and 
    takes stewardship of the asset token if the patron can't pay anymore.

    Harberger Tax (COST): 
    - Asset is always on sale.
    - You have to have a price set.
    - Tax (Patronage) is paid to maintain ownership.
    - Steward maints control over ERC721.
    */
    using SafeMath for uint256;

    mapping(uint256 => uint256) public price; //in wei
    ERC721Patronage_v1 public assetToken; // ERC721 NFT.

    mapping(uint256 => uint256) public totalCollected; // all patronage ever collected
    mapping(uint256 => uint256) public currentCollected; // amount currently collected for patron
    mapping(uint256 => uint256) public timeLastCollected;
    mapping(address => uint256) public timeLastCollectedPatron;
    mapping(address => uint256) public deposit;
    mapping(address => uint256) public totalPatronOwnedTokenCost;

    mapping(uint256 => address) public benefactors; // non-profit benefactor
    mapping(address => uint256) public benefactorFunds;

    mapping(uint256 => address) public currentPatron; // This is different to the current token owner.
    mapping(uint256 => mapping(address => bool)) public patrons;
    mapping(uint256 => mapping(address => uint256)) public timeHeld;

    mapping(uint256 => uint256) public timeAcquired;

    // 1200% patronage
    mapping(uint256 => uint256) public patronageNumerator;

    enum StewardState {Foreclosed, Owned}
    mapping(uint256 => StewardState) public state;

    address public admin;

    //////////////// NEW variables in v2///////////////////
    mapping(uint256 => uint256) public tokenGenerationRate; // we can reuse the patronage denominator

    MintManager_v2 public mintManager;
    uint256 public auctionStartPrice;
    uint256 public auctionEndPrice;
    uint256 public auctionLength;

    mapping(uint256 => address) artistAddresses; //mapping from tokenID to the artists address
    mapping(uint256 => uint256) wildcardsPercentages; // mapping from tokenID to the percentage sale cut of wildcards for each token
    mapping(uint256 => uint256) artistPercentages; // tokenId to artist percetages. To make it configurable. 10 000 = 100%

    event Buy(uint256 indexed tokenId, address indexed owner, uint256 price);
    event PriceChange(uint256 indexed tokenId, uint256 newPrice);
    event Foreclosure(address indexed prevOwner, uint256 foreclosureTime);
    event RemainingDepositUpdate(
        address indexed tokenPatron,
        uint256 remainingDeposit
    );

    event AddToken(
        uint256 indexed tokenId,
        uint256 patronageNumerator,
        uint256 tokenGenerationRate
    );
    // QUESTION: in future versions, should these two events (CollectPatronage and CollectLoyalty) be combined into one? - they only ever happen at the same time.
    event CollectPatronage(
        uint256 indexed tokenId,
        address indexed patron,
        uint256 remainingDeposit,
        uint256 amountReceived
    );
    event CollectLoyalty(
        uint256 indexed tokenId,
        address indexed patron,
        uint256 amountRecieved
    );

    modifier onlyPatron(uint256 tokenId) {
        require(msg.sender == currentPatron[tokenId], "");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "");
        _;
    }

    modifier onlyReceivingBenefactorOrAdmin(uint256 tokenId) {
        require(msg.sender == benefactors[tokenId] || msg.sender == admin, "");
        _;
    }

    modifier collectPatronage(uint256 tokenId) {
        _collectPatronage(tokenId);
        _;
    }

    modifier collectPatronageAddress(address tokenPatron) {
        _collectPatronagePatron(tokenPatron);
        _;
    }

    modifier priceGreaterThanZero(uint256 _newPrice) {
        require(_newPrice > 0, "");
        _;
    }
    modifier validWildcardsPercentage(
        uint256 wildcardsPercentage,
        uint256 tokenID
    ) {
        require(
            wildcardsPercentage >= 500 &&
                wildcardsPercentage <= (10000 - artistPercentages[tokenID]), // not sub safemath. Is this okay?
            "Minimum 5% (500) commission, max 100% (10000) commission."
        );
        _;
    }

    function initialize(address _assetToken, address _admin)
        public
        initializer
    {
        assetToken = ERC721Patronage_v1(_assetToken);
        admin = _admin;
    }

    function uintToStr(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }

        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }

        bytes memory bstr = new bytes(len);
        while (_i != 0) {
            bstr[--len] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
        }
        return string(bstr);
    }

    function listNewTokens(
        uint256[] memory tokens,
        address payable[] memory _benefactors,
        uint256[] memory _patronageNumerator,
        uint256[] memory _tokenGenerationRate
    ) public onlyAdmin {
        assert(tokens.length == _benefactors.length);
        assert(tokens.length == _patronageNumerator.length);
        assert(tokens.length == _tokenGenerationRate.length);

        for (uint8 i = 0; i < tokens.length; ++i) {
            assert(_benefactors[i] != address(0));
            string memory idString = uintToStr(tokens[i]);
            string memory tokenUriBase = "https://wildcards.xyz/token/";
            string memory tokenUri = string(
                abi.encodePacked(tokenUriBase, idString)
            );
            assetToken.mintWithTokenURI(address(this), tokens[i], tokenUri);
            benefactors[tokens[i]] = _benefactors[i];
            state[tokens[i]] = StewardState.Foreclosed;
            artistPercentages[tokens[i]] = 100;
            timeLastCollected[tokens[i]] = now;
            patronageNumerator[tokens[i]] = _patronageNumerator[i];
            tokenGenerationRate[tokens[i]] = _tokenGenerationRate[i];
            emit AddToken(
                tokens[i],
                _patronageNumerator[i],
                _tokenGenerationRate[i]
            );
        }
    }

    function addTokenGenerationRateToExistingTokens(
        uint256[] memory tokens,
        uint256[] memory _tokenGenerationRate
    ) internal {
        assert(tokens.length == _tokenGenerationRate.length);
        for (uint8 i = 0; i < tokens.length; ++i) {
            assert(tokenGenerationRate[tokens[i]] == 0);

            tokenGenerationRate[tokens[i]] = _tokenGenerationRate[i];
        }
    }

    function setMintManager(address _mintManager) public {
        require(address(mintManager) == address(0), "");
        mintManager = MintManager_v2(_mintManager);
    }

    function updateToV2(
        address _mintManager,
        uint256[] memory tokens,
        uint256[] memory _tokenGenerationRate
    ) public {
        setMintManager(_mintManager);
        addTokenGenerationRateToExistingTokens(tokens, _tokenGenerationRate);
    }

    function changeReceivingBenefactor(
        uint256 tokenId,
        address payable _newReceivingBenefactor
    ) public onlyReceivingBenefactorOrAdmin(tokenId) {
        address oldBenfactor = benefactors[tokenId];
        require(oldBenfactor != _newReceivingBenefactor, "");
        benefactors[tokenId] = _newReceivingBenefactor;
        benefactorFunds[_newReceivingBenefactor] = benefactorFunds[_newReceivingBenefactor]
            .add(benefactorFunds[oldBenfactor]);
        benefactorFunds[oldBenfactor] = 0;
    }

    function changeAdmin(address _admin) public onlyAdmin {
        admin = _admin;
    }

    function setArtCommission(uint256 tokenId, uint256 percentage)
        external
        onlyAdmin
    {
        require(percentage <= 2000, "");
        artistPercentages[tokenId] = percentage;
    }

    function setArtistAddress(uint256 tokenId, address artistAddress)
        external
        onlyAdmin
    {
        artistAddresses[tokenId] = artistAddress;
    }

    function changeAuctionParameters(
        uint256 _auctionStartPrice,
        uint256 _auctionEndPrice,
        uint256 _auctionLength
    ) external onlyAdmin {
        require(_auctionStartPrice >= _auctionEndPrice, "");
        require(_auctionLength >= 86400, "");

        auctionStartPrice = _auctionStartPrice;
        auctionEndPrice = _auctionEndPrice;
        auctionLength = _auctionLength;
    }

    function patronageOwed(uint256 tokenId)
        public
        view
        returns (uint256 patronageDue)
    {
        if (timeLastCollected[tokenId] == 0) return 0;

        return
            price[tokenId]
                .mul(now.sub(timeLastCollected[tokenId]))
                .mul(patronageNumerator[tokenId])
                .div(1000000000000)
                .div(365 days);
    }

    function patronageOwedWithTimestamp(uint256 tokenId)
        public
        view
        returns (uint256 patronageDue, uint256 timestamp)
    {
        return (patronageOwed(tokenId), now);
    }

    function patronageOwedPatron(address tokenPatron)
        public
        view
        returns (uint256 patronageDue)
    {
        if (timeLastCollectedPatron[tokenPatron] == 0) return 0;

        return
            totalPatronOwnedTokenCost[tokenPatron]
                .mul(now.sub(timeLastCollectedPatron[tokenPatron]))
                .div(1000000000000)
                .div(365 days);
    }

    function patronageOwedPatronWithTimestamp(address tokenPatron)
        public
        view
        returns (uint256 patronageDue, uint256 timestamp)
    {
        return (patronageOwedPatron(tokenPatron), now);
    }

    function foreclosedPatron(address tokenPatron) public view returns (bool) {
        if (patronageOwedPatron(tokenPatron) >= deposit[tokenPatron]) {
            return true;
        } else {
            return false;
        }
    }

    function foreclosed(uint256 tokenId) public view returns (bool) {
        address tokenPatron = currentPatron[tokenId];
        return foreclosedPatron(tokenPatron);
    }

    function depositAbleToWithdraw(address tokenPatron)
        public
        view
        returns (uint256)
    {
        uint256 collection = patronageOwedPatron(tokenPatron);
        if (collection >= deposit[tokenPatron]) {
            return 0;
        } else {
            return deposit[tokenPatron].sub(collection);
        }
    }

    function foreclosureTimePatron(address tokenPatron)
        public
        view
        returns (uint256)
    {
        uint256 pps = totalPatronOwnedTokenCost[tokenPatron]
            .div(1000000000000)
            .div(365 days);
        return now.add(depositAbleToWithdraw(tokenPatron).div(pps));
    }

    function foreclosureTime(uint256 tokenId) public view returns (uint256) {
        address tokenPatron = currentPatron[tokenId];
        return foreclosureTimePatron(tokenPatron);
    }

    function _collectLoyalty(uint256 tokenId) internal {
        address currentOwner = currentPatron[tokenId];
        uint256 previousTokenCollection = timeLastCollected[tokenId];
        uint256 patronageOwedByTokenPatron = patronageOwedPatron(currentOwner);
        uint256 timeSinceLastMint;

        if (patronageOwedByTokenPatron >= deposit[currentOwner]) {
            uint256 newTimeLastCollected = timeLastCollectedPatron[currentOwner]
                .add(
                (
                    (now.sub(timeLastCollectedPatron[currentOwner]))
                        .mul(deposit[currentOwner])
                        .div(patronageOwedByTokenPatron)
                )
            );
            timeSinceLastMint = (
                newTimeLastCollected.sub(previousTokenCollection)
            );
        } else {
            timeSinceLastMint = now.sub(timeLastCollected[tokenId]);
        }
        mintManager.tokenMint(
            currentOwner,
            timeSinceLastMint,
            tokenGenerationRate[tokenId]
        );
        emit CollectLoyalty(tokenId, currentOwner, timeSinceLastMint);
    }

    function _collectPatronage(uint256 tokenId) public {
        if (state[tokenId] == StewardState.Owned) {
            address currentOwner = currentPatron[tokenId];
            uint256 previousTokenCollection = timeLastCollected[tokenId];
            uint256 patronageOwedByTokenPatron = patronageOwedPatron(
                currentOwner
            );
            _collectLoyalty(tokenId);
            uint256 collection;

            if (patronageOwedByTokenPatron >= deposit[currentOwner]) {

                    uint256 newTimeLastCollected
                 = timeLastCollectedPatron[currentOwner].add(
                    (
                        (now.sub(timeLastCollectedPatron[currentOwner]))
                            .mul(deposit[currentOwner])
                            .div(patronageOwedByTokenPatron)
                    )
                );

                timeLastCollected[tokenId] = newTimeLastCollected;
                timeLastCollectedPatron[currentOwner] = newTimeLastCollected;
                collection = price[tokenId]
                    .mul(newTimeLastCollected.sub(previousTokenCollection))
                    .mul(patronageNumerator[tokenId])
                    .div(1000000000000)
                    .div(365 days);
                deposit[currentOwner] = 0;
                _foreclose(tokenId);
            } else {
                collection = price[tokenId]
                    .mul(now.sub(previousTokenCollection))
                    .mul(patronageNumerator[tokenId])
                    .div(1000000000000)
                    .div(365 days);

                timeLastCollected[tokenId] = now;
                timeLastCollectedPatron[currentOwner] = now;
                currentCollected[tokenId] = currentCollected[tokenId].add(
                    collection
                );
                deposit[currentOwner] = deposit[currentOwner].sub(
                    patronageOwedByTokenPatron
                );
            }
            totalCollected[tokenId] = totalCollected[tokenId].add(collection);
            address benefactor = benefactors[tokenId];
            benefactorFunds[benefactor] = benefactorFunds[benefactor].add(
                collection
            );
            emit CollectPatronage(
                tokenId,
                currentOwner,
                deposit[currentOwner],
                collection
            );
        }
    }

    function _collectPatronagePatron(address tokenPatron) public {
        uint256 patronageOwedByTokenPatron = patronageOwedPatron(tokenPatron);
        if (
            patronageOwedByTokenPatron > 0 &&
            patronageOwedByTokenPatron >= deposit[tokenPatron]
        ) {

                uint256 previousCollectionTime
             = timeLastCollectedPatron[tokenPatron];
            uint256 newTimeLastCollected = previousCollectionTime.add(
                (
                    (now.sub(previousCollectionTime))
                        .mul(deposit[tokenPatron])
                        .div(patronageOwedByTokenPatron)
                )
            );
            timeLastCollectedPatron[tokenPatron] = newTimeLastCollected;
            deposit[tokenPatron] = 0;
        } else {
            timeLastCollectedPatron[tokenPatron] = now;
            deposit[tokenPatron] = deposit[tokenPatron].sub(
                patronageOwedByTokenPatron
            );
        }

        emit RemainingDepositUpdate(tokenPatron, deposit[tokenPatron]);
    }

    function depositWei() public payable {
        depositWeiPatron(msg.sender);
    }

    function depositWeiPatron(address patron) public payable {
        require(totalPatronOwnedTokenCost[patron] > 0, "");
        deposit[patron] = deposit[patron].add(msg.value);
        emit RemainingDepositUpdate(patron, deposit[patron]);
    }

    function _auctionPrice(uint256 tokenId) internal view returns (uint256) {
        uint256 auctionEnd = timeLastCollected[tokenId].add(auctionLength);
        // If it is not brand new and foreclosed, use the foreclosre auction price.
        uint256 _auctionStartPrice;
        if (price[tokenId] != 0 && price[tokenId] > auctionEndPrice) {
            _auctionStartPrice = price[tokenId];
        } else {
            // Otherwise use starting auction price
            _auctionStartPrice = auctionStartPrice;
        }

        if (now >= auctionEnd) {
            return auctionEndPrice;
        } else {
            // startPrice - ( ( (startPrice - endPrice) * howLongThisAuctionBeenGoing ) / auctionLength )
            return
                _auctionStartPrice.sub(
                    (_auctionStartPrice.sub(auctionEndPrice))
                        .mul(now.sub(timeLastCollected[tokenId]))
                        .div(auctionLength)
                );
        }
    }

    function buy(
        uint256 tokenId,
        uint256 _newPrice,
        uint256 _deposit,
        uint256 wildcardsPercentage
    )
        public
        payable
        collectPatronage(tokenId)
        collectPatronageAddress(msg.sender)
        priceGreaterThanZero(_newPrice)
        validWildcardsPercentage(wildcardsPercentage, tokenId)
    {
        require(state[tokenId] == StewardState.Owned, "");
        uint256 remainingValueForDeposit = msg.value.sub(price[tokenId]);
        require(remainingValueForDeposit >= _deposit, "");

        _distributePurchaseProceeds(tokenId);

        wildcardsPercentages[tokenId] = wildcardsPercentage;
        deposit[msg.sender] = deposit[msg.sender].add(remainingValueForDeposit);
        transferAssetTokenTo(
            tokenId,
            assetToken.ownerOf(tokenId),
            currentPatron[tokenId],
            msg.sender,
            _newPrice
        );
        emit Buy(tokenId, msg.sender, _newPrice);
    }

    function buyAuction(
        uint256 tokenId,
        uint256 _newPrice,
        uint256 wildcardsPercentage
    )
        public
        payable
        collectPatronage(tokenId)
        collectPatronageAddress(msg.sender)
        priceGreaterThanZero(_newPrice)
        validWildcardsPercentage(wildcardsPercentage, tokenId)
    {
        require(state[tokenId] == StewardState.Foreclosed, "");
        uint256 auctionTokenPrice = _auctionPrice(tokenId);
        uint256 remainingValueForDeposit = msg.value.sub(auctionTokenPrice);

        _distributeAuctionProceeds(tokenId);

        state[tokenId] = StewardState.Owned;
        timeLastCollected[tokenId] = now;
        timeLastCollectedPatron[msg.sender] = now;

        wildcardsPercentages[tokenId] = wildcardsPercentage;
        deposit[msg.sender] = deposit[msg.sender].add(remainingValueForDeposit);
        transferAssetTokenTo(
            tokenId,
            assetToken.ownerOf(tokenId),
            currentPatron[tokenId],
            msg.sender,
            _newPrice
        );
        emit Buy(tokenId, msg.sender, _newPrice);
    }

    function _distributeAuctionProceeds(uint256 tokenId) internal {
        uint256 totalAmount = price[tokenId];
        if (artistPercentages[tokenId] == 0) {
            artistPercentages[tokenId] = 100;
        }
        uint256 artistAmount = totalAmount.mul(artistPercentages[tokenId]).div(
            10000
        );
        uint256 wildcardsAmount = totalAmount.sub(artistAmount);
        _payArtistAndWildcards(tokenId, artistAmount, wildcardsAmount);
    }

    function _distributePurchaseProceeds(uint256 tokenId) internal {
        uint256 totalAmount = price[tokenId];
        address tokenPatron = currentPatron[tokenId];
        // Wildcards percentage calc
        if (wildcardsPercentages[tokenId] == 0) {
            wildcardsPercentages[tokenId] = 500;
        }
        uint256 wildcardsAmount = totalAmount
            .mul(wildcardsPercentages[tokenId])
            .div(10000);

        // Artist percentage calc
        if (artistPercentages[tokenId] == 0) {
            artistPercentages[tokenId] = 100;
        }
        uint256 artistAmount = totalAmount.mul(artistPercentages[tokenId]).div(
            10000
        );
        uint256 previousOwnerProceedsFromSale = totalAmount
            .sub(wildcardsAmount)
            .sub(artistAmount);
        bool transferSuccess;
        if (
            totalPatronOwnedTokenCost[tokenPatron] ==
            price[tokenId].mul(patronageNumerator[tokenId])
        ) {
            previousOwnerProceedsFromSale = previousOwnerProceedsFromSale.add(
                deposit[tokenPatron]
            );
            deposit[tokenPatron] = 0;
            address payable payableCurrentPatron = address(
                uint160(tokenPatron)
            );
            (transferSuccess, ) = payableCurrentPatron.call.gas(2300).value(
                previousOwnerProceedsFromSale
            )("");
        }
        if (!transferSuccess) {
            deposit[tokenPatron] = deposit[tokenPatron].add(
                previousOwnerProceedsFromSale
            );
        }

        _payArtistAndWildcards(tokenId, artistAmount, wildcardsAmount);
    }

    function _payArtistAndWildcards(
        uint256 _tokenId,
        uint256 _artistAmount,
        uint256 _wildcardsAmount
    ) internal {
        if (artistAddresses[_tokenId] != address(0)) {
            deposit[artistAddresses[_tokenId]] = deposit[artistAddresses[_tokenId]]
                .add(_artistAmount);
            deposit[admin] = deposit[admin].add(_wildcardsAmount);
        } else {
            deposit[admin] = deposit[admin].add(_wildcardsAmount).add(
                _artistAmount
            );
        }
    }

    function changePrice(uint256 tokenId, uint256 _newPrice)
        public
        onlyPatron(tokenId)
        collectPatronage(tokenId)
    {
        require(state[tokenId] != StewardState.Foreclosed, "");
        require(_newPrice != 0, "");

        totalPatronOwnedTokenCost[msg.sender] = totalPatronOwnedTokenCost[msg
            .sender]
            .sub(price[tokenId].mul(patronageNumerator[tokenId]))
            .add(_newPrice.mul(patronageNumerator[tokenId]));

        price[tokenId] = _newPrice;
        emit PriceChange(tokenId, price[tokenId]);
    }

    function withdrawDeposit(uint256 _wei)
        public
        collectPatronageAddress(msg.sender)
        returns (uint256)
    {
        _withdrawDeposit(_wei);
    }

    function withdrawBenefactorFunds() public {
        withdrawBenefactorFundsTo(msg.sender);
    }

    function withdrawBenefactorFundsTo(address payable benefactor) public {
        require(benefactorFunds[benefactor] > 0, "");
        uint256 amountToWithdraw = benefactorFunds[benefactor];
        benefactorFunds[benefactor] = 0;

        (bool transferSuccess, ) = benefactor.call.gas(2300).value(
            amountToWithdraw
        )("");
        if (!transferSuccess) {
            revert("Unable to withdraw benefactor funds");
        }
    }

    function exit() public collectPatronageAddress(msg.sender) {
        _withdrawDeposit(deposit[msg.sender]);
    }

    function _withdrawDeposit(uint256 _wei) internal {
        require(deposit[msg.sender] >= _wei, "");

        deposit[msg.sender] = deposit[msg.sender].sub(_wei);

        (bool transferSuccess, ) = msg.sender.call.gas(2300).value(_wei)("");
        if (!transferSuccess) {
            revert("");
        }
    }

    function _foreclose(uint256 tokenId) internal {
        address currentOwner = assetToken.ownerOf(tokenId);
        address tokenPatron = currentPatron[tokenId];
        transferAssetTokenTo(
            tokenId,
            currentOwner,
            tokenPatron,
            address(this),
            price[tokenId]
        );
        state[tokenId] = StewardState.Foreclosed;
        currentCollected[tokenId] = 0;

        emit Foreclosure(currentOwner, timeLastCollected[tokenId]);
    }

    function transferAssetTokenTo(
        uint256 tokenId,
        address _currentOwner,
        address _currentPatron,
        address _newOwner,
        uint256 _newPrice
    ) internal {
        totalPatronOwnedTokenCost[_newOwner] = totalPatronOwnedTokenCost[_newOwner]
            .add(_newPrice.mul(patronageNumerator[tokenId]));
        totalPatronOwnedTokenCost[_currentPatron] = totalPatronOwnedTokenCost[_currentPatron]
            .sub(price[tokenId].mul(patronageNumerator[tokenId]));

        timeHeld[tokenId][_currentPatron] = timeHeld[tokenId][_currentPatron]
            .add((timeLastCollected[tokenId].sub(timeAcquired[tokenId])));
        assetToken.transferFrom(_currentOwner, _newOwner, tokenId);
        currentPatron[tokenId] = _newOwner;

        price[tokenId] = _newPrice;
        timeAcquired[tokenId] = now;
        patrons[tokenId][_newOwner] = true;
    }
}

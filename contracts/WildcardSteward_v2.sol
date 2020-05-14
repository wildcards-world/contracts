pragma solidity 0.5.16;
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
    uint256 public patronageDenominator;

    enum StewardState {Foreclosed, Owned}
    mapping(uint256 => StewardState) public state;

    address public admin;

    //////////////// NEW variables in v2///////////////////
    mapping(uint256 => uint256) public tokenGenerationRate; // we can reuse the patronage denominator

    MintManager_v2 public mintManager;

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
        require(msg.sender == currentPatron[tokenId], "Not patron");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyReceivingBenefactorOrAdmin(uint256 tokenId) {
        require(
            msg.sender == benefactors[tokenId] || msg.sender == admin,
            "Not benefactor or admin"
        );
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

    function initialize(
        address _assetToken,
        address _admin,
        uint256 _patronageDenominator
    ) public initializer {
        assetToken = ERC721Patronage_v1(_assetToken);
        admin = _admin;
        patronageDenominator = _patronageDenominator;
    }

    // TODO:: add validation that the token that is complient with the "PatronageToken" ERC721 interface extension somehow!
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
            benefactors[tokens[i]] = _benefactors[i];
            state[tokens[i]] = StewardState.Foreclosed; // TODO: Maybe Implement reverse dutch auction on intial sale or other such mechanisms to avoid the deadloss weight of
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
        require(
            address(mintManager) == address(0),
            "Only set on initialisation"
        ); // This can only be called once!
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
        benefactors[tokenId] = _newReceivingBenefactor;
        benefactorFunds[_newReceivingBenefactor] = benefactorFunds[oldBenfactor];
        benefactorFunds[oldBenfactor] = 0;
    }

    function changeAdmin(address _admin) public onlyAdmin {
        admin = _admin;
    }

    /* public view functions */
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
                .div(patronageDenominator)
                .div(365 days);
    }

    function patronageOwedWithTimestamp(uint256 tokenId)
        public
        view
        returns (uint256 patronageDue, uint256 timestamp)
    {
        return (patronageOwed(tokenId), now);
    }

    // TODO: make a version of this function that is for patronage owed by token rather than by tokenPatron like it is now.
    function patronageOwedPatron(address tokenPatron)
        public
        view
        returns (uint256 patronageDue)
    {
        if (timeLastCollectedPatron[tokenPatron] == 0) return 0;

        return
            totalPatronOwnedTokenCost[tokenPatron]
                .mul(now.sub(timeLastCollectedPatron[tokenPatron]))
                .div(patronageDenominator)
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
        // returns whether it is in foreclosed state or not
        // depending on whether deposit covers patronage due
        // useful helper function when price should be zero, but contract doesn't reflect it yet.
        if (patronageOwedPatron(tokenPatron) >= deposit[tokenPatron]) {
            return true;
        } else {
            return false;
        }
    }

    function foreclosed(uint256 tokenId) public view returns (bool) {
        // returns whether it is in foreclosed state or not
        // depending on whether deposit covers patronage due
        // useful helper function when price should be zero, but contract doesn't reflect it yet.
        address tokenPatron = currentPatron[tokenId];
        return foreclosedPatron(tokenPatron);
    }

    // same function as above, basically
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
        // patronage per second
        uint256 pps = totalPatronOwnedTokenCost[tokenPatron]
            .div(patronageDenominator)
            .div(365 days);
        return now.add(depositAbleToWithdraw(tokenPatron).div(pps)); // zero division if price is zero.
    }

    function foreclosureTime(uint256 tokenId) public view returns (uint256) {
        address tokenPatron = currentPatron[tokenId];
        return foreclosureTimePatron(tokenPatron);
    }

    /* actions */
    function _collectLoyalty(uint256 tokenId) internal {
        // NOTE: this isn't currently implemented optimally. It would be possible to keep track of the total loyalty token generation rate for all the users tokens and use that.
        // This should be implemented soon (while there are only a small number of tokens), or never.
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

    // TODO:: think of more efficient ways for recipients to collect patronage for lots of tokens at the same time.0
    function _collectPatronage(uint256 tokenId) public {
        // determine patronage to pay
        if (state[tokenId] == StewardState.Owned) {
            address currentOwner = currentPatron[tokenId];
            uint256 previousTokenCollection = timeLastCollected[tokenId];
            uint256 patronageOwedByTokenPatron = patronageOwedPatron(
                currentOwner
            );
            _collectLoyalty(tokenId); // This needs to be called before before the token may be foreclosed next section
            uint256 collection;

            // it should foreclose and take stewardship
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
                    .div(patronageDenominator)
                    .div(365 days);
                deposit[currentOwner] = 0;
                _foreclose(tokenId);
            } else {
                collection = price[tokenId]
                    .mul(now.sub(previousTokenCollection))
                    .mul(patronageNumerator[tokenId])
                    .div(patronageDenominator)
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
            // if foreclosed, tokens are minted and sent to the steward since _foreclose is already called.
            emit CollectPatronage(
                tokenId,
                currentOwner,
                deposit[currentOwner],
                collection
            );
        }
    }

    // This does accounting without transfering any tokens
    function _collectPatronagePatron(address tokenPatron) public {
        uint256 patronageOwedByTokenPatron = patronageOwedPatron(tokenPatron);
        if (
            patronageOwedByTokenPatron > 0 &&
            patronageOwedByTokenPatron >= deposit[tokenPatron]
        ) {

                uint256 previousCollectionTime
             = timeLastCollectedPatron[tokenPatron];
            // up to when was it actually paid for?
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

    // note: anyone can deposit
    function depositWei() public payable {
        depositWeiPatron(msg.sender);
    }

    function depositWeiPatron(address patron) public payable {
        require(totalPatronOwnedTokenCost[patron] > 0, "No tokens owned");
        deposit[patron] = deposit[patron].add(msg.value);
        emit RemainingDepositUpdate(patron, deposit[patron]);
    }

    function buy(uint256 tokenId, uint256 _newPrice)
        public
        payable
        collectPatronage(tokenId)
        collectPatronageAddress(msg.sender)
    {
        require(_newPrice > 0, "Price is zero");
        require(msg.value > price[tokenId], "Not enough"); // >, coz need to have at least something for deposit
        address currentOwner = assetToken.ownerOf(tokenId);
        address tokenPatron = currentPatron[tokenId];

        if (state[tokenId] == StewardState.Owned) {
            uint256 totalToPayBack = price[tokenId];
            // NOTE: pay back the deposit only if it is the only token the patron owns.
            if (
                totalPatronOwnedTokenCost[tokenPatron] ==
                price[tokenId].mul(patronageNumerator[tokenId])
            ) {
                totalToPayBack = totalToPayBack.add(deposit[tokenPatron]);
                deposit[tokenPatron] = 0;
            }

            // pay previous owner their price + deposit back.
            address payable payableCurrentPatron = address(
                uint160(tokenPatron)
            );
            (bool transferSuccess, ) = payableCurrentPatron
                .call
                .gas(2300)
                .value(totalToPayBack)("");
            if (!transferSuccess) {
                deposit[tokenPatron] = deposit[tokenPatron].add(totalToPayBack);
            }
        } else if (state[tokenId] == StewardState.Foreclosed) {
            state[tokenId] = StewardState.Owned;
            timeLastCollected[tokenId] = now;
            timeLastCollectedPatron[msg.sender] = now;
        }

        deposit[msg.sender] = deposit[msg.sender].add(
            msg.value.sub(price[tokenId])
        );
        transferAssetTokenTo(
            tokenId,
            currentOwner,
            tokenPatron,
            msg.sender,
            _newPrice
        );
        emit Buy(tokenId, msg.sender, _newPrice);
    }

    function changePrice(uint256 tokenId, uint256 _newPrice)
        public
        onlyPatron(tokenId)
        collectPatronage(tokenId)
    {
        require(state[tokenId] != StewardState.Foreclosed, "Foreclosed");
        require(_newPrice != 0, "Incorrect Price");

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
        require(benefactorFunds[benefactor] > 0, "No funds available");
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

    /* internal */
    function _withdrawDeposit(uint256 _wei) internal {
        // note: can withdraw whole deposit, which puts it in immediate to be foreclosed state.
        require(deposit[msg.sender] >= _wei, "Withdrawing too much");

        deposit[msg.sender] = deposit[msg.sender].sub(_wei);

        // msg.sender == patron
        (bool transferSuccess, ) = msg.sender.call.gas(2300).value(_wei)("");
        if (!transferSuccess) {
            revert("Unable to withdraw deposit");
        }
    }

    function _foreclose(uint256 tokenId) internal {
        // become steward of assetToken (aka foreclose)
        address currentOwner = assetToken.ownerOf(tokenId);
        address tokenPatron = currentPatron[tokenId];
        transferAssetTokenTo(
            tokenId,
            currentOwner,
            tokenPatron,
            address(this),
            0
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

        // note: it would also tabulate time held in stewardship by smart contract
        timeHeld[tokenId][_currentPatron] = timeHeld[tokenId][_currentPatron]
            .add((timeLastCollected[tokenId].sub(timeAcquired[tokenId])));
        assetToken.transferFrom(_currentOwner, _newOwner, tokenId);
        currentPatron[tokenId] = _newOwner;

        price[tokenId] = _newPrice;
        timeAcquired[tokenId] = now;
        patrons[tokenId][_newOwner] = true;
    }
}

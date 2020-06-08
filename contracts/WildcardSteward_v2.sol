pragma solidity 0.5.17;

import "./ERC721Patronage_v1.sol";
import "./MintManager_v2.sol";

import "@nomiclabs/buidler/console.sol";


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

    mapping(uint256 => uint256) public totalCollected; // THIS VALUE IS DEPRECATED
    mapping(uint256 => uint256) public currentCollected; // THIS VALUE IS DEPRECATED
    mapping(uint256 => uint256) public timeLastCollected; // THIS VALUE IS DEPRECATED.
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
    //////////////// NEW variables in v3 ///////////////////
    uint256 public auctionStartPrice;
    uint256 public auctionEndPrice;
    uint256 public auctionLength;

    mapping(uint256 => address) artistAddresses; //mapping from tokenID to the artists address
    mapping(uint256 => uint256) wildcardsPercentages; // mapping from tokenID to the percentage sale cut of wildcards for each token
    mapping(uint256 => uint256) artistPercentages; // tokenId to artist percetages. To make it configurable. 10 000 = 100%
    mapping(uint256 => uint256) tokenAuctionBeginTimestamp;

    mapping(address => uint256) public totalPatronTokenGenerationRate; // The total token generation rate for all the tokens of the given address.
    mapping(address => uint256) public benefactorTotalTokenNumerator;
    mapping(address => uint256) public benefactorLastTimeCollected;
    mapping(address => uint256) public benefactorCredit;
    uint256 public globalBenefactorDailyWithdrawalLimit;
    address public withdrawCheckerAdmin;
    uint256 public benefactorWithdrawalThrottle;

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
        uint256 tokenGenerationRate,
        uint256 unixTimestampOfTokenAuctionStart
    );

    // QUESTION: in future versions, should these two events (CollectPatronage and CollectLoyalty) be combined into one? - they only ever happen at the same time.
    // NOTE: this event is deprecated - it is only here for the upgrade function.
    event CollectPatronage(
        uint256 indexed tokenId,
        address indexed patron,
        uint256 remainingDeposit,
        uint256 amountReceived
    );
    // Legacy collect loyalty event - only used in the upgrade function; TODO: delete on next upgrade.
    event CollectLoyalty(
        uint256 indexed tokenId,
        address indexed patron,
        uint256 amountRecieved
    );
    event CollectLoyalty(address indexed patron, uint256 amountRecieved);

    event ArtistCommission(
        uint256 indexed tokenId,
        address artist,
        uint256 artistCommission
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

    // This modifier MUST be called anytime before the `benefactorTotalTokenNumerator[benefactor]` value changes.
    modifier updateBenefactorBalance(address benefactor) {
        _updateBenefactorBalance(benefactor);
        _;
    }

    modifier priceGreaterThanZero(uint256 _newPrice) {
        require(_newPrice > 0, "Price is zero");
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

    function initialize(
        address _assetToken,
        address _admin,
        address _mintManager,
        uint256 _benefactorWithdrawalThrottle
    ) public initializer {
        assetToken = ERC721Patronage_v1(_assetToken);
        admin = _admin;
        mintManager = MintManager_v2(_mintManager);
        benefactorWithdrawalThrottle = _benefactorWithdrawalThrottle;
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
        uint256[] memory _tokenGenerationRate,
        address[] memory _artists,
        uint256[] memory _artistCommission,
        uint256[] memory _releaseDate
    ) public onlyAdmin {
        assert(tokens.length == _benefactors.length);
        assert(tokens.length == _patronageNumerator.length);
        assert(tokens.length == _tokenGenerationRate.length);
        assert(tokens.length == _artists.length);
        assert(tokens.length == _artistCommission.length);
        assert(tokens.length == _releaseDate.length);

        for (uint8 i = 0; i < tokens.length; ++i) {
            address benefactor = _benefactors[i];
            assert(_benefactors[i] != address(0));
            string memory idString = uintToStr(tokens[i]);
            string memory tokenUriBase = "https://wildcards.xyz/token/";
            string memory tokenUri = string(
                abi.encodePacked(tokenUriBase, idString)
            );
            assetToken.mintWithTokenURI(address(this), tokens[i], tokenUri);
            benefactors[tokens[i]] = _benefactors[i];
            state[tokens[i]] = StewardState.Foreclosed;
            timeLastCollected[tokens[i]] = now;
            patronageNumerator[tokens[i]] = _patronageNumerator[i];
            tokenGenerationRate[tokens[i]] = _tokenGenerationRate[i];

            if (_releaseDate[i] < now) {
                tokenAuctionBeginTimestamp[i] = now;
            } else {
                tokenAuctionBeginTimestamp[i] = _releaseDate[i];
            }
            emit AddToken(
                tokens[i],
                _patronageNumerator[i],
                _tokenGenerationRate[i],
                tokenAuctionBeginTimestamp[i]
            );
            // Adding this after the add token emit, so graph can first capture the token before processing the change artist things
            changeArtistAddressAndCommission(
                tokens[i],
                _artists[i],
                _artistCommission[i]
            );

            // // No need to initialize this.
            // if (benefactorLastTimeCollected[benefactor] == 0) {
            //     benefactorLastTimeCollected[benefactor] = now;
            // }
        }
    }

    function upgradeToV3(
        uint256[] memory tokens,
        address _withdrawCheckerAdmin,
        uint256 _benefactorWithdrawalThrottle
    ) public onlyAdmin {
        require(withdrawCheckerAdmin == address(0));
        withdrawCheckerAdmin = _withdrawCheckerAdmin;

        for (uint8 i = 0; i < tokens.length; ++i) {
            uint256 tokenId = tokens[i];
            address currentOwner = currentPatron[tokenId];

            // NOTE: for this upgrade we make sure no tokens are foreclosed, or close to foreclosing

            uint256 collection = price[tokenId]
                .mul(now.sub(timeLastCollected[tokenId]))
                .mul(patronageNumerator[tokenId])
                .div(1000000000000)
                .div(365 days);

            // timeLastCollected[tokenId] = now; // This variable is depricated, no need to update it.
            timeLastCollectedPatron[currentOwner] = now;

            deposit[currentOwner] = deposit[currentOwner].sub(
                patronageOwedPatron(currentOwner)
            );

            benefactorFunds[benefactors[tokenId]] = benefactorFunds[benefactors[tokenId]]
                .add(collection);

            emit CollectPatronage(
                tokenId,
                currentOwner,
                deposit[currentOwner],
                collection
            );

            _collectLoyaltyPatron(
                currentOwner,
                now.sub(timeLastCollected[tokenId])
            );

            totalPatronTokenGenerationRate[currentOwner] = totalPatronTokenGenerationRate[currentOwner]
                .add(11574074074074);

            address tokenBenefactor = benefactors[tokenId];

            benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
                .add(price[tokenId].mul(patronageNumerator[tokenId]));

            if (benefactorLastTimeCollected[tokenBenefactor] == 0) {
                benefactorLastTimeCollected[tokenBenefactor] = now;
            }
        }

        benefactorWithdrawalThrottle = _benefactorWithdrawalThrottle;
    }

    function changeReceivingBenefactor(
        uint256 tokenId,
        address payable _newReceivingBenefactor
    ) public onlyReceivingBenefactorOrAdmin(tokenId) {
        address oldBenfactor = benefactors[tokenId];
        require(
            oldBenfactor != _newReceivingBenefactor,
            "Cannot change to same address"
        );
        benefactors[tokenId] = _newReceivingBenefactor;
        benefactorFunds[_newReceivingBenefactor] = benefactorFunds[_newReceivingBenefactor]
            .add(benefactorFunds[oldBenfactor]);
        benefactorFunds[oldBenfactor] = 0;
    }

    function changeAdmin(address _admin) public onlyAdmin {
        admin = _admin;
    }

    // This is a backdoor to prevent organisation withdrawal. Must be monitored and thrown away eventually.
    function changeBenefactorWithdrawalThrottle(
        uint256 _benefactorWithdrawalThrottle
    ) public onlyAdmin {
        benefactorWithdrawalThrottle = _benefactorWithdrawalThrottle;
    }

    function changeWithdrawCheckerAdmin(address _withdrawCheckerAdmin)
        public
        onlyAdmin
    {
        withdrawCheckerAdmin = _withdrawCheckerAdmin;
    }

    function setGlobal(uint256 _globalBenefactorDailyWithdrawalLimit)
        external
        onlyAdmin
    {
        globalBenefactorDailyWithdrawalLimit = _globalBenefactorDailyWithdrawalLimit;
    }

    function changeArtistAddressAndCommission(
        uint256 tokenId,
        address artistAddress,
        uint256 percentage
    ) public onlyAdmin {
        require(percentage <= 2000, "Cannot be more than 20%");
        artistPercentages[tokenId] = percentage;
        artistAddresses[tokenId] = artistAddress;
        emit ArtistCommission(tokenId, artistAddress, percentage);
    }

    function changeAuctionParameters(
        uint256 _auctionStartPrice,
        uint256 _auctionEndPrice,
        uint256 _auctionLength
    ) external onlyAdmin {
        require(
            _auctionStartPrice >= _auctionEndPrice,
            "Auction value must decrease over time"
        );
        require(_auctionLength >= 86400, "Auction should last at least day");

        auctionStartPrice = _auctionStartPrice;
        auctionEndPrice = _auctionEndPrice;
        auctionLength = _auctionLength;
    }

    // TODO: this function needs to be deprecated - only used in the tests
    function patronageOwed(uint256 tokenId)
        public
        view
        returns (uint256 patronageDue)
    {

            uint256 timeLastCollected
         = timeLastCollectedPatron[currentPatron[tokenId]];

        if (timeLastCollected == 0) return 0;

        uint256 owed = price[tokenId]
            .mul(now.sub(timeLastCollected))
            .mul(patronageNumerator[tokenId])
            .div(1000000000000)
            .div(365 days);
        console.log(owed, "due - owed");

        return owed;
    }

    // TODO: this function needs to be deprecated - only used in the tests
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

    // Purely for debugging
    function nowTime() public view returns (uint256) {
        return now;
    }

    function unclaimedPayoutDueForOrganisation(address benefactor)
        public
        view
        returns (uint256 payoutDue)
    {
        return
            benefactorTotalTokenNumerator[benefactor]
                .mul(now.sub(benefactorLastTimeCollected[benefactor]))
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

    /* actions */
    function _collectLoyaltyPatron(
        address tokenPatron,
        uint256 timeSinceLastMint
    ) internal {
        mintManager.tokenMint(
            tokenPatron,
            timeSinceLastMint,
            totalPatronTokenGenerationRate[tokenPatron]
        );
        emit CollectLoyalty(tokenPatron, timeSinceLastMint);
    }

    function _collectPatronage(uint256 tokenId) public {
        // console.log("collect patronage");
        // TODO: lots of this code is duplicated in the `_collectPatronagePatron` function. Refactor accordingly.
        if (state[tokenId] == StewardState.Owned) {
            // console.log(" token is owned!");
            address tokenPatron = currentPatron[tokenId];

            // _collectPatronagePatron(currentPatron[tokenId]);
            uint256 patronageOwedByTokenPatron = patronageOwedPatron(
                tokenPatron
            );

            uint256 timeSinceLastMint;

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
                timeSinceLastMint = (
                    newTimeLastCollected.sub(previousCollectionTime)
                );

                // The bellow 3 lines are the main difference between this function and the `_collectPatronagePatron` function.
                _collectLoyaltyPatron(tokenPatron, timeSinceLastMint); // NOTE: you have to call collectLoyaltyPatron before collecting your deposit.
                tokenAuctionBeginTimestamp[tokenId] = newTimeLastCollected;
                _foreclose(tokenId);

                address benefactor = benefactors[tokenId];

                // If the organisation collected their patronage after this token was foreclosed, then record the credit they have been given.
                if (
                    benefactorLastTimeCollected[benefactor] >
                    newTimeLastCollected
                ) {
                    benefactorCredit[benefactor] = price[tokenId].mul(
                        benefactorLastTimeCollected[benefactor].sub(
                            newTimeLastCollected
                        )
                    );

                    // // NOTE: the below code is slightly more involved, but effectively should do the same thing as the above line that updates the `benefactorCredit[benefactor]`
                    // uint256 amountOverPaidToBenefactorOnToken = price[tokenId]
                    //     .mul(
                    //     benefactorLastTimeCollected[benefactor].sub(
                    //         newTimeLastCollected
                    //     )
                    // )
                    //     .mul(patronageNumerator[tokenId])
                    //     .div(1000000000000)
                    //     .div(365 days);

                    // if (
                    //     amountOverPaidToBenefactorOnToken >
                    //     benefactorFunds[benefactor]
                    // ) {
                    //     benefactorCredit[benefactor] = amountOverPaidToBenefactorOnToken;
                    // } else {
                    //     benefactorFunds[benefactor] = benefactorFunds[benefactor]
                    //         .sub(amountOverPaidToBenefactorOnToken);
                    // }
                }
            } else {
                // console.log(" token is still owned");
                timeSinceLastMint = now.sub(
                    timeLastCollectedPatron[tokenPatron]
                );
                timeLastCollectedPatron[tokenPatron] = now;
                console.log(
                    "patronageOwedByTokenPatron",
                    patronageOwedByTokenPatron
                );
                deposit[tokenPatron] = deposit[tokenPatron].sub(
                    patronageOwedByTokenPatron
                );
                _collectLoyaltyPatron(tokenPatron, timeSinceLastMint);
            }

            emit RemainingDepositUpdate(tokenPatron, deposit[tokenPatron]);
        }
    }

    function safeSend(uint256 _wei, address recipient)
        internal
        returns (bool transferSuccess)
    {
        (transferSuccess, ) = recipient.call.gas(2300).value(_wei)("");
    }

    // Think carefully if it is a risk to make this public?
    function _updateBenefactorBalance(address benefactor) public {
        uint256 unclaimedPayoutAvailable = unclaimedPayoutDueForOrganisation(
            benefactor
        );

        if (unclaimedPayoutAvailable > 0) {
            if (
                unclaimedPayoutAvailable.add(benefactorFunds[benefactor]) <
                benefactorCredit[benefactor]
            ) {
                // Here there is nothing left extra to pay the organisation, everything goes to paying of debt.
                benefactorCredit[benefactor] = benefactorCredit[benefactor].sub(
                    unclaimedPayoutAvailable.add(benefactorFunds[benefactor])
                );
            } else {
                benefactorFunds[benefactor] = unclaimedPayoutAvailable
                    .add(benefactorFunds[benefactor])
                    .sub(benefactorCredit[benefactor]);

                benefactorCredit[benefactor] = 0;
            }
        }

        // console.log("UPDATE THE BENEFACTOR BALANCE");
        // console.log("UPDATE THE BENEFACTOR BALANCE");
        // console.log("UPDATE THE BENEFACTOR BALANCE");
        // console.log(now, benefactor);
        benefactorLastTimeCollected[benefactor] = now;
    }

    function withdrawBenefactorFundsTo(address payable benefactor) public {
        require(
            // QUESTION? Should this 1 day throttle limit be configurable?
            benefactorLastTimeCollected[benefactor].add(
                benefactorWithdrawalThrottle
            ) <= now,
            "Cannot call this function more than once a day"
        );

        _updateBenefactorBalance(benefactor);

        uint256 availableToWithdraw = benefactorFunds[benefactor];

        require(availableToWithdraw > 0, "No funds available");

        if (availableToWithdraw > globalBenefactorDailyWithdrawalLimit) {
            if (safeSend(globalBenefactorDailyWithdrawalLimit, benefactor)) {
                benefactorFunds[benefactor] = availableToWithdraw.sub(
                    globalBenefactorDailyWithdrawalLimit
                );
            } else {
                benefactorFunds[benefactor] = availableToWithdraw;
            }
        } else {
            if (safeSend(globalBenefactorDailyWithdrawalLimit, benefactor)) {
                benefactorFunds[benefactor] = 0;
            } else {
                benefactorFunds[benefactor] = availableToWithdraw;
            }
        }
    }

    function withdrawBenefactorFundsToValidated(
        address payable benefactor,
        uint256 maxAmount,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        // require(ecrecover(/* TODO */, v, r, s) == withdrawCheckerAdmin, "No permission to withdraw");

        _updateBenefactorBalance(benefactor);

        uint256 availableToWithdraw = benefactorFunds[benefactor];

        if (availableToWithdraw > 0) {
            if (availableToWithdraw > maxAmount) {
                if (
                    safeSend(globalBenefactorDailyWithdrawalLimit, benefactor)
                ) {
                    benefactorFunds[benefactor] = availableToWithdraw.sub(
                        globalBenefactorDailyWithdrawalLimit
                    );
                } else {
                    benefactorFunds[benefactor] = availableToWithdraw;
                }
            } else {
                if (
                    safeSend(globalBenefactorDailyWithdrawalLimit, benefactor)
                ) {
                    benefactorFunds[benefactor] = 0;
                } else {
                    benefactorFunds[benefactor] = availableToWithdraw;
                }
            }
        }
    }

    function _collectPatronagePatron(address tokenPatron) public {
        uint256 patronageOwedByTokenPatron = patronageOwedPatron(tokenPatron);

        uint256 timeSinceLastMint;

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
            timeSinceLastMint = (
                newTimeLastCollected.sub(previousCollectionTime)
            );
        } else {
            timeSinceLastMint = now.sub(timeLastCollectedPatron[tokenPatron]);
            timeLastCollectedPatron[tokenPatron] = now;
            deposit[tokenPatron] = deposit[tokenPatron].sub(
                patronageOwedByTokenPatron
            );
        }

        _collectLoyaltyPatron(tokenPatron, timeSinceLastMint);
        emit RemainingDepositUpdate(tokenPatron, deposit[tokenPatron]);
    }

    function depositWei() public payable {
        depositWeiPatron(msg.sender);
    }

    function depositWeiPatron(address patron) public payable {
        require(totalPatronOwnedTokenCost[patron] > 0, "No tokens owned");
        deposit[patron] = deposit[patron].add(msg.value);
        emit RemainingDepositUpdate(patron, deposit[patron]);
    }

    function _auctionPrice(uint256 tokenId) internal view returns (uint256) {
        uint256 auctionEnd = tokenAuctionBeginTimestamp[tokenId].add(
            auctionLength
        );
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
                        .mul(now.sub(tokenAuctionBeginTimestamp[tokenId]))
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
        updateBenefactorBalance(benefactors[tokenId])
        collectPatronageAddress(msg.sender)
        priceGreaterThanZero(_newPrice)
        validWildcardsPercentage(wildcardsPercentage, tokenId)
    {
        require(
            state[tokenId] == StewardState.Owned,
            "Cannot buy foreclosed token using this function"
        );
        uint256 remainingValueForDeposit = msg.value.sub(price[tokenId]);
        require(
            remainingValueForDeposit >= _deposit,
            "The deposit available is < what was stated in the transaction"
        );

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
        updateBenefactorBalance(benefactors[tokenId])
        collectPatronageAddress(msg.sender)
        priceGreaterThanZero(_newPrice)
        validWildcardsPercentage(wildcardsPercentage, tokenId)
    {
        // console.log("new price", _newPrice, "of token", tokenId);
        require(
            state[tokenId] == StewardState.Foreclosed,
            "Can only buy foreclosed tokens useing this function"
        );
        require(
            now >= tokenAuctionBeginTimestamp[tokenId],
            "Token is not yet released"
        );
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
        uint256 artistAmount;
        if (artistPercentages[tokenId] == 0) {
            artistAmount = 0;
        } else {
            artistAmount = totalAmount.mul(artistPercentages[tokenId]).div(
                10000
            );
        }
        uint256 wildcardsAmount = totalAmount.sub(artistAmount);
        deposit[artistAddresses[tokenId]] = deposit[artistAddresses[tokenId]]
            .add(artistAmount);
        deposit[admin] = deposit[admin].add(wildcardsAmount);
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
        uint256 artistAmount;
        if (artistPercentages[tokenId] == 0) {
            artistAmount = 0;
        } else {
            artistAmount = totalAmount.mul(artistPercentages[tokenId]).div(
                10000
            );
        }

        uint256 previousOwnerProceedsFromSale = totalAmount
            .sub(wildcardsAmount)
            .sub(artistAmount);
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
            (bool transferSuccess, ) = payableCurrentPatron
                .call
                .gas(2300)
                .value(previousOwnerProceedsFromSale)("");
            if (!transferSuccess) {
                deposit[tokenPatron] = deposit[tokenPatron].add(
                    previousOwnerProceedsFromSale
                );
            }
        } else {
            deposit[tokenPatron] = deposit[tokenPatron].add(
                previousOwnerProceedsFromSale
            );
        }

        deposit[artistAddresses[tokenId]] = deposit[artistAddresses[tokenId]]
            .add(artistAmount);
        deposit[admin] = deposit[admin].add(wildcardsAmount);
    }

    function changePrice(uint256 tokenId, uint256 _newPrice)
        public
        onlyPatron(tokenId)
        collectPatronage(tokenId)
        updateBenefactorBalance(benefactors[tokenId])
    {
        require(state[tokenId] != StewardState.Foreclosed, "Foreclosed");
        require(_newPrice != 0, "Incorrect Price");

        uint256 oldPriceScaled = price[tokenId].mul(
            patronageNumerator[tokenId]
        );
        uint256 newPriceScaled = _newPrice.mul(patronageNumerator[tokenId]);
        address tokenBenefactor = benefactors[tokenId];

        totalPatronOwnedTokenCost[msg.sender] = totalPatronOwnedTokenCost[msg
            .sender]
            .sub(oldPriceScaled)
            .add(newPriceScaled);

        benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
            .sub(oldPriceScaled)
            .add(newPriceScaled);

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

    function exit() public collectPatronageAddress(msg.sender) {
        _withdrawDeposit(deposit[msg.sender]);
    }

    function _withdrawDeposit(uint256 _wei) internal {
        require(deposit[msg.sender] >= _wei, "Withdrawing too much");

        deposit[msg.sender] = deposit[msg.sender].sub(_wei);

        (bool transferSuccess, ) = msg.sender.call.gas(2300).value(_wei)("");
        if (!transferSuccess) {
            revert("Unable to withdraw deposit");
        }
    }

    function _foreclose(uint256 tokenId) internal {
        address currentOwner = assetToken.ownerOf(tokenId);
        address tokenPatron = currentPatron[tokenId];
        resetTokenOnForeclosure(tokenId, currentOwner, tokenPatron);
        state[tokenId] = StewardState.Foreclosed;

        emit Foreclosure(currentOwner, timeLastCollected[tokenId]);
    }

    function transferAssetTokenTo(
        uint256 tokenId,
        address _currentOwner,
        address _currentPatron,
        address _newOwner,
        uint256 _newPrice
    ) internal {
        uint256 scaledOldPrice = price[tokenId].mul(
            patronageNumerator[tokenId]
        );
        uint256 scaledNewPrice = _newPrice.mul(patronageNumerator[tokenId]);

        totalPatronOwnedTokenCost[_newOwner] = totalPatronOwnedTokenCost[_newOwner]
            .add(scaledNewPrice);
        totalPatronTokenGenerationRate[_newOwner] = totalPatronTokenGenerationRate[_newOwner]
            .add(tokenGenerationRate[tokenId]);

        address tokenBenefactor = benefactors[tokenId];
        benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
            .add(scaledNewPrice);

        if (_currentPatron != address(this) && _currentPatron != address(0)) {
            totalPatronOwnedTokenCost[_currentPatron] = totalPatronOwnedTokenCost[_currentPatron]
                .sub(scaledOldPrice);

            totalPatronTokenGenerationRate[_currentPatron] = totalPatronTokenGenerationRate[_currentPatron]
                .sub((tokenGenerationRate[tokenId]));

            benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
                .sub(scaledOldPrice);
        }

        timeHeld[tokenId][_currentPatron] = timeHeld[tokenId][_currentPatron]
            .add((timeLastCollected[tokenId].sub(timeAcquired[tokenId])));
        assetToken.transferFrom(_currentOwner, _newOwner, tokenId);
        currentPatron[tokenId] = _newOwner;

        price[tokenId] = _newPrice;
        // console.log("SET THE NEW PRICE for token:", tokenId);
        // console.log(price[tokenId]);
        timeAcquired[tokenId] = now;
        patrons[tokenId][_newOwner] = true;
    }

    function resetTokenOnForeclosure(
        uint256 tokenId,
        address _currentOwner,
        address _currentPatron
    ) internal {
        uint256 scaledPrice = price[tokenId].mul(patronageNumerator[tokenId]);

        totalPatronOwnedTokenCost[_currentPatron] = totalPatronOwnedTokenCost[_currentPatron]
            .sub(scaledPrice);

        totalPatronTokenGenerationRate[_currentPatron] = totalPatronTokenGenerationRate[_currentPatron]
            .sub((tokenGenerationRate[tokenId]));

        address tokenBenefactor = benefactors[tokenId];
        benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
            .sub(scaledPrice);

        timeHeld[tokenId][_currentPatron] = timeHeld[tokenId][_currentPatron]
            .add((timeLastCollected[tokenId].sub(timeAcquired[tokenId])));
        assetToken.transferFrom(_currentOwner, address(this), tokenId);
        currentPatron[tokenId] = address(this);
    }
}

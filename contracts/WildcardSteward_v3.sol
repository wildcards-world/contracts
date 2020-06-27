pragma solidity 0.5.17;

import "./ERC721Patronage_v1.sol";
import "./MintManager_v2.sol";

import "@nomiclabs/buidler/console.sol";

/*
31536000 seconds = 365 days

divisor = 365 days * 1000000000000
        = 31536000000000000000
*/

contract WildcardSteward_v3 is Initializable {
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

    mapping(uint256 => uint256) public deprecated_totalCollected; // THIS VALUE IS DEPRECATED
    mapping(uint256 => uint256) public deprecated_currentCollected; // THIS VALUE IS DEPRECATED
    mapping(uint256 => uint256) public deprecated_timeLastCollected; // THIS VALUE IS DEPRECATED.
    mapping(address => uint256) public timeLastCollectedPatron;
    mapping(address => uint256) public deposit;
    mapping(address => uint256) public totalPatronOwnedTokenCost;

    mapping(uint256 => address) public benefactors; // non-profit benefactor
    mapping(address => uint256) public benefactorFunds;

    mapping(uint256 => address) public deprecated_currentPatron; // Deprecate This is different to the current token owner.
    mapping(uint256 => mapping(address => bool)) public deprecated_patrons; // Deprecate
    mapping(uint256 => mapping(address => uint256)) public deprecated_timeHeld; // Deprecate

    mapping(uint256 => uint256) public deprecate_timeAcquired; // deprecate

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
    address public withdrawCheckerAdmin;

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
    event WithdrawBenefactorFundsWithSafetyDelay(
        address indexed benefactor,
        uint256 withdrawAmount
    );
    event WithdrawBenefactorFunds(
        address indexed benefactor,
        uint256 withdrawAmount
    );
    event UpgradeToV3();

    modifier onlyPatron(uint256 tokenId) {
        require(msg.sender == assetToken.ownerOf(tokenId), "Not patron");
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
        address _withdrawCheckerAdmin,
        uint256 _auctionStartPrice,
        uint256 _auctionEndPrice,
        uint256 _auctionLength
    ) public initializer {
        assetToken = ERC721Patronage_v1(_assetToken);
        admin = _admin;
        withdrawCheckerAdmin = _withdrawCheckerAdmin;
        mintManager = MintManager_v2(_mintManager);
        _changeAuctionParameters(
            _auctionStartPrice,
            _auctionEndPrice,
            _auctionLength
        );
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
            patronageNumerator[tokens[i]] = _patronageNumerator[i];
            tokenGenerationRate[tokens[i]] = _tokenGenerationRate[i];

            if (_releaseDate[i] < now) {
                tokenAuctionBeginTimestamp[tokens[i]] = now;
            } else {
                tokenAuctionBeginTimestamp[tokens[i]] = _releaseDate[i];
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
        uint256 _auctionStartPrice,
        uint256 _auctionEndPrice,
        uint256 _auctionLength
    ) public {
        // This function effectively needs to call both _collectPatronage and _collectPatronagePatron from the v2 contract.
        require(withdrawCheckerAdmin == address(0));
        withdrawCheckerAdmin = _withdrawCheckerAdmin;
        // For each token
        for (uint8 i = 0; i < tokens.length; ++i) {
            uint256 tokenId = tokens[i];
            address currentOwner = assetToken.ownerOf(tokenId);

            // NOTE: for this upgrade we make sure no tokens are foreclosed, or close to foreclosing
            uint256 collection = price[tokenId]
                .mul(now.sub(deprecated_timeLastCollected[tokenId]))
                .mul(patronageNumerator[tokenId])
                .div(1000000000000)
                .div(365 days);

            // set the timeLastCollectedPatron for that tokens owner to 'now'.
            // timeLastCollected[tokenId] = now; // This variable is depricated, no need to update it.
            if (timeLastCollectedPatron[currentOwner] < now) {
                timeLastCollectedPatron[currentOwner] = now;
            }

            // set subtract patronage owed for the Patron from their deposit.
            deposit[currentOwner] = deposit[currentOwner].sub(
                patronageOwedPatron(currentOwner)
            );

            // Add the amount collected for current token to the benefactorFunds.
            benefactorFunds[benefactors[tokenId]] = benefactorFunds[benefactors[tokenId]]
                .add(collection);

            // Emit an event for the graph to pickup this action (the last time this event will ever be emited)
            emit CollectPatronage(
                tokenId,
                currentOwner,
                deposit[currentOwner],
                collection
            );

            // Collect the due loyalty tokens for the user
            if (currentOwner != address(0)) {
                _collectLoyaltyPatron(
                    currentOwner,
                    now.sub(deprecated_timeLastCollected[tokenId])
                );
            }

            // Add the tokens generation rate to the totalPatronTokenGenerationRate of the current owner
            totalPatronTokenGenerationRate[currentOwner] = totalPatronTokenGenerationRate[currentOwner]
            // 11574074074074 = 10^18 / 86400 This is just less (rounded down) than one token a day.
            //       - this can be done since all tokens have the exact same tokenGenerationRate - and hardcoding saves gas.
                .add(11574074074074);

            address tokenBenefactor = benefactors[tokenId];
            // add the scaled tokens price to the `benefactorTotalTokenNumerator`
            benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
                .add(price[tokenId].mul(patronageNumerator[tokenId]));

            // add the scaled tokens price to the `benefactorTotalTokenNumerator`
            if (benefactorLastTimeCollected[tokenBenefactor] == 0) {
                benefactorLastTimeCollected[tokenBenefactor] = now;
            }
        }
        _changeAuctionParameters(
            _auctionStartPrice,
            _auctionEndPrice,
            _auctionLength
        );
        emit UpgradeToV3();
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

    function changeWithdrawCheckerAdmin(address _withdrawCheckerAdmin)
        public
        onlyAdmin
    {
        withdrawCheckerAdmin = _withdrawCheckerAdmin;
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

    function _changeAuctionParameters(
        uint256 _auctionStartPrice,
        uint256 _auctionEndPrice,
        uint256 _auctionLength
    ) internal {
        require(
            _auctionStartPrice >= _auctionEndPrice,
            "Auction value must decrease over time"
        );
        require(_auctionLength >= 86400, "Auction should last at least day");

        auctionStartPrice = _auctionStartPrice;
        auctionEndPrice = _auctionEndPrice;
        auctionLength = _auctionLength;
    }

    function changeAuctionParameters(
        uint256 _auctionStartPrice,
        uint256 _auctionEndPrice,
        uint256 _auctionLength
    ) external onlyAdmin {
        _changeAuctionParameters(
            _auctionStartPrice,
            _auctionEndPrice,
            _auctionLength
        );
    }

    // TODO: this function needs to be deprecated - only used in the tests
    function patronageOwed(uint256 tokenId)
        public
        view
        returns (uint256 patronageDue)
    {

            uint256 tokenTimeLastCollectedPatron
         = timeLastCollectedPatron[assetToken.ownerOf(tokenId)];

        if (tokenTimeLastCollectedPatron == 0) return 0;

        uint256 owed = price[tokenId]
            .mul(now.sub(tokenTimeLastCollectedPatron))
            .mul(patronageNumerator[tokenId])
            .div(1000000000000)
            .div(365 days);

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

    function unclaimedPayoutDueForOrganisation(address benefactor)
        public
        view
        returns (uint256 payoutDue)
    {
        uint256 timePassed = now.sub(benefactorLastTimeCollected[benefactor]);
        return
            benefactorTotalTokenNumerator[benefactor]
                .mul(timePassed)
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
        address tokenPatron = assetToken.ownerOf(tokenId);
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
        address tokenPatron = assetToken.ownerOf(tokenId);
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
        if (state[tokenId] == StewardState.Owned) {
            address tokenPatron = assetToken.ownerOf(tokenId);

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
                tokenAuctionBeginTimestamp[tokenId] = newTimeLastCollected + 1; // The auction starts the second after the last time collected.
                _foreclose(tokenId);

                address benefactor = benefactors[tokenId];

                // If the organisation collected their patronage after this token was foreclosed, then record the credit they have been given.
                if (
                    benefactorLastTimeCollected[benefactor] >
                    newTimeLastCollected
                ) {
                    benefactorCredit[benefactor] = benefactorCredit[benefactor]
                        .add(
                        price[tokenId]
                            .mul(
                            (
                                benefactorLastTimeCollected[benefactor].sub(
                                    newTimeLastCollected
                                )
                            )
                        )
                            .mul(patronageNumerator[tokenId])
                            .div(31536000000000000000) // 365 days * 1000000000000
                    );
                }
            } else {
                timeSinceLastMint = now.sub(
                    timeLastCollectedPatron[tokenPatron]
                );
                timeLastCollectedPatron[tokenPatron] = now;
                deposit[tokenPatron] = deposit[tokenPatron].sub(
                    patronageOwedByTokenPatron
                );
                _collectLoyaltyPatron(tokenPatron, timeSinceLastMint);
            }

            emit RemainingDepositUpdate(tokenPatron, deposit[tokenPatron]);
        }
    }

    function safeSend(uint256 _wei, address payable recipient)
        internal
        returns (bool transferSuccess)
    {
        (transferSuccess, ) = recipient.call.gas(2300).value(_wei)("");
    }

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
                benefactorFunds[benefactor] = benefactorFunds[benefactor]
                    .add(unclaimedPayoutAvailable)
                    .sub(benefactorCredit[benefactor]);

                benefactorCredit[benefactor] = 0;
            }
        }

        benefactorLastTimeCollected[benefactor] = now;
    }

    function fundsDueForAuctionPeriodAtCurrentRate(address benefactor)
        internal
        view
        returns (uint256)
    {
        return
            benefactorTotalTokenNumerator[benefactor].mul(auctionLength).div(
                31536000000000000000
            ); // 365 days * 1000000000000
    }

    function withdrawBenefactorFundsTo(address payable benefactor) public {
        _updateBenefactorBalance(benefactor);

        uint256 availableToWithdraw = benefactorFunds[benefactor];


            uint256 benefactorWithdrawalSafetyDiscount
         = fundsDueForAuctionPeriodAtCurrentRate(benefactor);

        require(
            availableToWithdraw > benefactorWithdrawalSafetyDiscount,
            "No funds available"
        );

        // NOTE: no need for safe-maths, above require prevents issues.
        uint256 amountToWithdraw = availableToWithdraw -
            benefactorWithdrawalSafetyDiscount;

        benefactorFunds[benefactor] = benefactorWithdrawalSafetyDiscount;
        if (safeSend(amountToWithdraw, benefactor)) {
            emit WithdrawBenefactorFundsWithSafetyDelay(
                benefactor,
                amountToWithdraw
            );
        } else {
            benefactorFunds[benefactor] = benefactorFunds[benefactor].add(
                amountToWithdraw
            );
        }
    }

    function hasher(
        address benefactor,
        uint256 maxAmount,
        uint256 expiry
    ) public view returns (bytes32) {
        // In ethereum you have to prepend all signature hashes with this message (supposedly to prevent people from)
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    keccak256(abi.encodePacked(benefactor, maxAmount, expiry))
                )
            );
    }

    function withdrawBenefactorFundsToValidated(
        address payable benefactor,
        uint256 maxAmount,
        uint256 expiry,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(
            ecrecover(hash, v, r, s) == withdrawCheckerAdmin,
            "No permission to withdraw"
        );
        require(
            hash == hasher(benefactor, maxAmount, expiry),
            "Incorrect parameters"
        );
        require(now < expiry, "coupon has expired");

        _updateBenefactorBalance(benefactor);

        uint256 availableToWithdraw = benefactorFunds[benefactor];

        if (availableToWithdraw > 0) {
            if (availableToWithdraw > maxAmount) {
                if (safeSend(maxAmount, benefactor)) {
                    benefactorFunds[benefactor] = availableToWithdraw.sub(
                        maxAmount
                    );
                    emit WithdrawBenefactorFunds(
                        benefactor,
                        availableToWithdraw
                    );
                } else {
                    console.log("UNABLE TO SEND...");
                }
            } else {
                if (safeSend(availableToWithdraw, benefactor)) {
                    benefactorFunds[benefactor] = 0;
                    emit WithdrawBenefactorFunds(
                        benefactor,
                        availableToWithdraw
                    );
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
        timeLastCollectedPatron[msg.sender] = now;

        wildcardsPercentages[tokenId] = wildcardsPercentage;
        deposit[msg.sender] = deposit[msg.sender].add(remainingValueForDeposit);
        transferAssetTokenTo(
            tokenId,
            assetToken.ownerOf(tokenId),
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
        address tokenPatron = assetToken.ownerOf(tokenId);
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
        require(_newPrice < 10000 ether, "exceeded max price");

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
        _updateBenefactorBalance(benefactors[tokenId]);

        address currentOwner = assetToken.ownerOf(tokenId);
        resetTokenOnForeclosure(tokenId, currentOwner);
        state[tokenId] = StewardState.Foreclosed;

        emit Foreclosure(currentOwner, timeLastCollectedPatron[currentOwner]);
    }

    function transferAssetTokenTo(
        uint256 tokenId,
        address _currentOwner,
        address _newOwner,
        uint256 _newPrice
    ) internal {
        require(_newPrice < 10000 ether, "exceeded max price");

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

        if (_currentOwner != address(this) && _currentOwner != address(0)) {
            totalPatronOwnedTokenCost[_currentOwner] = totalPatronOwnedTokenCost[_currentOwner]
                .sub(scaledOldPrice);

            totalPatronTokenGenerationRate[_currentOwner] = totalPatronTokenGenerationRate[_currentOwner]
                .sub((tokenGenerationRate[tokenId]));

            benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
                .sub(scaledOldPrice);
        }

        assetToken.transferFrom(_currentOwner, _newOwner, tokenId);

        price[tokenId] = _newPrice;
    }

    function resetTokenOnForeclosure(uint256 tokenId, address _currentOwner)
        internal
    {
        uint256 scaledPrice = price[tokenId].mul(patronageNumerator[tokenId]);

        totalPatronOwnedTokenCost[_currentOwner] = totalPatronOwnedTokenCost[_currentOwner]
            .sub(scaledPrice);

        totalPatronTokenGenerationRate[_currentOwner] = totalPatronTokenGenerationRate[_currentOwner]
            .sub((tokenGenerationRate[tokenId]));

        address tokenBenefactor = benefactors[tokenId];
        benefactorTotalTokenNumerator[tokenBenefactor] = benefactorTotalTokenNumerator[tokenBenefactor]
            .sub(scaledPrice);

        assetToken.transferFrom(_currentOwner, address(this), tokenId);
    }
}

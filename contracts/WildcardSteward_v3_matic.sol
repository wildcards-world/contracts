pragma solidity 0.6.12;

import "../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/math/SafeMath.sol";
import "../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/Initializable.sol";

import "./ERC721Patronage_v1.sol";
import "./interfaces/IMintManager.sol";
import "./interfaces/IERC721Patronage.sol";
// import "./interfaces/IERC20Mintable.sol";

import "./BasicMetaTransaction.sol";

import "./Dai.sol";

// import "./GSNRecipientBase.sol";

// import "../vendered/gsn-2.0.0-beta.1.3/contracts/BaseRelayRecipient.sol";
// import "../vendered/gsn-2.0.0-beta.1.3/contracts/interfaces/IKnowForwarderAddressGsn.sol";

// import "@nomiclabs/buidler/console.sol";

contract WildcardSteward_v3_matic is Initializable, BasicMetaTransaction {
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
    IERC721Patronage public assetToken; // ERC721 NFT.

    mapping(uint256 => uint256) deprecated_totalCollected; // THIS VALUE IS DEPRECATED
    mapping(uint256 => uint256) deprecated_currentCollected; // THIS VALUE IS DEPRECATED
    mapping(uint256 => uint256) deprecated_timeLastCollected; // THIS VALUE IS DEPRECATED.
    mapping(address => uint256) public timeLastCollectedPatron;
    mapping(address => uint256) public deposit;
    mapping(address => uint256) public totalPatronOwnedTokenCost;

    mapping(uint256 => address) public benefactors; // non-profit benefactor
    mapping(address => uint256) public benefactorFunds;

    mapping(uint256 => address) deprecated_currentPatron; // Deprecate This is different to the current token owner.
    mapping(uint256 => mapping(address => bool)) deprecated_patrons; // Deprecate
    mapping(uint256 => mapping(address => uint256)) deprecated_timeHeld; // Deprecate

    mapping(uint256 => uint256) deprecated_timeAcquired; // deprecate

    // 1200% patronage
    mapping(uint256 => uint256) public patronageNumerator;
    uint256 public patronageDenominator;

    enum StewardState {Foreclosed, Owned}
    mapping(uint256 => StewardState) public state;

    address public admin;

    //////////////// NEW variables in v2///////////////////
    mapping(uint256 => uint256) deprecated_tokenGenerationRate; // we can reuse the patronage denominator

    IMintManager public mintManager;
    //////////////// NEW variables in v3 ///////////////////
    uint256 public auctionStartPrice;
    uint256 public auctionEndPrice;
    uint256 public auctionLength;

    mapping(uint256 => address) public artistAddresses; //mapping from tokenID to the artists address
    mapping(uint256 => uint256) public serviceProviderPercentages; // mapping from tokenID to the percentage sale cut of wildcards for each token
    mapping(uint256 => uint256) public artistPercentages; // tokenId to artist percetages. To make it configurable. 10 000 = 100%
    mapping(uint256 => uint256) public tokenAuctionBeginTimestamp;

    mapping(address => uint256) public totalPatronTokenGenerationRate; // The total token generation rate for all the tokens of the given address.
    mapping(address => uint256) public totalBenefactorTokenNumerator;
    mapping(address => uint256) public timeLastCollectedBenefactor; // make my name consistent please
    mapping(address => uint256) public benefactorCredit;
    address public withdrawCheckerAdmin;

    mapping(uint256 => bool) public withdrawalNonceUsed; // if true, the nonce (part of a withdrawal signature) has already been used for a withdrawal.

    /*
    31536000 seconds = 365 days

    divisor = 365 days * 1000000000000
            = 31536000000000000000
    */

    // 11574074074074 = 10^18 / 86400 This is just less (rounded down) than one token a day.
    //       - this can be done since all tokens have the exact same tokenGenerationRate - and hardcoding saves gas.
    uint256 public constant globalTokenGenerationRate = 11574074074074;
    uint256 public constant yearTimePatronagDenominator = 31536000000000000000;

    Dai public paymentToken; // ERC20 token used as payment.

    event Buy(uint256 indexed tokenId, address indexed owner, uint256 price);
    event PriceChange(uint256 indexed tokenId, uint256 newPrice);
    event Foreclosure(address indexed prevOwner, uint256 foreclosureTime);
    event RemainingDepositUpdate(
        address indexed tokenPatron,
        uint256 remainingDeposit
    );

    event AddTokenV3(
        uint256 indexed tokenId,
        uint256 patronageNumerator,
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
    event ChangeAuctionParameters();

    modifier onlyPatron(uint256 tokenId) {
        require(msgSender() == assetToken.ownerOf(tokenId), "Not patron");
        _;
    }

    modifier onlyAdmin() {
        require(msgSender() == admin, "Not admin");
        _;
    }

    modifier onlyReceivingBenefactorOrAdmin(uint256 tokenId) {
        require(
            msgSender() == benefactors[tokenId] || msgSender() == admin,
            "Not benefactor or admin"
        );
        _;
    }

    modifier collectPatronageAndSettleBenefactor(uint256 tokenId) {
        _collectPatronageAndSettleBenefactor(tokenId);
        _;
    }

    modifier collectPatronagePatron(address tokenPatron) {
        _collectPatronagePatron(tokenPatron);
        _;
    }

    modifier youCurrentlyAreNotInDefault(address tokenPatron) {
        require(
            !(deposit[tokenPatron] == 0 &&
                totalPatronOwnedTokenCost[tokenPatron] > 0),
            "no deposit existing tokens"
        );
        _;
    }

    modifier updateBenefactorBalance(address benefactor) {
        _updateBenefactorBalance(benefactor);
        _;
    }

    modifier priceGreaterThanZero(uint256 _newPrice) {
        require(_newPrice > 0, "Price is zero");
        _;
    }
    modifier notNullAddress(address checkAddress) {
        require(checkAddress != address(0), "null address");
        _;
    }
    modifier notSameAddress(address firstAddress, address secondAddress) {
        require(firstAddress != secondAddress, "cannot be same address");
        _;
    }
    modifier validWildcardsPercentage(
        uint256 serviceProviderPercentage,
        uint256 tokenID
    ) {
        require(
            serviceProviderPercentage >= 50000 &&
                serviceProviderPercentage <=
                (1000000 - artistPercentages[tokenID]), // not sub safemath. Is this okay?
            "commision not between 5% and 100%"
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
        uint256 _auctionLength,
        address _paymentToken
    ) public initializer {
        emit UpgradeToV3();
        assetToken = IERC721Patronage(_assetToken);
        admin = _admin;
        withdrawCheckerAdmin = _withdrawCheckerAdmin;
        mintManager = IMintManager(_mintManager);
        paymentToken = Dai(_paymentToken);
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
        address[] memory _benefactors,
        uint256[] memory _patronageNumerator,
        address[] memory _artists,
        uint256[] memory _artistCommission,
        uint256[] memory _releaseDate
    ) public onlyAdmin {
        assert(tokens.length == _benefactors.length);
        assert(tokens.length == _patronageNumerator.length);
        assert(tokens.length == _releaseDate.length);
        assert(_artists.length == _artistCommission.length);

        for (uint8 i = 0; i < tokens.length; ++i) {
            address benefactor = _benefactors[i];
            require(_benefactors[i] != address(0), "null address");
            string memory idString = uintToStr(tokens[i]);
            string memory tokenUriBase = "https://wildcards.xyz/token/";
            string memory tokenUri = string(
                abi.encodePacked(tokenUriBase, idString)
            );
            assetToken.mintWithTokenURI(address(this), tokens[i], tokenUri);
            benefactors[tokens[i]] = _benefactors[i];
            state[tokens[i]] = StewardState.Foreclosed;
            patronageNumerator[tokens[i]] = _patronageNumerator[i];
            // tokenGenerationRate[tokens[i]] = _tokenGenerationRate[i];

            if (_releaseDate[i] < now) {
                tokenAuctionBeginTimestamp[tokens[i]] = now;
            } else {
                tokenAuctionBeginTimestamp[tokens[i]] = _releaseDate[i];
            }

            emit AddTokenV3(
                tokens[i],
                _patronageNumerator[i],
                tokenAuctionBeginTimestamp[tokens[i]]
            );
            // Adding this after the add token emit, so graph can first capture the token before processing the change artist things
            if (_artists.length > i) {
                changeArtistAddressAndCommission(
                    tokens[i],
                    _artists[i],
                    _artistCommission[i]
                );
            }
        }
    }

    // TODO: you need an event in here!
    function changeReceivingBenefactor(
        uint256 tokenId,
        address _newReceivingBenefactor
    )
        public
        onlyReceivingBenefactorOrAdmin(tokenId)
        updateBenefactorBalance(benefactors[tokenId])
        updateBenefactorBalance(_newReceivingBenefactor)
        notNullAddress(_newReceivingBenefactor)
    {
        address oldBenfactor = benefactors[tokenId];

        require(
            oldBenfactor != _newReceivingBenefactor,
            "cannot be same address"
        );

        // Collect patronage from old and new benefactor before changing totalBenefactorTokenNumerator on both
        uint256 scaledPrice = price[tokenId].mul(patronageNumerator[tokenId]);
        totalBenefactorTokenNumerator[oldBenfactor] = totalBenefactorTokenNumerator[oldBenfactor]
            .sub(scaledPrice);
        totalBenefactorTokenNumerator[_newReceivingBenefactor] = totalBenefactorTokenNumerator[_newReceivingBenefactor]
            .add(scaledPrice);

        benefactors[tokenId] = _newReceivingBenefactor;
        // NB No fund exchanging here please!
    }

    // TODO: you need an event in here!
    // NB This function is if an organisation loses their keys etc..
    // It will transfer their deposit to their new benefactor address
    // It should only be called once all their tokens also changeReceivingBenefactor
    function changeReceivingBenefactorDeposit(
        address oldBenfactor,
        address _newReceivingBenefactor
    )
        public
        onlyAdmin
        notNullAddress(_newReceivingBenefactor)
        notSameAddress(oldBenfactor, _newReceivingBenefactor)
    {
        require(benefactorFunds[oldBenfactor] > 0, "no funds");

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
        notNullAddress(_withdrawCheckerAdmin)
    {
        withdrawCheckerAdmin = _withdrawCheckerAdmin;
    }

    function changeArtistAddressAndCommission(
        uint256 tokenId,
        address artistAddress,
        uint256 percentage
    ) public onlyAdmin {
        require(percentage <= 200000, "not more than 20%");
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
            "auction start < auction end"
        );
        require(_auctionLength >= 86400, "1 day min auction length");

        auctionStartPrice = _auctionStartPrice;
        auctionEndPrice = _auctionEndPrice;
        auctionLength = _auctionLength;
        emit ChangeAuctionParameters();
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

    function patronageOwedPatron(address tokenPatron)
        public
        view
        returns (uint256 patronageDue)
    {
        // NOTE: Leaving this code here as a reminder: totalPatronOwnedTokenCost[tokenPatron] has to be zero if timeLastCollectedPatron[tokenPatron] is zero. So effectively this line isn't needed.
        // if (timeLastCollectedPatron[tokenPatron] == 0) return 0;
        return
            totalPatronOwnedTokenCost[tokenPatron]
                .mul(now.sub(timeLastCollectedPatron[tokenPatron]))
                .div(yearTimePatronagDenominator);
    }

    function patronageDueBenefactor(address benefactor)
        public
        view
        returns (uint256 payoutDue)
    {
        // NOTE: Leaving this code here as a reminder: totalBenefactorTokenNumerator[tokenPatron] has to be zero if timeLastCollectedBenefactor[tokenPatron] is zero. So effectively this line isn't needed.
        // if (timeLastCollectedBenefactor[benefactor] == 0) return 0;
        return
            totalBenefactorTokenNumerator[benefactor]
                .mul(now.sub(timeLastCollectedBenefactor[benefactor]))
                .div(yearTimePatronagDenominator);
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
        uint256 pps = totalPatronOwnedTokenCost[tokenPatron].div(
            yearTimePatronagDenominator
        );
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
        if (timeSinceLastMint != 0) {
            mintManager.tokenMint(
                tokenPatron,
                timeSinceLastMint,
                totalPatronTokenGenerationRate[tokenPatron]
            );
            emit CollectLoyalty(
                tokenPatron,
                timeSinceLastMint.mul(
                    totalPatronTokenGenerationRate[tokenPatron]
                )
            );
        }
    }

    // TODO: create a version of this function that only collects patronage (and only settles the benefactor if the token forecloses) - is this needed?
    function _collectPatronageAndSettleBenefactor(uint256 tokenId) public {
        address tokenPatron = assetToken.ownerOf(tokenId);
        uint256 newTimeLastCollectedOnForeclosure = _collectPatronagePatron(
            tokenPatron
        );

        address benefactor = benefactors[tokenId];
        // bool tokenForeclosed = newTimeLastCollectedOnForeclosure > 0;
        bool tokenIsOwned = state[tokenId] == StewardState.Owned;
        if (newTimeLastCollectedOnForeclosure > 0 && tokenIsOwned) {
            tokenAuctionBeginTimestamp[tokenId] =
                // The auction starts the second after the last time collected.
                newTimeLastCollectedOnForeclosure +
                1;


                uint256 patronageDueBenefactorBeforeForeclosure
             = patronageDueBenefactor(benefactor);

            _foreclose(tokenId);

            uint256 amountOverCredited = price[tokenId]
                .mul(now.sub(newTimeLastCollectedOnForeclosure))
                .mul(patronageNumerator[tokenId])
                .div(yearTimePatronagDenominator);

            if (amountOverCredited < patronageDueBenefactorBeforeForeclosure) {
                _increaseBenefactorBalance(
                    benefactor,
                    patronageDueBenefactorBeforeForeclosure - amountOverCredited
                );
            } else {
                _decreaseBenefactorBalance(
                    benefactor,
                    amountOverCredited - patronageDueBenefactorBeforeForeclosure
                );
            }

            timeLastCollectedBenefactor[benefactor] = now;
        } else {
            _updateBenefactorBalance(benefactor);
        }
    }

    // function safeSend(uint256 _wei, address payable recipient)
    //     internal
    //     returns (bool transferSuccess)
    // {
    //     (transferSuccess, ) = recipient.call.gas(2300).value(_wei)("");
    // }

    function sendErc20(uint256 _wei, address recipient)
        internal
        returns (bool transferSuccess)
    {
        // try adaiContract.redeem(amount)  {
        return paymentToken.transfer(recipient, _wei);
        // } catch {
        //   emit ADaiRedeemFailed();
        //   adaiContract.transfer(msgSender(), amount);
        // }
    }

    function receiveErc20(uint256 amount, address from)
        internal
        returns (bool transferSuccess)
    {
        return paymentToken.transferFrom(msgSender(), address(this), amount);
    }

    // if credit balance exists,
    // if amount owed > creidt
    // credit zero add amount
    // else reduce credit by certain amount.
    // else if credit balance doesn't exist
    // add amount to balance
    // TODO: this function should have an event
    function _updateBenefactorBalance(address benefactor) public {
        uint256 patronageDueForBenefactor = patronageDueBenefactor(benefactor);

        if (patronageDueForBenefactor > 0) {
            _increaseBenefactorBalance(benefactor, patronageDueForBenefactor);
        }

        timeLastCollectedBenefactor[benefactor] = now;
    }

    function _increaseBenefactorBalance(
        address benefactor,
        uint256 patronageDueBenefactor
    ) internal {
        if (benefactorCredit[benefactor] > 0) {
            if (patronageDueBenefactor < benefactorCredit[benefactor]) {
                benefactorCredit[benefactor] = benefactorCredit[benefactor].sub(
                    patronageDueBenefactor
                );
            } else {
                benefactorFunds[benefactor] = patronageDueBenefactor.sub(
                    benefactorCredit[benefactor]
                );
                benefactorCredit[benefactor] = 0;
            }
        } else {
            benefactorFunds[benefactor] = benefactorFunds[benefactor].add(
                patronageDueBenefactor
            );
        }
    }

    function _decreaseBenefactorBalance(
        address benefactor,
        uint256 amountOverCredited
    ) internal {
        if (benefactorFunds[benefactor] > 0) {
            if (amountOverCredited <= benefactorFunds[benefactor]) {
                benefactorFunds[benefactor] = benefactorFunds[benefactor].sub(
                    amountOverCredited
                );
            } else {
                benefactorCredit[benefactor] = amountOverCredited.sub(
                    benefactorFunds[benefactor]
                );
                benefactorFunds[benefactor] = 0;
            }
        } else {
            benefactorCredit[benefactor] = benefactorCredit[benefactor].add(
                amountOverCredited
            );
        }
    }

    function fundsDueForAuctionPeriodAtCurrentRate(address benefactor)
        internal
        view
        returns (uint256)
    {
        return
            totalBenefactorTokenNumerator[benefactor].mul(auctionLength).div(
                yearTimePatronagDenominator
            ); // 365 days * 1000000000000
    }

    function withdrawBenefactorFundsTo(address benefactor) public {
        _updateBenefactorBalance(benefactor);

        uint256 availableToWithdraw = benefactorFunds[benefactor];


            uint256 benefactorWithdrawalSafetyDiscount
         = fundsDueForAuctionPeriodAtCurrentRate(benefactor);

        require(
            availableToWithdraw > benefactorWithdrawalSafetyDiscount,
            "no funds"
        );

        // NOTE: no need for safe-maths, above require prevents issues.
        uint256 amountToWithdraw = availableToWithdraw -
            benefactorWithdrawalSafetyDiscount;

        benefactorFunds[benefactor] = benefactorWithdrawalSafetyDiscount;
        if (sendErc20(amountToWithdraw, benefactor)) {
            emit WithdrawBenefactorFundsWithSafetyDelay(
                benefactor,
                amountToWithdraw
            );
        } else {
            // TODO: add an error in unsuccessful withdrawal.
            benefactorFunds[benefactor] = benefactorFunds[benefactor].add(
                amountToWithdraw
            );
        }
    }

    function hasher(
        address benefactor,
        uint256 maxAmount,
        uint256 expiry,
        uint256 nonce
    ) public view returns (bytes32) {
        // In ethereum you have to prepend all signature hashes with this message (supposedly to prevent people from)
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    keccak256(
                        abi.encodePacked(benefactor, maxAmount, expiry, nonce)
                    )
                )
            );
    }

    function withdrawBenefactorFundsToValidated(
        address benefactor,
        uint256 maxAmount,
        uint256 expiry,
        uint256 nonce,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        hash = hasher(benefactor, maxAmount, expiry, nonce);
        require(
            ecrecover(hash, v, r, s) == withdrawCheckerAdmin,
            "no permission to withdraw"
        );
        require(!withdrawalNonceUsed[nonce], "nonce already used");
        require(
            hash == hasher(benefactor, maxAmount, expiry, nonce),
            "incorrect hash"
        );
        require(now < expiry, "coupon expired");
        withdrawalNonceUsed[nonce] = true;

        _updateBenefactorBalance(benefactor);

        uint256 availableToWithdraw = benefactorFunds[benefactor];

        if (availableToWithdraw > 0) {
            if (availableToWithdraw > maxAmount) {
                if (sendErc20(maxAmount, benefactor)) {
                    benefactorFunds[benefactor] = availableToWithdraw.sub(
                        maxAmount
                    );
                    emit WithdrawBenefactorFunds(
                        benefactor,
                        availableToWithdraw
                    );
                }
            } else {
                uint256 contractBalance = paymentToken.balanceOf(address(this));

                if (sendErc20(availableToWithdraw, benefactor)) {
                    // TODO: re-entrancy
                    benefactorFunds[benefactor] = 0;
                    emit WithdrawBenefactorFunds(
                        benefactor,
                        availableToWithdraw
                    );
                }
            }
        }
    }

    function _collectPatronagePatron(address tokenPatron)
        public
        returns (uint256 newTimeLastCollectedOnForeclosure)
    {
        uint256 patronageOwedByTokenPatron = patronageOwedPatron(tokenPatron);

        uint256 timeSinceLastMint;

        if (
            patronageOwedByTokenPatron > 0 &&
            patronageOwedByTokenPatron > deposit[tokenPatron]
        ) {

                uint256 previousCollectionTime
             = timeLastCollectedPatron[tokenPatron];
            newTimeLastCollectedOnForeclosure = previousCollectionTime.add(
                (
                    (now.sub(previousCollectionTime))
                        .mul(deposit[tokenPatron])
                        .div(patronageOwedByTokenPatron)
                )
            );
            timeLastCollectedPatron[tokenPatron] = newTimeLastCollectedOnForeclosure;
            deposit[tokenPatron] = 0;
            timeSinceLastMint = (
                newTimeLastCollectedOnForeclosure.sub(previousCollectionTime)
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

    function depositWei(uint256 amount) public {
        depositWeiPatron(msgSender(), amount);
    }

    function depositWithPermit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address patron,
        uint256 amount
    ) external {
        paymentToken.permit(holder, spender, nonce, expiry, allowed, v, r, s);
        depositWeiPatron(patron, amount);
    }

    // Which the 'approve' function in erc20 this function is unsafe to be public.
    function depositWeiPatron(address patron, uint256 amount) internal {
        require(totalPatronOwnedTokenCost[patron] > 0, "no tokens");
        deposit[patron] = deposit[patron].add(amount);
        receiveErc20(amount, patron);
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

    function buyWithPermit(
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 tokenId,
        uint256 _newPrice,
        uint256 previousPrice,
        uint256 serviceProviderPercentage,
        uint256 depositAmount
    ) external {
        paymentToken.permit(
            msgSender(),
            address(this),
            nonce,
            expiry,
            allowed,
            v,
            r,
            s
        );
        buy(
            tokenId,
            _newPrice,
            previousPrice,
            serviceProviderPercentage,
            depositAmount
        );
    }

    function buy(
        uint256 tokenId,
        uint256 _newPrice,
        uint256 previousPrice,
        uint256 serviceProviderPercentage,
        uint256 depositAmount
    )
        public
        collectPatronageAndSettleBenefactor(tokenId)
        collectPatronagePatron(msgSender())
        priceGreaterThanZero(_newPrice)
        youCurrentlyAreNotInDefault(msgSender())
        validWildcardsPercentage(serviceProviderPercentage, tokenId)
    {
        require(state[tokenId] == StewardState.Owned, "token on auction");
        require(
            price[tokenId] == previousPrice,
            "must specify current price accurately"
        );
        receiveErc20(depositAmount.add(price[tokenId]), msgSender());
        address owner = assetToken.ownerOf(tokenId);

        _distributePurchaseProceeds(tokenId);

        serviceProviderPercentages[tokenId] = serviceProviderPercentage;
        deposit[msgSender()] = deposit[msgSender()].add(depositAmount);
        transferAssetTokenTo(
            tokenId,
            assetToken.ownerOf(tokenId),
            msgSender(),
            _newPrice
        );
        emit Buy(tokenId, msgSender(), _newPrice);
    }

    function buyAuctionWithPermit(
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 tokenId,
        uint256 _newPrice,
        uint256 serviceProviderPercentage,
        uint256 depositAmount
    ) external {
        paymentToken.permit(
            msgSender(),
            address(this),
            nonce,
            expiry,
            allowed,
            v,
            r,
            s
        );
        buyAuction(
            tokenId,
            _newPrice,
            serviceProviderPercentage,
            depositAmount
        );
    }

    function buyAuction(
        uint256 tokenId,
        uint256 _newPrice,
        uint256 serviceProviderPercentage,
        uint256 depositAmount
    )
        public
        collectPatronageAndSettleBenefactor(tokenId)
        collectPatronagePatron(msgSender())
        priceGreaterThanZero(_newPrice)
        youCurrentlyAreNotInDefault(msgSender())
        validWildcardsPercentage(serviceProviderPercentage, tokenId)
    {
        require(
            state[tokenId] == StewardState.Foreclosed,
            "token not foreclosed"
        );
        require(now >= tokenAuctionBeginTimestamp[tokenId], "not on auction");
        uint256 auctionTokenPrice = _auctionPrice(tokenId);

        // uint256 remainingValueForDeposit = msg.value.sub(auctionTokenPrice);

        _distributeAuctionProceeds(tokenId);

        state[tokenId] = StewardState.Owned;

        serviceProviderPercentages[tokenId] = serviceProviderPercentage;
        receiveErc20(depositAmount.add(auctionTokenPrice), msgSender());
        deposit[msgSender()] = deposit[msgSender()].add(depositAmount);
        transferAssetTokenTo(
            tokenId,
            assetToken.ownerOf(tokenId),
            msgSender(),
            _newPrice
        );
        emit Buy(tokenId, msgSender(), _newPrice);
    }

    function _distributeAuctionProceeds(uint256 tokenId) internal {
        uint256 totalAmount = price[tokenId];
        uint256 artistAmount;
        if (artistPercentages[tokenId] == 0) {
            artistAmount = 0;
        } else {
            artistAmount = totalAmount.mul(artistPercentages[tokenId]).div(
                1000000
            );
            deposit[artistAddresses[tokenId]] = deposit[artistAddresses[tokenId]]
                .add(artistAmount);
        }
        uint256 wildcardsAmount = totalAmount.sub(artistAmount);
        deposit[admin] = deposit[admin].add(wildcardsAmount);
    }

    function _distributePurchaseProceeds(uint256 tokenId) internal {
        uint256 totalAmount = price[tokenId];
        address tokenPatron = assetToken.ownerOf(tokenId);
        // Wildcards percentage calc
        if (serviceProviderPercentages[tokenId] == 0) {
            serviceProviderPercentages[tokenId] = 50000;
        }
        uint256 wildcardsAmount = totalAmount
            .mul(serviceProviderPercentages[tokenId])
            .div(1000000);

        // Artist percentage calc
        uint256 artistAmount;
        if (artistPercentages[tokenId] == 0) {
            artistAmount = 0;
        } else {
            artistAmount = totalAmount.mul(artistPercentages[tokenId]).div(
                1000000
            );
            deposit[artistAddresses[tokenId]] = deposit[artistAddresses[tokenId]]
                .add(artistAmount);
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
            // address payableCurrentPatron = address(uint160(tokenPatron));
            // (bool transferSuccess, ) = payableCurrentPatron
            //     .call
            //     .gas(2300)
            //     .value(previousOwnerProceedsFromSale)("");
            // if (!transferSuccess) {
            //     deposit[tokenPatron] = deposit[tokenPatron].add(
            //         previousOwnerProceedsFromSale
            //     );
            // }

            sendErc20(previousOwnerProceedsFromSale, tokenPatron);
        } else {
            deposit[tokenPatron] = deposit[tokenPatron].add(
                previousOwnerProceedsFromSale
            );
        }

        deposit[admin] = deposit[admin].add(wildcardsAmount);
    }

    function changePrice(uint256 tokenId, uint256 _newPrice)
        public
        onlyPatron(tokenId)
        collectPatronageAndSettleBenefactor(tokenId)
    {
        require(state[tokenId] != StewardState.Foreclosed, "foreclosed");
        require(_newPrice != 0, "incorrect price");
        require(_newPrice < 10000 ether, "exceeds max price");

        uint256 oldPriceScaled = price[tokenId].mul(
            patronageNumerator[tokenId]
        );
        uint256 newPriceScaled = _newPrice.mul(patronageNumerator[tokenId]);
        address tokenBenefactor = benefactors[tokenId];

        totalPatronOwnedTokenCost[msgSender()] = totalPatronOwnedTokenCost[msg
            .sender]
            .sub(oldPriceScaled)
            .add(newPriceScaled);

        totalBenefactorTokenNumerator[tokenBenefactor] = totalBenefactorTokenNumerator[tokenBenefactor]
            .sub(oldPriceScaled)
            .add(newPriceScaled);

        price[tokenId] = _newPrice;
        emit PriceChange(tokenId, price[tokenId]);
    }

    function withdrawDeposit(uint256 _wei)
        public
        collectPatronagePatron(msgSender())
        returns (uint256)
    {
        _withdrawDeposit(_wei);
    }

    function withdrawBenefactorFunds() public {
        withdrawBenefactorFundsTo(msgSender());
    }

    function exit() public collectPatronagePatron(msgSender()) {
        _withdrawDeposit(deposit[msgSender()]);
    }

    function _withdrawDeposit(uint256 _wei) internal {
        require(deposit[msgSender()] >= _wei, "withdrawing too much");

        deposit[msgSender()] = deposit[msgSender()].sub(_wei);

        if (!sendErc20(_wei, msgSender())) {
            revert("withdrawal failed");
        }
    }

    function _foreclose(uint256 tokenId) internal {
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
        require(_newPrice < 10000 ether, "exceeds max price");

        uint256 scaledOldPrice = price[tokenId].mul(
            patronageNumerator[tokenId]
        );
        uint256 scaledNewPrice = _newPrice.mul(patronageNumerator[tokenId]);

        totalPatronOwnedTokenCost[_newOwner] = totalPatronOwnedTokenCost[_newOwner]
            .add(scaledNewPrice);
        totalPatronTokenGenerationRate[_newOwner] = totalPatronTokenGenerationRate[_newOwner]
            .add(globalTokenGenerationRate);

        address tokenBenefactor = benefactors[tokenId];
        totalBenefactorTokenNumerator[tokenBenefactor] = totalBenefactorTokenNumerator[tokenBenefactor]
            .add(scaledNewPrice);

        if (_currentOwner != address(this) && _currentOwner != address(0)) {
            totalPatronOwnedTokenCost[_currentOwner] = totalPatronOwnedTokenCost[_currentOwner]
                .sub(scaledOldPrice);

            totalPatronTokenGenerationRate[_currentOwner] = totalPatronTokenGenerationRate[_currentOwner]
                .sub(globalTokenGenerationRate);

            totalBenefactorTokenNumerator[tokenBenefactor] = totalBenefactorTokenNumerator[tokenBenefactor]
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
            .sub((globalTokenGenerationRate));

        address tokenBenefactor = benefactors[tokenId];
        totalBenefactorTokenNumerator[tokenBenefactor] = totalBenefactorTokenNumerator[tokenBenefactor]
            .sub(scaledPrice);

        assetToken.transferFrom(_currentOwner, address(this), tokenId);
    }

    // THIS CODE IS PURELY FOR TESTING GSN - IT DOES NOTHING!
    event TestEvent(address sender, address paymentTokenAdr, address randomArg);

    function testFunctionThatDoesNothing(address randomArg) public {
        emit TestEvent(msgSender(), address(paymentToken), randomArg);
    }
}

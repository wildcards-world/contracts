// NOTE THIS CONTRACT WAS NEVER USED.
pragma solidity 0.6.12;

import "../../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/math/SafeMath.sol";
import "../../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/Initializable.sol";

import "../ERC721Patronage_v1.sol";
import "../interfaces/IMintManager.sol";
import "../interfaces/IERC721Patronage.sol";
// import "./interfaces/IERC20Mintable.sol";

import "../BasicMetaTransaction.sol";

import "../interfaces/IDai.sol";

// import "./GSNRecipientBase.sol";

// import "../vendered/gsn-2.0.0-beta.1.3/contracts/BaseRelayRecipient.sol";
// import "../vendered/gsn-2.0.0-beta.1.3/contracts/interfaces/IKnowForwarderAddressGsn.sol";

// import "@nomiclabs/buidler/console.sol";

contract AddLostEarningsToWildcardsDeposit is
    Initializable,
    BasicMetaTransaction
{
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

    IDai public paymentToken; // ERC20 token used as payment.

    modifier onlyAdmin() {
        require(msgSender() == admin, "Not admin");
        _;
    }

    function setCorrectEarningsFromFirst4WildcardsSold() public onlyAdmin {
        deposit[admin] = 20 ether; // 4 wildcards were sold each at 5 DAI.
    }
}

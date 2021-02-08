pragma solidity ^0.6.0;

import "../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/token/ERC20/ERC20.sol";
import "../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/access/AccessControl.sol";
import "./GSNRecipientBase.sol";

import "../vendered/gsn-2.0.0-beta.1.3/contracts/interfaces/IKnowForwarderAddressGsn.sol";

// import "@nomiclabs/buidler/console.sol";

contract ERC20PatronageReceipt_v2_upgradable is
    GSNRecipientBase,
    ERC20UpgradeSafe,
    AccessControlUpgradeSafe,
    IKnowForwarderAddressGsn
{
    bytes32 public constant MINTER_ROLE = keccak256("minter");
    bytes32 public constant ADMIN_ROLE = keccak256("admin");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    modifier onlyDepositorRole() {
        require(hasRole(DEPOSITOR_ROLE, _msgSender()), "Only Depositor");
        _;
    }

    event Init();
    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);

    function _msgSender()
        internal
        view
        override(ContextUpgradeSafe, GSNRecipientBase)
        returns (address payable)
    {
        return GSNRecipientBase._msgSender();
    }

    function _msgData()
        internal
        view
        override(ContextUpgradeSafe, GSNRecipientBase)
        returns (bytes memory)
    {
        return GSNRecipientBase._msgData();
    }

    function setup(
        string memory name,
        string memory symbol,
        address minter,
        address admin,
        address childChainManager
    ) public initializer {
        ERC20UpgradeSafe.__ERC20_init_unchained(name, symbol);
        AccessControlUpgradeSafe.__AccessControl_init_unchained();
        _setupRole(MINTER_ROLE, minter);
        _setupRole(ADMIN_ROLE, admin);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
        _setupRole(DEPOSITOR_ROLE, childChainManager);

        GSNRecipientBase.initialize();

        emit Init();
    }

    function mint(address to, uint256 amount) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "Caller is not a minter");

        _mint(to, amount);
    }

    function addMinter(address minter) public {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Caller not admin");
        grantRole(MINTER_ROLE, minter);

        emit MinterAdded(minter);
    }

    function renounceMinter() public {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Caller not admin");
        renounceRole(MINTER_ROLE, _msgSender());

        emit MinterRemoved(_msgSender());
    }

    function burn(address from, uint256 amount) public {
        // For now anyone can burn...
        // require(hasRole(BURNER_ROLE, _msgSender()), "Caller is not a burner");
        _burn(from, amount);
    }

    function getTrustedForwarder() public view override returns (address) {
        return trustedForwarder;
    }

    function setTrustedForwarder(address forwarder) public {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Caller is not a admin");

        trustedForwarder = forwarder;
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required amount for user
     * Make sure minting is done only by this function
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded amount
     */
    function deposit(address user, bytes calldata depositData)
        external
        onlyDepositorRole
    {
        uint256 amount = abi.decode(depositData, (uint256));
        _mint(user, amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external {
        _burn(_msgSender(), amount);
    }
}

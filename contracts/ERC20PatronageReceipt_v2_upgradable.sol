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

    function _msgSender()
        internal
        override(ContextUpgradeSafe, GSNRecipientBase)
        view
        returns (address payable)
    {
        return GSNRecipientBase._msgSender();
    }

    function _msgData()
        internal
        override(ContextUpgradeSafe, GSNRecipientBase)
        view
        returns (bytes memory)
    {
        return GSNRecipientBase._msgData();
    }

    function setup(
        string memory name,
        string memory symbol,
        address minter,
        address admin
    ) public initializer {
        ERC20UpgradeSafe.__ERC20_init_unchained(name, symbol);
        AccessControlUpgradeSafe.__AccessControl_init_unchained();
        _setupRole(MINTER_ROLE, minter);
        _setupRole(ADMIN_ROLE, admin);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);

        GSNRecipientBase.initialize();
    }

    function mint(address to, uint256 amount) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "Caller is not a minter");

        _mint(to, amount);
    }

    function addMinter(address minter) public {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Caller not admin");
        grantRole(MINTER_ROLE, minter);
    }

    function renounceMinter() public {
        renounceRole(MINTER_ROLE, _msgSender());
    }

    function burn(address from, uint256 amount) public {
        // For now anyone can burn...
        // require(hasRole(BURNER_ROLE, _msgSender()), "Caller is not a burner");
        _burn(from, amount);
    }

    function getTrustedForwarder() public override view returns (address) {
        return trustedForwarder;
    }

    function setTrustedForwarder(address forwarder) public {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Caller is not a admin");

        trustedForwarder = forwarder;
    }
}

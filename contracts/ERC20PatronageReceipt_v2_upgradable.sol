pragma solidity ^0.6.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/AccessControl.sol";
import "@nomiclabs/buidler/console.sol";

contract ERC20PatronageReceipt_v2_upgradable is
    ERC20UpgradeSafe,
    AccessControlUpgradeSafe
{
    bytes32 public constant MINTER_ROLE = keccak256("minter");
    bytes32 public constant ADMIN_ROLE = keccak256("admin");

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
    }

    function mint(address to, uint256 amount) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "Caller is not a minter");
        // require(hasRole(MINTER_ROLE, _msgSender()), "Caller is not a minter");
        _mint(to, amount);
    }

    function addMinter(address minter) public {
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
}

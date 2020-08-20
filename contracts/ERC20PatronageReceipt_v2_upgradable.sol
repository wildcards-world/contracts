pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

contract ERC20PatronageReceipt_v2_upgradable is
    ERC20,
    ERC20Mintable,
    ERC20Burnable,
    ERC20Detailed
{
    function setup(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address minter
    ) public initializer {
        ERC20Mintable.initialize(minter);
        ERC20Detailed.initialize(name, symbol, decimals);
    }
}

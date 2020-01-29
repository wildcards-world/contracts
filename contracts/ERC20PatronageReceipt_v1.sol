pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

contract ERC20PatronageReceipt_v1 is
    ERC20,
    ERC20Mintable,
    ERC20Burnable,
    ERC20Detailed
{
    address public steward;

    function initialize(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address minter
    ) public initializer {
        ERC20Detailed.initialize(name, symbol, decimals);
        ERC20Mintable.initialize(minter);
    }
}

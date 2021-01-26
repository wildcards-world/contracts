pragma solidity ^0.5.0;

contract IERC20Mintable {
    function mint(address account, uint256 amount) public returns (bool);

    function burnFrom(address sender, uint256 amount) public returns (bool);
}

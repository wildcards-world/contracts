pragma solidity ^0.6.0;

interface IERC20Mintable {
    function mint(address account, uint256 amount) external;
}

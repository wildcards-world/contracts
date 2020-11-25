pragma solidity ^0.6.0;

interface IERC20Mintable {
    function mint(address account, uint256 amount) external;

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external virtual returns (bool);

    function transfer(address recipient, uint256 amount)
        external
        virtual
        returns (bool);

    function balanceOf(address account) external virtual view returns (uint256);
}

pragma solidity ^0.6.0;

interface IDai {
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

    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

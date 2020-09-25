pragma solidity ^0.6.0;

interface IMintManager {
    function tokenMint(
        address receiverOfTokens,
        uint256 time,
        uint256 mintRate
    ) external;
}

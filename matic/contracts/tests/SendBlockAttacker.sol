pragma solidity 0.6.12;

import "../WildcardSteward_v3_matic.sol";

contract SendBlockAttacker {
    // TODO: fix this function to work with erc20?
    // function buyOnBehalf(
    //     WildcardSteward_v3_matic stewardAddress,
    //     uint256 tokenId,
    //     uint256 newPrice
    // ) public payable {
    //     stewardAddress.buyAuction.value(msg.value)(tokenId, newPrice, 50000);
    // }

    function withdrawDeposit(WildcardSteward_v3_matic stewardAddress, uint256 amount)
        public
    {
        stewardAddress.withdrawDeposit(amount);
    }

    function fallback() external payable {
        revert("I'm Malicious");
    }
}

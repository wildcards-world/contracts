pragma solidity 0.5.17;

import "../WildcardSteward_v3.sol";


contract SendBlockAttacker {
    function buyOnBehalf(
        WildcardSteward_v3 stewardAddress,
        uint256 tokenId,
        uint256 newPrice
    ) public payable {
        stewardAddress.buyAuction.value(msg.value)(tokenId, newPrice, 500);
    }

    function withdrawDeposit(WildcardSteward_v3 stewardAddress, uint256 amount)
        public
    {
        stewardAddress.withdrawDeposit(amount);
    }

    function() external payable {
        revert("I'm Malicious");
    }
}

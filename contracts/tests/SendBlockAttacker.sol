pragma solidity 0.5.15;

import "../WildcardSteward_v2.sol";


contract SendBlockAttacker {
    function buyOnBehalf(
        WildcardSteward_v2 stewardAddress,
        uint256 tokenId,
        uint256 newPrice
    ) public payable {
        stewardAddress.buy.value(msg.value)(tokenId, newPrice, msg.value);
    }

    function withdrawDeposit(WildcardSteward_v2 stewardAddress, uint256 amount)
        public
    {
        stewardAddress.withdrawDeposit(amount);
    }

    function() external payable {
        revert("I'm Malicious");
    }
}

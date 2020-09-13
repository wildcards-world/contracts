import "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/GSN/GSNRecipient.sol";

contract GSNRecipientBase is ContextUpgradeSafe, GSNRecipientUpgradeSafe {
    function initialize() public {
        __GSNRecipient_init();
    }

    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    ) external override view returns (uint256, bytes memory) {
        // TODO: be more strict here!
        //       https://docs.openzeppelin.com/contracts/3.x/gsn-strategies
        return _approveRelayedCall();
    }

    // We won't do any pre or post processing, so leave _preRelayedCall and _postRelayedCall empty
    function _preRelayedCall(bytes memory context)
        internal
        override
        returns (bytes32)
    {}

    function _postRelayedCall(
        bytes memory context,
        bool,
        uint256 actualCharge,
        bytes32
    ) internal override {}

    function _msgSender()
        internal
        virtual
        override(ContextUpgradeSafe, GSNRecipientUpgradeSafe)
        view
        returns (address payable)
    {
        return GSNRecipientUpgradeSafe._msgSender();
    }

    function _msgData()
        internal
        virtual
        override(ContextUpgradeSafe, GSNRecipientUpgradeSafe)
        view
        returns (bytes memory)
    {
        return GSNRecipientUpgradeSafe._msgData();
    }
}

import "../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/GSN/Context.sol";
import "../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/GSN/GSNRecipient.sol";
import "../vendered/gsn-2.0.0-beta.1.3/contracts/utils/MinLibBytes.sol";

contract GSNRecipientBase is ContextUpgradeSafe, GSNRecipientUpgradeSafe {
    function initialize() public {
        __GSNRecipient_init();
    }

    /*
     * Forwarder singleton we accept calls from
     */
    address internal trustedForwarder;

    // This function is copy/pasted from the gsn library...
    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarder;
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

    // function _msgSender()
    //     internal
    //     virtual
    //     view
    //     returns (address payable)
    // {
    //     return GSNRecipientUpgradeSafe._msgSender();
    // }

    /**
     * return the sender of this call.
     * if the call came through our trusted forwarder, return the original sender.
     * otherwise, return `msg.sender`.
     * should be used in the contract anywhere instead of msg.sender
     */
    function _msgSender()
        internal
        virtual
        override(ContextUpgradeSafe, GSNRecipientUpgradeSafe)
        view
        returns (address payable)
    {
        if (msg.data.length >= 24 && isTrustedForwarder(msg.sender)) {
            // At this point we know that the sender is a trusted forwarder,
            // so we trust that the last bytes of msg.data are the verified sender address.
            // extract sender address from the end of msg.data
            return
                address(
                    uint160(
                        MinLibBytes.readAddress(msg.data, msg.data.length - 20)
                    )
                );
        }
        return msg.sender;
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

pragma solidity 0.6.12;

import "./mod/ERC721.sol";
import "../vendered/@openzeppelin/contracts-ethereum-package-3.0.0/contracts/access/AccessControl.sol";
import "./GSNRecipientBase.sol";

import "../vendered/gsn-2.0.0-beta.1.3/contracts/interfaces/IKnowForwarderAddressGsn.sol";

// import "./WildcardSteward_v1.sol";
contract ERC721Patronage_v1 is
    GSNRecipientBase,
    ERC721UpgradeSafe,
    AccessControlUpgradeSafe,
    IKnowForwarderAddressGsn
{
    address public steward;
    bytes32 public constant MINTER_ROLE = keccak256("minter");
    bytes32 public constant ADMIN_ROLE = keccak256("admin");

    function _msgSender()
        internal
        override(ContextUpgradeSafe, GSNRecipientBase)
        view
        returns (address payable)
    {
        return GSNRecipientBase._msgSender();
    }

    function _msgData()
        internal
        override(ContextUpgradeSafe, GSNRecipientBase)
        view
        returns (bytes memory)
    {
        return GSNRecipientBase._msgData();
    }

    function setup(
        address _steward,
        string memory name,
        string memory symbol,
        address minter,
        address admin
    ) public initializer {
        steward = _steward;
        ERC721UpgradeSafe.__ERC721_init_unchained(name, symbol);
        _setupRole(MINTER_ROLE, minter);
        _setupRole(ADMIN_ROLE, admin);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);

        GSNRecipientBase.initialize();
    }

    // function mint(address to, uint256) public {
    //     require(hasRole(MINTER_ROLE, _msgSender()), "Caller is not a minter");
    //     _mint(to, amount);
    // }

    function mintWithTokenURI(
        address to,
        uint256 tokenId,
        string memory tokenURI
    ) public returns (bool) {
        require(hasRole(MINTER_ROLE, _msgSender()), "Caller is not a minter");

        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return true;
    }

    function isMinter(address account) public view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        override
        view
        returns (bool)
    {
        return (spender == steward);
        /*
          // NOTE: temporarily disabling sending of the tokens independently. A protective messure since it isn't clear to users how this function should work.
          //       Will re-add once a mechanism is agreed on by the community.
          || ERC721._isApprovedOrOwner(spender, tokenId)
          */
    }

    function addMinter(address minter) public {
        grantRole(MINTER_ROLE, minter);
    }

    function renounceMinter() public {
        renounceRole(MINTER_ROLE, _msgSender());
    }

    // function transferFrom(address from, address to, uint256 tokenId) public {
    //     if (_msgSender() != steward) {
    //         WildcardSteward_v1 stewardContract = WildcardSteward_v1(steward);

    //         // Calculate remaining deposit for the two addresses involved in transfer.
    //         stewardContract._collectPatronagePatron(to);
    //         stewardContract._collectPatronage(tokenId);

    //         // Do not allow someone to transfer a token if their deposit is Zero.
    //         require(stewardContract.deposit(to) > 0, "Recipient needs to have a deposit.");
    //         require(stewardContract.deposit(from) > 0, "Sender deposit has run out.");
    //     }

    //     ERC721.transferFrom(from, to, tokenId);
    // }

    function getTrustedForwarder() public override view returns (address) {
        return trustedForwarder;
    }

    function setTrustedForwarder(address forwarder) public {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Caller is not a admin");

        trustedForwarder = forwarder;
    }
}

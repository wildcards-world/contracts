pragma solidity 0.6.12;

import "./mod/ERC721.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/AccessControl.sol";

// import "./WildcardSteward_v1.sol";
contract ERC721Patronage_v1 is ERC721UpgradeSafe, AccessControlUpgradeSafe {
    address public steward;
    bytes32 public constant MINTER_ROLE = keccak256("minter");
    bytes32 public constant ADMIN_ROLE = keccak256("admin");

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
    }

    // function mint(address to, uint256) public {
    //     require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
    //     _mint(to, amount);
    // }

    function mintWithTokenURI(
        address to,
        uint256 tokenId,
        string memory tokenURI
    ) public returns (bool) {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");

        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return true;
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
    //     if (msg.sender != steward) {
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
}

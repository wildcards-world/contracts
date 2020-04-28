pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721Enumerable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721Metadata.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721MetadataMintable.sol";


// import "./WildcardSteward_v1.sol";
contract ERC721Patronage_v1 is
    Initializable,
    ERC721,
    ERC721Enumerable,
    ERC721Metadata,
    ERC721MetadataMintable
{
    address public steward;

    function setup(
        address _steward,
        string memory name,
        string memory symbol,
        address minter
    ) public initializer {
        steward = _steward;
        ERC721.initialize();
        ERC721Enumerable.initialize();
        ERC721Metadata.initialize(name, symbol);
        // Initialize the minter and pauser roles, and renounce them
        ERC721MetadataMintable.initialize(address(this));
        _removeMinter(address(this));
        _addMinter(minter);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
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

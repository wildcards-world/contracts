pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721Enumerable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721Metadata.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721MetadataMintable.sol";
// import "../node_modules/@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721.sol";
// import "../node_modules/@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721Enumerable.sol";
// import "../node_modules/@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721Metadata.sol";

contract ERC721Patronage_v0 is Initializable, ERC721, ERC721Enumerable, ERC721Metadata, ERC721MetadataMintable {
    address public steward;

    function setup(address _steward, string memory name, string memory symbol, address minter) public initializer {
        steward = _steward;
        ERC721.initialize();
        ERC721Enumerable.initialize();
        ERC721Metadata.initialize(name, symbol);
                // Initialize the minter and pauser roles, and renounce them
        ERC721MetadataMintable.initialize(address(this));
        _removeMinter(address(this));
        _addMinter(minter);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        return (spender == steward || ERC721._isApprovedOrOwner(spender, tokenId));
    }
}

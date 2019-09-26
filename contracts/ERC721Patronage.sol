pragma solidity ^0.5.0;

// import "./ERC721.sol";
// import "./ERC721Enumerable.sol";
// import "./ERC721Metadata.sol";
import "../node_modules/@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721Full.sol";

/**i
 * @title Full ERC721 Token
 * This implementation includes all the required and some optional functionality of the ERC721 standard
 * Moreover, it includes approve all functionality using operator terminology
 * @dev see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 */
contract ERC721Patronage is ERC721Full {
    address public steward;
    bool public init = false;

    constructor (string memory name, string memory symbol) public {
      // TODO: make this all work the way that OpenZeppelin is designed to work.
      // ERC721Metadata.initialize(name, symbol);
        // solhint-disable-previous-line no-empty-blocks
    }

    function initialize(uint8 numberOfTokens, string memory uri) public {
        require(!init, "Already initialized");
        init = true;

        steward = msg.sender;
        // mint tokens
        for (uint8 i = 0; i < numberOfTokens; ++i){
          _mint(steward, i); // mint
          _setTokenURI(i, uri);
        }
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        // address owner = ownerOf(tokenId);
        // return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));

        // MODIFIED:
        // Only the steward is allowed to transfer
        return (spender == steward); 
    }
}

pragma solidity ^0.6.0;

interface IERC721Patronage {
    function ownerOf(uint256 tokenId) external view returns (address owner);

    function mintWithTokenURI(
        address to,
        uint256 tokenId,
        string memory tokenURI
    ) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}

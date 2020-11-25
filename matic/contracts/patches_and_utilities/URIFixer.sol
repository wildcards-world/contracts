pragma solidity ^0.6.0;

contract Initializable {
    bool private initialized;
    bool private initializing;
    uint256[50] private ______gap;
}

contract Context {}

interface IERC165 {}

contract IERC721 is Initializable, IERC165 {}

contract IERC721Receiver {}

library SafeMath {}

library Address {}

library Counters {
    using SafeMath for uint256;

    struct Counter {
        uint256 _value;
    }
}

contract ERC165 is Initializable, IERC165 {
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;

    mapping(bytes4 => bool) private _supportedInterfaces;

    uint256[50] private ______gap;
}

contract ERC721 is Initializable, Context, ERC165, IERC721 {
    using SafeMath for uint256;
    using Address for address;
    using Counters for Counters.Counter;

    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;

    mapping(uint256 => address) private _tokenOwner;

    mapping(uint256 => address) private _tokenApprovals;

    mapping(address => Counters.Counter) private _ownedTokensCount;

    mapping(address => mapping(address => bool)) private _operatorApprovals;

    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

    uint256[50] private ______gap;
}

contract IERC721Enumerable is Initializable, IERC721 {}

contract ERC721Enumerable is
    Initializable,
    Context,
    ERC165,
    ERC721,
    IERC721Enumerable
{
    mapping(address => uint256[]) private _ownedTokens;

    mapping(uint256 => uint256) private _ownedTokensIndex;

    uint256[] private _allTokens;

    mapping(uint256 => uint256) private _allTokensIndex;

    bytes4 private constant _INTERFACE_ID_ERC721_ENUMERABLE = 0x780e9d63;

    uint256[50] private ______gap;
}

contract IERC721Metadata is Initializable, IERC721 {}

contract ERC721Metadata is
    Initializable,
    Context,
    ERC165,
    ERC721,
    IERC721Metadata
{
    string private _name;

    string private _symbol;

    mapping(uint256 => string) _tokenURIs;

    bytes4 private constant _INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;

    uint256[50] private ______gap;
}

library Roles {
    struct Role {
        mapping(address => bool) bearer;
    }
}

contract MinterRole is Initializable, Context {
    using Roles for Roles.Role;

    Roles.Role private _minters;

    uint256[50] private ______gap;
}

contract ERC721MetadataMintable is
    Initializable,
    ERC721,
    ERC721Metadata,
    MinterRole
{
    uint256[49] private ______gap;
    address public metadataAdmin;
}

contract URIFixer is
    Initializable,
    ERC721,
    ERC721Enumerable,
    ERC721Metadata,
    ERC721MetadataMintable
{
    address public steward;

    // mapping(uint256 => bytes32) _tokenURInew;

    function setOwner(address upgradeAdmin) public {
        require(metadataAdmin == address(0)); // This can only be called once!
        metadataAdmin = upgradeAdmin;
    }

    function updateTokenUri(uint256 tokenIds, string memory newTokenUri)
        public
    {
        require(metadataAdmin == msg.sender);
        _tokenURIs[tokenIds] = newTokenUri;
    }
}

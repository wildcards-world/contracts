pragma solidity 0.5.15;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IERC20Mintable.sol";


contract MintManager_v2 is Initializable {
    using SafeMath for uint256;

    address public admin;
    address public steward;
    IERC20Mintable public token;

    modifier onlySteward() {
        require(msg.sender == steward, "Not steward");
        _;
    }

    function initialize(address _admin, address _steward, address _token)
        public
        initializer
    {
        admin = _admin;
        steward = _steward;
        token = IERC20Mintable(_token);
    }

    function tokenMint(address receiverOfTokens, uint256 time, uint256 mintRate)
        external
        onlySteward
    {
        uint256 amountToMintForUser = time.mul(mintRate);
        uint256 amountToMintForTreasury = amountToMintForUser.mul(20).div(100);
        token.mint(receiverOfTokens, amountToMintForUser);
        token.mint(admin, amountToMintForTreasury);
    }
}

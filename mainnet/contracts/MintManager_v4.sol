pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IERC20Mintable.sol";

contract MintManager_v4 is Initializable {
    using SafeMath for uint256;

    address public admin;
    address public steward;
    IERC20Mintable public token;
    address public maticErc20PredicateProxy;

    modifier onlySteward() {
        require(msg.sender == steward, "Not steward");
        _;
    }
    modifier onlyMaticErc20PredicateProxy() {
        require(msg.sender == maticErc20PredicateProxy, "Not erc20Predicate");
        _;
    }

    function addMaticPredicateProxy(address _maticErc20PredicateProxy)
        public
    // onlySteward
    {
        require(maticErc20PredicateProxy == address(0));
        maticErc20PredicateProxy = _maticErc20PredicateProxy;
    }

    function tokenMint(
        address receiverOfTokens,
        uint256 time,
        uint256 mintRate
    ) external onlySteward {
        uint256 amountToMintForUser = time.mul(mintRate);
        uint256 amountToMintForTreasury = amountToMintForUser.mul(20).div(100);

        token.mint(receiverOfTokens, amountToMintForUser);
        token.mint(admin, amountToMintForTreasury);
    }

    function safeTransfer(address withdrawer, uint256 amount)
        external
        onlyMaticErc20PredicateProxy
    {
        uint256 amountToMintForTreasury = amount.mul(2).div(100);

        token.mint(withdrawer, amount);
        token.mint(admin, amountToMintForTreasury);
    }

    function safeTransferFrom(
        address depositor,
        address maticErc20PredicateAddress,
        uint256 amount
    ) external onlyMaticErc20PredicateProxy {
        token.burnFrom(depositor, amount);
    }
}

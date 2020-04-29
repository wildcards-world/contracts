const { BN } = require("@openzeppelin/test-helpers");

const NUM_SECONDS_IN_YEAR = "31536000";

const STEWARD_CONTRACT_NAME = "./WildcardSteward_v2.sol";
const ERC721_CONTRACT_NAME = "./ERC721Patronage_v1.sol";
const ERC20_CONTRACT_NAME = "./ERC20PatronageReceipt_v2.sol";
const MINT_MANAGER_CONTRACT_NAME = "./MintManager_v2.sol";
const SENT_ATTACKER_CONTRACT_NAME = "./tests/SendBlockAttacker.sol";

// NOTE:: This was inspired by this question and the off by one second errors I was getting:
// https://ethereum.stackexchange.com/a/74558/4642
const waitTillBeginningOfSecond = () =>
  new Promise((resolve) => {
    const timeTilNextSecond = 1000 - new Date().getMilliseconds();
    setTimeout(resolve, timeTilNextSecond);
  });

module.exports = {
  STEWARD_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
  SENT_ATTACKER_CONTRACT_NAME,
  waitTillBeginningOfSecond,

  //patronage per token = price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  multiPatronageCalculator: () => (timeInSeconds, tokenArray) => {
    const totalPatronage = tokenArray.reduce(
      (totalPatronage, token) =>
        totalPatronage.add(
          new BN(token.price)
            .mul(new BN(timeInSeconds))
            .mul(new BN(token.patronageNumerator))
            .div(new BN("1000000000000"))
            .div(new BN(NUM_SECONDS_IN_YEAR))
        ),
      new BN("0")
    );
    return totalPatronage;
  },

  multiTokenCalculator: (timeInSeconds, tokenArray) => {
    const totalTokens = tokenArray.reduce(
      (totalTokens, token) =>
        totalTokens.add(
          new BN(token.tokenGenerationRate).mul(new BN(timeInSeconds))
        ),
      new BN("0")
    );
    return totalTokens;
  },
};

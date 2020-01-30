const { BN } = require("@openzeppelin/test-helpers");

const NUM_SECONDS_IN_YEAR = "31536000";

const STEWARD_CONTRACT_NAME = "./WildcardSteward_v1.sol";
const ERC721_CONTRACT_NAME = "./ERC721Patronage_v1.sol";

// NOTE:: This was inspired by this question and the off by one second errors I was getting:
// https://ethereum.stackexchange.com/a/74558/4642
const waitTillBeginningOfSecond = () =>
  new Promise(resolve => {
    const timeTilNextSecond = 1000 - new Date().getMilliseconds();
    setTimeout(resolve, timeTilNextSecond);
  });

module.exports = {
  STEWARD_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  waitTillBeginningOfSecond,

  //patronage per token = price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  multiPatronageCalculator: patronageDenominator => (
    timeInSeconds,
    tokenArray
  ) => {
    const totalPatronage = tokenArray.reduce(
      (totalPatronage, token) =>
        totalPatronage.add(
          new BN(token.price)
            .mul(new BN(timeInSeconds))
            .mul(new BN(token.patronageNumerator))
            .div(new BN(patronageDenominator))
            .div(new BN(NUM_SECONDS_IN_YEAR))
        ),
      new BN("0")
    );
    return totalPatronage;
  }
};

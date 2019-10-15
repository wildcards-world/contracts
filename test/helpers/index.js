const { BN } = require('@openzeppelin/test-helpers')

const NUM_SECONDS_IN_YEAR = '31536000'

module.exports = {
  //patronage per token = price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  multiPatronageCalculator: patronageDenominator => (timeInSeconds, tokenArray) => {
    const totalPatronage = tokenArray.reduce(
      (totalPatronage, token) =>
        totalPatronage.add(
          (new BN(token.price))
            .mul(new BN(timeInSeconds))
            .mul(new BN(token.patronageNumerator))
            .div(new BN(patronageDenominator))
            .div(new BN(NUM_SECONDS_IN_YEAR))
        )
      , new BN('0'));
    return totalPatronage
  }
};

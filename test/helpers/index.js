const { BN } = require("@openzeppelin/test-helpers");

const { promisify } = require("util");

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

const setupTimeManager = async (web3) => {
  const getCurrentTimestamp = async () => {
    return new BN(
      (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp
    );
  };
  const txTimestamp = async (transaction) => {
    const tx = await transaction;
    return new BN((await web3.eth.getBlock(tx.receipt.blockNumber)).timestamp);
  };
  const timeSince = async (timestampInThePast, tillTimestamp) => {
    const timeSince = tillTimestamp.sub(timestampInThePast);
    return timeSince;
  };
  const timeSinceTimestamp = async (timestampInThePast) => {
    return await timeSince(timestampInThePast, await getCurrentTimestamp());
  };
  const setNextTxTimestamp = async (timeIncrease) => {
    if (timeIncrease.lt(new BN("1"))) {
      throw "timeIncrease must be positive";
    }
    const timestamp = parseInt(
      (await getCurrentTimestamp()).add(timeIncrease).toString()
    );

    await promisify(web3.currentProvider.send.bind(web3.currentProvider))({
      jsonrpc: "2.0",
      method: "evm_setNextBlockTimestamp",
      params: [timestamp],
    });

    return new BN(timestamp);
  };

  return {
    setNextTxTimestamp,
    timeSinceTimestamp,
    timeSince,
    getCurrentTimestamp,
    txTimestamp,
  };
};

module.exports = {
  STEWARD_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
  SENT_ATTACKER_CONTRACT_NAME,
  waitTillBeginningOfSecond,
  setupTimeManager,

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

  patronageDue: (tokenArray) => {
    const totalPatronage = tokenArray.reduce(
      (totalPatronage, token) =>
        totalPatronage.add(
          new BN(token.price)
            .mul(new BN(token.timeHeld))
            .mul(new BN(token.patronageNumerator))
            .div(new BN("31536000000000000000")) // = 1 year * patronageDenominator = 365 days * 1000000000000
        ),
      new BN("0")
    );
    return totalPatronage;
  },

  // startPrice - ( ( (startPrice - endPrice) * howLongThisAuctionBeenGoing ) / auctionLength )
  auctionCalculator: (
    auctionStartPrice,
    auctionEndPrice,
    auctionLength,
    howLongThisAuctionBeenGoing
  ) => {
    let diff = auctionStartPrice.sub(auctionEndPrice);
    return auctionStartPrice.sub(
      diff.mul(new BN(howLongThisAuctionBeenGoing)).div(new BN(auctionLength))
    );
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

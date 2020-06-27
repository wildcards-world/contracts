const { BN } = require("@openzeppelin/test-helpers");

const { promisify } = require("util");

const NUM_SECONDS_IN_YEAR = "31536000";
const STEWARD_CONTRACT_NAME = "./WildcardSteward_v3.sol";
const ERC721_CONTRACT_NAME = "./ERC721Patronage_v1.sol";
const ERC20_CONTRACT_NAME = "./ERC20PatronageReceipt_v2.sol";
const MINT_MANAGER_CONTRACT_NAME = "./MintManager_v2.sol";
const SENT_ATTACKER_CONTRACT_NAME = "./tests/SendBlockAttacker.sol";
const abi = require("ethereumjs-abi");
const ethUtil = require("ethereumjs-util");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);

const launchTokens = async (steward, tokenParameters) => {
  return await steward.listNewTokens(
    tokenParameters.map((item) => item.token),
    tokenParameters.map((item) => item.benefactor),
    tokenParameters.map((item) => item.patronageNumerator),
    tokenParameters.map((item) => item.tokenGenerationRate),
    tokenParameters.map((item) => item.artist),
    tokenParameters.map((item) => item.artistCommission),
    tokenParameters.map((item) => item.releaseDate)
  );
};
const initialize = async (
  admin,
  withdrawCheckerAdmin,
  auctionStartPrice,
  auctionEndPrice,
  auctionLength,
  tokenParameters
) => {
  const erc721 = await ERC721token.new({ from: admin });
  const steward = await WildcardSteward.new({ from: admin });
  const mintManager = await MintManager.new({ from: admin });
  const erc20 = await ERC20token.new("Wildcards Loyalty Token", "WLT", 18, {
    from: admin,
  });
  await mintManager.initialize(admin, steward.address, erc20.address, {
    from: admin,
  });
  await erc20.addMinter(mintManager.address, {
    from: admin,
  });
  await erc20.renounceMinter({ from: admin });
  await erc721.setup(
    steward.address,
    "ALWAYSFORSALETestToken",
    "AFSTT",
    admin,
    { from: admin }
  );
  await erc721.addMinter(steward.address, { from: admin });
  await erc721.renounceMinter({ from: admin });
  // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
  // address _assetToken,
  // address _admin,
  // address _mintManager,
  // address _withdrawCheckerAdmin,
  // uint256 _auctionStartPrice,
  // uint256 _auctionEndPrice,
  // uint256 _auctionLength
  await steward.initialize(
    erc721.address,
    admin,
    mintManager.address,
    withdrawCheckerAdmin,
    auctionStartPrice,
    auctionEndPrice,
    auctionLength
  );

  await launchTokens(steward, tokenParameters);

  return {
    erc721,
    steward,
    mintManager,
    erc20,
  };
};

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
  const timeSince = (timestampInThePast, tillTimestamp) => {
    const timeSince = tillTimestamp.sub(timestampInThePast);
    return timeSince;
  };
  const timeSinceTimestamp = async (timestampInThePast) => {
    return timeSince(timestampInThePast, await getCurrentTimestamp());
  };
  const setNextTxTimestamp = async (timeIncrease) => {
    const timeIncreaseBN = new BN(timeIncrease);
    if (timeIncreaseBN.lt(new BN("1"))) {
      throw "timeIncrease must be positive";
    }
    const timestamp = parseInt(
      (await getCurrentTimestamp()).add(timeIncreaseBN).toString()
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

const withdrawBenefactorFundsAll = async (
  steward,
  web3,
  withdrawCheckerAdmin,
  benefactor,
  maxAmount,
  expiry,
  from
) => {
  const hash =
    "0x" +
    abi
      .soliditySHA3(
        ["address", "uint256", "uint256"],
        [benefactor, maxAmount, expiry]
      )
      .toString("hex");

  const signature = await web3.eth.sign(hash, withdrawCheckerAdmin);

  const { r, s, v } = ethUtil.fromRpcSig(signature);
  // NOTE: The below 3 lines do the same thing as the above line, kept for reference.
  // const r = signature.slice(0, 66);
  // const s = "0x" + signature.slice(66, 130);
  // const v = web3.utils.toDecimal("0x" + signature.slice(130, 132));

  // this prefix is required by the `ecrecover` builtin solidity function (other than that it is pretty arbitrary)
  const prefix = "\x19Ethereum Signed Message:\n32";
  const prefixedBytes = web3.utils.fromAscii(prefix) + hash.slice(2);
  const prefixedHash = web3.utils.sha3(prefixedBytes, { encoding: "hex" });

  // // For reforence, how to recover a signature with javascript.
  // const recoveredPub = ethUtil.ecrecover(
  //   ethUtil.toBuffer(prefixedHash),
  //   sigDecoded.v,
  //   sigDecoded.r,
  //   sigDecoded.s
  // );
  // const recoveredAddress = ethUtil.pubToAddress(recoveredPub).toString("hex");

  return await steward.withdrawBenefactorFundsToValidated(
    benefactor,
    maxAmount,
    expiry,
    prefixedHash,
    v,
    r,
    s,
    {
      from: from || benefactor,
      gasPrice: "0", // Set gas price to 0 for simplicity
    }
  );
};

module.exports = {
  STEWARD_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
  SENT_ATTACKER_CONTRACT_NAME,
  setupTimeManager,
  initialize,
  launchTokens,
  withdrawBenefactorFundsAll,
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

  multiTokenCalculator: (tokenArray) => {
    const totalTokens = tokenArray.reduce(
      (totalTokens, token) =>
        totalTokens.add(
          new BN(token.tokenGenerationRate).mul(new BN(token.timeHeld))
        ),
      new BN("0")
    );
    return totalTokens;
  },
};

// Load zos scripts and truffle wrapper function
const { scripts, ConfigManager } = require("@openzeppelin/cli");
const { add, push, create } = scripts;

const WildcardSteward_v3_matic = artifacts.require("WildcardSteward_v3_matic");
const MintManager_v2 = artifacts.require("MintManager_v2");

async function deploy(options, accounts) {
  console.log("1");
  add({
    contractsData: [
      { name: "ERC721Patronage_v1", alias: "ERC721Patronage" },
      { name: "WildcardSteward_v3_matic", alias: "WildcardSteward" },
      {
        name: "ERC20PatronageReceipt_v2_upgradable",
        alias: "ERC20PatronageReceipt",
      },
      { name: "MintManager_v2", alias: "MintManager" },
    ],
  });
  console.log("2");

  await push({ ...options, force: true });
  console.log("3");

  const mintManager = await create(
    Object.assign({ contractAlias: "MintManager" }, options)
  );
  console.log("4");
  const steward = await create(
    Object.assign({ contractAlias: "WildcardSteward" }, options)
  );
  console.log("5");
  const patronageToken = await create({
    ...options,
    contractAlias: "ERC721Patronage",
    methodName: "setup",
    methodArgs: [steward.address, "WildcardsTokens", "WT", mintManager.address],
  });
  console.log("5");
  const patronageReceiptToken = await create({
    ...options,
    contractAlias: "ERC20PatronageReceipt",
    methodName: "setup",
    methodArgs: ["Wildcards Loyalty Token", "WLT", 18, steward.address],
  });
  console.log("6");

  //STEWARD
  const wildcardStewardContract = await WildcardSteward_v3_matic.at(
    steward.address
  );

  await wildcardStewardContract.initialize(
    // address _assetToken,
    patronageToken.address,
    // address _admin,
    accounts[0],
    // address _mintManager,
    mintManager.address,
    // address _withdrawCheckerAdmin,
    accounts[0],
    // uint256 _auctionStartPrice,
    "200000000000000000000", // 200 DAI
    // uint256 _auctionEndPrice,
    "5000000000000000000", // 5 DAI
    // uint256 _auctionLength
    "604800", // 1week = 60*60*24*7
    { from: accounts[0] }
  );

  // MINT MANAGER
  const mintManagerContract = await MintManager_v2.at(mintManager.address);
  await mintManagerContract.initialize(
    // address _admin,
    accounts[0],
    // address _steward,
    steward.address,
    // address _token
    patronageToken.address,
    { from: accounts[0] }
  );
}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }
    const { network, txParams } = await ConfigManager.initNetworkConfiguration({
      network: networkName,
      from: accounts[0],
    });
    await deploy({ network, txParams }, accounts);
  });
};

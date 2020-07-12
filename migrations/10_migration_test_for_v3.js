const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, update } = scripts;

const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");
const WildcardSteward_v3 = artifacts.require("WildcardSteward_v3");

const adminCheckerAddress = "0xDcC54cd9876230571bB68cC6d38ddeFc50095224";

async function deploy(options) {
  add({
    contractsData: [{ name: "WildcardSteward_v3", alias: "WildcardSteward" }],
  });

  // Push implementation contracts to the network
  await push({ ...options, force: true }); // I have to use force here because OpenZeppelin is being difficult :/ (and this is a hacky solution anyway...)
  const tokensToUpgrade = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "42",
  ];

  // Update instance, adding +10 to value as part of the migration
  let result = await update({
    ...options,
    contractAlias: "WildcardSteward",
    methodName: "upgradeToV3",
    methodArgs: [
      tokensToUpgrade,
      adminCheckerAddress,
      "1000000000000000000", // 1 ETH
      "50000000000000000", // 0.05 ETH
      "604800", // auction length 1week = 60*60*24*7
    ],
  });

  console.log(result);

  // // Validate that the upgrade was successful:
  // const steward_v0 = await WildcardSteward_v0.deployed();
  // const steward = await WildcardSteward_v3.at(steward_v0.address);
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

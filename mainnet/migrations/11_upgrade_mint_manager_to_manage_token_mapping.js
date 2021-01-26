const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, update } = scripts;

const goerliErc20Predicate = "0xdD6596F2029e6233DEFfaCa316e6A95217d4Dc34";
const mainnetErc20Predicate = "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf";

async function deploy(options, accounts, networkName) {
  add({
    contractsData: [{ name: "MintManager_v4", alias: "MintManager" }],
  });
  console.log("Added the contract");
  // Push implementation contracts to the network
  await push({ ...options, force: true }); // I have to use force here because OpenZeppelin is being difficult :/ (and this is a hacky solution anyway...)
  console.log("FINISHED PUSHING");

  if (networkName === "goerli") {
    // Update instance, adding +10 to value as part of the migration
    let result = await update({
      ...options,
      contractAlias: "MintManager",
      methodName: "addMaticPredicateProxy",
      methodArgs: [goerliErc20Predicate],
    });
  } else {
    let result = await update({
      ...options,
      contractAlias: "MintManager",
      methodName: "addMaticPredicateProxy",
      methodArgs: [mainnetErc20Predicate],
    });
  }

  console.log("Finished upgrading the mint manager to act as the token bridge");
}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }

    console.log({ networkName });

    const { network, txParams } = await ConfigManager.initNetworkConfiguration({
      network: networkName,
      from: accounts[0],
    });
    await deploy({ network, txParams }, accounts, networkName);
  });
};

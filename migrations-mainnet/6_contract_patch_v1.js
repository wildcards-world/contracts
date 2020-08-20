const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, update } = scripts;

async function deploy(options) {
  add({
    contractsData: [{ name: "ERC721Patronage_v1", alias: "ERC721Patronage" }]
  });

  // Push implementation contracts to the network
  await push({ ...options, force: true }); // I have to use force here because OpenZeppelin is being difficult :/ (and this is a hacky solution anyway...)

  // Update instance, adding +10 to value as part of the migration
  await update(
    Object.assign(
      {
        contractAlias: "ERC721Patronage"
      },
      options
    )
  );

  add({
    contractsData: [{ name: "WildcardSteward_v1", alias: "WildcardSteward" }]
  });
  await push({ ...options, force: true }); // I have to use force here because OpenZeppelin is being difficult :/ (and this is a hacky solution anyway...)
  await update(
    Object.assign(
      {
        contractAlias: "WildcardSteward"
      },
      options
    )
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
      from: accounts[0]
    });
    await deploy({ network, txParams });
  });
};

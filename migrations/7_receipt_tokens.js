const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, create, update } = scripts;
const WildcardSteward_v1 = artifacts.require("WildcardSteward_v1");
const MintManager_v2 = artifacts.require("MintManager_v2");

async function deploy(options, accounts) {
  // Manually putting the address here since not sure why trying to fetch it fails.
  const stewardAddress = "0x935AC70f8F1013A97F0aEEf9ABD1421002989D18"; //(await WildcardSteward_v1.deployed()).address;

  add({
    contractsData: [
      { name: "WildcardSteward_v2", alias: "WildcardSteward" },
      { name: "MintManager_v2", alias: "MintManager" },
      { name: "ERC20PatronageReceipt_v2", alias: "ERC20PatronageReceipt" }
    ]
  });

  // Push implementation contracts to the network
  await push({ ...options, force: true });

  // Update instance
  const erc20 = await create(
    Object.assign(
      {
        contractAlias: "ERC20PatronageReceipt",
        methodName: "initialize",
        methodArgs: [
          "Wildcards Loyalty Token",
          "WLT",
          18,
          accounts[0] /* NOTE: for now the 'admin' will also be able to mint tokens */
        ]
      },
      options
    )
  );
  const mintManager = await create(
    Object.assign(
      {
        contractAlias: "MintManager",
        methodName: "initialize",
        methodArgs: [accounts[0], stewardAddress, erc20.address]
      },
      options
    )
  );
  erc20.addMinter(mintManager.address);
  await update(
    Object.assign(
      {
        contractAlias: "WildcardSteward",
        methodName: "addTokenGenerationRateToExistingTokens",
        methodArgs: [
          [
            /* TODO: token ids */
          ],
          [
            /* TODO: generation rates */
          ]
        ]
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

    if (networkName === "test") {
      return;
    }

    const { network, txParams } = await ConfigManager.initNetworkConfiguration({
      network: networkName,
      from: accounts[0]
    });
    await deploy({ network, txParams }, accounts);
  });
};

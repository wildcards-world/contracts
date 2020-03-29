const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, create, update } = scripts;
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");
const ERC20PatronageReceipt_v2 = artifacts.require("ERC20PatronageReceipt_v2");

const receiptGenerationRate = 11574074074074; // This is just less (rounded down) than one token a day (ie. 10^18 / 86400)

async function deploy(options, accounts, erc20PatronageReceipt_v2) {
  const stewardAddress = (await WildcardSteward_v0.deployed()).address;

  console.log("1");
  add({
    contractsData: [
      { name: "WildcardSteward_v2", alias: "WildcardSteward" },
      { name: "MintManager_v2", alias: "MintManager" }
    ]
  });

  console.log("2");
  // Push implementation contracts to the network
  await push({ ...options, force: true });

  console.log("3");
  // Update instances
  const mintManager = await create(
    Object.assign(
      {
        contractAlias: "MintManager",
        methodName: "initialize",
        methodArgs: [
          accounts[0],
          stewardAddress,
          erc20PatronageReceipt_v2.address
        ]
      },
      options
    )
  );
  await erc20PatronageReceipt_v2.addMinter(mintManager.address);
  erc20PatronageReceipt_v2.renounceMinter({ from: accounts[0] });

  console.log("5");
  await update(
    Object.assign(
      {
        contractAlias: "WildcardSteward",
        methodName: "updateToV2",
        methodArgs: [
          mintManager.address,
          [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 42],
          [
            receiptGenerationRate,
            receiptGenerationRate,
            receiptGenerationRate,
            receiptGenerationRate,

            receiptGenerationRate,
            receiptGenerationRate,
            receiptGenerationRate,
            receiptGenerationRate,

            receiptGenerationRate,
            receiptGenerationRate,
            receiptGenerationRate,
            receiptGenerationRate,

            receiptGenerationRate
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

    const erc20PatronageReceipt_v2 = await deployer.deploy(
      ERC20PatronageReceipt_v2,
      "Wildcards Loyalty Token",
      "WLT",
      18
    );
    // const erc20PatronageReceipt_v2 = await ERC20PatronageReceipt_v2.deployed();

    const { network, txParams } = await ConfigManager.initNetworkConfiguration({
      network: networkName,
      from: accounts[0]
    });
    await deploy({ network, txParams }, accounts, erc20PatronageReceipt_v2);
  });
};

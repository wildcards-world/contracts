// Load zos scripts and truffle wrapper function
const { scripts, ConfigManager } = require("@openzeppelin/cli");
const { add, push, create } = scripts;

async function deploy(options, accounts) {
  console.log("1");
  add({
    contractsData: [
      {
        name: "ERC20PatronageReceipt_v2_upgradable",
        alias: "ERC20PatronageReceipt_upgradable",
      },
      { name: "ERC721Patronage_v1", alias: "ERC721Patronage" },
      { name: "AFSSteward_v3_matic", alias: "AFSSteward" },
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
    Object.assign({ contractAlias: "AFSSteward" }, options)
  );
  console.log("5");
  const patronageToken = await create({
    ...options,
    contractAlias: "ERC721Patronage",
    // methodName: "setup",
    // methodArgs: [steward.address, "WildcardsTokens", "WT", accounts[0]],
  });
  console.log("5");
  const patronageReceiptToken = await create({
    ...options,
    contractAlias: "ERC20PatronageReceipt_upgradable",
    // methodName: "setup",
    // methodArgs: ["Wildcards Loyalty Token", "WLT", accounts[0], accounts[0]],
  });
  console.log("6");
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

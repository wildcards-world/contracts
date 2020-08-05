const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, update } = scripts;

const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const ERC721Patronage_v2 = artifacts.require("ERC721Patronage_v2");

const adminCheckerAddress = "0xDcC54cd9876230571bB68cC6d38ddeFc50095224";

async function deploy(options) {
  console.log(options);
  add({
    contractsData: [{ name: "ERC721Patronage_v2", alias: "ERC721Patronage" }],
  });

  // Push implementation contracts to the network
  await push({ ...options, force: true }); // I have to use force here because OpenZeppelin is being difficult :/ (and this is a hacky solution anyway...)

  // Update instance, adding +10 to value as part of the migration
  let result = await update({
    ...options,
    contractAlias: "ERC721Patronage",
  });

  console.log(result);

  // // Validate that the upgrade was successful:
  // const steward_v0 = await ERC721Patronage_v0.deployed();
  // const steward = await ERC721Patronage_v2.at(steward_v0.address);
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
    throw "Don't save migration!";
  });
};

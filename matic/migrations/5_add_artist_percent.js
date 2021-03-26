const WildcardSteward_v3 = artifacts.require("WildcardSteward_matic_v0");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, update } = scripts;

async function deploy(options) {
  add({
    contractsData: [
      { name: "WildcardSteward_matic_v1", alias: "WildcardSteward" },
    ],
  });

  // Push implementation contracts to the network
  await push({ ...options, force: true }); // I have to use force here because OpenZeppelin is being difficult :/ (and this is a hacky solution anyway...)

  await update(
    Object.assign(
      {
        contractAlias: "WildcardSteward",
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
      from: accounts[0],
    });
    await deploy({ network, txParams });
  });
};

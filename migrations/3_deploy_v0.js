const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const WildcardSteward_v3_matic = artifacts.require("WildcardSteward_v3_matic");
const MintManager_v2 = artifacts.require("MintManager_v2");
const ERC20PatronageReceipt_v2 = artifacts.require(
  "ERC20PatronageReceipt_v2_upgradable"
);

const { ConfigManager } = require("@openzeppelin/cli");

async function deploy(options, accounts) {
  const patronageERC721 = await ERC721Patronage_v1.deployed();
  const patronageERC20 = await ERC20PatronageReceipt_v2.deployed();
  const steward = await WildcardSteward_v3_matic.deployed();
  const mintManager = await MintManager_v2.deployed();

  console.log("1");
  await patronageERC721.setup(
    steward.address,
    "WildcardsTokens",
    "WT",
    steward.address
  );

  console.log("2");

  await patronageERC20.addMinter(steward.address);
  console.log("3");
  await patronageERC20.renounceMinter();
  console.log("4");

  //STEWARD

  await steward.initialize(
    // address _assetToken,
    patronageERC721.address,
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
    patronageERC721.address,
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

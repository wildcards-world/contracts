const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./Dai.sol");
const WildcardSteward_v3_matic = artifacts.require("WildcardSteward_v3_matic");
const MintManager_v2 = artifacts.require("MintManager_v2");
const ERC20PatronageReceipt_v2 = artifacts.require(
  "ERC20PatronageReceipt_v2_upgradable"
);

const { ConfigManager } = require("@openzeppelin/cli");

async function deploy(options, accounts, deployer) {
  let paymentTokenAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
  // If it isn't matic mainnet, deploy our own dai implementation.
  if (options.networkName != "matic") {
    const networkId = await web3.eth.net.getId();
    console.log("NETWORK ID", networkId);
    const paymentToken = await deployer.deploy(Dai, networkId, {
      from: accounts[0],
    });
    paymentTokenAddress = paymentToken.address;
  }
  console.log({ paymentTokenAddress });

  const patronageERC721 = await ERC721Patronage_v1.deployed();
  const patronageERC20 = await ERC20PatronageReceipt_v2.deployed();
  const steward = await WildcardSteward_v3_matic.deployed();
  const mintManager = await MintManager_v2.deployed();

  console.log("1");
  await patronageERC721.setup(
    steward.address,
    "WildcardsTokens",
    "WT",
    steward.address,
    accounts[0]
  );

  console.log("2");

  await patronageERC20.setup(
    "Wildcards Loyalty Token",
    "WLT",
    mintManager.address,
    accounts[0]
  );

  // GSN TESTING!
  // await patronageERC20.addMinter(accounts[0]);
  // await patronageERC20.setTrustedForwarder(
  //   "0x844849A90479a12FFc549c8Da98E362575FF78d7"
  // );

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
    paymentTokenAddress,
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
    patronageERC20.address,
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

    await deploy({ network, txParams }, accounts, deployer);
  });
};

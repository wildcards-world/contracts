const ERC20_CONTRACT_NAME = "./ERC20PatronageReceipt_v2.sol";
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);

const deploy = async (options, accounts) => {
  const admin = accounts[0];

  const localDAI = await ERC20token.new("Local DAI", "LDAI", 18, {
    from: admin,
  });

  return localDAI;
};

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

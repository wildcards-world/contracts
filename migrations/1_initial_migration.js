const Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer, networkName) {
  if (networkName === "test") {
    return;
  }
  deployer.deploy(Migrations);
};

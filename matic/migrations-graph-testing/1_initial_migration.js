const Migrations = artifacts.require("./Migrations.sol");

module.exports = function (deployer, networkName, accounts) {
  // throw "Remove this line if you really do want to restart your migrations. Otherwise check all the config is correct!";
  deployer.deploy(Migrations);
};

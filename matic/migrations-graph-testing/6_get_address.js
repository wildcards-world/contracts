const WildcardSteward_v3 = artifacts.require("WildcardSteward_matic_v2");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

let org1 = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
let org2 = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";

module.exports = function (deployer, networkName, accounts) {
  deployer.then(async () => {
    const steward = await WildcardSteward_v3.deployed();
    const patronageToken = await ERC721Patronage_v1.deployed();
    console.log({
      steward: steward.address,
      patronageToken: patronageToken.address
    })
    throw new Error("some error");
  });

};

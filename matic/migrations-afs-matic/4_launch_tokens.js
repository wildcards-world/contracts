const AFSSteward_v3 = artifacts.require("AFSSteward_v3_matic");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const starHarbergerTaxRateAnimal = "240" + "0000000000"; // Harberger tax rate of 240% per year

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }

    const steward = await AFSSteward_v3.deployed();
    const patronageToken = await ERC721Patronage_v1.deployed();

    const isMinter = await patronageToken.isMinter(steward.address);
    console.log("steward address After", steward.address);

    console.log("IS MINTER?", isMinter);
    console.log("before minting");
    await steward.listNewTokens(
      ["26", "27", "28", "29"],
      [
        testAccountAddress,
        testAccountAddress,
        testAccountAddress,
        testAccountAddress,
      ],
      [
        starHarbergerTaxRateAnimal,
        starHarbergerTaxRateAnimal,
        starHarbergerTaxRateAnimal,
        starHarbergerTaxRateAnimal,
      ],
      [],
      [],
      [1598186000, 1598186000, 1598186000, 1598186000],
      { from: accounts[0] }
    );
    console.log("After minting");
  });
};

const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const WildcardSteward_v3 = artifacts.require("WildcardSteward_v3");

const laSendaVerdeAddress = "0x6e2a8814bE551B263f9B95A721D32d33877Ee5Ec";
const darwinAnimalDoctorsAddress = "0x233f9bcb02bfAD03aAcCb6cE40b6C4f83C867603";
const tempWhaleConservancyAccount =
  "0x4245284F5D377E5d2d86306e836c8df33152c94e";
const bdiAddress = "0xADad0D21ba0E4b356e2b2769e08CfeF206f83891";
const saveWildAddress = "0xc0eD94f053E7Ee5f24DCebbfd4dcF16d8E767d5F";
const pangolinAfricaAddress = "0x0471C0ADbF27c53FbCf122C829807bd3DE3fec55";

const sliceHarbergerTaxRateAnimal = "120" + "0000000000"; // Harberger tax rate of 120% per year
const charlesHarbergerTaxRate = "6000000000000"; // Harberger tax rate of 600% per year
const starHarbergerTaxRateAnimal = "240" + "0000000000"; // Harberger tax rate of 240% per year
const harbergerTaxRatePendo = "120" + "0000000000"; // Harberger tax rate of 600% per year

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }

    const patronageToken_v0 = await ERC721Patronage_v0.deployed();
    const steward_v0 = await WildcardSteward_v0.deployed();
    const patronageToken = await ERC721Patronage_v1.at(
      patronageToken_v0.address
    );
    const steward = await WildcardSteward_v3.at(steward_v0.address);

    await patronageToken.addMinter(steward_v0.address);
    await patronageToken.renounceMinter();

    await steward.listNewTokens(
      ["22", "23", "24", "25"],
      [
        tempWhaleConservancyAccount,
        bdiAddress,
        tempWhaleConservancyAccount,
        pangolinAfricaAddress,
      ],
      [
        sliceHarbergerTaxRateAnimal,
        charlesHarbergerTaxRate,
        starHarbergerTaxRateAnimal,
        harbergerTaxRatePendo,
      ],
      [],
      [],
      [1596541800, 1596551800, 1596591800, 1596690305],
      { from: accounts[0] }
    );

    throw "don't continue";
  });
};

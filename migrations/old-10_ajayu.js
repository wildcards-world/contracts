const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const WildcardSteward_v2 = artifacts.require("WildcardSteward_v2");

const receiptGenerationRate = 11574074074074; // This is just less (rounded down) than one token a day (ie. 10^18 / 86400)
const tokenIdAnimalId = "18";

const conservationOrganizationAddress =
  "0x6e2a8814bE551B263f9B95A721D32d33877Ee5Ec";
//                        6000000000000
const harbergerTaxRateAnimal = "600" + "0000000000"; // Harberger tax rate of 600% per year

module.exports = function(deployer, networkName, accounts) {
  throw "this is 10";
  return deployer
    .then(async () => {
      // Don't try to deploy/migrate the contracts for tests
      if (networkName === "test") {
        return;
      }

      const patronageToken_v0 = await ERC721Patronage_v0.deployed();
      const steward_v0 = await WildcardSteward_v0.deployed();
      const patronageToken = await ERC721Patronage_v1.at(
        patronageToken_v0.address
      );
      const steward = await WildcardSteward_v2.at(steward_v0.address);

      let tx = await patronageToken.mintWithTokenURI(
        steward.address,
        tokenIdAnimalId,
        `https://wildcards.xyz/token/${tokenIdAnimalId}`,
        { from: accounts[0], gas: 681877 }
      );

      console.log(tx);

      await steward.listNewTokens(
        [tokenIdAnimalId],
        [conservationOrganizationAddress],
        [harbergerTaxRateAnimal],
        [receiptGenerationRate],
        { from: accounts[0], gas: 615225 }
      );
      throw "Don't continue 10";
    })
    .then(() => {
      throw "Don't continue 10";
    });
};

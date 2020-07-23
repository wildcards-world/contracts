const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const WildcardSteward_v2 = artifacts.require("WildcardSteward_v2");

const receiptGenerationRate = 11574074074074; // This is just less (rounded down) than one token a day (ie. 10^18 / 86400)
const tokenIdEspumita = "8";
const tokenIdUcok = "14";
const tokenIdTarkus = "15";
const tokenIdHook = "16";
const tokenIdMijungla = "17";
const laSendaVerdeAddress = "0x6e2a8814bE551B263f9B95A721D32d33877Ee5Ec";
const darwinAnimalDoctorsAddress = "0x233f9bcb02bfAD03aAcCb6cE40b6C4f83C867603";
const tempWhaleConservancyAccount =
  "0x4245284F5D377E5d2d86306e836c8df33152c94e";
const bdiAddress = "0xADad0D21ba0E4b356e2b2769e08CfeF206f83891";
const saveWildAddress = "0xc0eD94f053E7Ee5f24DCebbfd4dcF16d8E767d5F";
//                        6000000000000
const harbergerTaxRate = "6000000000000"; // Harberger tax rate of 600% per year
const harbergerTaxRateTarkus = "2400000000000"; // Harberger tax rate of 240% per year
const harbergerTaxRateHook = "2400000000000";
const harbergerTaxRateStar = "2400000000000";
const harbergerTaxRateMijungla = "6000000000000";

const ajayuTokenId = "18";

const ajayuHarbergerTaxRateAnimal = "600" + "0000000000";

const arthurTokenId = "19";

const arthurHarbergerTaxRateAnimal = "240" + "0000000000";

const aboTokenId = "20";

const aboHarbergerTaxRateAnimal = "120" + "0000000000"; // Harberger tax rate of 120% per year

const whackyCappyTokenId = "21";

const whackyCappyHarbergerTaxRateAnimal = "240" + "0000000000"; // Harberger tax rate of 120% per year
const sliceTokenId = "22";

const sliceHarbergerTaxRateAnimal = "120" + "0000000000"; // Harberger tax rate of 120% per year

const starTokenId = "24";

const starHarbergerTaxRateAnimal = "240" + "0000000000"; // Harberger tax rate of 240% per year

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
    const steward = await WildcardSteward_v2.at(steward_v0.address);

    await Promise.all([
      patronageToken.mintWithTokenURI(
        steward.address,
        tokenIdEspumita,
        "https://wildcards.xyz/token/8",
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        tokenIdUcok,
        "https://wildcards.xyz/token/14",
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        tokenIdTarkus,
        "https://wildcards.xyz/token/15",
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        tokenIdHook,
        "https://wildcards.xyz/token/16",
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        tokenIdMijungla,
        "https://wildcards.xyz/token/17",
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        ajayuTokenId,
        `https://wildcards.xyz/token/${ajayuTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        arthurTokenId,
        `https://wildcards.xyz/token/${arthurTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        aboTokenId,
        `https://wildcards.xyz/token/${aboTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        whackyCappyTokenId,
        `https://wildcards.xyz/token/${whackyCappyTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        sliceTokenId,
        `https://wildcards.xyz/token/${sliceTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        starTokenId,
        `https://wildcards.xyz/token/${starTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
    ]);

    await steward.listNewTokens(
      [
        tokenIdEspumita,
        tokenIdUcok,
        tokenIdTarkus,
        tokenIdHook,
        tokenIdMijungla,
        ajayuTokenId,
        arthurTokenId,
        aboTokenId,
        whackyCappyTokenId,
        sliceTokenId,
        starTokenId,
      ],
      [
        laSendaVerdeAddress,
        darwinAnimalDoctorsAddress,
        laSendaVerdeAddress,
        tempWhaleConservancyAccount,
        laSendaVerdeAddress,
        laSendaVerdeAddress,
        saveWildAddress,
        bdiAddress,
        bdiAddress,
        tempWhaleConservancyAccount,
        tempWhaleConservancyAccount,
      ],
      [
        harbergerTaxRate,
        harbergerTaxRate,
        harbergerTaxRateTarkus,
        harbergerTaxRateHook,
        harbergerTaxRateMijungla,
        ajayuHarbergerTaxRateAnimal,
        arthurHarbergerTaxRateAnimal,
        aboHarbergerTaxRateAnimal,
        whackyCappyHarbergerTaxRateAnimal,
        sliceHarbergerTaxRateAnimal,
        starHarbergerTaxRateAnimal,
      ],
      [
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
        receiptGenerationRate,
      ],
      { from: accounts[0], gas: 6152250 }
    );
  });
};

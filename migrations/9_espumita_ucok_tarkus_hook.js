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
const ajayuTokenId = "18";
const arthurTokenId = "19";
const aboTokenId = "20";
const whackyCappyTokenId = "21";
const sliceTokenId = "22";
const charlesTokenId = "23";
const starTokenId = "24";
const tokenIdPendo = "25";

const laSendaVerdeAddress = "0x6e2a8814bE551B263f9B95A721D32d33877Ee5Ec";
const darwinAnimalDoctorsAddress = "0x233f9bcb02bfAD03aAcCb6cE40b6C4f83C867603";
const tempWhaleConservancyAccount =
  "0x4245284F5D377E5d2d86306e836c8df33152c94e";
const bdiAddress = "0xADad0D21ba0E4b356e2b2769e08CfeF206f83891";
const saveWildAddress = "0xc0eD94f053E7Ee5f24DCebbfd4dcF16d8E767d5F";
const pangolinAfricaAddress = "0x0471C0ADbF27c53FbCf122C829807bd3DE3fec55";

const harbergerTaxRate = "6000000000000"; // Harberger tax rate of 600% per year
const harbergerTaxRateTarkus = "2400000000000"; // Harberger tax rate of 240% per year
const harbergerTaxRateHook = "2400000000000";
const harbergerTaxRateMijungla = "6000000000000";
const ajayuHarbergerTaxRateAnimal = "600" + "0000000000";
const arthurHarbergerTaxRateAnimal = "240" + "0000000000";
const aboHarbergerTaxRateAnimal = "120" + "0000000000"; // Harberger tax rate of 120% per year
const whackyCappyHarbergerTaxRateAnimal = "240" + "0000000000"; // Harberger tax rate of 240% per year
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
        `https://wildcards.xyz/token/${charlesTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        starTokenId,
        `https://wildcards.xyz/token/${starTokenId}`,
        { from: accounts[0], gas: 681877 }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        starTokenId,
        `https://wildcards.xyz/token/${tokenIdPendo}`,
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
        charlesTokenId,
        starTokenId,
        tokenIdPendo,
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
        bdiAddress,
        tempWhaleConservancyAccount,
        pangolinAfricaAddress,
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
        charlesHarbergerTaxRate,
        starHarbergerTaxRateAnimal,
        harbergerTaxRatePendo,
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
        receiptGenerationRate,
        receiptGenerationRate,
      ],
      { from: accounts[0], gas: 9152250 }
    );
  });
};

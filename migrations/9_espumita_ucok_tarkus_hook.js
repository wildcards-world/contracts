const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const WildcardSteward_v2 = artifacts.require("WildcardSteward_v2");

const receiptGenerationRate = 11574074074074; // This is just less (rounded down) than one token a day (ie. 10^18 / 86400)
const tokenIdEspumita = "8";
const tokenIdUcok = "14";
const tokenIdTarkus = "15";
const tokenIdHook = "16";
const laSendaVerdeAddress = "0x6e2a8814bE551B263f9B95A721D32d33877Ee5Ec";
const darwinAnimalDoctorsAddress = "0x233f9bcb02bfAD03aAcCb6cE40b6C4f83C867603";
const tempWhaleConservancyAccount =
  "0x4245284F5D377E5d2d86306e836c8df33152c94e";
//                        6000000000000
const harbergerTaxRate = "6000000000000"; // Harberger tax rate of 600% per year
const harbergerTaxRateTarkus = "2400000000000"; // Harberger tax rate of 240% per year
const harbergerTaxRateHook = "2400000000000";

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
    ]);

    /*
      uint256[] memory tokens,
      address payable[] memory _benefactors,
      uint256[] memory _patronageNumerator,
      uint256[] memory _tokenGenerationRate
    */
    await steward.listNewTokens(
      [tokenIdEspumita, tokenIdUcok],
      [laSendaVerdeAddress, darwinAnimalDoctorsAddress],
      [harbergerTaxRate, harbergerTaxRate],
      [receiptGenerationRate, receiptGenerationRate],
      { from: accounts[0], gas: 615225 }
    );

    await patronageToken.mintWithTokenURI(
      steward.address,
      tokenIdTarkus,
      "https://wildcards.xyz/token/15",
      { from: accounts[0], gas: 681877 }
    );

    await steward.listNewTokens(
      [tokenIdTarkus],
      [laSendaVerdeAddress],
      [harbergerTaxRateTarkus],
      [receiptGenerationRate],
      { from: accounts[0], gas: 615225 }
    );

    await patronageToken.mintWithTokenURI(
      steward.address,
      tokenIdHook,
      "https://wildcards.xyz/token/16",
      { from: accounts[0], gas: 681877 }
    );

    /*
      uint256[] memory tokens,
      address payable[] memory _benefactors,
      uint256[] memory _patronageNumerator,
      uint256[] memory _tokenGenerationRate
    */

    await steward.listNewTokens(
      [tokenIdHook],
      [tempWhaleConservancyAccount],
      [harbergerTaxRateHook],
      [receiptGenerationRate],
      { from: accounts[0], gas: 615225 }
    );
  });
};

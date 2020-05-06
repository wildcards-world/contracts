const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const WildcardSteward_v2 = artifacts.require("WildcardSteward_v2");

const receiptGenerationRate = 11574074074074; // This is just less (rounded down) than one token a day (ie. 10^18 / 86400)
const tokenId = "13";
const votingContractAddress = "0x03e051b7e42480Cc9D54F1caB525D2Fea2cF4d83";

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

    await patronageToken.mintWithTokenURI(
      steward.address,
      tokenId,
      "https://wildcards.xyz/token/13",
      { from: accounts[0] }
    );

    await steward.listNewTokens(
      [tokenId],
      [votingContractAddress],
      [600000000000], // Harberger tax rate of 60% per year
      [receiptGenerationRate],
      { from: accounts[0] }
    );
  });
};

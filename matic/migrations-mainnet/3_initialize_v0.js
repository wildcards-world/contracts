const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");

const patronageNumerator = 2400000000000;
const patronageDenominator = 1000000000000;

const image1MetadataJson = {
  artist: "Matty Fraser",
  name: "Simon",

  // https://ipfs.infura.io/ipfs/QmZt5S8tD7L4nMBo4NTtVDpV3qpteA1DXJwKRmuF318tHd"
  ipfs: "QmZt5S8tD7L4nMBo4NTtVDpV3qpteA1DXJwKRmuF318tHd",
  type: "Gorilla"
};
const image1MetadataString = JSON.stringify(image1MetadataJson);
const image2MetadataJson = {
  artist: "Matty Fraser",
  name: "Andy",
  // https://ipfs.infura.io/ipfs/QmUjnwmYQE1QjkNpoEdpGwbj1s4cj5gVfEePNPnArbm5Tv
  ipfs: "QmUjnwmYQE1QjkNpoEdpGwbj1s4cj5gVfEePNPnArbm5Tv",
  type: "Gorilla"
};
const image2MetadataString = JSON.stringify(image2MetadataJson);

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }

    const patronageToken = await ERC721Patronage_v0.deployed();
    const steward = await WildcardSteward_v0.deployed();

    console.log(await patronageToken.isMinter.call(accounts[0]));
    await Promise.all([
      patronageToken.mintWithTokenURI(
        steward.address,
        0,
        image1MetadataString,
        { from: accounts[0] }
      ),
      patronageToken.mintWithTokenURI(
        steward.address,
        1,
        image2MetadataString,
        { from: accounts[0] }
      )
    ]);
    await steward.initialize(
      patronageToken.address,
      accounts[0],
      patronageDenominator,
      { from: accounts[0] }
    );
    await steward.listNewTokens(
      [0, 1],
      [accounts[0], accounts[0]],
      [patronageNumerator, patronageNumerator],
      { from: accounts[0] }
    );
  });
};

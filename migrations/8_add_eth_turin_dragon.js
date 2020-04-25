const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v1");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v2");

module.exports = function (deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }

    const patronageToken = await ERC721Patronage_v0.deployed();
    const steward = await WildcardSteward_v0.deployed();

    await Promise.all(
      tokenData.map((token) => {
        console.log("deploying token:", token.id);
        return patronageToken.mintWithTokenURI(
          steward.address,
          token.id,
          "https://wildcards.xyz/token/13",
          { from: accounts[0] }
        );
      })
    );

    let listOfTokenIds = tokenData.map((token) => token.id);
    let benefactors = tokenData.map((token) => token.benefactor || accounts[0]);
    let patronageNumerators = tokenData.map(
      (token) => token.patronageNumerator
    );
    console.log("listing tokens with steward:", listOfTokenIds);
    await steward.listNewTokens(
      listOfTokenIds,
      benefactors,
      patronageNumerators,
      { from: accounts[0] }
    );
  });
};

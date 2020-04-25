const { ConfigManager, scripts } = require("@openzeppelin/cli");
const { add, push, update } = scripts;
const URIFixer = artifacts.require("URIFixer");
const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");

async function deploy(options, primaryAccount) {
  add({
    contractsData: [{ name: "URIFixer", alias: "ERC721Patronage" }],
  });

  // Push implementation contracts to the network
  await push({ ...options, force: true }); // I have to use force here because OpenZeppelin is being difficult :/ (and this is a hacky solution anyway...)

  // Update instance
  await update(
    Object.assign(
      {
        contractAlias: "ERC721Patronage",
        methodName: "setOwner",
        methodArgs: [primaryAccount],
      },
      options
    )
  );
}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }
    const { network, txParams } = await ConfigManager.initNetworkConfiguration({
      network: networkName,
      from: accounts[0],
    });
    await deploy({ network, txParams }, accounts[0]);

    const uriFixerAddress = (await ERC721Patronage_v0.deployed()).address;
    const uriFixer = await URIFixer.at(uriFixerAddress);
    await Promise.all([
      uriFixer.updateTokenUri(
        0,
        "https://ipfs.io/ipfs/QmcY1m22fmXR5uwELpiANNZTiji9jDaYt3iWmtJ2iyzTPd",
        { from: accounts[0] }
      ),

      uriFixer.updateTokenUri(
        1,
        "https://ipfs.io/ipfs/QmbbHEMaakEyPcxKmeJ1N87CVot9NhF2YePgcjsiPxZgX5",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        2,
        "https://ipfs.io/ipfs/QmY2tMCbnrsZCuTWceHtWDf8C2frAg9MUPep9WQJwhEfFP",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        3,
        "https://ipfs.io/ipfs/QmRn1XJ6QX51F6Sdz6xfxiUYyPpZkCFoi1AmhAJ4VgvjS5",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        4,
        "https://ipfs.io/ipfs/QmcgjAKPP9Btibrd11pK9xW7t1tzgL45PaEqEqDwDp3qbX",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        5,
        "https://ipfs.io/ipfs/QmbYDwg2DYm237xDzwBpEisLjx8XdxQAxtbE5myNhZ85Mg",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        6,
        "https://ipfs.io/ipfs/QmPeztYoHZJXTVgdqNuyX6ZSyP6hcsG6rmDxCqvCpu6Pk2",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        7,
        "https://ipfs.io/ipfs/Qmbbm8KVFnBXJirKfYZrjnmZ895hEcyw5t2ZjPERauTWUA",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        9,
        "https://ipfs.io/ipfs/QmWW4mU9fXQSPuPpMXu6ZcNm17zjDonfbUn3FojTnddu1a",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        10,
        "https://ipfs.io/ipfs/QmcsYFqJckrwM8n4xYVh3eRUA7exaiBWJGFETWBJj2cWmc",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        11,
        "https://ipfs.io/ipfs/QmTuiKtFKqo8c67pGJTHUgedEBh9STbWvvPkeakSHVNGwc",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        12,
        "https://ipfs.io/ipfs/QmTcNw6AhqjqiSrAGSAdSG7cmgmq9w33WNnjyi9A2xpBgp",
        {
          from: accounts[0],
        }
      ),
      uriFixer.updateTokenUri(
        42,
        "https://ipfs.io/ipfs/QmTKddy2jARpWUWFATWcfiRrMNYCuiNPnVwYFTtJcJu6wv",
        {
          from: accounts[0],
        }
      ),
    ]);
  });
};

"use strict";

// Adapted from: https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/examples/lib-complex/index.js and https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/examples/lib-simple/index.js
global.artifacts = artifacts;
global.web3 = web3;

const args = require("minimist")(process.argv.slice(2));
const network = args.network;

const {
  AppProject,
  Contracts,
  ZWeb3,
  Package
} = require("@openzeppelin/upgrades");

const patronageNftName = "ERC721Patronage";
const wildcardStewardName = "WildcardSteward";

const image1MetadataJson = {
  artist: "Matty Fraser",
  name: "Simon",
  // https://ipfs.infura.io/ipfs/QmZt5S8tD7L4nMBo4NTtVDpV3qpteA1DXJwKRmuF318tHd"
  ipfs: "QmZt5S8tD7L4nMBo4NTtVDpV3qpteA1DXJwKRmuF318tHd"
};
const image1MetadataString = JSON.stringify(image1MetadataJson);
const image2MetadataJson = {
  artist: "Matty Fraser",
  name: "Andy",
  // https://ipfs.infura.io/ipfs/QmUjnwmYQE1QjkNpoEdpGwbj1s4cj5gVfEePNPnArbm5Tv
  ipfs: "QmUjnwmYQE1QjkNpoEdpGwbj1s4cj5gVfEePNPnArbm5Tv"
};
const image2MetadataString = JSON.stringify(image2MetadataJson);

async function setupApp(txParams) {
  ZWeb3.initialize(web3.currentProvider);

  // On-chain, single entry point of the entire application.
  console.error(`<< Setting up App >> network: ${network}`);
  const initialVersion = "0.0.1";
  return await AppProject.fetchOrDeploy(
    "complex-example",
    initialVersion,
    txParams,
    {}
  );
}

async function deployVersion1(project, owner) {
  console.log("<< Deploying Wildcards Steward >>");
  const WildcardSteward_v0 = Contracts.getFromLocal("WildcardSteward_v0");
  await project.setImplementation(WildcardSteward_v0, wildcardStewardName);
  const WildcardSteward = await project.createProxy(WildcardSteward_v0, {
    contractName: wildcardStewardName
  });

  console.log("<< Deploying ERC721 Patronage Tokens >>");
  const ERC721Patronage_v0 = Contracts.getFromLocal("ERC721Patronage_v0");
  await project.setImplementation(ERC721Patronage_v0, patronageNftName);
  const ERC721Patronage = await project.createProxy(ERC721Patronage_v0, {
    contractName: patronageNftName
    // TODO: get this setup method to work, not sure what is wrong!
    // initMethod: 'setup',
    // initArgs: [
    //   WildcardSteward.address, "WildcardsTokens", "WT", owner
    // ]
  });

  await ERC721Patronage.methods
    .setup(WildcardSteward.address, "WildcardsTokens", "WT", owner)
    .send({ from: owner });
  await ERC721Patronage.methods
    .mintWithTokenURI(steward.address, 0, image1MetadataString)
    .send({ from: owner });
  await ERC721Patronage.methods
    .mintWithTokenURI(steward.address, 1, image2MetadataString)
    .send();
  await WildcardSteward.methods.initialize(
    [0, 1],
    accounts[0],
    patronageToken.address,
    patronageNumerator,
    patronageDenominator
  );
  return { WildcardSteward, ERC721Patronage };
}

module.exports = async function() {
  const owner = web3.eth.accounts[1];
  const txParams = {
    from: owner,
    gas: 3000000,
    gasPrice: 100000000000
  };
  const app = await setupApp(txParams);
  const v1contracts = await deployVersion1(app, owner);
};

// (will be) used in tests:
module.exports.setupApp = setupApp;
module.exports.deployVersion1 = deployVersion1;

// Load zos scripts and truffle wrapper function
const { scripts, ConfigManager } = require('@openzeppelin/cli');
const { add, push, create } = scripts;
const patronageNumerator = 12
const patronageDenominator = 1

const image1MetadataJson = {
  artist: "Matty Fraser",
  name: "Simon",
  // https://ipfs.infura.io/ipfs/QmZt5S8tD7L4nMBo4NTtVDpV3qpteA1DXJwKRmuF318tHd"
  ipfs: "QmZt5S8tD7L4nMBo4NTtVDpV3qpteA1DXJwKRmuF318tHd"
}
const image1MetadataString = JSON.stringify(image1MetadataJson)
const image2MetadataJson = {
  artist: "Matty Fraser",
  name: "Andy",
  // https://ipfs.infura.io/ipfs/QmUjnwmYQE1QjkNpoEdpGwbj1s4cj5gVfEePNPnArbm5Tv
  ipfs: "QmUjnwmYQE1QjkNpoEdpGwbj1s4cj5gVfEePNPnArbm5Tv"
}
const image2MetadataString = JSON.stringify(image2MetadataJson)

async function deploy(options, accounts) {
  add({
    contractsData: [
      { name: 'ERC721Patronage_v0', alias: 'ERC721Patronage' },
      { name: 'WildcardSteward_v0', alias: 'WildcardSteward' },
    ]
  });

  await push(options);

  const steward = await create(Object.assign({ contractAlias: 'WildcardSteward' }, options));
  const patronageToken = await create({
    ...options,
    contractAlias: 'ERC721Patronage',
    methodName: 'setup',
    methodArgs: [
      steward.address, "WildcardsTokens", "WT", accounts[0]
    ]
  });

  console.log(await patronageToken.methods.isMinter(accounts[0]).call(options.txParams))
  console.log(await patronageToken.methods.mintWithTokenURI(steward.address, 0, image1MetadataString).send(options.txParams))
  console.log(await patronageToken.methods.mintWithTokenURI(steward.address, 1, image2MetadataString).send(options.txParams))
  await steward.methods.initialize([0, 1, 2], accounts[0], patronageToken.address, patronageNumerator, patronageDenominator)
}

module.exports = function (deployer, networkName, accounts) {
  deployer.then(async () => {
    const { network, txParams } = await ConfigManager.initNetworkConfiguration({ network: networkName, from: accounts[0] })
    await deploy({ network, txParams }, accounts)
  })
}

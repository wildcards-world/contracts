// Load zos scripts and truffle wrapper function
const { scripts, ConfigManager } = require('@openzeppelin/cli');
const { add, push, create } = scripts;

async function deploy(options) {
  add({
    contractsData: [
      { name: 'ERC721Patronage_v0', alias: 'ERC721Patronage' },
      // { name: 'WildcardSteward_v0', alias: 'WildcardSteward' },
    ]
  });

  await push(options);

  await create(Object.assign({ contractAlias: 'ERC721Patronage' }, options));
  // await create(Object.assign({ contractAlias: 'WildcardSteward' }, options));
}

module.exports = function (deployer, networkName, accounts) {
  deployer.then(async () => {
    const { network, txParams } = await ConfigManager.initNetworkConfiguration({ network: networkName, from: accounts[1] })
    await deploy({ network, txParams })
  })
}

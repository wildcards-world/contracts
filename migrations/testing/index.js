// const {
//   time // Assertions for transactions that should fail
// } = require('@openzeppelin/test-helpers');

// time.increase(duration)
const { promisify } = require("util");
const Web3 = require('web3');

const increaseTime = async (web3, duration) => {
  await promisify(web3.currentProvider.send.bind(web3.currentProvider))({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: new Date().getTime(),
    });
}

// const { networks } = require('../../truffle-config.js');

const getWeb3 = (rpcEndpoint) => {
    // const { provider } = (networks[network] || {})
    // console.log(networks)
    // console.log(networks[network])
    // console.log({provider})
    // if (!provider) {
    //   throw new Error(`Unable to find provider for network: ${network}`)
    // }

  const web3 = new Web3(rpcEndpoint)

    return web3
}

module.exports = {
  increaseTime,
  getWeb3
}
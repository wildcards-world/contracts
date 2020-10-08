const path = require("path");
// This gives very strange errors in development, so keep these values null unless you require infura etc.
const HDWalletProvider = require("@truffle/hdwallet-provider");
const {
  mnemonic,
  mainnetProviderUrl,
  rinkebyProviderUrl,
  kovanProviderUrl,
  goerliProviderUrl,
} = require("./secretsManager.js");
// let HDWalletProvider = function(mnemonic, providerUrl, index) {};
// let mnemonic, mainnetProviderUrl, rinkebyProviderUrl, goerliProviderUrl;

const blockchainNodeHost = process.env.BLOCKCHAIN_NODE_HOST || "localhost";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  plugins: ["solidity-coverage"],
  // contracts_build_directory: path.join(__dirname, "artifacts/contracts"),
  networks: {
    mainnet: {
      network_id: 1,
      provider: new HDWalletProvider(mnemonic, mainnetProviderUrl, 0),
      // gas: 4700000,
      gasPrice: 45000000000, // 10 gwei
      skipDryRun: true,
    },
    mumbai: {
      network_id: 80001,
      provider: new HDWalletProvider(
        mnemonic,
        "https://rpc-mumbai.matic.today",
        0
      ),
      // gas: 4700000,
      gasPrice: 2000000000, // 2 gwei
      skipDryRun: true,
    },
    matic: {
      network_id: 137,
      provider: new HDWalletProvider(
        mnemonic,
        "https://rpc-mainnet.matic.network",
        0
      ),
      // gas: 4700000,
      gasPrice: 2000000000, // 2 gwei
      skipDryRun: true,
    },
    rinkeby: {
      network_id: 4,
      provider: new HDWalletProvider(mnemonic, rinkebyProviderUrl, 0),
      gas: 4700000,
      gasPrice: 10000000000, // 10 gwe
      skipDryRun: true,
    },
    kovan: {
      network_id: 42,
      provider: new HDWalletProvider(mnemonic, kovanProviderUrl, 0),
      // gas: 47000000,
      gasPrice: 10000000000, // 10 gwei
      skipDryRun: true,
    },
    goerli: {
      network_id: 5,
      provider: new HDWalletProvider(mnemonic, goerliProviderUrl, 0),
      // gas: 47000000,
      gasPrice: 50000000000, // 10 gwei
      skipDryRun: true,
    },
    development: {
      host: blockchainNodeHost, // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasPrice: 1000000000, // 0.1 gwei
    },
    test: {
      host: blockchainNodeHost, // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasPrice: 100000000, // 0.1 gwei
    },
  },
  mocha: {
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 25, //in gwei
    },
  },
  compilers: {
    solc: {
      version: "0.6.12",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: "istanbul",
      },
    },
  },
};

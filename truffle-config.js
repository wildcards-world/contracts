const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const {
  mnemonic,
  mainnetProviderUrl,
  rinkebyProviderUrl,
  goerliProviderUrl,
} = require("./secretsManager.js");

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
      gasPrice: 10000000000, // 10 gwei
      skipDryRun: true,
    },
    rinkeby: {
      network_id: 4,
      provider: new HDWalletProvider(mnemonic, rinkebyProviderUrl, 0),
      gas: 4700000,
      gasPrice: 10000000000, // 10 gwe
      skipDryRun: true,
    },
    goerli: {
      network_id: 5,
      provider: new HDWalletProvider(mnemonic, goerliProviderUrl, 0),
      // gas: 47000000,
      gasPrice: 10000000000, // 10 gwei
      skipDryRun: true,
    },
    development: {
      host: blockchainNodeHost, // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasPrice: 1000000000, // 1 gwei
    },
    test: {
      host: blockchainNodeHost, // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasPrice: 1000000000, // 1 gwei
    },
  },
  mocha: {
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 5, //in gwei
    },
  },
  compilers: {
    solc: {
      version: "0.5.15",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};

const path = require("path");
// This gives very strange errors in development, so keep these values null unless you require infura etc.
const HDWalletProvider = require("@truffle/hdwallet-provider");
let config;
try {
  config = require("./secretsManager.js");
} catch (e) {
  console.error(
    "You are using the example secrets manager, please copy this file if you want to use it"
  );
  config = require("./secretsManagerCi.js");
}
const {
  mnemonic,
  mainnetProviderUrl,
  rinkebyProviderUrl,
  kovanProviderUrl,
  goerliProviderUrl,
  maticProviderUrl,
  mumbaiProviderUrl
} = config;
// let HDWalletProvider = function(mnemonic, providerUrl, index) {};
// let mnemonic, mainnetProviderUrl, rinkebyProviderUrl, goerliProviderUrl;

const blockchainNodeHost = process.env.BLOCKCHAIN_NODE_HOST || "localhost";
const migrations_directory = process.env.MIGRATIONS_DIRECTORY || "./migrations";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  plugins: ["solidity-coverage"],
  // contracts_build_directory: path.join(__dirname, "artifacts/contracts"),
  migrations_directory,
  networks: {
    // mainnet: {
    //   network_id: 1,
    //   provider: new HDWalletProvider(mnemonic, mainnetProviderUrl, 0),
    //   // gas: 4700000,
    //   gasPrice: 45000000000, // 10 gwei
    //   skipDryRun: true,
    // },
    mumbai: {
      network_id: 80001,
      provider: new HDWalletProvider(
        mnemonic,
        mumbaiProviderUrl,
        // "https://rpc-mumbai.matic.today",
        0
      ),
      // gas: 4700000,
      gasPrice: 2000000000, // 2 gwei
      skipDryRun: true,
    },
    matic: {
      network_id: 137,
      chainId: 137,
      provider: new HDWalletProvider(
        mnemonic,
        // "https://matic-mainnet-full-rpc.bwarelabs.com/",
        // "https://rpc-mainnet.matic.network",
        // "https://matic-mainnet.chainstacklabs.com",
        // maticProviderUrl,
        // "https://polygon-rpc.com/",
        "https://polygon-mainnet.g.alchemy.com/v2/VzFC8zPoM4mv4iXB7v0JpBfehIppOsDe",
        0
      ),
      // gas: 4700000,
      gasPrice: 50000000000, // 2 gwei
      skipDryRun: true,
    },
    // rinkeby: {
    //   network_id: 4,
    //   provider: new HDWalletProvider(mnemonic, rinkebyProviderUrl, 0),
    //   gas: 4700000,
    //   gasPrice: 10000000000, // 10 gwe
    //   skipDryRun: true,
    // },
    // kovan: {
    //   network_id: 42,
    //   provider: new HDWalletProvider(mnemonic, kovanProviderUrl, 0),
    //   // gas: 47000000,
    //   gasPrice: 10000000000, // 10 gwei
    //   skipDryRun: true,
    // },
    // goerli: {
    //   network_id: 5,
    //   provider: new HDWalletProvider(mnemonic, goerliProviderUrl, 0),
    //   gas: 8000000,
    //   gasPrice: 10000000000, // 10 gwei
    //   skipDryRun: true,
    // },
    development: {
      host: blockchainNodeHost, // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasPrice: 1000000000, // 0.1 gwei
    },
    // test: {
    //   host: blockchainNodeHost, // Localhost (default: none)
    //   port: 8545, // Standard Ethereum port (default: none)
    //   network_id: "*", // Any network (default: none)
    //   gasPrice: 100000000, // 0.1 gwei
    // },
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

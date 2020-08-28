const isCoverage = process.env.IS_COVERAGE == "true";
const isGasReport = process.env.IS_GAS_REPORT == "true";

usePlugin("@nomiclabs/buidler-truffle5");
if (isCoverage) usePlugin("solidity-coverage");
if (isGasReport) usePlugin("buidler-gas-reporter");

module.exports = {
  defaultNetwork: "buidlerevm",
  networks: {
    buidlerevm: {
      gas: 95000000,
      blockGasLimit: 95000000,
    },
  },
  reporterOptions: {
    currency: "USD",
    gasPrice: 25, //in gwei
  },
  solc: {
    version: "0.6.12",
    optimizer: {
      enabled: true,
      runs: 200,
    },
    evmVersion: "constantinople",
  },
};

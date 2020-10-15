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
      accounts: [
        {
          privateKey:
            "0x368526b7ba385d09fb28f070f7004cbda539e608e8aab3b638371ccf106db2be",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0x552d4c98d7ff8e517f95cfe718b773afe81be49c049cf54ecdd0fb20489f2337",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0xb5546e25f9324e63ef077e2ce63ccdc54b4d84b1866c5606945c3039580bdf47",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0x1cf31081f9d193b6facdff5f10d254cbcb146546d5c7890ab083096f7fc103fa",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0x7f8f0e6b5dbbbb12cbabb8dc1a5db01097b89e516fb640605ea682cc75f9d3e1",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0x43b6d6b00bbf21350264185bf6dbd0fc4bb77ece7767920049de0a400d6bbd44",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0x2dd7432302e8f5fb16ff638105336350b234d7adb84c37037187a3fbf28fb1b9",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0x412160799812b640ff97a020e54578bd7a799407e5fb851dda720e9f43d7b2c7",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0xedd34b942f5da2a8be7e6612872844037a30a75d14cc07f5f188e9b9fcdcbcfe",
          balance: "0x3635C9ADC5DEA00000",
        },
        {
          privateKey:
            "0x9f825b26444f1f85e95c448dda2b4a63dce499f81ae20b090e02b20d2ce8bba0",
          balance: "0x3635C9ADC5DEA00000",
        },
      ],
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
    evmVersion: "istanbul",
  },
};

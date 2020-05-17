usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("solidity-coverage");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await web3.eth.getAccounts();

  for (const account of accounts) {
    console.log(account);
  }
});

module.exports = {
  networks: {
    buidlerevm: {
      blockGasLimit: 95000000,
      gas: 95000000,
    },
  },
  solc: {
    version: "0.5.17",
  },
};

const WildcardSteward = artifacts.require("WildcardSteward_v2");

contract("Wildcards Steward - unable to deploy", (accounts) => {
  it("Checking the gas limit", async () => {
    const steward = await WildcardSteward.new({
      from: accounts[0],
      gas: 95000000,
    });

    const gasUsed = (
      await web3.eth.getTransactionReceipt(steward.contract.transactionHash)
    ).gasUsed;

    console.log("Deploying the steward contract used:", gasUsed);
  });
});

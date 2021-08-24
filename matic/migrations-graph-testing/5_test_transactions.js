const WildcardSteward_v3 = artifacts.require("WildcardSteward_matic_v2");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

let org1 = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
let org2 = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";

module.exports = function (deployer, networkName, accounts) {
  deployer.then(async () => {
    const steward = await WildcardSteward_v3.deployed();

    const paymentToken = await Dai.deployed();
    if (networkName != "matic") {
      // Mint for some test accounts:
      await paymentToken.mint(
        "0xd3Cbce59318B2E570883719c8165F9390A12BdD6",
        ether("1000000")
      );
      await paymentToken.mint(
        "0x2999Fe533BC08A03304C96E8668BfA17D9D0D35b",
        ether("100000")
      );
      await paymentToken.mint(
        "0x9241DcC41515150E8363BEf238f92B15167791d7",
        ether("100000")
      );

      await paymentToken.mint(accounts[1], ether("100000"));
      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[1],
      });
      await steward.buyAuction("1", ether("50"), 50000, ether("5000"), {
        from: accounts[1],
      });

      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[1],
      });
      await steward.buyAuction("2", ether("55"), 50000, ether("5000"), {
        from: accounts[1],
      });

      await paymentToken.mint(accounts[2], ether("100000"));
      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[2],
      });
      await steward.buyAuction("3", ether("60"), 50000, ether("5050"), {
        from: accounts[2],
      });

      await paymentToken.mint(accounts[3], ether("100000"));
      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[3],
      });
      await steward.buyAuction("4", ether("65"), 50000, ether("8000"), {
        from: accounts[3],
      });

      // User 2 adds more deposit
      await steward.depositWei(ether("68"), {
        from: accounts[2],
      });

      // User 3 buys user 1's token
      await steward.buy("2", ether("88"), ether("55"), 50000, ether("456"), {
        from: accounts[3],
      });
    }
    const stewardAddress = steward.address;
    const daiAddress = paymentToken.address;
    console.log(`let verifyingContract = "${daiAddress}";
      let spender = "${stewardAddress}";`);
  });
};

const WildcardSteward_v3 = artifacts.require("WildcardSteward_v3_matic");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./Dai.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const starHarbergerTaxRateAnimal = "240" + "0000000000"; // Harberger tax rate of 240% per year

const buyAuctionPermit = async (
  provider,
  steward,
  daiContract,
  account,
  tokenId,
  tokenPrice,
  depositAmount
) => {
  let { nonce, expiry, v, r, s } = await daiPermitGeneration(
    provider,
    daiContract,
    account,
    steward.address
  );
  console.log("PERMIT", { nonce, expiry, v, r, s });

  await steward.buyAuctionWithPermit(
    // uint256 nonce,
    nonce,
    // uint256 expiry,
    expiry,
    // bool allowed,
    true,
    // uint8 v,
    v,
    // bytes32 r,
    r,
    // bytes32 s,
    s,
    // uint256 tokenId,
    tokenId,
    // uint256 _newPrice,
    tokenPrice,
    // uint256 serviceProviderPercentage,
    50000,
    // uint256 depositAmount
    depositAmount,
    {
      from: account,
    }
  );
  console.log("after the buy auction");
};
module.exports = function(deployer, networkName, accounts) {
  console.log({ accounts });
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }

    const steward = await WildcardSteward_v3.deployed();
    const patronageToken = await ERC721Patronage_v1.deployed();

    const isMinter = await patronageToken.isMinter(steward.address);
    console.log("steward address After", steward.address);

    console.log("IS MINTER?", isMinter);
    console.log("before minting");
    await steward.listNewTokens(
      ["26", "27", "28", "29"],
      [
        testAccountAddress,
        testAccountAddress,
        testAccountAddress,
        testAccountAddress,
      ],
      [
        starHarbergerTaxRateAnimal,
        starHarbergerTaxRateAnimal,
        starHarbergerTaxRateAnimal,
        starHarbergerTaxRateAnimal,
      ],
      [],
      [],
      [0, 0, 0, 0],
      { from: accounts[0] }
    );
    console.log("After minting");

    if (networkName != "matic") {
      const paymentToken = await Dai.deployed();

      await paymentToken.mint(accounts[1], ether("100000"));
      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[1],
      });
      await steward.buyAuction("26", ether("50"), 50000, ether("5000"), {
        from: accounts[1],
      });
      // await buyAuctionPermit(
      //   web3.currentProvider,
      //   steward,
      //   paymentToken,
      //   accounts[1],
      //   "26",
      //   ether("60"),
      //   ether("5050")
      // );

      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[1],
      });
      await steward.buyAuction("27", ether("55"), 50000, ether("5000"), {
        from: accounts[1],
      });
      // await buyAuctionPermit(
      //   web3.currentProvider,
      //   steward,
      //   paymentToken,
      //   accounts[1],
      //   "27",
      //   ether("55"),
      //   ether("5000")
      // );
      await paymentToken.mint(accounts[2], ether("100000"));
      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[2],
      });
      await steward.buyAuction("28", ether("60"), 50000, ether("5050"), {
        from: accounts[2],
      });
      // await buyAuctionPermit(
      //   web3.currentProvider,
      //   steward,
      //   paymentToken,
      //   accounts[2],
      //   "28",
      //   ether("60"),
      //   ether("5050")
      // );
      await paymentToken.mint(accounts[3], ether("100000"));
      await paymentToken.approve(steward.address, ether("50000000"), {
        from: accounts[3],
      });
      await steward.buyAuction("29", ether("65"), 50000, ether("8000"), {
        from: accounts[3],
      });
      // await buyAuctionPermit(
      //   web3.currentProvider,
      //   steward,
      //   paymentToken,
      //   accounts[3],
      //   "29",
      //   ether("65"),
      //   ether("8000")
      // );

      // User 2 adds more deposit
      await steward.depositWei(ether("68"), {
        from: accounts[2],
      });
      // let { nonce, expiry, v, r, s } = await daiPermitGeneration(
      //   web3.currentProvider,
      //   paymentToken,
      //   accounts[2],
      //   steward.address
      // );
      // await steward.depositWithPermit(
      //   nonce,
      //   expiry,
      //   true,
      //   v,
      //   r,
      //   s,
      //   accounts[2],
      //   ether("68"),
      //   {
      //     from: accounts[2],
      //   }
      // );

      // User 3 buys user 1's token
      await steward.buy("27", ether("88"), ether("55"), 50000, ether("456"), {
        from: accounts[3],
      });
      // let {
      //   nonce: nonce2,
      //   expiry: expiry2,
      //   v: v2,
      //   r: r2,
      //   s: s2,
      // } = await daiPermitGeneration(
      //   web3.currentProvider,
      //   paymentToken,
      //   accounts[3],
      //   steward.address
      // );
      // await steward.buyWithPermit(
      //   nonce2,
      //   expiry2,
      //   true,
      //   v2,
      //   r2,
      //   s2,
      //   "27",
      //   ether("88"),
      //   ether("55"),
      //   50000,
      //   ether("456"),
      //   {
      //     from: accounts[3],
      //   }
      // );
    }
  });
};

const WildcardSteward_v3 = artifacts.require("WildcardSteward_matic_v0");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

let mareCetAddress = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
let lionLandscapes = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";
let zavoraLabAddress = "0x16Aa1E035AAffF67ED35bf7BC00070d8a88ee3C1";
let oceansResearchAddres = "0x0633de7c301f6e350db531c5f95a4500d9373c51";

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
  console.log("ACCOUNT", account);
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
      [mareCetAddress, lionLandscapes, zavoraLabAddress, oceansResearchAddres],
      [
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
      ],
      [],
      [],
      [1605106800, 1605279600, 1605452400, 1605625200],
      { from: accounts[0] }
    );
    console.log("After minting");

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
    const stewardAddress = steward.address;
    const daiAddress = paymentToken.address;
    console.log(`let verifyingContract = "${daiAddress}";
      let spender = "${stewardAddress}";`);
  });
};

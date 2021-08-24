const WildcardSteward_v3 = artifacts.require("WildcardSteward_matic_v2");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

let org1 = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
let org2 = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";

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
module.exports = function (deployer, networkName, accounts) {
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
      ["1", "2", "3", "4", "5", "6"],
      [org1, org1, org1, org1, org2, org2],
      [
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
      ],
      [],
      [],
      [1, 1, 1, 1, 1, 1],
      { from: accounts[0] }
    );
    console.log("After minting");
  });
};

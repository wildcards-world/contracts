const WildcardSteward_v3 = artifacts.require("WildcardSteward_matic_v0");
const WildcardSteward_matic_v1 = artifacts.require("WildcardSteward_matic_v1");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

// let mareCetAddress = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
// let lionLandscapes = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";
let zavoraLabAddress = "0x16Aa1E035AAffF67ED35bf7BC00070d8a88ee3C1";
let oceansResearchAddres = "0x0633de7c301f6e350db531c5f95a4500d9373c51";
let sasharkconservancy = "0x102B9d763d502EE4E86A74277E6C251bD6759FE1";
let sharkspotters = "0x603192ABB2E402202D3d88F000427a43C51eD79A";
let southrupuniconservation = "0xbd7b4286602145ccd122d5cd6bf6e9d61af17c48";
let easternghatsws = "0x24A784BeB57385Ed37d3020Cc5a310E287AaD28E";
let endangeredwildlife = "0xA7Cb48CB98fE1a8CFF4A6e4C6EEF8b4bcAe0C1cC";
let oana = "0x6dB803540E20E16b7355bC4d4dA33c46b76DC2FA";
let bios = "0x05b71fE3f642d18A7034818C6085e15A5Ed26699";
const bdiAddress = "0xADad0D21ba0E4b356e2b2769e08CfeF206f83891";

let civit = "0x8846e72803d0CeCaeeaC329ec0d566Fbefa056f3";
let creatifa = "0x9894d59d59e90eb82f74eec4dca2d7bd2754e5cb";
let yuhlets = "0x6555f8fb6a02c9c73d55c72959a9e0cebff13489";
let oficinastk = "0xa4aD045d62a493f0ED883b413866448AfB13087C";
let ktwentymanjones = "0x5f68c84Cc626E70eAE9707a3a352394136D9638e";
let kbo_metaverse = "0x015dA446370a4791A95227777F8DF841F7040d7d";
let deemerman = "0x595Da8DED6019715E143824Ef901864cE35167FA";

const monday7Dec2020 = 1607353200;
const twoDaysInSeconds = 172800;

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

    const stewardAddress = (await WildcardSteward_v3.deployed()).address;
    const steward = await WildcardSteward_matic_v1.at(stewardAddress);
    const patronageToken = await ERC721Patronage_v1.deployed();

    const isMinter = await patronageToken.isMinter(steward.address);
    console.log("steward address After", steward.address);

    console.log("IS MINTER?", isMinter);
    console.log("before minting");

    await steward.listNewTokens(
      [
        "30" /*37*/,
        "31" /*49*/,
        "32" /*52*/,
        "33" /*77*/,
        "34" /*41*/,
        "35" /*58*/,
        "36" /*72*/,
        "37" /*39*/,
        "38" /*48*/,
        "39" /*52*/,
      ],
      [
        sasharkconservancy,
        sharkspotters,
        southrupuniconservation,
        easternghatsws,
        endangeredwildlife,
        oana,
        bios,
        zavoraLabAddress,
        oceansResearchAddres,
        bdiAddress,
      ],
      [
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
      ],
      [
        civit,
        creatifa,
        yuhlets,
        oficinastk,
        ktwentymanjones,
        ktwentymanjones,
        creatifa,
        ktwentymanjones,
        kbo_metaverse,
        deemerman,
      ],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [
        monday7Dec2020,
        monday7Dec2020 + twoDaysInSeconds,
        monday7Dec2020 + twoDaysInSeconds * 2,
        monday7Dec2020 + twoDaysInSeconds * 3,
        monday7Dec2020 + twoDaysInSeconds * 4,
        monday7Dec2020 + twoDaysInSeconds * 5,
        monday7Dec2020 + twoDaysInSeconds * 6,
        monday7Dec2020 + twoDaysInSeconds * 7,
        monday7Dec2020 + twoDaysInSeconds * 8,
        monday7Dec2020 + twoDaysInSeconds * 9,
      ],
      { from: accounts[0] }
    );
    console.log("After minting");

    await Promise.all([
      steward.setArtistCommissionOnNextSale("30", 500000),
      steward.setArtistCommissionOnNextSale("31", 500000),
      steward.setArtistCommissionOnNextSale("32", 500000),
      steward.setArtistCommissionOnNextSale("33", 500000),
      steward.setArtistCommissionOnNextSale("34", 500000),
      steward.setArtistCommissionOnNextSale("35", 500000),
      steward.setArtistCommissionOnNextSale("36", 500000),
      steward.setArtistCommissionOnNextSale("37", 500000),
      steward.setArtistCommissionOnNextSale("38", 500000),
      steward.setArtistCommissionOnNextSale("39", 500000),
    ]);

    console.log("artist amounts");
  });
};

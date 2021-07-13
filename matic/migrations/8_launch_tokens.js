const WildcardSteward_v3 = artifacts.require("WildcardSteward_matic_v0");
const WildcardSteward_matic_v1 = artifacts.require("WildcardSteward_matic_v1");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

const mareCetAddress = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
const lionLandscapes = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";
const zavoraLabAddress = "0x16Aa1E035AAffF67ED35bf7BC00070d8a88ee3C1";
const oceansResearchAddres = "0x0633de7c301f6e350db531c5f95a4500d9373c51";
const sasharkconservancy = "0x102B9d763d502EE4E86A74277E6C251bD6759FE1";
const sharkspotters = "0x603192ABB2E402202D3d88F000427a43C51eD79A";
const southrupuniconservation = "0xbd7b4286602145ccd122d5cd6bf6e9d61af17c48";
const easternghatsws = "0x24A784BeB57385Ed37d3020Cc5a310E287AaD28E";
const endangeredwildlife = "0xA7Cb48CB98fE1a8CFF4A6e4C6EEF8b4bcAe0C1cC";
const oana = "0x6dB803540E20E16b7355bC4d4dA33c46b76DC2FA";
const bios = "0x05b71fE3f642d18A7034818C6085e15A5Ed26699";
const bdiAddress = "0xADad0D21ba0E4b356e2b2769e08CfeF206f83891";
const sharklife = "0x069cBb4916aD021CF04CbBdf1a7ADB2Bcc669813";

const fishcatAddress = "0xbc2c67a59ec004d7127a63f0f99275e31b4883cf";
const mountKenyaTrust = "0xB1cf64514B89F0fAbBB7C7bEe95d72b175a63a8B";
const tsavoTrust = "0xb13Ad3f90722Dae0f9C1c7b4deF7bbAa6b68e4Be";
const fynbosLife = "0xcaFA650A4e133228f6CcE8f0674A81057EdADFEe";
const wildTrust = "0x47256AebE55084289297c58dEfF791016F545261";

const noArtist = "0x0000000000000000000000000000000000000000";
let civit = "0x8846e72803d0CeCaeeaC329ec0d566Fbefa056f3";
let creatifa = "0x9894d59d59e90eb82f74eec4dca2d7bd2754e5cb";
let yuhlets = "0x6555f8fb6a02c9c73d55c72959a9e0cebff13489";
let oficinastk = "0xa4aD045d62a493f0ED883b413866448AfB13087C";
let ktwentymanjones = "0x5f68c84Cc626E70eAE9707a3a352394136D9638e";
let kbo_metaverse = "0x015dA446370a4791A95227777F8DF841F7040d7d";
let deemerman = "0x595Da8DED6019715E143824Ef901864cE35167FA";
const oculardelusion = "0xbc2c67a59ec004d7127a63f0f99275e31b4883cf";
const coyotlcompany = "0x65D472172E4933aa4Ddb995CF4Ca8bef72a46576";
const connorg_art = "0x7078f4Ac06393093BCBf6920A8BD3d202fdfd08B";
const cryptocromo = "0x981276d81272f7CD8808701645741db1abaCad56";
const adaPainter = "0xdcdfdCfE8044a8D373260dA3fe45e71a0Af5ef77";
const camoleite = "0x203140E492789c8A3130E4554E65820D6d918F9E";
const higherDesignCo = "0x2E5E62C8cD9ede2874b6a9c87F843389BFD7cB3B";
const canBaris = "0x5BC3FE260ea58C8516dbc11ac7DcdC0eC06E0359";
const chairleMartinsin = "0xbE98Fc043Cb2D0CBc5368adB5fB85bbd202E2823";

const monday18Jan2020 = 1610996400;
const friday5March2020 = 1614924000;
const friday9July2021 = 1625839200;
const tuesday8July2021 = 1626163200;
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
module.exports = function (deployer, networkName, accounts) {
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

    // "54", "55", "56", "57", "58", "59", "60"

    /*

{
  wildcards (
    where: {
      id_in: ["matic54", "matic55", "matic56", "matic57", "matic58", "matic59", "matic60"]}
  ) {
    id
    priceHistory {
      id
    }
  }
}


    */
    // await steward.listNewTokens(
    //   [
    //     "54" /*63*/,
    //     "55" /*86*/,
    //     "56" /*68*/,
    //     "57" /*85*/,
    //     "58" /*55*/,
    //     "59" /*83*/,
    //     "60" /*84*/,
    //   ],
    //   [
    //     mountKenyaTrust,
    //     fynbosLife,
    //     tsavoTrust,
    //     fynbosLife,
    //     zavoraLabAddress,
    //     fynbosLife,
    //     fynbosLife,
    //   ],
    //   [
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //   ],
    //   [
    //     connorg_art,
    //     camoleite,
    //     cryptocromo,
    //     noArtist,
    //     camoleite,
    //     noArtist,
    //     noArtist,
    //   ],
    //   [0, 0, 0, 0, 0, 0, 0],
    //   [
    //     friday5March2020,
    //     friday5March2020 + twoDaysInSeconds * 4,
    //     friday5March2020 + twoDaysInSeconds * 8,
    //     friday5March2020 + twoDaysInSeconds * 12,
    //     friday5March2020 + twoDaysInSeconds * 16,
    //     friday5March2020 + twoDaysInSeconds * 20,
    //     friday5March2020 + twoDaysInSeconds * 24,
    //   ],
    //   { from: accounts[0] }
    // );
    // console.log("After minting");

    // await Promise.all([
    //   steward.setArtistCommissionOnNextSale("40", 500000),
    //   steward.setArtistCommissionOnNextSale("41", 500000),
    //   steward.setArtistCommissionOnNextSale("43", 500000),
    //   steward.setArtistCommissionOnNextSale("44", 500000),
    //   steward.setArtistCommissionOnNextSale("45", 500000),
    //   steward.setArtistCommissionOnNextSale("46", 500000),
    //   steward.setArtistCommissionOnNextSale("47", 500000),
    //   steward.setArtistCommissionOnNextSale("48", 500000),
    //   steward.setArtistCommissionOnNextSale("49", 500000),
    //   steward.setArtistCommissionOnNextSale("50", 500000),
    //   steward.setArtistCommissionOnNextSale("51", 500000),
    //   steward.setArtistCommissionOnNextSale("52", 500000),
    //   steward.setArtistCommissionOnNextSale("53", 500000),
    // ]);
    // await steward.listNewTokens(
    //   [
    //     "61" /*63*/,
    //     "62" /*86*/,
    //     "63" /*68*/,
    //   ],
    //   [
    //     sharklife,
    //     wildTrust,
    //     mountKenyaTrust,
    //   ],
    //   [
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //     twentyPercentMonthlyHarbergerTax,
    //   ],
    //   [
    //     chairleMartinsin,
    //     canBaris,
    //     adaPainter
    //   ],
    //   [50000, 50000, 50000],
    //   [
    //     friday9July2021,
    //     friday9July2021 + twoDaysInSeconds * 4,
    //     friday9July2021 + twoDaysInSeconds * 8,
    //   ],
    //   { from: accounts[0] }
    // );
    // console.log("After minting");

    // await Promise.all([
    //   steward.setArtistCommissionOnNextSale("61", 500000),
    //   steward.setArtistCommissionOnNextSale("62", 500000),
    //   steward.setArtistCommissionOnNextSale("63", 500000),
    // ]);
    await steward.listNewTokens(
      [
        "64",
        "65",
      ],
      [
        oceansResearchAddres,
        wildTrust,
      ],
      [
        twentyPercentMonthlyHarbergerTax,
        twentyPercentMonthlyHarbergerTax,
      ],
      [
        adaPainter,
        adaPainter
      ],
      [50000, 50000],
      [
        tuesday8July2021,
        tuesday8July2021 + twoDaysInSeconds * 1,
      ],
      { from: accounts[0] }
    );
    console.log("After minting");

    await Promise.all([
      steward.setArtistCommissionOnNextSale("64", 500000),
      steward.setArtistCommissionOnNextSale("65", 500000),
    ]);

    console.log("artist amounts");
    throw "don't continue";
  });
};

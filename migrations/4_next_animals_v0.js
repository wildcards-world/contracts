const ERC721Patronage_v0 = artifacts.require("ERC721Patronage_v0");
const WildcardSteward_v0 = artifacts.require("WildcardSteward_v0");

const tokenData = [
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Apthapi",

      // https://ipfs.infura.io/ipfs/QmTgQgR139N1zohnALNGKPmjuCc1jcL9SYbzs4XopLKDuh"
      ipfs: "QmTgQgR139N1zohnALNGKPmjuCc1jcL9SYbzs4XopLKDuh",
      type: "Tapirus terrestris"
    },
    patronageNumerator: 1200000000000,
    id: 2
  },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Aruma",

      ipfs: "QmcpcDSbLobdf4xQ86AQWtAQh8xXm933XUEZaD9mreW9LQ",
      type: "Tremarctos ornatus"
    },
    patronageNumerator: 2400000000000,
    id: 3
  },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Cat Stevens",

      ipfs: "QmNvnLGmmM1njpWrPryRfMRDBk5TuRUvXovzpWA1Crmxqm",
      type: "Leopardus pardalis"
    },
    patronageNumerator: 2400000000000,
    id: 4
  },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Cubai",

      ipfs: "QmWac15m5eRSsV9Jg3MK7f4yLpFm8SbyjqGLAAb52CLyeN",
      type: "Panthera onca"
    },
    patronageNumerator: 6000000000000,
    id: 5
  },
  // {
  //   metadata: {
  //     artist: "Funi Mathonsi",
  //     name: "Mijungla",

  //     ipfs: "QmWac15m5eRSsV9Jg3MK7f4yLpFm8SbyjqGLAAb52CLyeN",
  //     type: "Panthera onca",
  //   },
  //   patronageNumerator: 6000000000000
  // },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Llajuita",

      ipfs: "QmXnjKgAnkX4XomY6vwPRu2nVPRkcmgjLaxsMeGxzoPFC3",
      type: "Mazama americana"
    },
    patronageNumerator: 2400000000000,
    id: 6
  },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Pancho",

      ipfs: "QmU49kqLQV2npDKKGELRVJaV7n8BcBSWaLS9Zvnk34f2PF",
      type: "Chelonoidis denticulata"
    },
    patronageNumerator: 1200000000000,
    id: 7
  },
  // {
  //   metadata: {
  //     artist: "Funi Mathonsi",
  //     name: "Espumita",

  //     ipfs: "QmU1y8HxrYcUDoAUF2A6yLmSTDnPwVL137Vri4GbRcNKVx",
  //     type: "Puma concolor",
  //   },
  //   patronageNumerator: 6000000000000,
  //   id: 8
  // },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Verano",

      ipfs: "QmU36pE4dwcAMzrS8vk4Wizveh4vxTCKBe1imDXiSVSp7Q",
      type: "Ara ararauna"
    },
    patronageNumerator: 12000000000000,
    id: 9
  },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Nonhlanhla",

      ipfs: "Qmd1SVbjpAN1aPdhw2Bj7U6WQz9bZfuzMtveKxunjTYTNo",
      type: "Crocuta crocuta"
    },
    patronageNumerator: 2400000000000,
    id: 10,
    benefactor: "0xFA53ed45C13A2b86daA0074E7AdA739280635d19"
  },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Dlala",

      ipfs: "QmfZCBq2aviKJ6EAYRUh1eEv8JqYh9d5qpmdChWsEjxR7k",
      type: "Crocuta crocuta"
    },
    patronageNumerator: 2400000000000,
    id: 11,
    benefactor: "0xFA53ed45C13A2b86daA0074E7AdA739280635d19"
  },
  {
    metadata: {
      artist: "Funi Mathonsi",
      name: "Isisa",

      ipfs: "QmSdBtskpa2Hkj97M1yEUNfYvihr8omHs1CMCiSTPzv3Rc",
      type: "Crocuta crocuta"
    },
    patronageNumerator: 6000000000000,
    id: 12,
    benefactor: "0xFA53ed45C13A2b86daA0074E7AdA739280635d19"
  },
  {
    metadata: {
      artist: "Matty Fraser",
      name: "Simon",

      // https://ipfs.infura.io/ipfs/QmXGMcZPxVVsbiHngN5hb79wyVEEx3CT4j8HUivvqpHMMV
      ipfs: "QmXGMcZPxVVsbiHngN5hb79wyVEEx3CT4j8HUivvqpHMMV",
      type: "Gorilla"
    },
    patronageNumerator: 300000000000,
    id: 42,
    benefactor: "0xFA53ed45C13A2b86daA0074E7AdA739280635d19"
  }
];

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    // Don't try to deploy/migrate the contracts for tests
    if (networkName === "test") {
      return;
    }

    const patronageToken = await ERC721Patronage_v0.deployed();
    const steward = await WildcardSteward_v0.deployed();

    await Promise.all(
      tokenData.map(token => {
        console.log("deploying token:", token.id);
        return patronageToken.mintWithTokenURI(
          steward.address,
          token.id,
          JSON.stringify(token.metadata),
          { from: accounts[0] }
        );
      })
    );

    let listOfTokenIds = tokenData.map(token => token.id);
    let benefactors = tokenData.map(token => token.benefactor || accounts[0]);
    let patronageNumerators = tokenData.map(token => token.patronageNumerator);
    console.log("listing tokens with steward:", listOfTokenIds);
    await steward.listNewTokens(
      listOfTokenIds,
      benefactors,
      patronageNumerators,
      { from: accounts[0] }
    );
  });
};

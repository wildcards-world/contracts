const { BN, ether, time } = require("@openzeppelin/test-helpers");
const {
  multiTokenCalculator,
  initialize,
  setupTimeManager,
  isCoverage,
  waitTillBeginningOfSecond,
  globalTokenGenerationRate,
} = require("./helpers");

const SECONDS_IN_A_MINUTE = "60";
const TREASURY_NUMERATOR = "20"; // This indicates a 20% rate of tokens treasury collects
const TREASURY_DENOMINATOR = "100";
const tenMinPatronageAt1Eth = ether("1")
  .mul(new BN("600"))
  .mul(new BN("12"))
  .div(new BN("1"))
  .div(new BN("31536000"));

contract("WildcardSteward loyalty token", (accounts) => {
  let steward;
  let erc20;
  const patronageNumerator = "12000000000000";
  const artistAddress = accounts[9];
  const artistCommission = 0;

  const benefactorAddress = accounts[8];
  const withdrawCheckerAdmin = accounts[6];
  const admin = accounts[0];
  const zeroEther = ether("0");
  const auctionEndPrice = zeroEther;
  const auctionStartPrice = zeroEther;
  const auctionDuration = new BN(86400);
  const tokenDefaults = {
    benefactor: benefactorAddress,
    patronageNumerator,
    artist: artistAddress,
    artistCommission,
    releaseDate: 0,
  };
  const tokenDetails = [
    {
      ...tokenDefaults,
      token: "0",
    },
    {
      ...tokenDefaults,
      token: "1",
    },
    {
      ...tokenDefaults,
      token: "2",
    },
  ];
  let setNextTxTimestamp,
    timeSinceTimestamp,
    getCurrentTimestamp,
    timeSince,
    txTimestamp;

  before(async () => {
    const timeManager = await setupTimeManager(web3);
    setNextTxTimestamp = timeManager.setNextTxTimestamp; // takes in duration
    timeSinceTimestamp = timeManager.timeSinceTimestamp; // takes in old timestamp, returns current time
    getCurrentTimestamp = timeManager.getCurrentTimestamp; // returns timestamp of a given transaction
    timeSince = timeManager.timeSince; // returns interval between two timestamps
    txTimestamp = timeManager.txTimestamp; // returns timestamp of a given transaction
  });

  beforeEach(async () => {
    const result = await initialize(
      admin,
      withdrawCheckerAdmin,
      auctionStartPrice,
      auctionEndPrice,
      auctionDuration,
      tokenDetails,
      [accounts[2], accounts[3], accounts[7]]
    );
    steward = result.steward;
    erc20 = result.erc20;

    if (isCoverage) await waitTillBeginningOfSecond();
  });

  it("steward: loyalty-mint. Checking correct number of tokens are received after holding a token for  100min", async () => {
    testTokenId1 = tokenDetails[0].token;
    const timeHeld = 100; // In minutes
    // Person buys a token
    await steward.buyAuction(testTokenId1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });

    // TIME INCREASES HERE BY timeHeld
    await setNextTxTimestamp(time.duration.minutes(timeHeld));
    // First token bought from patron [Collect patronage will therefore be called]
    await steward.buy(testTokenId1, ether("1"), ether("1"), 50000, ether("1"), {
      from: accounts[3],
    });

    const expectedTokens = multiTokenCalculator([
      {
        timeHeld: new BN(timeHeld).mul(new BN(SECONDS_IN_A_MINUTE)).toString(),
        tokenGenerationRate: globalTokenGenerationRate,
      },
    ]);
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    const amountOfTreasuryToken = await erc20.balanceOf(accounts[0]); // stewards account
    const expectedTreasuryToken = new BN(expectedTokens)
      .mul(new BN(TREASURY_NUMERATOR))
      .div(new BN(TREASURY_DENOMINATOR));

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
    assert.equal(
      amountOfTreasuryToken.toString(),
      expectedTreasuryToken.toString()
    );
  });

  it("steward: loyalty-mint. Checking correct number of tokens received after holding 2 different token for  100min", async () => {
    const testTokenId1 = tokenDetails[0].token;
    const testTokenId2 = tokenDetails[1].token;
    const timeHeld = 100; // In minutes
    // Person buys a token
    await steward.buyAuction(testTokenId1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    const timeBetweenTransactions = new BN(50);
    await setNextTxTimestamp(timeBetweenTransactions);
    await steward.buyAuction(testTokenId2, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });

    // TIME INCREASES HERE BY timeHeld
    await setNextTxTimestamp(
      time.duration.minutes(timeHeld).sub(timeBetweenTransactions)
      // .sub(new BN(1))
    );
    // First token bought from patron [Collect patronage will therefore be called]
    await steward.buy(testTokenId1, ether("1"), ether("1"), 50000, ether("2"), {
      from: accounts[3],
    });

    await setNextTxTimestamp(timeBetweenTransactions);
    await steward.buy(testTokenId2, ether("1"), ether("1"), 50000, ether("2"), {
      from: accounts[3],
    });

    const expectedTokens = multiTokenCalculator([
      {
        timeHeld: new BN(timeHeld).mul(new BN(SECONDS_IN_A_MINUTE)).toString(),
        tokenGenerationRate: globalTokenGenerationRate,
      },
      {
        timeHeld: new BN(timeHeld).mul(new BN(SECONDS_IN_A_MINUTE)).toString(),
        tokenGenerationRate: globalTokenGenerationRate,
      },
    ]);
    const expectedTreasuryTokensFromUser2 = multiTokenCalculator([
      {
        timeHeld: timeBetweenTransactions,
        tokenGenerationRate: globalTokenGenerationRate,
      },
    ]).div(new BN(5) /* since 20% goes to the organisation */);
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    const amountOfTreasuryToken = await erc20.balanceOf(accounts[0]); // stewards account

    const expectedTreasuryToken = new BN(expectedTokens)
      .mul(new BN(TREASURY_NUMERATOR))
      .div(new BN(TREASURY_DENOMINATOR))
      .add(expectedTreasuryTokensFromUser2);

    if (!isCoverage)
      assert.equal(amountOfToken.toString(), expectedTokens.toString());
    assert.equal(
      amountOfTreasuryToken.toString(),
      expectedTreasuryToken.toString()
    );
  });

  it("steward: loyalty-mint. Checking correct number of tokens are received/minted after foreclosure.", async () => {
    testTokenId1 = tokenDetails[0].token;
    const timeHeld = 10; // In minutes
    const totalToBuy = new BN(tenMinPatronageAt1Eth);

    await steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
      from: accounts[0],
    });

    await steward.buyAuction(testTokenId1, ether("1"), 50000, totalToBuy, {
      from: accounts[2],
    });

    await setNextTxTimestamp(time.duration.minutes(150));
    // foreclosure should happen here (since patraonge was only for 10min)
    await steward._collectPatronageAndSettleBenefactor(testTokenId1, {
      from: accounts[2],
    });

    // should only receive 10min of tokens
    const expectedTokens = multiTokenCalculator([
      {
        timeHeld: new BN(timeHeld).mul(new BN(SECONDS_IN_A_MINUTE)).toString(),
        tokenGenerationRate: globalTokenGenerationRate,
      },
    ]);
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    const amountOfTreasuryToken = await erc20.balanceOf(accounts[0]); // stewards account
    const expectedTreasuryToken = new BN(expectedTokens)
      .mul(new BN(TREASURY_NUMERATOR))
      .div(new BN(TREASURY_DENOMINATOR));

    assert.equal(
      amountOfToken.toString(),
      expectedTokens.toString(),
      "the correct amount of tokens should be minted for the patron"
    );
    assert.equal(
      amountOfTreasuryToken.toString(),
      expectedTreasuryToken.toString(),
      "the correct amount of tokens should be minted for wildcards"
    );
  });

  it("steward: loyalty-mint. Checking that loyalty tokens are minted for all tokens owned by the current owner.", async () => {
    testTokenId1 = tokenDetails[0].token;
    testTokenId2 = tokenDetails[1].token;
    testTokenId3 = tokenDetails[2].token;
    const timeHeld = 10; // In minutes
    const totalToBuy = new BN(tenMinPatronageAt1Eth);

    await steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
      from: accounts[0],
    });

    const buy1Timestamp = await txTimestamp(
      steward.buyAuction(testTokenId1, ether("1"), 50000, totalToBuy, {
        from: accounts[2],
      })
    );
    await setNextTxTimestamp(new BN(5)); // put a multiple of 5 as time between transactions so that rounding doesn't cause maths issues.
    const buy2Timestamp = await txTimestamp(
      steward.buyAuction(testTokenId2, ether("1"), 50000, totalToBuy, {
        from: accounts[2],
      })
    );
    await setNextTxTimestamp(new BN(5)); // put a multiple of 5 as time between transactions so that rounding doesn't cause maths issues.
    const buy3Timestamp = await txTimestamp(
      steward.buyAuction(testTokenId3, ether("1"), 50000, totalToBuy, {
        from: accounts[2],
      })
    );

    const foreclosureTime = await steward.foreclosureTimePatron(accounts[2]);

    await setNextTxTimestamp(time.duration.minutes(15));
    // foreclosure should happen here (since patraonge was only for 10min)
    await steward._collectPatronageAndSettleBenefactor(testTokenId1, {
      from: accounts[2],
    });

    // should only receive 10min of tokens
    const expectedTokens = multiTokenCalculator([
      {
        timeHeld: timeSince(buy1Timestamp, foreclosureTime).toString(),
        tokenGenerationRate: globalTokenGenerationRate,
      },
      {
        timeHeld: timeSince(buy2Timestamp, foreclosureTime).toString(),
        tokenGenerationRate: globalTokenGenerationRate,
      },
      {
        timeHeld: timeSince(buy3Timestamp, foreclosureTime).toString(),
        tokenGenerationRate: globalTokenGenerationRate,
      },
    ]);
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    const amountOfTreasuryToken = await erc20.balanceOf(accounts[0]); // stewards account
    const expectedTreasuryToken = new BN(expectedTokens)
      .mul(new BN(TREASURY_NUMERATOR))
      .div(new BN(TREASURY_DENOMINATOR));

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
    if (!isCoverage)
      assert.equal(
        amountOfTreasuryToken.toString(),
        expectedTreasuryToken.toString()
      );
  });

  it("steward: loyalty-mint. Checking Minted erc20's can be sent between parties for sanity.", async () => {
    testTokenId1 = tokenDetails[0].token;
    const timeHeld = 100;

    await steward.buyAuction(testTokenId1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    await time.increase(time.duration.minutes(timeHeld));
    await steward.buy(testTokenId1, ether("1"), ether("1"), 50000, ether("2"), {
      from: accounts[7],
    });

    const amountToTransfer = 100;
    await erc20.transfer(accounts[3], amountToTransfer, {
      from: accounts[2],
    });
    const amountOfTokenTransferred = await erc20.balanceOf(accounts[3]);

    assert.equal(
      amountToTransfer.toString(),
      amountOfTokenTransferred.toString()
    );
  });
});

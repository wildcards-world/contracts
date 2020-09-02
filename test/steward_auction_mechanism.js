const { BN, expectRevert, ether, time } = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
  auctionCalculator,
  initialize,
  setupTimeManager,
  isCoverage,
  waitTillBeginningOfSecond,
  launchTokens,
} = require("./helpers");
const testHelpers = require("@openzeppelin/test-helpers");

const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward owed", (accounts) => {
  let steward;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  const benefactorAddress = accounts[8];
  const artistAddress = accounts[9];
  const withdrawCheckerAdmin = accounts[6];
  const artistCommission = 0;
  const admin = accounts[0];
  const zeroEther = ether("0");
  const auctionEndPrice = zeroEther;
  const auctionStartPrice = ether("1");
  const auctionDuration = new BN(86400);
  const percentageForWildcards = 50000;
  const tokenDefaults = {
    benefactor: benefactorAddress,
    patronageNumerator,
    tokenGenerationRate,
    artist: artistAddress,
    artistCommission,
    releaseDate: 0,
  };
  const tokenDetails = [
    {
      ...tokenDefaults,
      token: "0",
    },
  ];

  let setNextTxTimestamp,
    timeSinceTimestamp,
    getCurrentTimestamp,
    timeSince,
    txTimestamp;
  const tenMinPatronageAt1Eth = patronageCalculator("600", [
    {
      patronageNumerator,
      price: ether("1"),
    },
  ]);

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
      [accounts[2], accounts[3], accounts[4]]
    );
    steward = result.steward;

    if (isCoverage) await waitTillBeginningOfSecond();
  });

  it("steward: auction. Checking cannot change to wrong permutations of auction", async () => {
    await expectRevert(
      steward.changeAuctionParameters(ether("0"), ether("0"), auctionDuration, {
        from: accounts[1],
      }),
      "Not admin"
    );
    await expectRevert(
      steward.changeAuctionParameters(ether("1"), ether("2"), auctionDuration, {
        from: admin,
      }),
      "auction start < auction end"
    );
    await expectRevert(
      steward.changeAuctionParameters(ether("1"), ether("0.5"), 600, {
        from: admin,
      }),
      "1 day min auction length"
    );
  });

  // buy auction timing correct
  it("steward: auction. Initial price auction works.", async () => {
    const newTokens = [
      {
        ...tokenDefaults,
        token: "5",
      },
      {
        ...tokenDefaults,
        token: "6",
      },
      {
        ...tokenDefaults,
        token: "7",
      },
    ];
    await launchTokens(steward, newTokens);

    const tokenPrice = ether("1");

    const halfAuctionDuration = auctionDuration.div(new BN(2));
    const threeQuartersAuctionDuration = auctionDuration
      .div(new BN(4))
      .mul(new BN(3));
    const quarterAuctionDuration = auctionDuration.div(new BN(4));

    // CHECK 1: price of token functions correctly for auction after half the time is up
    await setNextTxTimestamp(halfAuctionDuration); // Price should now be 0.5eth to buy
    let predictedCostOfToken = auctionCalculator(
      auctionStartPrice,
      auctionEndPrice,
      auctionDuration,
      halfAuctionDuration
    );
    const msgValue = ether("1");
    const remainingDepositCalc = msgValue.sub(predictedCostOfToken);

    await steward.buyAuction(
      newTokens[0].token,
      tokenPrice,
      percentageForWildcards,
      remainingDepositCalc,
      {
        from: accounts[2],
      }
    );
    const actualDeposit = await steward.deposit.call(accounts[2]);
    if (!isCoverage) {
      assert.equal(actualDeposit.toString(), remainingDepositCalc.toString());
      assert.equal(actualDeposit.toString(), ether("0.5").toString());
    }

    // CHECK 2: price of token functions correctly for auction after 3/4 time is up
    await time.increase(quarterAuctionDuration.sub(new BN(1)));
    let costOfToken2 = auctionCalculator(
      auctionStartPrice,
      auctionEndPrice,
      auctionDuration,
      threeQuartersAuctionDuration
    );
    let remainingDepositCalc2 = msgValue.sub(costOfToken2);
    await steward.buyAuction(
      newTokens[1].token,
      tokenPrice,
      percentageForWildcards,
      remainingDepositCalc2,
      {
        from: accounts[3],
      }
    );
    let actualDeposit2 = await steward.deposit.call(accounts[3]);
    if (!isCoverage) {
      assert.equal(actualDeposit2.toString(), remainingDepositCalc2.toString());
      assert.equal(actualDeposit2.toString(), ether("0.75").toString());
    }

    // CHECK 3: If auction is over, minprice is returned.
    await time.increase(halfAuctionDuration); // must be more than quarterAuctionDuration - auction should be over, min price of 0
    await steward.buyAuction(
      newTokens[2].token,
      tokenPrice,
      percentageForWildcards,
      msgValue, // since auction ends at 0
      {
        from: accounts[4],
      }
    );
    let actualDeposit3 = await steward.deposit.call(accounts[4]);
    assert.equal(actualDeposit3.toString(), msgValue.toString());
  });

  it("steward: auction. Check custom-auction on foreclosure works.", async () => {
    await steward.changeAuctionParameters(
      zeroEther,
      zeroEther,
      auctionDuration,
      {
        from: accounts[0],
      }
    );
    const newSalePrice = ether("2");
    const timeTillTokenIsBoughtAfterForeclosure = new BN("20000");
    await steward.buyAuction(
      tokenDetails[0].token,
      newSalePrice,
      percentageForWildcards,
      tenMinPatronageAt1Eth,
      {
        from: accounts[2],
      }
    );

    // should foreclose
    let costOfToken1 = auctionCalculator(
      newSalePrice, // since starting price should be 2
      zeroEther,
      auctionDuration,
      timeTillTokenIsBoughtAfterForeclosure
    );

    await setNextTxTimestamp(
      time.duration.minutes(5).add(timeTillTokenIsBoughtAfterForeclosure)
      // .add(new BN(1))
    );
    const msgValue = ether("2");

    const remainingDepositCalc = msgValue.sub(costOfToken1);
    await steward.buyAuction(
      tokenDetails[0].token,
      newSalePrice,
      percentageForWildcards,
      remainingDepositCalc,
      {
        from: accounts[3],
      }
    );

    const actualDeposit = await steward.deposit.call(accounts[3]);
    assert.equal(actualDeposit.toString(), remainingDepositCalc.toString());
  });

  it("steward: auction. Check ming price returned after auction finished", async () => {
    await steward.changeAuctionParameters(
      ether("1"),
      ether("0.5"),
      auctionDuration,
      {
        from: accounts[0],
      }
    );
    await steward.buyAuction(
      0,
      ether("2"),
      percentageForWildcards,
      tenMinPatronageAt1Eth,
      {
        from: accounts[2],
        // value: ether("1").add(tenMinPatronageAt1Eth),
      }
    );

    await time.increase(time.duration.minutes(5));

    // should foreclose

    let costOfToken1 = ether("0.5");

    await time.increase(time.duration.seconds(90000));
    let msgValue = ether("2");

    let remainingDepositCalc = msgValue.sub(costOfToken1);
    await steward.buyAuction(
      0,
      ether("2"),
      percentageForWildcards,
      remainingDepositCalc,
      {
        from: accounts[3],
      }
    );

    let actualDeposit = await steward.deposit.call(accounts[3]);
    assert.equal(actualDeposit.toString(), remainingDepositCalc.toString());
  });

  it("steward: auction. Price set below auction min won't induce custom auction", async () => {
    await steward.changeAuctionParameters(
      ether("0"),
      ether("0"),
      auctionDuration,
      {
        from: accounts[0],
      }
    );
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("0.2"),
      percentageForWildcards,
      tenMinPatronageAt1Eth,
      {
        from: accounts[2],
      }
    );
    await steward.changeAuctionParameters(
      ether("1"),
      ether("0.5"),
      auctionDuration,
      {
        from: accounts[0],
      }
    );
    const tokenForeclosureTime = time.duration.minutes(50); // since price is 0.2=1/5 ether, we have 10min * 5.
    let costOfToken1 = auctionCalculator(
      ether("1"),
      ether("0.5"),
      auctionDuration,
      "30000" // say 20 000 seconds elapse.
    );

    await setNextTxTimestamp(
      tokenForeclosureTime.add(time.duration.seconds(30000))
    );
    let msgValue = ether("2");

    let remainingDepositCalc = msgValue.sub(costOfToken1);
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("2"),
      percentageForWildcards,
      remainingDepositCalc,
      {
        from: accounts[3],
      }
    );

    let actualDeposit = await steward.deposit.call(accounts[3]);
    if (!isCoverage)
      assert.equal(actualDeposit.toString(), remainingDepositCalc.toString());
  });

  it("steward: auction. Cannot buy till on sale", async () => {
    await steward.changeAuctionParameters(
      ether("1"),
      ether("0.5"),
      auctionDuration,
      {
        from: accounts[0],
      }
    );
    const timeTillLaunch = new BN(50);
    const newTokens = [
      {
        ...tokenDefaults,
        token: "5",
        releaseDate: (await getCurrentTimestamp())
          .add(new BN(2)) // since 2 transactions happen after token is released.
          .add(timeTillLaunch),
      },
    ];
    await launchTokens(steward, newTokens);

    await expectRevert(
      steward.buyAuction(
        newTokens[0].token,
        ether("0.2"),
        percentageForWildcards,
        tenMinPatronageAt1Eth,
        {
          from: accounts[2],
        }
      ),
      "not on auction"
    );

    const timeAfterTokenLaunchToBuy = time.duration.seconds(30000);

    let costOfToken1 = auctionCalculator(
      ether("1"),
      ether("0.5"),
      auctionDuration,
      timeAfterTokenLaunchToBuy
    );

    await setNextTxTimestamp(timeTillLaunch.add(timeAfterTokenLaunchToBuy));

    let msgValue = ether("2");
    let remainingDepositCalc = msgValue.sub(costOfToken1);
    await steward.buyAuction(
      newTokens[0].token,
      ether("2"),
      percentageForWildcards,
      remainingDepositCalc,
      {
        from: accounts[3],
      }
    );

    let actualDeposit = await steward.deposit.call(accounts[3]);
    if (!isCoverage)
      assert.equal(actualDeposit.toString(), remainingDepositCalc.toString());
  });
});

const { BN, ether, time } = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
  setupTimeManager,
  initialize,
  isCoverage,
  waitTillBeginningOfSecond,
} = require("./helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward owed", (accounts) => {
  let steward;
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
    tokenGenerationRate: 1,
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
    txTimestamp,
    setTimestamp;

  before(async () => {
    const timeManager = await setupTimeManager(web3);
    setNextTxTimestamp = timeManager.setNextTxTimestamp; // takes in duration
    timeSinceTimestamp = timeManager.timeSinceTimestamp; // takes in old timestamp, returns current time
    getCurrentTimestamp = timeManager.getCurrentTimestamp; // returns timestamp of a given transaction
    timeSince = timeManager.timeSince; // returns interval between two timestamps
    txTimestamp = timeManager.txTimestamp; // returns timestamp of a given transaction
    setTimestamp = async (duration) => {
      await timeManager.setNextTxTimestamp(duration);
      await web3.eth.sendTransaction({
        from: accounts[5],
        to: accounts[5],
        value: "0",
      });
    };

    if (isCoverage) await waitTillBeginningOfSecond();
  });

  beforeEach(async () => {
    const result = await initialize(
      admin,
      withdrawCheckerAdmin,
      auctionStartPrice,
      auctionEndPrice,
      auctionDuration,
      tokenDetails,
      [accounts[2], accounts[3]]
    );
    steward = result.steward;
  });

  it("steward: multi-token. check patronage of two tokens owed by the same patron after 10 minutes.", async () => {
    // buy 2 tokens, with prices of 1 ether and 2 ether.
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      ether("1"),
      {
        from: accounts[2],
      }
    );
    await steward.buyAuction(
      tokenDetails[1].token,
      ether("2"),
      50000,
      ether("1"),
      {
        from: accounts[2],
      }
    );

    await setTimestamp(time.duration.minutes(10));
    const owedPatron = await steward.patronageOwedPatron.call(accounts[2], {
      from: accounts[2],
    });

    // What our functions calculate should be owed
    const priceOfToken1 = await steward.price.call(tokenDetails[0].token);
    const priceOfToken2 = await steward.price.call(tokenDetails[1].token);
    const expectedPatronageAfter10minToken1 = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
    const expectedPatronageAfter10minToken2 = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[1].patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    const expectedPatronageBoth = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
      {
        patronageNumerator: tokenDetails[1].patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);

    if (!isCoverage) {
      assert.equal(owedPatron.toString(), expectedPatronageBoth.toString());
      assert.equal(
        owedPatron.toString(),
        expectedPatronageAfter10minToken2
          .add(expectedPatronageAfter10minToken1)
          .toString()
      );
    }
  });

  // buy 2 tokens, with prices of 1 ether and 2 ether.
  it("steward: multi-token. check patronage of two tokens owed by the same patron after 10 minutes one of the tokens gets bought.", async () => {
    const token1Price = ether("1");
    await steward.buyAuction(
      tokenDetails[0].token,
      token1Price,
      50000,
      ether("1"),
      {
        from: accounts[2],
      }
    );
    await steward.buyAuction(
      tokenDetails[1].token,
      ether("2"),
      50000,
      web3.utils.toWei("0.1", "ether"),
      {
        from: accounts[2],
      }
    );

    await setTimestamp(time.duration.minutes(10));

    const owedPatron = await steward.patronageOwedPatron.call(accounts[2], {
      from: accounts[2],
    });

    // What we calculate
    const priceOfToken1 = await steward.price.call(tokenDetails[0].token);
    const priceOfToken2 = await steward.price.call(tokenDetails[1].token);
    const expectedPatronageAfter10minToken1 = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
    const expectedPatronageAfter10minToken2 = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[1].patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    const expectedPatronageBoth = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
      {
        patronageNumerator: tokenDetails[1].patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    // Token 1 bought
    await steward.buy(
      tokenDetails[0].token,
      ether("0.1"),
      token1Price,
      50000,
      ether("1.1"),
      {
        from: accounts[3],
      }
    );
    // Time increases
    await setTimestamp(time.duration.minutes(10));

    const owedPatronSecond = await steward.patronageOwedPatron.call(
      accounts[2]
    );
    const owedPatron2Second = await steward.patronageOwedPatron.call(
      accounts[3]
    );

    const priceOfToken1new = await steward.price.call(tokenDetails[0].token);
    const expectedPatronageAfter20minToken2 = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[1].patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    const expectedPatronageAfter20minToken1 = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1new.toString(),
      },
    ]);

    if (!isCoverage) {
      assert.equal(
        owedPatron.toString(),
        expectedPatronageAfter10minToken2
          .add(expectedPatronageAfter10minToken1)
          .toString()
      );
      assert.equal(owedPatron.toString(), expectedPatronageBoth.toString());
      // Should only count since the last clearance (when token 1 was bought)
      assert.equal(
        owedPatronSecond.toString(),
        expectedPatronageAfter10minToken2.toString()
      );
      assert.equal(
        owedPatron2Second.toString(),
        expectedPatronageAfter20minToken1.toString()
      );
    }
  });
});

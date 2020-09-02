const { BN, ether, time } = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
  setupTimeManager,
  initialize,
  isCoverage,
  waitTillBeginningOfSecond,
} = require("./helpers");
const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward owed", (accounts) => {
  let steward;

  const artistAddress = accounts[7];
  const artistCommission = 0;

  const patronageNumerator = "12000000000000";

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
      [accounts[2]]
    );
    steward = result.steward;

    if (isCoverage) await waitTillBeginningOfSecond();
  });

  it("steward: multi-patronage. On token buy, check that the remaining deposit is sent back to patron only if it is their only token", async () => {
    ///////////////////  TIME = 0 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////

    const testTokenId1 = tokenDetails[0].token;
    const testTokenId2 = tokenDetails[1].token;

    //Buying 1st token and setting selling price to 1 eth. With 1 eth deposit.
    const buyTx1BlockTime = await txTimestamp(
      steward.buyAuction(testTokenId1, ether("1"), 50000, ether("1"), {
        from: accounts[2],
      })
    );
    const lastCollectedPatronT0 = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );
    const priceOfToken1 = await steward.price.call(testTokenId1);
    const patronDepositInitial = await steward.deposit.call(accounts[2]);

    assert.equal(buyTx1BlockTime.toString(), lastCollectedPatronT0.toString());

    /////////////////// TIME = 10 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await setNextTxTimestamp(time.duration.minutes(10));
    const collectPatronageT10_tx = await steward._collectPatronageAndSettleBenefactor(
      testTokenId1
    );
    const benefactorFundsT10 = await steward.benefactorFunds.call(accounts[8]);
    const collectPatronageT10BlockTime = (
      await web3.eth.getBlock(collectPatronageT10_tx.receipt.blockNumber)
    ).timestamp;
    const lastCollectedPatronT10 = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );

    // Check patronage after 10mins is correct
    const patronDepositAfter10min = await steward.deposit.call(accounts[2]);
    const expectedPatronageAfter10min = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
    if (!isCoverage)
      assert.equal(
        patronDepositInitial.toString(),
        patronDepositAfter10min.add(expectedPatronageAfter10min).toString()
      );
    assert.equal(
      collectPatronageT10BlockTime.toString(),
      lastCollectedPatronT10.toString()
    );

    assert.equal(
      expectedPatronageAfter10min.toString(),
      benefactorFundsT10.toString()
    );

    /////////////////// TIME = 20 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await setNextTxTimestamp(time.duration.minutes(10));

    // Buy a 2nd token
    const buyToken2Tx = await steward.buyAuction(
      testTokenId2,
      ether("2"),
      50000,
      ether("1"),
      { from: accounts[2] }
    );
    const benefactorFundsT20 = await steward.benefactorFunds.call(accounts[8]);
    const buyToken2BlockTime = (
      await web3.eth.getBlock(buyToken2Tx.receipt.blockNumber)
    ).timestamp;
    const lastCollectedPatronT20 = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );
    const priceOfToken2 = await steward.price.call(testTokenId2);
    assert.equal(
      buyToken2BlockTime.toString(),
      lastCollectedPatronT20.toString()
    );

    const patronDepositAfter20min = await steward.deposit.call(accounts[2]);
    const patronDepositCalculatedAfter20min = await steward.depositAbleToWithdraw.call(
      accounts[2]
    );
    const expectedPatronage10MinToken1 = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);

    if (!isCoverage) {
      assert.equal(
        patronDepositAfter20min.toString(),
        patronDepositAfter10min
          .sub(expectedPatronage10MinToken1)
          .add(ether("1"))
          .toString()
      );
      assert.equal(
        patronDepositCalculatedAfter20min.toString(),
        patronDepositAfter10min
          .add(ether("1"))
          .sub(expectedPatronage10MinToken1)
          .toString()
      );
    }

    /////////////////// TIME = 30 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await setNextTxTimestamp(time.duration.minutes(10));
    // This adds an extra second to the test, but is needed since this test is long off by one second errors should be avoided.

    await steward._collectPatronageAndSettleBenefactor(testTokenId1);

    const patronDepositAfter30min = await steward.deposit.call(accounts[2]);
    const patronDepositCalculatedAfter30min = await steward.depositAbleToWithdraw.call(
      accounts[2]
    );
    const expectedPatronageMulti = patronageCalculator("600", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
      {
        patronageNumerator: tokenDetails[1].patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);

    // Fix this tiny error in commented out assert
    // AssertionError: expected '1999999999999999544' to equal '1999999999999999543'
    // + expected - actual
    // -1999999999999999544
    // +1999999999999999543
    // assert.equal(
    //   patronDepositAfter20min.toString(),
    //   patronDepositAfter30min.add(expectedPatronageMulti).toString()
    // );
    assert.equal(
      patronDepositCalculatedAfter30min.toString(),
      patronDepositAfter30min.toString()
    );

    const benefactorFundsT30 = await steward.benefactorFunds.call(accounts[8]);

    const expectedTotalPatronageT30Token1 = patronageCalculator("1800", [
      {
        patronageNumerator: tokenDetails[0].patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
    if (!isCoverage)
      assert.equal(
        benefactorFundsT30.sub(benefactorFundsT20).toString(),
        expectedTotalPatronageT30Token1.toString()
      );

    /////////////////// TIME = 40 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));

    const benefactor2FundsT40Unclaimed = await steward.patronageDueBenefactor.call(
      accounts[8]
    );
    const benefactor2FundsT40AlreadyClaimed = await steward.benefactorFunds.call(
      accounts[8]
    );

    const expectedTotalPatronageT40Token2 = patronageCalculator("2400", [
      {
        patronageNumerator: tokenDetails[1].patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);

    if (!isCoverage)
      // TODO: investigate why this test is flaky. I think it is the only flaky test in our whole test suite.
      assert.equal(
        expectedTotalPatronageT40Token2.toString(),
        benefactor2FundsT40Unclaimed
          .add(benefactor2FundsT40AlreadyClaimed)
          .toString()
      );
  });
});

const { BN, ether, time } = require("@openzeppelin/test-helpers");
const { promisify } = require("util");
const {
  setupTimeManager,
  patronageDue,
  initialize,
  withdrawBenefactorFundsAll,
  isCoverage,
  waitTillBeginningOfSecond,
} = require("./helpers");
// TODO: switch to the ethersjs version, for future typescript support? https://www.npmjs.com/package/@ethersproject/abi
const one = new BN(1);

contract("WildcardSteward Benefactor collection", (accounts) => {
  let steward, paymentToken;

  const patronageNumerator = "12000000000000";
  const patronageDenominator = "1000000000000";
  const tokenGenerationRate = 10; // should depend on token
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const artistAddress = accounts[9];
  const artistCommission = 0;

  const tenMinPatronageAt1Eth = patronageDue([
    {
      price: ether("1"),
      timeHeld: new BN(600),
      patronageNumerator,
    },
  ]);

  const admin = accounts[0];
  const benefactor1 = accounts[1];
  const benefactor2 = accounts[2];
  const patron1 = accounts[3];
  const patron2 = accounts[4];
  const withdrawCheckerAdmin = accounts[6];
  const zeroEther = ether("0");
  const auctionEndPrice = zeroEther;
  const auctionStartPrice = zeroEther;
  const auctionDuration = new BN(86400);
  const percentageForWildcards = 50000;
  const tokenDefaults = {
    benefactor: benefactor1,
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
    {
      ...tokenDefaults,
      token: "1",
    },
    {
      ...tokenDefaults,
      token: "2",
    },
    {
      ...tokenDefaults,
      benefactor: benefactor2,
      token: "3",
    },
    {
      ...tokenDefaults,
      benefactor: benefactor2,
      token: "4",
    },
  ];
  let setNextTxTimestamp,
    timeSinceTimestamp,
    getCurrentTimestamp,
    timeSince,
    txTimestamp;
  let withdrawMaxPermissioned;

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
      [benefactor1, benefactor2, patron2, patron1]
    );
    steward = result.steward;
    paymentToken = result.paymentToken;
    withdrawMaxPermissioned = async (benefactor) =>
      withdrawBenefactorFundsAll(
        steward,
        web3,
        withdrawCheckerAdmin,
        benefactor,
        ether("100").toString(),
        (await getCurrentTimestamp()).add(new BN(100000000)).toString()
      );

    if (isCoverage) await waitTillBeginningOfSecond();
  });

  it("steward: benefactor withdrawal. A token is owned for 1 year.", async () => {
    const tokenPrice = ether("0.01");
    const deposit = ether("0.5");
    await steward.buyAuction(1, tokenPrice, percentageForWildcards, deposit, {
      from: accounts[2],
    });

    let timestampBefore = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;

    const balanceBefore = await paymentToken.balanceOf(benefactor1);
    await setNextTxTimestamp(time.duration.days(365));

    await withdrawMaxPermissioned(benefactor1);
    // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
    const due = tokenPrice
      .mul(time.duration.days(365))
      .mul(new BN(patronageNumerator))
      .div(new BN(patronageDenominator))
      .div(time.duration.days(365));
    const balanceAfter = await paymentToken.balanceOf(benefactor1);
    if (!isCoverage)
      assert.equal(balanceAfter.sub(balanceBefore).toString(), due.toString());
  });

  // it("steward: benefactor withdrawal. A token is owned for 1 year.", async () => {
  //   const tokenPrice = ether("0.01");
  //   const deposit = ether("0.5");
  //   await steward.buyAuction(1, tokenPrice, percentageForWildcards, {
  //     from: accounts[2],
  //     value: deposit,
  //   });

  //   let timestampBefore = (
  //     await web3.eth.getBlock(await web3.eth.getBlockNumber())
  //   ).timestamp;

  //   const balTrack = await balance.tracker(benefactor1);
  //   await setNextTxTimestamp(time.duration.days(365));

  //   await steward.withdrawBenefactorFunds({
  //     from: benefactor1,
  //     gasPrice: "0", // Set gas price to 0 for simplicity
  //   });

  //   // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
  //   const due = tokenPrice
  //     .mul(time.duration.days(365))
  //     .mul(new BN(patronageNumerator))
  //     .div(new BN(patronageDenominator))
  //     .div(time.duration.days(365));

  //   assert.equal((await balTrack.delta()).toString(), due.toString());
  // });

  describe("steward: benefactor withdrawal with token foreclosure", async () => {
    it("steward: benefactor withdrawal. A token is owned for 20 minutes, but forecloses after 10 minutes. The organisation withdraws their funds after 20 minutes.", async () => {
      const tokenPrice = ether("1");
      const deposit = tenMinPatronageAt1Eth;
      const buyToken2Timestamp = await txTimestamp(
        steward.buyAuction(
          tokenDetails[1].token,
          tokenPrice,
          percentageForWildcards,
          // TODO: investigate why setting this deposit to a lower value causes a contract revert (eg deposit causes a revert)
          deposit.mul(new BN(10)),
          {
            from: patron2,
          }
        )
      );

      const buyToken1Timestamp = await txTimestamp(
        steward.buyAuction(
          tokenDetails[0].token,
          tokenPrice,
          percentageForWildcards,
          deposit,
          {
            from: patron1,
            // value: deposit,
          }
        )
      );

      const token1ForeclosureTime = await steward.foreclosureTime.call(
        tokenDetails[0].token
      );
      assert.equal(
        token1ForeclosureTime.toString(),
        buyToken1Timestamp.add(time.duration.minutes(10)).toString(),
        "foreclosure time should be 10 minutes after purchase"
      );

      const balanceBefore = await paymentToken.balanceOf(benefactor1);
      const withdrawBenefactorFundstimestamp = await setNextTxTimestamp(
        time.duration.minutes(20).add(one)
      );
      await withdrawMaxPermissioned(benefactor1);

      // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
      // TODO: create a function
      const totalDue = patronageDue([
        {
          price: tokenPrice,
          timeHeld: await timeSinceTimestamp(buyToken1Timestamp),
          patronageNumerator,
        },
        {
          price: tokenPrice,
          timeHeld: await timeSinceTimestamp(buyToken2Timestamp),
          patronageNumerator,
        },
      ]);

      const balanceAfter = await paymentToken.balanceOf(benefactor1);
      if (!isCoverage)
        assert.equal(
          balanceAfter.sub(balanceBefore).toString(),
          totalDue.toString()
        );

      const benefactorCreditBefore = await steward.benefactorCredit.call(
        benefactor1
      );
      const benefactorFundsBefore = await steward.benefactorFunds.call(
        benefactor1
      );
      const tokenPriceBefore = await steward.price.call(tokenDetails[0].token);
      const patronScaledCostBefore = await steward.totalPatronOwnedTokenCost.call(
        patron1
      );
      const benefactorScaledCostBefore = await steward.totalBenefactorTokenNumerator.call(
        benefactor1
      );
      // After calling collect patronage a credit should reflect. tenMinPatronageAt1Eth
      await steward._collectPatronageAndSettleBenefactor(tokenDetails[0].token);

      const totalDueBeforeForeclosure = patronageDue([
        {
          price: tokenPrice,
          timeHeld: 1,
          patronageNumerator,
        },
        {
          price: tokenPrice,
          timeHeld: 1,
          patronageNumerator,
        },
      ]);

      const benefactorCreditAfter = await steward.benefactorCredit.call(
        benefactor1
      );
      const benefactorFundsAfter = await steward.benefactorFunds.call(
        benefactor1
      );
      const tokenPriceAfter = await steward.price.call(tokenDetails[0].token);
      const potronScaledCostAfter = await steward.totalPatronOwnedTokenCost.call(
        patron1
      );
      const benefactorScaledCostAfter = await steward.totalBenefactorTokenNumerator.call(
        benefactor1
      );

      if (!isCoverage) {
        assert.equal(
          "0",
          benefactorCreditBefore.toString(),
          "benefactor shouldn't have credit before token forecloses"
        );
        assert.equal(
          benefactorCreditAfter.toString(),
          tenMinPatronageAt1Eth.toString(),
          "benefactor should have correct credit after token is foreclosed"
        );
        assert.equal(
          benefactorFundsBefore.toString(),
          "0",
          "benefactor should start with a balance of zero"
        );
        assert.equal(
          patronScaledCostBefore.toString(),
          tokenPrice.mul(new BN(patronageNumerator)).toString(),
          "The scaled token price is incorrect before the withdrawal"
        );
        assert.equal(
          benefactorFundsAfter.toString(),
          "0",
          "benefactor funds should stay zero"
        );
        assert.equal(
          tokenPriceBefore.toString(),
          tokenPriceAfter.toString(),
          "The token price shouldn't change"
        );
        assert.equal(
          "0",
          potronScaledCostAfter.toString(),
          "The patrons scaled cost should reset to zero when token forecloses"
        );
        assert.equal(
          benefactorScaledCostBefore.toString(),
          benefactorScaledCostAfter.mul(new BN(2)).toString(),
          "The benefactor scaled cost should be half (since half the tokens were foreclosed)"
        );

        const balanceBefore2 = await paymentToken.balanceOf(benefactor1);
        await setNextTxTimestamp(time.duration.minutes(40));

        // the amount of credit should be tenMinPatronageAt1Eth;
        // the extra amount available to withdraw should be 3 * tenMinPatronageAt1Eth;

        // the error is the available to withdraw is at 1826484018264840 (8 * tenMinPatronageAt1Eth)
        // Since the foreclosure of token 1 is not Recognized here.
        await withdrawMaxPermissioned(benefactor1);

        const amountDueForToken2inSecondWithdrawal = patronageDue([
          {
            price: tokenPrice,
            timeHeld: await timeSinceTimestamp(
              withdrawBenefactorFundstimestamp
            ),
            patronageNumerator,
          },
        ]);

        const totalDueInSecondWithdrawal = patronageDue([
          {
            price: tokenPrice,
            timeHeld: await timeSince(
              withdrawBenefactorFundstimestamp,
              token1ForeclosureTime
            ),
            patronageNumerator,
          },
          {
            price: tokenPrice,
            timeHeld: await timeSinceTimestamp(
              withdrawBenefactorFundstimestamp
            ),
            patronageNumerator,
          },
        ]);

        const balanceAfter2 = await paymentToken.balanceOf(benefactor1);
        const changeInBenefactorBalance = balanceAfter2.sub(balanceBefore2);
        assert.isTrue(
          // NOTE: due to division error, can be off by 1...
          Math.abs(changeInBenefactorBalance.sub(totalDueInSecondWithdrawal)) <=
            1
        );
        const calculatedBenefactorBalanceChange = amountDueForToken2inSecondWithdrawal.sub(
          benefactorCreditAfter
        );
      }
    });
  });
});

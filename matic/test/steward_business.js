const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const {
  initialize,
  setupTimeManager,
  patronageDue,
  isCoverage,
} = require("./helpers");

contract("WildcardSteward owed", (accounts) => {
  let steward, paymentToken;

  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const artistAddress = accounts[9];
  const artistCommission = new BN(10000); // 1%

  const admin = accounts[0];
  const benefactor = accounts[1];
  const withdrawCheckerAdmin = accounts[6];
  const zeroEther = ether("0");
  const auctionEndPrice = zeroEther;
  const auctionStartPrice = zeroEther;
  const auctionDuration = new BN(86400);
  const defaultPercentageForWildcards = new BN(50000);
  const percentageCutPrecision = new BN(1000000);
  const tokenDefaults = {
    benefactor: benefactor,
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
      [accounts[2], accounts[3]]
    );
    steward = result.steward;
    paymentToken = result.paymentToken;
  });

  it("steward: multi-token-deposit. On token buy, check that the remaining deposit is sent back to patron only if it is their only token", async () => {
    const token1Price = ether("1");
    const token2Price = ether("2");
    const tenPercentForWildcards = new BN(100000);
    //Buying 2 tokens. Setting selling price to 1 and 2 eth respectively. Sending 1 eth each for deposit.
    // 5% wildcards commission
    const initialBuyToken1Timestamp = await txTimestamp(
      steward.buyAuction(
        tokenDetails[0].token,
        token1Price,
        defaultPercentageForWildcards,
        ether("1"),
        {
          from: accounts[2],
          gasPrice: 0,
        }
      )
    );
    // 10% wildcards commission set for sale.
    const initialBuyToken2Timestamp = await steward.buyAuction(
      tokenDetails[1].token,
      token2Price,
      tenPercentForWildcards,
      ether("1"),
      {
        from: accounts[2],
        gasPrice: 0,
      }
    );

    const patronDepositBeforeSale = await steward.deposit.call(accounts[2]);
    const balancePatronBeforeSale = await paymentToken.balanceOf(accounts[2]);
    // When first token is bought, deposit should remain.
    await steward.buy(
      tokenDetails[0].token,
      ether("1"),
      ether("1"),
      defaultPercentageForWildcards,
      ether("2"),
      {
        from: accounts[3],
        gasPrice: 0,
      }
    );

    const firstSaleArtistCut = token1Price
      .mul(artistCommission)
      .div(percentageCutPrecision);
    const firstSaleWildcardsCut = token1Price
      .mul(defaultPercentageForWildcards)
      .div(percentageCutPrecision);

    const patronDepositAfterFirstSale = await steward.deposit.call(accounts[2]);
    const balancePatronAfterFirstSale = await paymentToken.balanceOf(
      accounts[2]
    );

    const patronageDueFromHoldingTokensSale1 = patronageDue([
      { price: token1Price, timeHeld: 1, patronageNumerator },
      { price: token2Price, timeHeld: 1, patronageNumerator },
    ]);

    // 1% to artist and 5% to wildcards on this token.
    if (!isCoverage)
      // -2939998477929984780
      // +-3000001522070015220
      assert.equal(
        patronDepositAfterFirstSale.toString(),
        patronDepositBeforeSale
          .add(token1Price.sub(firstSaleArtistCut).sub(firstSaleWildcardsCut))
          .sub(patronageDueFromHoldingTokensSale1)
          .toString(),
        "Deposit should be 94% of original, since 5% + 1% went to wildcards and the artist respectively."
      );

    assert.equal(
      balancePatronBeforeSale.toString(),
      balancePatronAfterFirstSale.toString()
    );

    const artistDepositAfterFirstSale = await steward.deposit.call(accounts[9]);
    assert.equal(
      artistDepositAfterFirstSale.toString(),
      ether("0.01").toString()
    );

    const wildcardsDepositAfterFirstSale = await steward.deposit.call(
      accounts[0]
    );
    assert.equal(
      wildcardsDepositAfterFirstSale.toString(),
      ether("0.05").toString(),
      "wildcards deposit should be 5% of the sale"
    );

    //Second token then bought. Deposit should now be added back the patrons balance

    const patronDepositAfterSecondSale1 = await steward.deposit.call(
      accounts[2]
    );

    await steward.buy(
      tokenDetails[1].token,
      ether("1"),
      token2Price,
      defaultPercentageForWildcards,
      ether("3"),
      {
        from: accounts[3],
        gasPrice: 0,
      }
    );
    const patronDepositAfterSecondSale2 = await steward.deposit.call(
      accounts[2]
    );

    const balancePatronAfterSecondSale = await paymentToken.balanceOf(
      accounts[2]
    );
    const patronDepositAfterSecondSale = await steward.deposit.call(
      accounts[2]
    );

    const secondSaleArtistCut = token2Price
      .mul(artistCommission)
      .div(percentageCutPrecision);
    const secondSaleWildcardsCut = token2Price
      .mul(tenPercentForWildcards)
      .div(percentageCutPrecision);

    const patronageDueFromHoldingTokensSale2 = patronageDue([
      { price: token2Price, timeHeld: 1, patronageNumerator },
    ]);

    //Checking once no more tokens are owned, the deposit is set to zero
    assert.equal(patronDepositAfterSecondSale.toString(), "0");
    //Checking owner gets deposit back on sale of final token plus sale price too.
    if (!isCoverage)
      assert.equal(
        balancePatronAfterSecondSale.toString(),
        balancePatronAfterFirstSale
          .add(token2Price.sub(secondSaleArtistCut).sub(secondSaleWildcardsCut))
          .add(patronDepositAfterFirstSale)
          .sub(patronageDueFromHoldingTokensSale2)
          .toString(),
        "The user should get back their full deposit + sale price on last token sale."
      );

    const balanceArtistBeforeWithdraw = await paymentToken.balanceOf(
      accounts[9]
    );

    const artistDepositAfterSecondSale = await steward.deposit.call(
      accounts[9]
    );
    assert.equal(
      artistDepositAfterSecondSale.toString(),
      ether("0.03").toString()
    );

    await steward.withdrawDeposit(ether("0.03"), {
      from: accounts[9],
      gasPrice: 0,
    });

    const balanceArtistAfterWithdraw = await paymentToken.balanceOf(
      accounts[9]
    );

    assert.equal(
      balanceArtistBeforeWithdraw.toString(),
      balanceArtistAfterWithdraw.sub(ether("0.03")).toString(),
      "Artist should have received their 1% of the sales and be able to withdraw it."
    );

    const wildcardsDepositAfterSecondSale = await steward.deposit.call(
      accounts[0]
    );

    assert.equal(
      wildcardsDepositAfterSecondSale.toString(),
      ether("0.25").toString(),
      "Deposit for wildcards is incorrect after the first sale."
    );
  });
});

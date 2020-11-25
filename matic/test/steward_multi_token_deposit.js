const { BN, ether, time } = require("@openzeppelin/test-helpers");
const { patronageDue, setupTimeManager, initialize } = require("./helpers");

contract("WildcardSteward owed", (accounts) => {
  let steward, paymentToken;
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
    //Buying 2 tokens. Setting selling price to 1 and 2 eth respectively. Sending 1 eth each for deposit.
    const buy1time = await txTimestamp(
      steward.buyAuction(tokenDetails[0].token, ether("1"), 50000, ether("1"), {
        from: accounts[2],
      })
    );
    const token2price = ether("2");
    const buy2time = await txTimestamp(
      steward.buyAuction(
        tokenDetails[1].token,
        token2price,
        50000,
        ether("1"),
        {
          from: accounts[2],
        }
      )
    );

    const priceOftoken1 = await steward.price.call(tokenDetails[0].token);
    const priceOftoken2 = await steward.price.call(tokenDetails[1].token);

    const patronDepositBeforeSale = await steward.deposit.call(accounts[2]);
    const balancePatronBeforeSale = await paymentToken.balanceOf(accounts[2]);

    // TIME INCREASES HERE BY 10 MIN
    await setNextTxTimestamp(time.duration.minutes(10));

    // When first token is bought, deposit should remain.
    const sell1time = await txTimestamp(
      steward.buy(
        tokenDetails[0].token,
        ether("1"),
        ether("1"),
        50000,
        ether("2"),
        {
          from: accounts[3],
        }
      )
    );

    const patronDepositAfterFirstSale = await steward.deposit.call(accounts[2]);
    const balancePatronAfterFirstSale = await paymentToken.balanceOf(
      accounts[2]
    );

    //Second token then bought. Deposit should now be added back the patrons balance
    const sell2time = await txTimestamp(
      steward.buy(
        tokenDetails[1].token,
        ether("1"),
        priceOftoken2,
        50000,
        ether("3"),
        {
          from: accounts[3],
        }
      )
    );

    const balancePatronAfterSecondSale = await paymentToken.balanceOf(
      accounts[2]
    );
    const patronDepositAfterSecondSale = await steward.deposit.call(
      accounts[2]
    );

    const expectedPatronageAfterFirstSale = patronageDue([
      {
        timeHeld: sell1time.sub(buy2time),
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price: priceOftoken1.toString(),
      },
      {
        timeHeld: sell1time.sub(buy2time),
        patronageNumerator: tokenDetails[1].patronageNumerator,
        price: priceOftoken2.toString(),
      },
    ]);
    const expectedPatronageFromSecondSale = patronageDue([
      {
        timeHeld: sell2time.sub(sell1time),
        patronageNumerator: tokenDetails[1].patronageNumerator,
        price: priceOftoken2.toString(),
      },
    ]);

    assert.equal(
      patronDepositAfterFirstSale.toString(),
      patronDepositBeforeSale
        .sub(expectedPatronageAfterFirstSale)
        .add(ether("0.95")) //since now you would recieve 0.94 ether from the sale to your deposit instead
        //  0.05 wildcards and 0.01 artist commision
        .toString()
    );

    //Checking once no more tokens are owned, the deposit is set to zero
    assert.equal(patronDepositAfterSecondSale.toString(), "0");
    // This should now be the same, as only the deposit should increase
    assert.equal(
      balancePatronBeforeSale.toString(),
      balancePatronAfterFirstSale.toString()
    );
    //Checking owner gets deposit back on sale of final token plus sale price too.
    assert.equal(
      balancePatronAfterSecondSale.toString(),
      balancePatronAfterFirstSale
        .add(ether("1.9"))
        .add(patronDepositAfterFirstSale)
        .sub(expectedPatronageFromSecondSale)
        .toString()
    );
  });
});

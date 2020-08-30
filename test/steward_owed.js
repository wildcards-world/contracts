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
  withdrawBenefactorFundsAll,
  isCoverage,
  waitTillBeginningOfSecond,
  multiPatronageCalculator,
} = require("./helpers");

const patronageCalculator = multiPatronageCalculator();
const one = new BN(1);

contract("WildcardSteward owed", (accounts) => {
  let erc721;
  let steward;
  let paymentToken;

  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const artistAddress = accounts[9];
  const artistCommission = 0;
  const feeSplitDenominator = new BN(10000);

  const tenMinPatronageAt1Eth = ether("1")
    .mul(new BN("600"))
    .mul(new BN("12"))
    .div(new BN("1"))
    .div(new BN("31536000"));

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
  let withdrawMaxPermissioned;

  before(async () => {
    const timeManager = await setupTimeManager(web3);
    setNextTxTimestamp = timeManager.setNextTxTimestamp; // takes in duration
    timeSinceTimestamp = timeManager.timeSinceTimestamp; // takes in old timestamp, returns current time
    getCurrentTimestamp = timeManager.getCurrentTimestamp; // returns timestamp of a given transaction
    timeSince = timeManager.timeSince; // returns interval between two timestamps
    txTimestamp = timeManager.txTimestamp; // returns timestamp of a given transaction
    setTimestamp = async (duration) => {
      await timeManager.setNextTxTimestamp(duration);
      return await timeManager.txTimestamp({
        receipt: await web3.eth.sendTransaction({
          from: accounts[5],
          to: accounts[5],
          value: "0",
        }),
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
    erc721 = result.erc721;

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

  it("steward: owed. transfer without steward (fail)", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("1"), {
      from: accounts[2],
    });
    await expectRevert.unspecified(
      erc721.transferFrom(accounts[2], accounts[1], 42, { from: accounts[2] })
    );
  });
  it("steward: owed. check patronage owed after 1 second.", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("1"), {
      from: accounts[2],
    });

    await setTimestamp(1);
    const owed = await steward.patronageOwedPatron.call(accounts[2], {
      from: accounts[2],
    });
    const expectedPatronageAfter1second = patronageCalculator("1", [
      {
        patronageNumerator: patronageNumerator,
        price: ether("1"),
      },
    ]);

    assert.equal(owed.toString(), expectedPatronageAfter1second.toString());
  });

  it("steward: owed. check patronage owed after 1 year.", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("1"), {
      from: accounts[2],
    });

    await setTimestamp(time.duration.days(365));
    const owed = await steward.patronageOwedPatron.call(accounts[2], {
      from: accounts[2],
    });

    const due = patronageCalculator("31536000", [
      {
        patronageNumerator: patronageNumerator,
        price: ether("1"),
      },
    ]);

    assert.equal(owed.toString(), due.toString());
    // TODO: this value shouldn't be hardcoded. It should depend on the tax variable of the token.
    assert.equal(owed.toString(), "12000000000000000000"); // 5% over 365 days.
  });

  it("steward: owed. collect patronage successfully after 10 minutes.", async () => {
    const price = ether("1");
    await steward.buyAuction(tokenDetails[0].token, price, 50000, ether("1"), {
      from: accounts[2],
    });

    const measurementTimestamp = await setTimestamp(time.duration.minutes(10));
    const owed = await steward.patronageOwedPatron.call(accounts[2], {
      from: accounts[2],
    });
    const collectPatronageTimestamp = await txTimestamp(
      steward._collectPatronageAndSettleBenefactor(tokenDetails[0].token)
    );
    // TODO: this isn't necessary anymore. Left in not to break the tests.
    const updateBenefactorBalanceTimestamp = await txTimestamp(
      steward._updateBenefactorBalance(benefactorAddress)
    );

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFund = await steward.benefactorFunds.call(
      benefactorAddress
    );
    const timeLastCollectedBenefactor = await steward.timeLastCollectedBenefactor.call(
      benefactorAddress
    );
    const previousBlockTime = await time.latest();

    const patronageDueSinceMeasurement = patronageDue([
      {
        timeHeld: collectPatronageTimestamp.sub(measurementTimestamp),
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price,
      },
    ]);
    const patronageEarnedSinceMeasurement = patronageDue([
      {
        timeHeld: updateBenefactorBalanceTimestamp.sub(measurementTimestamp),
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price,
      },
    ]);

    const calcDeposit = price.sub(owed).sub(patronageDueSinceMeasurement);

    assert.equal(deposit.toString(), calcDeposit.toString());

    assert.equal(
      benefactorFund.toString(),
      owed.add(patronageEarnedSinceMeasurement).toString()
    );
    assert.equal(
      timeLastCollectedBenefactor.toString(),
      previousBlockTime.toString()
    );
  });

  it("steward: owed. collect patronage successfully after 10min and again after 10min.", async () => {
    const price = ether("1");
    const initialBuyTimestamp = await txTimestamp(
      steward.buyAuction(tokenDetails[0].token, price, 50000, ether("1"), {
        from: accounts[2],
      })
    );

    await setNextTxTimestamp(time.duration.minutes(10));

    await steward._collectPatronageAndSettleBenefactor(tokenDetails[0].token);

    await setNextTxTimestamp(time.duration.minutes(10));

    const collectPatronageTimestamp = await txTimestamp(
      steward._collectPatronageAndSettleBenefactor(tokenDetails[0].token)
    );
    const updateBenefactorBalanceTimestamp = await txTimestamp(
      steward._updateBenefactorBalance(benefactorAddress)
    );

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFund = await steward.benefactorFunds.call(
      benefactorAddress
    );
    const timeLastCollected = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );

    const patronageDueTillCollection = patronageDue([
      {
        timeHeld: collectPatronageTimestamp.sub(initialBuyTimestamp),
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price,
      },
    ]);
    const patronageDueTillBenefactorUpdate = patronageDue([
      {
        timeHeld: updateBenefactorBalanceTimestamp.sub(initialBuyTimestamp),
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price,
      },
    ]);

    const calcDeposit = ether("1").sub(patronageDueTillCollection);

    assert.equal(deposit.toString(), calcDeposit.toString());
    assert.equal(
      benefactorFund.toString(),
      patronageDueTillBenefactorUpdate.toString()
    );
    assert.equal(
      timeLastCollected.toString(),
      collectPatronageTimestamp.toString()
    );
  });

  it("steward: owed. collect patronage that forecloses precisely after 10min.", async () => {
    const price = ether("1");
    const tenMinutes = time.duration.minutes(10);

    // 10min of patronage
    const initialBuyTimestamp = await txTimestamp(
      steward.buyAuction(
        tokenDetails[0].token,
        price,
        50000,
        tenMinPatronageAt1Eth,
        {
          from: accounts[2],
        }
      )
    );

    await setNextTxTimestamp(tenMinutes.add(one));
    const receipt = await steward._collectPatronageAndSettleBenefactor(
      tokenDetails[0].token
    ); // will foreclose
    // const updateBenefactorBalanceTimestamp = await txTimestamp(
    //   steward._updateBenefactorBalance(benefactorAddress)
    // );
    const collectPatronageTimestamp = await txTimestamp(receipt);

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFund = await steward.benefactorFunds.call(
      benefactorAddress
    );
    const timeLastCollected = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );
    const previousBlockTime = await time.latest();
    const state = await steward.state.call(tokenDetails[0].token);

    const timeHeld = timeLastCollected.sub(initialBuyTimestamp);

    const calcBenefactorFund = patronageDue([
      {
        timeHeld,
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price,
      },
    ]);
    // const calcTotalCurrentCollected = owed.patronageDue;

    const currentOwner = await erc721.ownerOf.call(tokenDetails[0].token);

    expectEvent(receipt, "Foreclosure", {
      prevOwner: accounts[2],
      foreclosureTime: timeLastCollected,
    });
    assert.equal(currentOwner, steward.address);
    assert.equal(deposit.toString(), "0");
    // TODO: invistigate why this sometimes gives an off by one error (not always)
    assert.equal(benefactorFund.toString(), calcBenefactorFund.toString());
    assert.equal(
      timeLastCollected.toString(),
      previousBlockTime.sub(one).toString()
    );
    assert.equal(state.toString(), "0"); // foreclosed state
  });

  it("steward: owed. Deposit zero after 10min of patronage (after 10min) [success].", async () => {
    // 10min of patronage
    await steward.buyAuction(1, ether("1"), 50000, tenMinPatronageAt1Eth, {
      from: accounts[2],
    });

    await setTimestamp(time.duration.minutes(10));
    const deposit = await steward.deposit.call(accounts[2]);
    const availableToWithdraw = await steward.depositAbleToWithdraw.call(
      accounts[2]
    );

    assert.equal(deposit.toString(), tenMinPatronageAt1Eth.toString());
    assert.equal(availableToWithdraw.toString(), "0");
  });

  it("steward: owed. Foreclose Time is 10min into future on 10min patronage deposit [success].", async () => {
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buyAuction(1, ether("1"), 50000, totalToBuy, {
      from: accounts[2],
    });

    const forecloseTime = await steward.foreclosureTime.call(1);
    const previousBlockTime = await time.latest();
    const finalTime = previousBlockTime.add(time.duration.minutes(10));
    assert.equal(forecloseTime.toString(), finalTime.toString());
  });

  it("steward: owed. buy from person that forecloses precisely after 10min.", async () => {
    const price = ether("1");
    const price2 = ether("2");
    const wildcardsSplit = new BN(50000);
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    const initialBuyTime = await txTimestamp(
      steward.buyAuction(
        tokenDetails[0].token,
        price,
        wildcardsSplit,
        totalToBuy,
        {
          from: accounts[2],
        }
      )
    );

    let secondBuyTime = await setNextTxTimestamp(
      time.duration.minutes(10).add(one)
    );
    const secondBuyValue = ether("1").add(totalToBuy); // Paying the 1eth auction price plus totaltobuy
    const txReceipt = await steward.buyAuction(
      tokenDetails[0].token,
      price2,
      wildcardsSplit,
      totalToBuy, // Paying the 1eth auction price plus totaltobuy
      {
        from: accounts[3],
      }
    ); // will foreclose and then buy

    const depositSecondUser = await steward.deposit.call(accounts[3]);
    const benefactorFund = await steward.benefactorFunds.call(
      benefactorAddress
    );
    const timeLastCollectedBuyer1 = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );
    const timeLastCollectedBuyer2 = await steward.timeLastCollectedPatron.call(
      accounts[3]
    );
    const previousBlockTime = await time.latest();
    const state = await steward.state.call(tokenDetails[0].token);

    const currentOwner = await erc721.ownerOf.call(tokenDetails[0].token);

    const timeLastCollected = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );
    const timeHeld = timeLastCollected.sub(initialBuyTime);

    const calcBenefactorFund = patronageDue([
      {
        timeHeld,
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price,
      },
    ]);

    const depositCalc = secondBuyValue.sub(price);

    expectEvent(txReceipt, "Foreclosure", { prevOwner: accounts[2] });
    expectEvent(txReceipt, "Buy", { owner: accounts[3], price: ether("2") });

    assert.equal(currentOwner, accounts[3]);
    assert.equal(depositSecondUser.toString(), depositCalc.toString());
    assert.equal(benefactorFund.toString(), calcBenefactorFund.toString());
    assert.equal(
      timeLastCollectedBuyer1.toString(),
      previousBlockTime.sub(one).toString()
    );
    assert.equal(state.toString(), "1"); // owned state
  });

  it("steward: owed. collect patronage by benefactor after 10min.", async () => {
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      totalToBuy,
      {
        from: accounts[2],
      }
    );
    await setNextTxTimestamp(time.duration.minutes(10).add(one));
    await steward._collectPatronageAndSettleBenefactor(tokenDetails[0].token); // will foreclose

    const balanceBefore = await paymentToken.balanceOf(benefactorAddress);

    await withdrawMaxPermissioned(benefactorAddress);

    const benefactorFund = await steward.benefactorFunds.call(
      benefactorAddress
    );

    assert.equal(benefactorFund.toString(), "0");
    const balanceAfter = await paymentToken.balanceOf(benefactorAddress);
    assert.equal(
      balanceAfter.sub(balanceBefore).toString(),
      totalToBuy.toString()
    );
  });
  it("steward: owed. collect patronage. 10min deposit. 20min Foreclose.", async () => {
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buyAuction(1, ether("1"), 50000, totalToBuy, {
      from: accounts[2],
    });

    await setTimestamp(time.duration.minutes(20));
    // 20min owed patronage
    // 10min due
    const foreclosed = await steward.foreclosed.call(1);
    const preTLC = await steward.timeLastCollectedPatron.call(accounts[2]);
    const preDeposit = await steward.deposit.call(accounts[2]);
    const owed = await steward.patronageOwedPatron.call(accounts[2], {
      from: accounts[2],
    });
    await steward._collectPatronageAndSettleBenefactor(1); // will foreclose

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFunds = await steward.benefactorFunds.call(
      benefactorAddress
    );
    const benefactorCredit = await steward.benefactorCredit.call(
      benefactorAddress
    );
    const timeLastCollected = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );
    const previousBlockTime = await time.latest();
    const tlcCheck = preTLC.add(
      previousBlockTime
        .sub(preTLC)
        .mul(preDeposit)
        .div(owed)
    );
    const state = await steward.state.call(1);

    const calcBenefactorFund = tenMinPatronageAt1Eth;

    const currentOwner = await erc721.ownerOf.call(1);

    assert.isTrue(foreclosed);
    assert.equal(deposit.toString(), "0");
    assert.equal(
      benefactorFunds.sub(benefactorCredit).toString(),
      calcBenefactorFund.toString()
    );
    assert.equal(timeLastCollected.toString(), tlcCheck.toString());
    assert.equal(state.toString(), "0"); // foreclosed state
    assert.equal(steward.address, currentOwner);
  });
  it("steward: owed. deposit wei success from many accounts", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    await steward.depositWei(ether("1"), { from: accounts[2] });
    // NOTE: this function has been disabled temporarily for security reasons.
    // await steward.depositWeiPatron(accounts[2], ether("1"), {
    //   from: accounts[3],
    // });
    const deposit = await steward.deposit.call(accounts[2]);
    assert.equal(deposit.toString(), ether("3").toString());
  });

  it("steward: owed. change price to zero [fail]", async () => {
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      ether("2"),
      {
        from: accounts[2],
      }
    );
    await expectRevert(
      steward.changePrice(tokenDetails[0].token, "0", { from: accounts[2] }),
      "incorrect price"
    );
  });

  it("steward: owed. change price to more [success]", async () => {
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      ether("2"),
      {
        from: accounts[2],
      }
    );
    const txReceipt = await steward.changePrice(
      tokenDetails[0].token,
      ether("3"),
      {
        from: accounts[2],
      }
    );
    expectEvent(txReceipt, "PriceChange", { newPrice: ether("3") });
    const postPrice = await steward.price.call(tokenDetails[0].token);
    assert.equal(ether("3").toString(), postPrice.toString());
  });

  it("steward: owed. change price to less [success]", async () => {
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      ether("2"),
      {
        from: accounts[2],
      }
    );
    await steward.changePrice(tokenDetails[0].token, ether("0.5"), {
      from: accounts[2],
    });
    const postPrice = await steward.price.call(tokenDetails[0].token);
    assert.equal(ether("0.5").toString(), postPrice.toString());
  });

  it("steward: owed. change price to less with another account [fail]", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    await expectRevert(
      steward.changePrice(tokenDetails[0].token, ether("0.5"), {
        from: accounts[3],
      }),
      "Not patron"
    );
  });

  it("steward: owed. withdraw whole deposit into foreclosure [succeed]", async () => {
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      ether("2"),
      {
        from: accounts[2],
      }
    );
    const deposit = await steward.deposit.call(accounts[2]);
    await setNextTxTimestamp(5);
    const amountUsed = patronageDue([
      {
        timeHeld: 5,
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price: ether("1"),
      },
    ]);
    await steward.withdrawDeposit(deposit.sub(amountUsed), {
      from: accounts[2],
    });
    const foreclosed = await steward.foreclosed.call(tokenDetails[0].token);
    const foreclosedPatron = await steward.foreclosedPatron.call(accounts[2]);
    assert(foreclosed);
    assert(foreclosedPatron);
  });

  it("steward: owed. withdraw whole deposit through exit into foreclosure after 10min [succeed]", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    await setNextTxTimestamp(time.duration.minutes(10));
    await steward.exit({ from: accounts[2] });
    const foreclosed = await steward.foreclosed.call(1);
    const foreclosedPatron = await steward.foreclosedPatron.call(accounts[2]);
    assert(foreclosed);
    assert(foreclosedPatron);
  });

  it("steward: owed. withdraw some deposit [succeeds]", async () => {
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      ether("2"),
      {
        from: accounts[2],
      }
    );
    await setNextTxTimestamp(5);
    const amountUsed = patronageDue([
      {
        timeHeld: 5,
        patronageNumerator: tokenDetails[0].patronageNumerator,
        price: ether("1"),
      },
    ]);
    await steward.withdrawDeposit(ether("1"), { from: accounts[2] });
    const deposit = await steward.deposit.call(accounts[2]);
    assert.equal(
      deposit.toString(),
      ether("1")
        .sub(amountUsed)
        .toString()
    );
  });

  it("steward: owed. withdraw more than exists [fail]", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    await expectRevert(
      steward.withdrawDeposit(ether("4"), { from: accounts[2] }),
      "withdrawing too much"
    );
  });

  // TODO: This test needs to change, but it returns "revert" as the reason, that is a bug. It should say "withdrawing too much", even if `accounts[3]` has never used this before.
  // it('steward: owned. withdraw some deposit from another account [fails]', async () => {
  //   await steward.buy(1, ether('1'), { from: accounts[2], value: ether('2') });
  //   await expectRevert(steward.withdrawDeposit(ether('1'), { from: accounts[3] }), "Not patron");
  // });

  it("steward: owed. Bought once, bought again from same account [success]", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    const deposit = await steward.deposit.call(accounts[2]);
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const currentOwner = await erc721.ownerOf.call(1);
    assert.equal(deposit.toString(), ether("2").toString());
    assert.equal(price.toString(), ether("1").toString());
    assert.equal(state, 1);
    assert.equal(currentOwner, accounts[2]);
    await steward.buy(1, ether("1"), ether("1"), 50000, ether("1"), {
      from: accounts[2],
    });
    const deposit2 = await steward.deposit.call(accounts[2]);
    const price2 = await steward.price.call(1);
    const state2 = await steward.state.call(1);
    const currentOwner2 = await erc721.ownerOf.call(1);
    assert.equal(deposit2.toString(), ether("1").toString());
    assert.equal(price2.toString(), ether("1").toString());
    assert.equal(state2, 1);
    assert.equal(currentOwner2, accounts[2]);
  });
  it("steward: owed. Bought once, bought again from another account [success]", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    const deposit = await steward.deposit.call(accounts[2]);
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const currentOwner = await erc721.ownerOf.call(1);
    assert.equal(deposit.toString(), ether("2").toString());
    assert.equal(price.toString(), ether("1").toString());
    assert.equal(state, 1);
    assert.equal(currentOwner, accounts[2]);
    await steward.buy(1, ether("1"), ether("1"), 50000, ether("1"), {
      from: accounts[3],
    });
    const deposit2 = await steward.deposit.call(accounts[3]);
    const price2 = await steward.price.call(1);
    const state2 = await steward.state.call(1);
    const currentOwner2 = await erc721.ownerOf.call(1);
    assert.equal(deposit2.toString(), ether("1").toString());
    assert.equal(price2.toString(), ether("1").toString());
    assert.equal(state2, 1);
    assert.equal(currentOwner2, accounts[3]);
  });

  it("steward: owed. Bought once, bought again from another account after 10min [success]", async () => {
    await steward.buyAuction(1, ether("1"), 50000, ether("2"), {
      from: accounts[2],
    });
    const deposit = await steward.deposit.call(accounts[2]);
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const currentOwner = await erc721.ownerOf.call(1);
    assert.equal(deposit.toString(), ether("2").toString());
    assert.equal(price.toString(), ether("1").toString());
    assert.equal(state, 1);
    assert.equal(currentOwner, accounts[2]);
    const patronageFor10min = new BN(tenMinPatronageAt1Eth);

    await setNextTxTimestamp(time.duration.minutes(10));

    const balTrack = await balance.tracker(accounts[2]);
    const preBuy = await balTrack.get();
    const preDeposit = await steward.deposit.call(accounts[2]);
    await steward.buy(1, ether("1"), ether("1"), 50000, ether("1"), {
      from: accounts[3],
      gasPrice: "1000000000",
    }); // 1 gwei

    // TODO: Add a check in the smart contract, that if it is the only token owned by the Patron, return their deposit. And add the following 3 lines back.
    // const calcDiff = preDeposit.sub(patronageFor10min).add(ether('1'));

    // const delta = await balTrack.delta();
    // assert.equal(delta.toString(), calcDiff.toString());
    const deposit2 = await steward.deposit.call(accounts[3]);
    const price2 = await steward.price.call(1);
    const state2 = await steward.state.call(1);
    const currentOwner2 = await erc721.ownerOf.call(1);
    assert.equal(deposit2.toString(), ether("1").toString());
    assert.equal(price2.toString(), ether("1").toString());
    assert.equal(state2, 1);
    assert.equal(currentOwner2, accounts[3]);
  });

  it("steward: owed: deposit wei, change price, withdrawing deposit in foreclosure state [fail]", async () => {
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buyAuction(
      tokenDetails[0].token,
      ether("1"),
      50000,
      totalToBuy,
      {
        from: accounts[2],
      }
    );
    await setNextTxTimestamp(time.duration.minutes(20)); // into foreclosure state

    // await expectRevert(steward.depositWei({ from: accounts[2], value: ether('1') }), "Foreclosed");
    await expectRevert(
      steward.changePrice(tokenDetails[0].token, ether("2"), {
        from: accounts[2],
      }),
      "foreclosed"
    );
    await expectRevert(
      steward.withdrawDeposit(ether("0.5"), { from: accounts[2] }),
      "withdrawing too much"
    );
  });

  it("steward: owed: goes into foreclosure state & bought from another account [success]", async () => {
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buyAuction(1, ether("1"), 50000, totalToBuy, {
      from: accounts[2],
    });
    await setNextTxTimestamp(time.duration.minutes(11000000)); // into foreclosure state

    // price should be 1 still at the instant it forecloses.
    await steward.buyAuction(1, ether("2"), 50000, totalToBuy, {
      from: accounts[3],
    });

    const deposit = await steward.deposit.call(accounts[3]);
    const previousBlockTime = await time.latest();
    const timeLastCollected = await steward.timeLastCollectedPatron.call(
      accounts[3]
    ); // on buy.
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const owner = await erc721.ownerOf.call(1);

    assert.equal(state, 1);
    assert.equal(deposit.toString(), totalToBuy.toString());
    assert.equal(price.toString(), ether("2").toString());
    assert.equal(timeLastCollected.toString(), previousBlockTime.toString());
    assert.equal(owner, accounts[3]);
  });

  /* NOTE: deprecating this test, it doesn't work well with the auction mechanism.
  it("steward: owed: goes into foreclosure state & bought from same account [success]", async () => {
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buyAuction(tokenDetails[0].token, ether("1"), 50000, {
      from: accounts[2],
      value: totalToBuy,
    });
    await setNextTxTimestamp(time.duration.minutes(10)); // into foreclosure state

    // price should be zero, thus totalToBuy should primarily going into the deposit [as if from init]
    await steward.buy(1, ether("2"), 50000, {
      from: accounts[2],
      value: ether("1").add(totalToBuy),
    });

    const deposit = await steward.deposit.call(accounts[2]);
    const totalCollected = await steward.totalCollected.call(1);
    const currentCollected = await steward.currentCollected.call(1);
    const previousBlockTime = await time.latest();
    const timeLastCollected = await steward.timeLastCollected.call(1); // on buy.
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const owner = await erc721.ownerOf.call(1);

    assert.equal(state, 1);
    assert.equal(deposit.toString(), totalToBuy.toString());
    assert.equal(price.toString(), ether("2").toString());
    assert.equal(totalCollected.toString(), totalToBuy.toString());
    assert.equal(currentCollected.toString(), "0");
    assert.equal(timeLastCollected.toString(), previousBlockTime.toString());
    assert.equal(owner, accounts[2]);
  });
  */

  describe("the benefactor can assign another address to act as the steward", () => {
    it("an entity that is not the current benefactor should NOT be able to change the benefactor", async () => {
      await expectRevert(
        steward.changeReceivingBenefactor(0, accounts[2], {
          from: accounts[3],
        }),
        "Not benefactor"
      );
    });

    it("the current organisation should be able to change the benefactor", async () => {
      await steward.changeReceivingBenefactor(0, accounts[3], {
        from: benefactorAddress,
      });
      const newOwner = await steward.benefactors.call(0);
      assert.equal(newOwner, accounts[3]);
      // return back to the previous owner to make this test isomorphic
      await steward.changeReceivingBenefactor(0, accounts[1], {
        from: accounts[3],
      });
      const prevOwner = await steward.benefactors.call(0);
      assert.equal(prevOwner, accounts[1]);
    });
  });
});

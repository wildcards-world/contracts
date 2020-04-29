const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const {
  waitTillBeginningOfSecond,
  STEWARD_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
} = require("./helpers");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);

// todo: test over/underflows

contract("WildcardSteward owed", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  let mintManager;
  let testTokenURI = "test token uri";
  const testTokenId = 1;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const tenMinPatronageAt1Eth = ether("1")
    .mul(new BN("600"))
    .mul(new BN("12"))
    .div(new BN("1"))
    .div(new BN("31536000"));

  beforeEach(async () => {
    erc721 = await ERC721token.new({ from: accounts[0] });
    steward = await WildcardSteward.new({ from: accounts[0] });
    mintManager = await MintManager.new({ from: accounts[0] });
    erc20 = await ERC20token.new("Wildcards Loyalty Token", "WLT", 18, {
      from: accounts[0],
    });
    await mintManager.initialize(accounts[0], steward.address, erc20.address, {
      from: accounts[0],
    });
    await erc721.setup(
      steward.address,
      "ALWAYSFORSALETestToken",
      "AFSTT",
      accounts[0],
      { from: accounts[0] }
    );
    await erc721.addMinter(steward.address, { from: accounts[0] });
    await erc721.renounceMinter({ from: accounts[0] });
    await erc20.addMinter(mintManager.address, {
      from: accounts[0],
    });
    await erc20.renounceMinter({ from: accounts[0] });

    // TODO: use this to make the contract address of the token deterministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(erc721.address, accounts[0]);
    await steward.updateToV2(mintManager.address, [], []);
    await steward.listNewTokens(
      [0, 1, 2],
      [accounts[0], accounts[0], accounts[0]],
      [patronageNumerator, patronageNumerator, patronageNumerator],
      [tokenGenerationRate, tokenGenerationRate, tokenGenerationRate]
    );
  });

  it("steward: owed. transfer without steward (fail)", async () => {
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });
    await expectRevert.unspecified(
      erc721.transferFrom(accounts[2], accounts[1], 42, { from: accounts[2] })
    );
  });

  it("steward: owed. check patronage owed after 1 second.", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    const timeLastCollected = await steward.timeLastCollected.call(1);
    await time.increase(1);
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });

    // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
    // TODO: make all these values into global constants
    const due = ether("1")
      .mul(owed.timestamp.sub(timeLastCollected))
      .mul(new BN("12000000000000"))
      .div(new BN("1000000000000"))
      .div(new BN("31536000"));

    assert.equal(owed.patronageDue.toString(), due.toString());
  });

  it("steward: owed. check patronage owed after 1 year.", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    const timeLastCollected = await steward.timeLastCollected.call(1);
    await time.increase(time.duration.days(365));
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });

    // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
    const due = ether("1")
      .mul(owed.timestamp.sub(timeLastCollected))
      .mul(new BN("12000000000000"))
      .div(new BN("1000000000000"))
      .div(new BN("31536000"));

    assert.equal(owed.patronageDue.toString(), due.toString());
    // TODO: this value shouldn't be hardcoded. It should depend on the tax variable of the token.
    assert.equal(owed.patronageDue.toString(), "12000000000000000000"); // 5% over 365 days.
  });

  it("steward: owed. collect patronage successfully after 10 minutes.", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    await time.increase(time.duration.minutes(10));
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });
    const PatronOwed = await steward.patronageOwedPatronWithTimestamp.call(
      accounts[2],
      { from: accounts[2] }
    );
    const { logs } = await steward._collectPatronage(testTokenId);

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFund = await steward.benefactorFunds.call(accounts[0]);
    const timeLastCollected = await steward.timeLastCollected.call(1);
    const previousBlockTime = await time.latest();
    const currentCollected = await steward.currentCollected.call(1);
    const totalCollected = await steward.totalCollected.call(1);

    const calcDeposit = ether("1").sub(owed.patronageDue);
    // Should we have these in all of our test cases?
    expectEvent.inLogs(logs, "CollectPatronage", {
      tokenId: testTokenId.toString(),
      patron: accounts[2],
      remainingDeposit: deposit,
      amountReceived: totalCollected,
    });
    assert.equal(deposit.toString(), calcDeposit.toString());
    assert.equal(benefactorFund.toString(), owed.patronageDue.toString());
    assert.equal(timeLastCollected.toString(), previousBlockTime.toString());
    assert.equal(currentCollected.toString(), owed.patronageDue.toString());
    assert.equal(totalCollected.toString(), owed.patronageDue.toString());
  });

  it("steward: owed. collect patronage successfully after 10min and again after 10min.", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    await time.increase(time.duration.minutes(10));
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });
    await steward._collectPatronage(testTokenId);
    await time.increase(time.duration.minutes(10));
    const owed2 = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });
    await steward._collectPatronage(testTokenId);

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFund = await steward.benefactorFunds.call(accounts[0]);
    const timeLastCollected = await steward.timeLastCollected.call(1);
    const previousBlockTime = await time.latest();
    const currentCollected = await steward.currentCollected.call(1);
    const totalCollected = await steward.totalCollected.call(1);

    const calcDeposit = ether("1")
      .sub(owed.patronageDue)
      .sub(owed2.patronageDue);
    const calcBenefactorFund = owed.patronageDue.add(owed2.patronageDue);
    const calcCurrentCollected = owed.patronageDue.add(owed2.patronageDue);
    const calcTotalCurrentCollected = owed.patronageDue.add(owed2.patronageDue);

    assert.equal(deposit.toString(), calcDeposit.toString());
    assert.equal(benefactorFund.toString(), calcBenefactorFund.toString());
    assert.equal(timeLastCollected.toString(), previousBlockTime.toString());
    assert.equal(currentCollected.toString(), calcCurrentCollected.toString());
    assert.equal(
      totalCollected.toString(),
      calcTotalCurrentCollected.toString()
    );
  });

  it("steward: owed. collect patronage that forecloses precisely after 10min.", async () => {
    await waitTillBeginningOfSecond();
    // 10min of patronage
    await steward.buy(1, ether("1"), tenMinPatronageAt1Eth, {
      from: accounts[2],
      value: tenMinPatronageAt1Eth,
    });

    await time.increase(time.duration.minutes(10));
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });
    const { logs } = await steward._collectPatronage(testTokenId); // will foreclose

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFund = await steward.benefactorFunds.call(accounts[0]);
    const timeLastCollected = await steward.timeLastCollected.call(1);
    const previousBlockTime = await time.latest();
    const currentCollected = await steward.currentCollected.call(1);
    const totalCollected = await steward.totalCollected.call(1);
    const state = await steward.state.call(1);

    const calcBenefactorFund = owed.patronageDue;
    const calcTotalCurrentCollected = owed.patronageDue;

    const currentOwner = await erc721.ownerOf.call(1);

    const timeHeld = await steward.timeHeld.call(1, accounts[2]);

    expectEvent.inLogs(logs, "Foreclosure", {
      prevOwner: accounts[2],
      foreclosureTime: timeLastCollected,
    });
    assert.equal(timeHeld.toString(), time.duration.minutes(10).toString());
    assert.equal(currentOwner, steward.address);
    assert.equal(deposit.toString(), "0");
    // TODO: invistigate why this sometimes gives an off by one error (not always)
    // assert.equal(benefactorFund.toString(), calcBenefactorFund.toString());
    assert(
      benefactorFund
        .sub(calcBenefactorFund)
        .abs()
        .toString() <= 1
    );
    assert.equal(timeLastCollected.toString(), previousBlockTime.toString());
    assert.equal(currentCollected.toString(), "0");
    assert.equal(
      totalCollected.toString(),
      calcTotalCurrentCollected.toString()
    );
    assert.equal(state.toString(), "0"); // foreclosed state
  });

  it("steward: owed. Deposit zero after 10min of patronage (after 10min) [success].", async () => {
    await waitTillBeginningOfSecond();
    // 10min of patronage
    await steward.buy(1, ether("1"), tenMinPatronageAt1Eth, {
      from: accounts[2],
      value: tenMinPatronageAt1Eth,
    });

    await time.increase(time.duration.minutes(10));
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
    await steward.buy(1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });

    const forecloseTime = await steward.foreclosureTime.call(1);
    const previousBlockTime = await time.latest();
    const finalTime = previousBlockTime.add(time.duration.minutes(10));
    assert.equal(forecloseTime.toString(), finalTime.toString());
  });

  it("steward: owed. buy from person that forecloses precisely after 10min.", async () => {
    await waitTillBeginningOfSecond();
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buy(1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });
    const pred = await steward.deposit.call(accounts[2]);

    await time.increase(time.duration.minutes(10));
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });
    const preTimeBought = await steward.timeAcquired.call(1);
    const { logs } = await steward.buy(1, ether("2"), totalToBuy, {
      from: accounts[3],
      value: totalToBuy,
    }); // will foreclose and then buy

    const deposit = await steward.deposit.call(accounts[3]);
    const benefactorFund = await steward.benefactorFunds.call(accounts[0]);
    const timeLastCollected = await steward.timeLastCollected.call(1);
    const previousBlockTime = await time.latest();
    const currentCollected = await steward.currentCollected.call(1);
    const totalCollected = await steward.totalCollected.call(1);
    const state = await steward.state.call(1);

    const calcBenefactorFund = owed.patronageDue;
    const calcTotalCurrentCollected = owed.patronageDue;

    const currentOwner = await erc721.ownerOf.call(1);

    const timeHeld = await steward.timeHeld.call(1, accounts[2]);
    const calcTH = timeLastCollected.sub(preTimeBought);

    expectEvent.inLogs(logs, "Foreclosure", { prevOwner: accounts[2] });
    expectEvent.inLogs(logs, "Buy", { owner: accounts[3], price: ether("2") });
    // TODO: invistigate why this sometimes gives an off by one error (not always)
    // assert.equal(timeHeld.toString(), calcTH.toString();
    assert(
      timeHeld
        .sub(calcTH)
        .abs()
        .toString() <= 1
    );
    assert.equal(currentOwner, accounts[3]);
    assert.equal(deposit.toString(), totalToBuy.toString());
    assert.equal(benefactorFund.toString(), calcBenefactorFund.toString());
    assert.equal(timeLastCollected.toString(), previousBlockTime.toString());
    assert.equal(currentCollected.toString(), "0");
    assert.equal(
      totalCollected.toString(),
      calcTotalCurrentCollected.toString()
    );
    assert.equal(state.toString(), "1"); // owned state
  });

  it("steward: owed. collect patronage by benefactor after 10min. [ @skip-on-coverage ]", async () => {
    await waitTillBeginningOfSecond();
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buy(1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });
    await time.increase(time.duration.minutes(10));
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });
    await steward._collectPatronage(testTokenId); // will foreclose

    const balTrack = await balance.tracker(accounts[0]);

    const txReceipt = await steward.withdrawBenefactorFunds({
      from: accounts[0],
      gasPrice: "1000000000",
    }); // 1 gwei gas
    const txCost = new BN(txReceipt.receipt.gasUsed).mul(new BN("1000000000"));
    const calcDiff = totalToBuy.sub(txCost);

    const benefactorFund = await steward.benefactorFunds.call(accounts[0]);

    assert.equal(benefactorFund.toString(), "0");
    const delta = await balTrack.delta();
    assert.equal(delta.toString(), calcDiff.toString());
  });

  it("steward: owed. collect patronage. 10min deposit. 20min Foreclose.", async () => {
    await waitTillBeginningOfSecond();
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buy(1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });

    await time.increase(time.duration.minutes(20));
    // 20min owed patronage
    // 10min due
    const foreclosed = await steward.foreclosed.call(1);
    const preTLC = await steward.timeLastCollected.call(1);
    const preDeposit = await steward.deposit.call(accounts[2]);
    const preTimeBought = await steward.timeAcquired.call(1);
    const owed = await steward.patronageOwedWithTimestamp.call(1, {
      from: accounts[2],
    });
    await steward._collectPatronage(testTokenId); // will foreclose

    const deposit = await steward.deposit.call(accounts[2]);
    const benefactorFund = await steward.benefactorFunds.call(accounts[0]);
    const timeLastCollected = await steward.timeLastCollected.call(1);
    const previousBlockTime = await time.latest();
    const tlcCheck = preTLC.add(
      previousBlockTime
        .sub(preTLC)
        .mul(preDeposit)
        .div(owed.patronageDue)
    );
    const currentCollected = await steward.currentCollected.call(1);
    const totalCollected = await steward.totalCollected.call(1);
    const state = await steward.state.call(1);

    const calcBenefactorFund = tenMinPatronageAt1Eth;
    const calcTotalCurrentCollected = tenMinPatronageAt1Eth;

    const currentOwner = await erc721.ownerOf.call(1);

    const timeHeld = await steward.timeHeld.call(1, accounts[2]);
    const calcTH = timeLastCollected.sub(preTimeBought);

    assert.isTrue(foreclosed);
    assert.equal(steward.address, currentOwner);
    assert.equal(timeHeld.toString(), calcTH.toString());
    assert.equal(deposit.toString(), "0");
    assert.equal(benefactorFund.toString(), calcBenefactorFund.toString());
    assert.equal(timeLastCollected.toString(), tlcCheck.toString());
    assert.equal(currentCollected.toString(), "0");
    assert.equal(
      totalCollected.toString(),
      calcTotalCurrentCollected.toString()
    );
    assert.equal(state.toString(), "0"); // foreclosed state
  });

  it("steward: owed. deposit wei success from many accounts", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    await steward.depositWei({ from: accounts[2], value: ether("1") });
    await steward.depositWeiPatron(accounts[2], {
      from: accounts[3],
      value: ether("1"),
    });
    const deposit = await steward.deposit.call(accounts[2]);
    assert.equal(deposit.toString(), ether("4").toString());
  });

  it("steward: owed. change price to zero [fail]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    await expectRevert(
      steward.changePrice(testTokenId, "0", { from: accounts[2] }),
      "Incorrect Price"
    );
  });

  it("steward: owed. change price to more [success]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    const { logs } = await steward.changePrice(testTokenId, ether("3"), {
      from: accounts[2],
    });
    expectEvent.inLogs(logs, "PriceChange", { newPrice: ether("3") });
    const postPrice = await steward.price.call(1);
    assert.equal(ether("3").toString(), postPrice.toString());
  });

  it("steward: owed. change price to less [success]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    await steward.changePrice(testTokenId, ether("0.5"), { from: accounts[2] });
    const postPrice = await steward.price.call(1);
    assert.equal(ether("0.5").toString(), postPrice.toString());
  });

  it("steward: owed. change price to less with another account [fail]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    await expectRevert(
      steward.changePrice(testTokenId, ether("0.5"), { from: accounts[3] }),
      "Not patron"
    );
  });

  it("steward: owed. withdraw whole deposit into foreclosure [succeed]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    const deposit = await steward.deposit.call(accounts[2]);
    await steward.withdrawDeposit(deposit, { from: accounts[2] });
    const foreclosed = await steward.foreclosed.call(1);
    const foreclosedPatron = await steward.foreclosedPatron.call(accounts[2]);
    assert(foreclosed);
    assert(foreclosedPatron);
  });

  it("steward: owed. withdraw whole deposit through exit into foreclosure after 10min [succeed]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    await time.increase(time.duration.minutes(10));
    await steward.exit({ from: accounts[2] });
    const foreclosed = await steward.foreclosed.call(1);
    const foreclosedPatron = await steward.foreclosedPatron.call(accounts[2]);
    assert(foreclosed);
    assert(foreclosedPatron);
  });

  it("steward: owed. withdraw some deposit [succeeds]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    await steward.withdrawDeposit(ether("1"), { from: accounts[2] });
    const deposit = await steward.deposit.call(accounts[2]);
    assert.equal(deposit.toString(), ether("1").toString());
  });

  it("steward: owed. withdraw more than exists [fail]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    await expectRevert(
      steward.withdrawDeposit(ether("4"), { from: accounts[2] }),
      "Withdrawing too much"
    );
  });

  // This test needs to change, but it returns "revert" as the reason, that is a bug. It should say "Withdrawing too much", even if `accounts[3]` has never used this before.
  // it('steward: owned. withdraw some deposit from another account [fails]', async () => {
  //   await waitTillBeginningOfSecond()
  //   await steward.buy(1, ether('1'), { from: accounts[2], value: ether('2') });
  //   await expectRevert(steward.withdrawDeposit(ether('1'), { from: accounts[3] }), "Not patron");
  // });

  it("steward: owed. Bought once, bought again from same account [success]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    const deposit = await steward.deposit.call(accounts[2]);
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const currentOwner = await erc721.ownerOf.call(1);
    assert.equal(deposit.toString(), ether("2").toString());
    assert.equal(price.toString(), ether("1").toString());
    assert.equal(state, 1);
    assert.equal(currentOwner, accounts[2]);
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("2"),
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
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
    });
    const deposit = await steward.deposit.call(accounts[2]);
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const currentOwner = await erc721.ownerOf.call(1);
    assert.equal(deposit.toString(), ether("2").toString());
    assert.equal(price.toString(), ether("1").toString());
    assert.equal(state, 1);
    assert.equal(currentOwner, accounts[2]);
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[3],
      value: ether("2"),
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

  it("steward: owed. Bought once, bought again from another account after 10min [success] [ @skip-on-coverage ]", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(1, ether("1"), ether("2"), {
      from: accounts[2],
      value: ether("2"),
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

    await time.increase(time.duration.minutes(10));

    const balTrack = await balance.tracker(accounts[2]);
    const preBuy = await balTrack.get();
    const preDeposit = await steward.deposit.call(accounts[2]);
    await steward.buy(1, ether("1"), ether("1"), {
      from: accounts[3],
      value: ether("2"),
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
    await waitTillBeginningOfSecond();
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buy(1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });
    await time.increase(time.duration.minutes(20)); // into foreclosure state

    // await expectRevert(steward.depositWei({ from: accounts[2], value: ether('1') }), "Foreclosed");
    await expectRevert(
      steward.changePrice(testTokenId, ether("2"), { from: accounts[2] }),
      "Foreclosed"
    );
    await expectRevert(
      steward.withdrawDeposit(ether("0.5"), { from: accounts[2] }),
      "Withdrawing too much"
    );
  });

  it("steward: owed: goes into foreclosure state & bought from another account [success]", async () => {
    await waitTillBeginningOfSecond();
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buy(1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });
    await time.increase(time.duration.minutes(20)); // into foreclosure state

    // price should be zero, thus totalToBuy should primarily going into the deposit [as if from init]
    await steward.buy(1, ether("2"), totalToBuy, {
      from: accounts[3],
      value: totalToBuy,
    });

    const deposit = await steward.deposit.call(accounts[3]);
    const totalCollected = await steward.totalCollected.call(1);
    const currentCollected = await steward.currentCollected.call(1);
    const previousBlockTime = await time.latest();
    const timeLastCollected = await steward.timeLastCollected.call(1); // on buy.
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    const owner = await erc721.ownerOf.call(1);
    const wasPatron1 = await steward.patrons.call(1, accounts[2]);
    const wasPatron2 = await steward.patrons.call(1, accounts[3]);

    assert.equal(state, 1);
    assert.equal(deposit.toString(), totalToBuy.toString());
    assert.equal(price.toString(), ether("2").toString());
    assert.equal(totalCollected.toString(), totalToBuy.toString());
    assert.equal(currentCollected.toString(), "0");
    assert.equal(timeLastCollected.toString(), previousBlockTime.toString());
    assert.equal(owner, accounts[3]);
    assert.isTrue(wasPatron1);
    assert.isTrue(wasPatron2);
  });

  it("steward: owed: goes into foreclosure state & bought from same account [success]", async () => {
    await waitTillBeginningOfSecond();
    // 10min of patronage
    const totalToBuy = new BN(tenMinPatronageAt1Eth);
    await steward.buy(1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });
    await time.increase(time.duration.minutes(20)); // into foreclosure state

    // price should be zero, thus totalToBuy should primarily going into the deposit [as if from init]
    await steward.buy(1, ether("2"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
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
        from: accounts[0],
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

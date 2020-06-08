const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
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
const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward owed", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  const testToken1 = { id: 1, patronageNumerator: 12 };
  const testToken2 = { id: 2, patronageNumerator: 24 };
  const tokenGenerationRate = 10; // should depend on token
  const artistAddress = accounts[7];
  const artistCommission = 0;

  beforeEach(async () => {
    erc721 = await ERC721token.new({ from: accounts[0] });
    steward = await WildcardSteward.new({ from: accounts[0] });
    mintManager = await MintManager.new({ from: accounts[0] });
    erc20 = await ERC20token.new("Wildcards Loyalty Token", "WLT", 18);

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

    await erc20.addMinter(mintManager.address);
    await erc20.renounceMinter({ from: accounts[0] });

    // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(
      erc721.address,
      accounts[0],
      mintManager.address,
      0 /*Set to zero for testing purposes*/
    );
    await steward.listNewTokens(
      [testToken1.id, testToken2.id],
      [accounts[8], accounts[9]],
      [testToken1.patronageNumerator, testToken2.patronageNumerator],
      [tokenGenerationRate, tokenGenerationRate],
      [artistAddress, artistAddress],
      [artistCommission, artistCommission],
      [0, 0]
    );
    await steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
      from: accounts[0],
    });
  });

  it("steward: multi-patronage. On token buy, check that the remaining deposit is sent back to patron only if it is their only token", async () => {
    ///////////////////  TIME = 0 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await waitTillBeginningOfSecond();
    testTokenId1 = testToken1.id;
    testTokenId2 = testToken2.id;

    //Buying 1st token and setting selling price to 1 eth. With 1 eth deposit.
    const buyTx1 = await steward.buyAuction(testTokenId1, ether("1"), 500, {
      from: accounts[2],
      value: ether("1"),
    });
    const buyTx1BlockTime = (
      await web3.eth.getBlock(buyTx1.receipt.blockNumber)
    ).timestamp;
    const lastCollectedPatronT0 = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );
    const priceOfToken1 = await steward.price.call(testTokenId1);
    const patronDepositInitial = await steward.deposit.call(accounts[2]);

    assert.equal(buyTx1BlockTime.toString(), lastCollectedPatronT0.toString());

    /////////////////// TIME = 10 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));
    const collectPatronageT10_tx = await steward._collectPatronage(
      testTokenId1
    );
    const benefactorFundsT10 = await steward.unclaimedPayoutDueForOrganisation.call(
      accounts[8]
    );
    const collectPatronageT10BlockTime = (
      await web3.eth.getBlock(collectPatronageT10_tx.receipt.blockNumber)
    ).timestamp;
    const lastCollectedPatronT10 = await steward.timeLastCollectedPatron.call(
      accounts[2]
    );

    // Check patronage after 10mins is correct
    const patronDepositAfter10min = await steward.deposit.call(accounts[2]);
    const expectedPatronageAfter10min = patronageCalculator("601", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
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
    await time.increase(time.duration.minutes(10));
    // await waitTillBeginningOfSecond();

    // Buy a 2nd token
    const buyToken2Tx = await steward.buyAuction(
      testTokenId2,
      ether("2"),
      500,

      { from: accounts[2], value: ether("1") }
    );
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
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);

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

    /////////////////// TIME = 30 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));
    // This adds an extra second to the test, but is needed since this test is long off by one second errors should be avoided.
    await waitTillBeginningOfSecond();

    await steward._collectPatronage(testTokenId1);

    const patronDepositAfter30min = await steward.deposit.call(accounts[2]);
    const patronDepositCalculatedAfter30min = await steward.depositAbleToWithdraw.call(
      accounts[2]
    );
    const expectedPatronageMulti = patronageCalculator("600", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
      {
        patronageNumerator: testToken2.patronageNumerator.toString(),
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

    const benefactorFundsT30 = await steward.unclaimedPayoutDueForOrganisation.call(
      accounts[8]
    );

    const expectedTotalPatronageT30Token1 = patronageCalculator("1801", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
    assert.equal(
      benefactorFundsT30.toString(),
      expectedTotalPatronageT30Token1.toString()
    );

    /////////////////// TIME = 40 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));

    const benefactor2FundsT40Unclaimed = await steward.unclaimedPayoutDueForOrganisation.call(
      accounts[9]
    );
    const benefactor2FundsT40AlreadyClaimed = await steward.benefactorFunds.call(
      accounts[9]
    );

    // TODO: this might be a BUG!! Why is this value 2402 not 1201??
    const expectedTotalPatronageT40Token2 = patronageCalculator("1201", [
      {
        patronageNumerator: testToken2.patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);

    assert.equal(
      expectedTotalPatronageT40Token2.toString(),
      benefactor2FundsT40Unclaimed
        .add(benefactor2FundsT40AlreadyClaimed)
        .toString()
    );
  });
});

const { BN, expectRevert, ether, expectEvent, balance, time } = require('openzeppelin-test-helpers');

const Artwork = artifacts.require('./ERC721Patronage_v0.sol');
const WildcardSteward = artifacts.require('./WildcardSteward_v0.sol');

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

// NOTE:: This was inspired by this question and the off by one second errors I was getting:
// https://ethereum.stackexchange.com/a/74558/4642
const waitTillBeginningOfSecond = () => new Promise(resolve => {
  const timeTilNextSecond = 1000 - new Date().getMilliseconds()
  setTimeout(resolve, timeTilNextSecond)
})

// todo: test over/underflows
const NUM_SECONDS_IN_YEAR = '31536000'
const PATRONAGE_DENOMINATOR = '1'

//patronage per token = price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
const multiPatronageCalculator = (timeInSeconds, tokenArray) => {
  const totalPatronage = tokenArray.reduce(
    (totalPatronage, token) =>
      totalPatronage.add(
        (new BN(token.price))
          .mul(new BN(timeInSeconds))
          .mul(new BN(token.patronageNumerator))
          .div(new BN(PATRONAGE_DENOMINATOR))
          .div(new BN(NUM_SECONDS_IN_YEAR))
      )
    , new BN('0'));
  return totalPatronage
}

contract('WildcardSteward owed', (accounts) => {

  let artwork;
  let steward;
  const testToken1 = { id: 1, patronageNumerator: 12 }
  const testToken2 = { id: 2, patronageNumerator: 24 }
  const patronageDenominator = 1;
  let testTokenURI = 'test token uri'


  beforeEach(async () => {
    artwork = await Artwork.new({ from: accounts[0] });
    steward = await WildcardSteward.new({ from: accounts[0] });
    await artwork.setup(steward.address, "ALWAYSFORSALETestToken", "AFSTT", accounts[0], { from: accounts[0] })
    //await artwork.mintWithTokenURI(steward.address, testToken0.id, testTokenURI, { from: accounts[0] })
    await artwork.mintWithTokenURI(steward.address, testToken1.id, testTokenURI, { from: accounts[0] })
    await artwork.mintWithTokenURI(steward.address, testToken2.id, testTokenURI, { from: accounts[0] })
    // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(artwork.address, accounts[0], patronageDenominator)
    await steward.listNewTokens([testToken1.id, testToken2.id], [accounts[8], accounts[9]], [testToken1.patronageNumerator, testToken2.patronageNumerator])
  })

  it('steward: deposit-management. On token buy, check that the remaining deposit is sent back to patron only if it is their only token', async () => {

    ///////////////////  TIME = 0 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await waitTillBeginningOfSecond()
    testTokenId1 = testToken1.id
    testTokenId2 = testToken2.id

    //Buying 1st token and setting selling price to 1 eth. With 1 eth deposit.
    const buyTx1 = await steward.buy(testTokenId1, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    const buyTx1BlockTime = (await web3.eth.getBlock(buyTx1.receipt.blockNumber)).timestamp
    const lastCollectedPatronT0 = await steward.timeLastCollectedPatron.call(accounts[2])
    const priceOfToken1 = await steward.price.call(testTokenId1)
    const patronDepositInitial = await steward.deposit.call(accounts[2]);

    assert.equal(buyTx1BlockTime.toString(), lastCollectedPatronT0.toString())

    /////////////////// TIME = 10 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));
    const collectPatronageT10_tx = await steward._collectPatronage(testTokenId1);
    const benefactorFundsT10 = await steward.benefactorFunds.call(accounts[8])
    const collectPatronageT10BlockTime = (await web3.eth.getBlock(collectPatronageT10_tx.receipt.blockNumber)).timestamp
    const lastCollectedPatronT10 = await steward.timeLastCollectedPatron.call(accounts[2])

    // Check patronage after 10mins is correct
    const patronDepositAfter10min = await steward.deposit.call(accounts[2]);
    const expectedPatronageAfter10min = multiPatronageCalculator('600',
      [{ patronageNumerator: testToken1.patronageNumerator.toString(), price: priceOfToken1.toString() }])
    assert.equal(patronDepositInitial.toString(), patronDepositAfter10min.add(expectedPatronageAfter10min).toString());
    assert.equal(collectPatronageT10BlockTime.toString(), lastCollectedPatronT10.toString())
    assert.equal(expectedPatronageAfter10min.toString(), benefactorFundsT10.toString())

    /////////////////// TIME = 20 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));
    // await waitTillBeginningOfSecond()

    // Buy a 2nd token
    const buyToken2Tx = await steward.buy(testTokenId2, web3.utils.toWei('2', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    const buyToken2BlockTime = (await web3.eth.getBlock(buyToken2Tx.receipt.blockNumber)).timestamp
    const lastCollectedPatronT20 = await steward.timeLastCollectedPatron.call(accounts[2])
    const priceOfToken2 = await steward.price.call(testTokenId2)
    assert.equal(buyToken2BlockTime.toString(), lastCollectedPatronT20.toString())

    const patronDepositAfter20min = await steward.deposit.call(accounts[2]);
    const patronDepositCalculatedAfter20min = await steward.depositAbleToWithdraw.call(accounts[2]);
    const expectedPatronage10MinToken1 = multiPatronageCalculator('600',
      [{ patronageNumerator: testToken1.patronageNumerator.toString(), price: priceOfToken1.toString() }])

    assert.equal(patronDepositAfter20min.toString(), patronDepositAfter10min.sub(expectedPatronage10MinToken1).add(ether('1')).toString());
    assert.equal(patronDepositCalculatedAfter20min.toString(), patronDepositAfter10min.add(ether('1')).sub(expectedPatronage10MinToken1).toString());

    /////////////////// TIME = 30 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));
    // This adds an extra second to the test, but is needed since this test is long off by one second errors should be avoided.
    await waitTillBeginningOfSecond()

    await steward._collectPatronage(testTokenId1);

    const patronDepositAfter30min = await steward.deposit.call(accounts[2]);
    const patronDepositCalculatedAfter30min = await steward.depositAbleToWithdraw.call(accounts[2]);
    const expectedPatronageMulti = multiPatronageCalculator('601',
      [{ patronageNumerator: testToken1.patronageNumerator.toString(), price: priceOfToken1.toString() },
      { patronageNumerator: testToken2.patronageNumerator.toString(), price: priceOfToken2.toString() }])

    assert.equal(patronDepositAfter20min.toString(), patronDepositAfter30min.add(expectedPatronageMulti).toString());
    assert.equal(patronDepositCalculatedAfter30min.toString(), patronDepositAfter30min.toString());

    const benefactorFundsT30 = await steward.benefactorFunds.call(accounts[8])
    const balTrack = await balance.tracker(accounts[8]);
    await steward.withdrawBenefactorFundsTo(accounts[8])
    const balanceChangePatron1 = await balTrack.delta()

    const expectedTotalPatronageT30Token1 = multiPatronageCalculator('1801',
      [{ patronageNumerator: testToken1.patronageNumerator.toString(), price: priceOfToken1.toString() }])
    assert.equal(benefactorFundsT30.toString(), expectedTotalPatronageT30Token1.toString())
    assert.equal(balanceChangePatron1.toString(), expectedTotalPatronageT30Token1.toString())

    /////////////////// TIME = 40 ////////////////////
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    await time.increase(time.duration.minutes(10));

    await steward._collectPatronage(testTokenId2);

    const benefactor2FundsT40 = await steward.benefactorFunds.call(accounts[9])
    const balTrack2 = await balance.tracker(accounts[9]);
    await steward.withdrawBenefactorFundsTo(accounts[9])
    const balanceChangePatron2 = await balTrack2.delta()

    const expectedTotalPatronageT40Token2 = multiPatronageCalculator('1201',
      [{ patronageNumerator: testToken2.patronageNumerator.toString(), price: priceOfToken2.toString() }])
    assert.equal(benefactor2FundsT40.toString(), expectedTotalPatronageT40Token2.toString())
    assert.equal(balanceChangePatron2.toString(), expectedTotalPatronageT40Token2.toString())

  });
});

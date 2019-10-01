const { BN, expectRevert, ether, expectEvent, balance, time } = require('openzeppelin-test-helpers');

const Artwork = artifacts.require('./ERC721Patronage.sol');
const ArtSteward = artifacts.require('./WildcardSteward.sol');

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

// NOTE:: This was inspired by this question and the off by one second errors I was getting:
//        https://ethereum.stackexchange.com/a/74558/4642
const waitTillBeginningOfSecond = () => new Promise(resolve => {
  const timeTilNextSecond = 1000 - new Date().getMilliseconds()
  setTimeout(resolve, timeTilNextSecond - 1000)
})

// todo: test over/underflows

contract('WildcardSteward owed', (accounts) => {

  let artwork;
  let steward;
  const testTokenId1 = 1
  const testTokenId2 = 2
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const tenMinPatronageAt1Eth = ether('1').mul(new BN('600')).mul(new BN('12')).div(new BN('1')).div(new BN('31536000'));


  beforeEach(async () => {
    artwork = await Artwork.new("TESTARTWORK", "TA");
    steward = await ArtSteward.new(accounts[1], artwork.address, { from: accounts[0] });
  });

  it('steward: owned. check patronage of two tokens owed by the same user after 10 minutes.', async () => {
    await waitTillBeginningOfSecond()
    // buy 2 tokens, with prices of 1 ether and 2 ether.
    await steward.buy(1, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    await steward.buy(2, web3.utils.toWei('2', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });

    await time.increase(time.duration.minutes(10));
    const owed1 = await steward.patronageOwedWithTimestamp.call(1, { from: accounts[2] });
    const owed2 = await steward.patronageOwedWithTimestamp.call(2, { from: accounts[2] });
    const owedUser = await steward.patronageOwedUserWithTimestamp.call(accounts[2], { from: accounts[2] });

    assert.equal(owed1.patronageDue.toString(), tenMinPatronageAt1Eth.toString());
    assert.equal(owed2.patronageDue.toString(), tenMinPatronageAt1Eth.mul(new BN('2')).toString());
    assert.equal(owedUser.patronageDue.toString(), tenMinPatronageAt1Eth.mul(new BN('3')).toString());
    assert(true)
  });

  // buy 2 tokens, with prices of 1 ether and 2 ether.
  it('steward: owned. check patronage of two tokens owed by the same user after 10 minutes one of the tokens gets bought.', async () => {
    await waitTillBeginningOfSecond()
    await steward.buy(1, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    await steward.buy(2, web3.utils.toWei('2', 'ether'), { from: accounts[2], value: web3.utils.toWei('0.1', 'ether') });

    await time.increase(time.duration.minutes(10));
    const owed1 = await steward.patronageOwedWithTimestamp.call(1, { from: accounts[2] });
    const owed2 = await steward.patronageOwedWithTimestamp.call(2, { from: accounts[2] });
    const owedUser = await steward.patronageOwedUserWithTimestamp.call(accounts[2], { from: accounts[2] });
    // await steward.buy(1, web3.utils.toWei('0.1', 'ether'), { from: accounts[3], value: ether('1.1') });
    await steward.buy(1, ether('0.1'), { from: accounts[3], value: ether('1.1') });
    // console.log((new BN('555').div(new BN('10'))).toString(), ether('1').toString(), ether('0.1').toString());
    await time.increase(time.duration.minutes(10));
    const owed1Second = await steward.patronageOwedWithTimestamp.call(1);
    const owed2Second = await steward.patronageOwedWithTimestamp.call(2, { from: accounts[2] });
    const owedUserSecond = await steward.patronageOwedUserWithTimestamp.call(accounts[2]);
    const owedUser2Second = await steward.patronageOwedUserWithTimestamp.call(accounts[3]);

    assert.equal(owed1.patronageDue.toString(), tenMinPatronageAt1Eth.toString());
    assert.equal(owed2.patronageDue.toString(), tenMinPatronageAt1Eth.mul(new BN('2')).toString());
    assert.equal(owedUser.patronageDue.toString(), tenMinPatronageAt1Eth.mul(new BN('3')).toString());
    // collected double since 20 min
    assert.equal(owed2Second.patronageDue.toString(), tenMinPatronageAt1Eth.mul(new BN('4')).toString());
    assert.equal(owed1Second.patronageDue.toString(), tenMinPatronageAt1Eth.div(new BN('10')).toString());
    // Should only count since the last clearance (when token 1 was bought)
    assert.equal(owedUserSecond.patronageDue.toString(), tenMinPatronageAt1Eth.mul(new BN('2')).toString());
    assert.equal(owedUser2Second.patronageDue.toString(), tenMinPatronageAt1Eth.div(new BN('10')).toString());
  });
});

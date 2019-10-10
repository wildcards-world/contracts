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

contract('WildcardSteward owed', (accounts) => {

  let artwork;
  let steward;
  const testTokenId1 = 1
  const testTokenId2 = 2
  const patronageNumerator = 12;
  const patronageDenominator = 1;
  let testTokenURI = 'test token uri'
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const tenMinPatronageAt1Eth = ether('1').mul(new BN('600')).mul(new BN('12')).div(new BN('1')).div(new BN('31536000'));

  beforeEach(async () => {
    artwork = await Artwork.new({ from: accounts[0] });
    steward = await WildcardSteward.new({ from: accounts[0] });
    await artwork.setup(steward.address, "ALWAYSFORSALETestToken", "AFSTT", accounts[0], { from: accounts[0] })
    await artwork.mintWithTokenURI(steward.address, 0, testTokenURI, { from: accounts[0] })
    await artwork.mintWithTokenURI(steward.address, 1, testTokenURI, { from: accounts[0] })
    await artwork.mintWithTokenURI(steward.address, 2, testTokenURI, { from: accounts[0] })
    // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(artwork.address, accounts[0], patronageDenominator)
    await steward.listNewTokens([0, 1, 2], [accounts[0], accounts[0], accounts[0]], [patronageNumerator, patronageNumerator, patronageNumerator])
  })

  it('steward: deposit-management. On token buy, check that the remaining deposit is sent back to patron only if it is their only token', async () => {
    await waitTillBeginningOfSecond()
    // buy 2 tokens, with prices of 1 ether and 2 ether.
    await steward.buy(testTokenId1, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    await steward.buy(testTokenId2, web3.utils.toWei('2', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });

    await time.increase(time.duration.minutes(10));

    const patronDepositBeforeSale = await steward.deposit.call(accounts[2]);
    const balancePatronBeforeSale = new BN(await web3.eth.getBalance(accounts[2]));
    await steward.buy(testTokenId1, ether('1'), { from: accounts[3], value: ether('2') });
    const balancePatronAfterFirstSale = new BN(await web3.eth.getBalance(accounts[2]));
    const patronDepositAfterFirstSale = await steward.deposit.call(accounts[2]);
    await steward.buy(testTokenId2, ether('1'), { from: accounts[3], value: ether('3') });
    const balancePatronAfterSecondSale = new BN(await web3.eth.getBalance(accounts[2]));
    const patronDepositAfterSecondSale = await steward.deposit.call(accounts[2]);

    // NOTE:: These tests are extremely flakey due to timeing difficulties in ganache... (something to look into)
    assert(patronDepositBeforeSale.sub(patronDepositAfterFirstSale).lt(new BN("684931506849316")));
    assert.equal(patronDepositAfterSecondSale.toString(), "0");
    assert.equal(balancePatronBeforeSale.toString(), balancePatronAfterFirstSale.add(ether('1')).toString());
    assert.equal(balancePatronAfterSecondSale.toString(), balancePatronAfterFirstSale.add(ether('2')).add(balancePatronAfterFirstSale).toString());
  });
});

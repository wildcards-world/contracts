const { BN, expectRevert, ether, expectEvent, balance, time } = require('@openzeppelin/test-helpers');

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

    //Buying 2 tokens. Setting selling price to 1 and 2 eth respectively. Sending 1 eth each for deposit. 
    await steward.buy(testTokenId1, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    await steward.buy(testTokenId2, web3.utils.toWei('2', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });

    const priceOftoken1 = await steward.price.call(testTokenId1)
    const priceOftoken2 = await steward.price.call(testTokenId2)

    // TIME INCREASES HERE BY 10 MIN
    await time.increase(time.duration.minutes(10));

    const patronDepositBeforeSale = await steward.deposit.call(accounts[2]);
    const balancePatronBeforeSale = new BN(await web3.eth.getBalance(accounts[2]));

    // When first token is bought, deposit should remain.
    await steward.buy(testTokenId1, ether('1'), { from: accounts[3], value: ether('2') });

    const patronDepositAfterFirstSale = await steward.deposit.call(accounts[2]);
    const balancePatronAfterFirstSale = new BN(await web3.eth.getBalance(accounts[2]));

    //Second token then bought. Deposit should now be added back the patrons balance
    await steward.buy(testTokenId2, ether('1'), { from: accounts[3], value: ether('3') });

    const balancePatronAfterSecondSale = new BN(await web3.eth.getBalance(accounts[2]));
    const patronDepositAfterSecondSale = await steward.deposit.call(accounts[2]);

    const expectedPatronageAfter10min = multiPatronageCalculator('600', [{ patronageNumerator: '12', price: priceOftoken1.toString() }, { patronageNumerator: '12', price: priceOftoken2.toString() }])
    assert.equal(patronDepositBeforeSale.toString(), patronDepositAfterFirstSale.add(expectedPatronageAfter10min).toString());

    //Checking once no more tokens are owned, the deopsit is set to zero
    assert.equal(patronDepositAfterSecondSale.toString(), "0");
    //Checking that the balance after selling 1 token has increased by only the amount recieved. 
    assert.equal(balancePatronBeforeSale.add(ether('1')).toString(), balancePatronAfterFirstSale.toString());
    //Checking owner gets deposit back on sale of final token plus sale price too.
    assert.equal(balancePatronAfterSecondSale.toString(), balancePatronAfterFirstSale.add(ether('2')).add(patronDepositAfterFirstSale).toString());
  });
});

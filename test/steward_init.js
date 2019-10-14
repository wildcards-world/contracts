const { BN, expectRevert, ether, expectEvent, balance, time } = require('@openzeppelin/test-helpers');

const Artwork = artifacts.require('./ERC721Patronage_v0.sol');
const WildcardSteward = artifacts.require('./WildcardSteward_v0.sol');

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

contract('WildcardSteward', (accounts) => {

  let artwork;
  let steward;
  const patronageDenominator = 1;
  const patronageNumerator = 12;
  const testTokenURI = 'test token uri'

  beforeEach(async () => {
    artwork = await Artwork.new({ from: accounts[0] });
    steward = await WildcardSteward.new({ from: accounts[0] });
    await artwork.setup(steward.address, "ALWAYSFORSALETestToken", "AFSTT", accounts[0], { from: accounts[0] })
    await artwork.mintWithTokenURI(steward.address, 0, testTokenURI, { from: accounts[0] })
    // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(artwork.address, accounts[0], patronageDenominator)
    await steward.listNewTokens([0], [accounts[0]], [patronageNumerator])
  });

  it('steward: init: artwork minted', async () => {
    const currentOwner = await artwork.ownerOf.call(0);
    const uri = await artwork.tokenURI(0);
    assert.equal(uri, testTokenURI);
    assert.equal(steward.address, currentOwner);
  });

  // TODO: add a check that patrons can't add deposit when they don't own any tokens. Is that needed?
  it('steward: init: deposit wei fail [foreclosed]', async () => {
    await expectRevert(steward.depositWei({ from: accounts[2], value: web3.utils.toWei('1', 'ether') }), "No tokens owned");
  });

  it('steward: init: wait time. deposit wei fail [foreclosed]', async () => {
    await time.increase(1000); // 1000 seconds, arbitrary
    await expectRevert(steward.depositWei({ from: accounts[2], value: web3.utils.toWei('1', 'ether') }), "No tokens owned");
  });

  it('steward: init: change price fail [not patron]', async () => {
    await expectRevert(steward.changePrice(0, 500, { from: accounts[2] }), "Not patron");
  });

  it('steward: init: collect 0 patronage.', async () => {
    const totalBefore = await steward.totalCollected.call(1);
    await time.increase(1000); // 1000 seconds, arbitrary
    await steward._collectPatronage(1, { from: accounts[2] });
    const totalAfter = await steward.totalCollected.call(1);
    assert.equal(totalBefore.toString(), totalAfter.toString());
  });

  it('steward: init: buy with zero wei [fail payable]', async () => {
    await expectRevert.unspecified(steward.buy(1, 1000, { from: accounts[2], value: web3.utils.toWei('0', 'ether') }));
  });

  it('steward: init: buy with 1 ether but 0 price [fail on price]', async () => {
    await expectRevert(steward.buy(1, 0, { from: accounts[2], value: web3.utils.toWei('1', 'ether') }), "Price is zero");
  });

  it('steward: init: buy with 2 ether, price of 1 success [price = 1 eth, deposit = 1 eth]', async () => {
    const { logs } = await steward.buy(0, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    expectEvent.inLogs(logs, 'LogBuy', { owner: accounts[2], price: ether('1') });
    const deposit = await steward.deposit.call(accounts[2]);
    const price = await steward.price.call(0);
    const state = await steward.state.call(0);
    assert.equal(deposit, web3.utils.toWei('1', 'ether'));
    assert.equal(price, web3.utils.toWei('1', 'ether'));
    assert.equal(state, 1);
  });
});

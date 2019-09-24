const { BN, shouldFail, ether, expectEvent, balance, time } = require('openzeppelin-test-helpers');

const Artwork = artifacts.require('./ERC721Full.sol');
const VitalikSteward = artifacts.require('./VitalikSteward.sol');

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

contract('VitalikSteward', (accounts) => {

  let artwork;
  let steward;

  beforeEach(async () => {
    artwork = await Artwork.new("TESTARTWORK", "TA");
    steward = await VitalikSteward.new(accounts[1], artwork.address, { from: accounts[0] });
  });

  it('steward: init: artwork minted', async () => {
    const currentOwner = await artwork.ownerOf.call(1);
    const uri = await artwork.tokenURI(1);
    assert.equal(uri, "FIX-ME");
    assert.equal(steward.address, currentOwner);
  });

  it('steward: init: retry setup (fail)', async () => {
    await shouldFail.reverting.withMessage(artwork.setup(8, "something", { from: accounts[0] }), "Already initialized");
  });

  it('steward: init: deposit wei fail [foreclosed]', async () => {
    await shouldFail.reverting.withMessage(steward.depositWei(1, { from: accounts[2], value: web3.utils.toWei('1', 'ether') }), "Foreclosed");
  });

  it('steward: init: wait time. deposit wei fail [foreclosed]', async () => {
    await time.increase(1000); // 1000 seconds, arbitrary
    await shouldFail.reverting.withMessage(steward.depositWei(1, { from: accounts[2], value: web3.utils.toWei('1', 'ether') }), "Foreclosed");
  });

  it('steward: init: change price fail [not patron]', async () => {
    await shouldFail.reverting.withMessage(steward.changePrice(1, 500, { from: accounts[2] }), "Not patron");
  });

  it('steward: init: collect 0 patronage.', async () => {
    const totalBefore = await steward.totalCollected.call(1);
    await time.increase(1000); // 1000 seconds, arbitrary
    await steward._collectPatronage(1, { from: accounts[2] });
    const totalAfter = await steward.totalCollected.call(1);
    assert.equal(totalBefore.toString(), totalAfter.toString());
  });

  it('steward: init: withdraw deposit [not patron]', async () => {
    await shouldFail.reverting.withMessage(steward.withdrawDeposit(1, 10, { from: accounts[2] }), "Not patron");
  });

  it('steward: init: buy with zero wei [fail payable]', async () => {
    await shouldFail.reverting(steward.buy(1, 1000, { from: accounts[2], value: web3.utils.toWei('0', 'ether') }));
  });

  it('steward: init: buy with 1 ether but 0 price [fail on price]', async () => {
    await shouldFail.reverting.withMessage(steward.buy(1, 0, { from: accounts[2], value: web3.utils.toWei('1', 'ether') }), "Price is zero");
  });

  it('steward: init: buy with 2 ether, price of 1 success [price = 1 eth, deposit = 1 eth]', async () => {
    const { logs } = await steward.buy(1, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
    expectEvent.inLogs(logs, 'LogBuy', { owner: accounts[2], price: ether('1') });
    const deposit = await steward.deposit.call(1);
    const price = await steward.price.call(1);
    const state = await steward.state.call(1);
    assert.equal(deposit, web3.utils.toWei('1', 'ether'));
    assert.equal(price, web3.utils.toWei('1', 'ether'));
    assert.equal(state, 1);
  });
});

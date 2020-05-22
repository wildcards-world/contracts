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
  setupTimeManager,
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

contract("WildcardSteward Benefactor collection", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  let mintManager;
  const testTokenId = 1;
  const patronageNumerator = "12000000000000";
  const patronageDenominator = "1000000000000";
  const tokenGenerationRate = 10; // should depend on token
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const artistAddress = accounts[9];
  const artistCommission = 0;

  const tenMinPatronageAt1Eth = ether("1")
    .mul(new BN("600"))
    .mul(new BN("12"))
    .div(new BN("1"))
    .div(new BN("31536000"));

  const admin = accounts[0];
  const benefactor1 = accounts[1];
  const benefactor2 = accounts[2];
  const patron1 = accounts[3];
  const patron2 = accounts[4];

  beforeEach(async () => {
    erc721 = await ERC721token.new({ from: admin });
    steward = await WildcardSteward.new({ from: admin });
    mintManager = await MintManager.new({ from: admin });
    erc20 = await ERC20token.new("Wildcards Loyalty Token", "WLT", 18, {
      from: admin,
    });
    await mintManager.initialize(admin, steward.address, erc20.address, {
      from: admin,
    });
    await erc721.setup(
      steward.address,
      "ALWAYSFORSALETestToken",
      "AFSTT",
      admin,
      { from: admin }
    );
    await erc721.addMinter(steward.address, { from: admin });
    await erc721.renounceMinter({ from: admin });
    await erc20.addMinter(mintManager.address, {
      from: admin,
    });
    await erc20.renounceMinter({ from: admin });

    // TODO: use this to make the contract address of the token deterministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(
      erc721.address,
      admin,
      mintManager.address,
      0 /*Set to zero for testing purposes*/,
      ether("10") /* set this too high for the tests */
    );
    await steward.listNewTokens(
      [0, 1, 2, 3, 4],
      [benefactor1, benefactor1, benefactor1, benefactor2, benefactor2],
      [
        patronageNumerator,
        patronageNumerator,
        patronageNumerator,
        patronageNumerator,
        patronageNumerator,
      ],
      [
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
      ],
      [
        artistAddress,
        artistAddress,
        artistAddress,
        artistAddress,
        artistAddress,
      ],
      [
        artistCommission,
        artistCommission,
        artistCommission,
        artistCommission,
        artistCommission,
      ],
      [0, 0, 0, 0, 0]
    );
    await steward.changeAuctionParameters("0", "0", 86400, {
      from: admin,
    });
  });

  it("steward: benefactor withdrawal. A token is owned for 1 year.", async () => {
    const { setNextTxTimestamp } = await setupTimeManager(web3);
    const tokenPrice = ether("0.01");
    const deposit = ether("0.5");
    await steward.buyAuction(1, tokenPrice, 500, {
      from: accounts[2],
      value: deposit,
    });

    let timestampBefore = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;

    const balTrack = await balance.tracker(benefactor1);
    await setNextTxTimestamp(time.duration.days(365));

    await steward.withdrawBenefactorFunds({
      from: benefactor1,
      gasPrice: "0", // Set gas price to 0 for simplicity
    });

    let timestampAfter = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;

    // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
    const due = tokenPrice
      .mul(time.duration.days(365))
      .mul(new BN(patronageNumerator))
      .div(new BN(patronageDenominator))
      .div(time.duration.days(365));

    assert.equal((await balTrack.delta()).toString(), due.toString());
  });

  it("steward: benefactor withdrawal. A token is owned for 1 year.", async () => {
    const { setNextTxTimestamp } = await setupTimeManager(web3);
    const tokenPrice = ether("0.01");
    const deposit = ether("0.5");
    await steward.buyAuction(1, tokenPrice, 500, {
      from: accounts[2],
      value: deposit,
    });

    let timestampBefore = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;

    const balTrack = await balance.tracker(benefactor1);
    await setNextTxTimestamp(time.duration.days(365));

    await steward.withdrawBenefactorFunds({
      from: benefactor1,
      gasPrice: "0", // Set gas price to 0 for simplicity
    });

    let timestampAfter = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;

    // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
    const due = tokenPrice
      .mul(time.duration.days(365))
      .mul(new BN(patronageNumerator))
      .div(new BN(patronageDenominator))
      .div(time.duration.days(365));

    assert.equal((await balTrack.delta()).toString(), due.toString());
  });

  describe("steward: benefactor withdrawal with token foreclosure", async () => {
    it("steward: benefactor withdrawal. A token is owned for 2 days, but forecloses after 1 day. The organisation withdraws their after 2 days, token foreclosed after 2 days.", async () => {
      const { setNextTxTimestamp } = await setupTimeManager(web3);
      const tokenPrice = ether("0.01");
      const deposit = ether("0.5");
      await steward.buyAuction(1, tokenPrice, 500, {
        from: accounts[2],
        value: deposit,
      });

      let timestampBefore = (
        await web3.eth.getBlock(await web3.eth.getBlockNumber())
      ).timestamp;

      const balTrack = await balance.tracker(benefactor1);
      await setNextTxTimestamp(time.duration.days(365));

      await steward.withdrawBenefactorFunds({
        from: benefactor1,
        gasPrice: "0", // Set gas price to 0 for simplicity
      });

      let timestampAfter = (
        await web3.eth.getBlock(await web3.eth.getBlockNumber())
      ).timestamp;

      // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
      const due = tokenPrice
        .mul(time.duration.days(365))
        .mul(new BN(patronageNumerator))
        .div(new BN(patronageDenominator))
        .div(time.duration.days(365));

      assert.equal((await balTrack.delta()).toString(), due.toString());
    });
  });
});

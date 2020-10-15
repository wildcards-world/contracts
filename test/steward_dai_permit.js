const { BN, expectRevert, ether, time } = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
  auctionCalculator,
  initialize,
  setupTimeManager,
  isCoverage,
  waitTillBeginningOfSecond,
  launchTokens,
  daiPermitGeneration,
} = require("./helpers");
const testHelpers = require("@openzeppelin/test-helpers");

const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward owed", (accounts) => {
  // console.log({ accounts, web3 });
  let steward, daiContract;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  const benefactorAddress = accounts[8];
  const artistAddress = accounts[9];
  const withdrawCheckerAdmin = accounts[6];
  const artistCommission = 0;
  const admin = accounts[0];
  const zeroEther = ether("0");
  const auctionEndPrice = zeroEther;
  const auctionStartPrice = ether("1");
  const auctionDuration = new BN(86400);
  const percentageForWildcards = 50000;
  const tokenDefaults = {
    benefactor: benefactorAddress,
    patronageNumerator,
    tokenGenerationRate,
    artist: artistAddress,
    artistCommission,
    releaseDate: 0,
  };
  const tokenDetails = [
    {
      ...tokenDefaults,
      token: "0",
    },
  ];

  let setNextTxTimestamp,
    timeSinceTimestamp,
    getCurrentTimestamp,
    timeSince,
    txTimestamp;
  const tenMinPatronageAt1Eth = patronageCalculator("600", [
    {
      patronageNumerator,
      price: ether("1"),
    },
  ]);

  before(async () => {
    const timeManager = await setupTimeManager(web3);
    setNextTxTimestamp = timeManager.setNextTxTimestamp; // takes in duration
    timeSinceTimestamp = timeManager.timeSinceTimestamp; // takes in old timestamp, returns current time
    getCurrentTimestamp = timeManager.getCurrentTimestamp; // returns timestamp of a given transaction
    timeSince = timeManager.timeSince; // returns interval between two timestamps
    txTimestamp = timeManager.txTimestamp; // returns timestamp of a given transaction
  });

  beforeEach(async () => {
    const result = await initialize(
      admin,
      withdrawCheckerAdmin,
      auctionStartPrice,
      auctionEndPrice,
      auctionDuration,
      tokenDetails,
      [accounts[2], accounts[3], accounts[4]],
      false
    );
    steward = result.steward;
    daiContract = result.paymentToken;

    if (isCoverage) await waitTillBeginningOfSecond();
  });

  // buy auction timing correct
  it("steward: auction with Dai `permit`.", async () => {
    const newTokens = [
      {
        ...tokenDefaults,
        token: "5",
      },
      {
        ...tokenDefaults,
        token: "6",
      },
      {
        ...tokenDefaults,
        token: "7",
      },
    ];
    await launchTokens(steward, newTokens);

    const tokenPrice = ether("1");

    const halfAuctionDuration = auctionDuration.div(new BN(2));

    // CHECK 1: price of token functions correctly for auction after half the time is up
    await setNextTxTimestamp(halfAuctionDuration); // Price should now be 0.5eth to buy
    let predictedCostOfToken = auctionCalculator(
      auctionStartPrice,
      auctionEndPrice,
      auctionDuration,
      halfAuctionDuration
    );
    const msgValue = ether("1");
    const remainingDepositCalc = msgValue.sub(predictedCostOfToken);

    let { nonce, expiry, v, r, s } = await daiPermitGeneration(
      web3.currentProvider,
      daiContract,
      accounts[2],
      steward.address
    );
    await steward.buyAuctionWithPermit(
      // uint256 nonce,
      nonce,
      // uint256 expiry,
      expiry,
      // bool allowed,
      true,
      // uint8 v,
      v,
      // bytes32 r,
      r,
      // bytes32 s,
      s,
      // uint256 tokenId,
      newTokens[0].token,
      // uint256 _newPrice,
      tokenPrice,
      // uint256 serviceProviderPercentage,
      percentageForWildcards,
      // uint256 depositAmount
      remainingDepositCalc,
      {
        from: accounts[2],
      }
    );
    const actualDeposit = await steward.deposit.call(accounts[2]);
    if (!isCoverage) {
      assert.equal(actualDeposit.toString(), remainingDepositCalc.toString());
      assert.equal(actualDeposit.toString(), ether("0.5").toString());
    }
  });
});

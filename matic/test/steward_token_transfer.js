const { BN, ether, time } = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
  setupTimeManager,
  initialize,
  isCoverage,
  waitTillBeginningOfSecond,
} = require("./helpers");
const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward owed", (accounts) => {
  let steward, erc721;

  const artistAddress = accounts[7];
  const artistCommission = 0;

  const patronageNumerator = "12000000000000";

  const benefactorAddress = accounts[8];
  const withdrawCheckerAdmin = accounts[6];
  const admin = accounts[0];
  const zeroEther = ether("0");
  const auctionEndPrice = zeroEther;
  const auctionStartPrice = zeroEther;
  const auctionDuration = new BN(86400);
  const tokenDefaults = {
    benefactor: benefactorAddress,
    patronageNumerator,
    artist: artistAddress,
    artistCommission,
    releaseDate: 0,
  };
  const tokenDetails = [
    {
      ...tokenDefaults,
      token: "0",
    },
    {
      ...tokenDefaults,
      token: "1",
    },
  ];
  let setNextTxTimestamp,
    timeSinceTimestamp,
    getCurrentTimestamp,
    timeSince,
    txTimestamp;

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
      [accounts[2]]
    );
    steward = result.steward;
    erc721 = result.erc721;

    if (isCoverage) await waitTillBeginningOfSecond();
  });

  describe("steward: basic token send (happy path)", async () => {
    let usersDepositBeforeTransfer,
      totalPatronOwnedTokenCost,
      yearTimePatronagDenominator;
    const testTokenId1 = tokenDetails[0].token;
    const testTokenId2 = tokenDetails[1].token;
    const priceAfterSend = ether("2");
    const depositAfterSend = ether("1.5");

    beforeEach(async () => {
      //Buying 1st token and setting selling price to 1 eth. With 1 eth deposit.
      await steward.buyAuction(testTokenId1, ether("1"), 50000, ether("1"), {
        from: accounts[2],
      });

      await steward.buyAuction(testTokenId2, ether("2"), 50000, ether("1"), {
        from: accounts[2],
      });
      usersDepositBeforeTransfer = await steward.deposit.call(accounts[2]);
      totalPatronOwnedTokenCost = await steward.totalPatronOwnedTokenCost.call(
        accounts[2]
      );
      yearTimePatronagDenominator = await steward.yearTimePatronagDenominator.call();
    });

    it("Transfering a token shouldn't affect the users own deposit", async () => {
      await setNextTxTimestamp(time.duration.minutes(10));
      await steward.transferWithDeposit(
        accounts[3],
        testTokenId1,
        priceAfterSend,
        depositAfterSend,
        {
          from: accounts[2],
        }
      );
      const usersDepositAfterTransfer = await steward.deposit.call(accounts[2]);

      assert.equal(
        usersDepositBeforeTransfer.toString(),
        usersDepositAfterTransfer
          .add(
            time.duration
              .minutes(10)
              .mul(totalPatronOwnedTokenCost)
              .div(yearTimePatronagDenominator)
          )
          .toString(),
        "The users deposit was affected when sending a token"
      );
    });

    it("The token should belong to the recipient", async () => {
      await steward.transferWithDeposit(
        accounts[3],
        testTokenId1,
        priceAfterSend,
        depositAfterSend,
        {
          from: accounts[2],
        }
      );
      const newOwner = await erc721.ownerOf(testTokenId1);

      assert.equal(
        newOwner,
        accounts[3],
        "Wrong owner of token after transfer"
      );
    });

    it("The token should have the correct price", async () => {
      await steward.transferWithDeposit(
        accounts[3],
        testTokenId1,
        priceAfterSend,
        depositAfterSend,
        {
          from: accounts[2],
        }
      );
      const price = await steward.price(testTokenId1);

      assert.equal(
        price.toString(),
        priceAfterSend.toString(),
        "Price was set correctly after send"
      );
    });

    it("The token should have the correct deposit", async () => {
      await steward.transferWithDeposit(
        accounts[3],
        testTokenId1,
        priceAfterSend,
        depositAfterSend,
        {
          from: accounts[2],
        }
      );
      const deposit = await steward.deposit(accounts[3]);

      assert.equal(deposit.toString(), depositAfterSend.toString(), "another");
    });
  });
});

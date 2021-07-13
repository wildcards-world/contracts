const { BN, ether, time, expectRevert } = require("@openzeppelin/test-helpers");
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
      [accounts[2], accounts[3], accounts[4]]
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
  describe("steward: basic token send (error cases)", async () => {
    // let usersDepositBeforeTransfer,
    //   totalPatronOwnedTokenCost,
    //   yearTimePatronagDenominator;
    const testTokenId1 = tokenDetails[0].token;
    const testTokenId2 = tokenDetails[1].token;
    const priceAfterSend = ether("2");
    const depositAfterSend = ether("1.5");
    const priceOfToken1 = ether("1");
    const priceOfToken2 = ether("2");

    beforeEach(async () => {
      const depositFor10MinForclosureToken1 = patronageCalculator("601", [
        {
          patronageNumerator: patronageNumerator,
          price: priceOfToken1.toString(),
        },
      ]);
      const depositFor10MinForclosureToken2 = patronageCalculator("600", [
        {
          patronageNumerator: patronageNumerator,
          price: priceOfToken2.toString(),
        },
      ]);
      //Buying 1st token and setting selling price to 1 eth. With 1 eth deposit.
      let tx1 = await txTimestamp(
        steward.buyAuction(
          testTokenId1,
          priceOfToken1,
          50000,
          depositFor10MinForclosureToken1,
          {
            from: accounts[2],
          }
        )
      );

      let tx2 = await txTimestamp(
        steward.buyAuction(
          testTokenId2,
          priceOfToken2,
          50000,
          depositFor10MinForclosureToken2,
          {
            from: accounts[2],
          }
        )
      );

      usersDepositBeforeTransfer = await steward.deposit.call(accounts[2]);
      totalPatronOwnedTokenCost = await steward.totalPatronOwnedTokenCost.call(
        accounts[2]
      );
      yearTimePatronagDenominator = await steward.yearTimePatronagDenominator.call();
    });

    it("should allow transfer right up till the time of foreclosure", async () => {
      await setNextTxTimestamp(time.duration.minutes(10).sub(new BN(1)));

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

    it("should not allow the user to transfer a token if they are meant to be foreclosed", async () => {
      await setNextTxTimestamp(time.duration.minutes(10));

      await expectRevert(
        steward.transferWithDeposit(
          accounts[3],
          testTokenId1,
          priceAfterSend,
          depositAfterSend,
          {
            from: accounts[2],
          }
        ),
        "no deposit existing tokens"
      );
    });
    it("shouldn't allow another user to transfer other tokens", async () => {
      await expectRevert(
        steward.transferWithDeposit(
          accounts[3],
          testTokenId1,
          priceAfterSend,
          depositAfterSend,
          {
            from: accounts[4],
          }
        ),
        "not owner"
      );
    });
    it("shouldn't allow a foreclosed user to recieve tokens", async () => {
      // Make accounts[3] foreclosed
      steward.buy(
        testTokenId2,
        priceOfToken2,
        priceOfToken2,
        50000,
        priceOfToken2.add(new BN("5")),
        {
          from: accounts[3],
        }
      );
      await setNextTxTimestamp(time.duration.minutes(10)); // enough time for account[3] to foreclose

      await expectRevert(
        steward.transferWithDeposit(
          accounts[3],
          testTokenId1,
          priceAfterSend,
          depositAfterSend,
          {
            from: accounts[2],
          }
        ),
        "no deposit existing tokens"
      );
    });
    it("deposit of sent token should be at least 1 week", async () => {
      const depositFor1WeekMinus1Second = patronageCalculator(
        time.duration.weeks("1").sub(new BN(1)),
        [
          {
            patronageNumerator: patronageNumerator,
            price: priceAfterSend.toString(),
          },
        ]
      );
      const depositFor1Week = patronageCalculator(time.duration.weeks("1"), [
        {
          patronageNumerator: patronageNumerator,
          price: priceAfterSend.toString(),
        },
      ]);

      await expectRevert(
        steward.transferWithDeposit(
          accounts[3],
          testTokenId1,
          priceAfterSend,
          depositFor1WeekMinus1Second,
          {
            from: accounts[2],
          }
        ),
        "Deposit less than 1 week"
      );
      await steward.transferWithDeposit(
        accounts[3],
        testTokenId1,
        priceAfterSend,
        depositFor1Week,
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
  });
});

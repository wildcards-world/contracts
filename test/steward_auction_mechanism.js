const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
  waitTillBeginningOfSecond,
  auctionCalculator,
  STEWARD_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
} = require("./helpers");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);

const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward owed", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  const artistAddress = accounts[9];
  const artistCommission = 0;
  const testToken1 = { id: 1, patronageNumerator: 12 };
  const testToken2 = { id: 2, patronageNumerator: 12 };
  testTokenId1 = testToken1.id;
  testTokenId2 = testToken2.id;
  const tenMinPatronageAt1Eth = ether("1")
    .mul(new BN("600"))
    .mul(new BN("12"))
    .div(new BN("1"))
    .div(new BN("31536000"));

  beforeEach(async () => {
    erc721 = await ERC721token.new({ from: accounts[0] });
    steward = await WildcardSteward.new({ from: accounts[0] });
    mintManager = await MintManager.new({ from: accounts[0] });
    erc20 = await ERC20token.new("Wildcards Loyalty Token", "WLT", 18, {
      from: accounts[0],
    });
    await mintManager.initialize(accounts[0], steward.address, erc20.address, {
      from: accounts[0],
    });
    await erc721.setup(
      steward.address,
      "ALWAYSFORSALETestToken",
      "AFSTT",
      accounts[0],
      { from: accounts[0] }
    );
    await erc721.addMinter(steward.address, { from: accounts[0] });
    await erc721.renounceMinter({ from: accounts[0] });
    await erc20.addMinter(mintManager.address, {
      from: accounts[0],
    });
    await erc20.renounceMinter({ from: accounts[0] });

    await steward.initialize(erc721.address, accounts[0], mintManager.address);
    await steward.listNewTokens(
      [0, testTokenId1, testTokenId2, 3],
      [accounts[0], accounts[0], accounts[0], accounts[0]],
      [
        patronageNumerator,
        testToken1.patronageNumerator,
        testToken2.patronageNumerator,
        testToken2.patronageNumerator,
      ],
      [
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
      ],
      [artistAddress, artistAddress, artistAddress, artistAddress],
      [artistCommission, artistCommission, artistCommission, artistCommission],
      [0, 0, 0, Date.now() + 86400]
      //1704067200
      //Is equivalent to:
      //01/01/2024 @ 12:00am (UTC)
    );
    await steward.changeAuctionParameters(ether("1"), ether("0"), 86400, {
      from: accounts[0],
    });
  });

  it("steward: auction. Checking cannot change to wrong permutations of auction", async () => {
    await expectRevert(
      steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
        from: accounts[1],
      }),
      "Not admin"
    );
    await expectRevert(
      steward.changeAuctionParameters(ether("1"), ether("2"), 86400, {
        from: accounts[0],
      }),
      "Auction value must decrease over time"
    );
    await expectRevert(
      steward.changeAuctionParameters(ether("1"), ether("0.5"), 600, {
        from: accounts[0],
      }),
      "Auction should last at least day"
    );
  });

  // buy auction timing correct
  it("steward: auction. Initial price auction works.", async () => {
    let oneSecondTolerance = auctionCalculator(
      ether("1"),
      ether("0"),
      "86400",
      "86399"
    );

    // CHECK 1: price of token functions correctly for auction after half the time is up
    await time.increase(time.duration.seconds(43200)); // Price should now be 0.5eth to buy
    let costOfToken1 = auctionCalculator(
      ether("1"),
      ether("0"),
      "86400",
      "43200"
    );
    let msgValue = ether("1");
    await steward.buyAuction(testTokenId1, ether("1"), 500, {
      from: accounts[2],
      value: msgValue,
    });
    let remainingDepositCalc = msgValue.sub(costOfToken1);
    let actualDeposit = await steward.deposit.call(accounts[2]);
    assert.isTrue(
      Math.abs(actualDeposit.sub(remainingDepositCalc)) <= oneSecondTolerance
    );
    assert.isTrue(
      Math.abs(actualDeposit.sub(ether("0.5"))) <= oneSecondTolerance //sanity check
    );

    // CHECK 2: price of token functions correctly for auction after 3/4 time is up
    await time.increase(time.duration.seconds(21600));
    let costOfToken2 = auctionCalculator(
      ether("1"),
      ether("0"),
      "86400",
      "64800"
    );
    await steward.buyAuction(testTokenId2, ether("1"), 500, {
      from: accounts[3],
      value: msgValue,
    });
    let remainingDepositCalc2 = msgValue.sub(costOfToken2);
    let actualDeposit2 = await steward.deposit.call(accounts[3]);
    assert.isTrue(
      Math.abs(actualDeposit2.sub(remainingDepositCalc2)) <= oneSecondTolerance
    );
    assert.isTrue(
      Math.abs(actualDeposit2.sub(ether("0.75"))) <= oneSecondTolerance //sanity check
    );

    // CHECK 3: If auction is over, minprice is returned.
    await time.increase(time.duration.seconds(43200)); // auction should be over, min price of 0
    await steward.buyAuction(0, ether("1"), 500, {
      from: accounts[4],
      value: msgValue,
    });
    let actualDeposit3 = await steward.deposit.call(accounts[4]);
    assert.isTrue(
      Math.abs(actualDeposit3.sub(ether("1"))) <= oneSecondTolerance //sanity check
    );
  });

  it("steward: auction. Check custom-auction on foreclosure works.", async () => {
    await steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
      from: accounts[0],
    });
    await steward.buyAuction(0, ether("2"), 500, {
      from: accounts[2],
      value: tenMinPatronageAt1Eth,
    });

    await time.increase(time.duration.minutes(5));
    // should foreclose
    let oneSecondTolerance = auctionCalculator(
      ether("2"), // since starting price should be 2
      ether("0"),
      "86400",
      "86399"
    );

    let costOfToken1 = auctionCalculator(
      ether("2"),
      ether("0"),
      "86400",
      "20000" // say 20 000 seconds elapse.
    );

    await time.increase(time.duration.seconds(20000));
    let msgValue = ether("2");

    await steward.buyAuction(0, ether("2"), 500, {
      from: accounts[3],
      value: msgValue,
    });

    let remainingDepositCalc = msgValue.sub(costOfToken1);
    let actualDeposit = await steward.deposit.call(accounts[3]);
    assert.isTrue(
      Math.abs(actualDeposit.sub(remainingDepositCalc)) <= oneSecondTolerance
    );
  });

  it("steward: auction. Check ming price returned after auction finished", async () => {
    await steward.changeAuctionParameters(ether("1"), ether("0.5"), 86400, {
      from: accounts[0],
    });
    await steward.buyAuction(0, ether("2"), 500, {
      from: accounts[2],
      value: ether("1").add(tenMinPatronageAt1Eth),
    });

    await time.increase(time.duration.minutes(5));
    // should foreclose
    let oneSecondTolerance = auctionCalculator(
      ether("1"), // since starting price should be 2
      ether("0.5"),
      "86400",
      "86399"
    );

    let costOfToken1 = ether("0.5");

    await time.increase(time.duration.seconds(90000));
    let msgValue = ether("2");

    await steward.buyAuction(0, ether("2"), 500, {
      from: accounts[3],
      value: msgValue,
    });

    let remainingDepositCalc = msgValue.sub(costOfToken1);
    let actualDeposit = await steward.deposit.call(accounts[3]);
    assert.isTrue(
      Math.abs(actualDeposit.sub(remainingDepositCalc)) <= oneSecondTolerance
    );
  });

  it("steward: auction. Price set below auction min won't induce custome auction", async () => {
    await steward.changeAuctionParameters(ether("1"), ether("0.5"), 86400, {
      from: accounts[0],
    });
    await steward.buyAuction(0, ether("0.2"), 500, {
      from: accounts[2],
      value: ether("1").add(tenMinPatronageAt1Eth),
    });

    await time.increase(time.duration.minutes(50));
    // should foreclose
    let oneSecondTolerance = auctionCalculator(
      ether("1"), // since starting price should be 2
      ether("0.5"),
      "86400",
      "86399"
    );

    let costOfToken1 = auctionCalculator(
      ether("1"),
      ether("0.5"),
      "86400",
      "30000" // say 20 000 seconds elapse.
    );

    await time.increase(time.duration.seconds(30000));
    let msgValue = ether("2");

    await steward.buyAuction(0, ether("2"), 500, {
      from: accounts[3],
      value: msgValue,
    });

    let remainingDepositCalc = msgValue.sub(costOfToken1);
    let actualDeposit = await steward.deposit.call(accounts[3]);
    assert.isTrue(
      Math.abs(actualDeposit.sub(remainingDepositCalc)) <= oneSecondTolerance
    );
  });

  it("steward: auction. Cannot buy till on sale", async () => {
    await steward.changeAuctionParameters(ether("1"), ether("0.5"), 86400, {
      from: accounts[0],
    });
    await expectRevert(
      steward.buyAuction(3, ether("0.2"), 500, {
        from: accounts[2],
        value: ether("1").add(tenMinPatronageAt1Eth),
      }),
      "Token is not yet released"
    );

    await time.increase(time.duration.seconds(86400));
    // should foreclose
    let oneSecondTolerance = auctionCalculator(
      ether("1"), // since starting price should be 2
      ether("0.5"),
      "86400",
      "86399"
    );

    let costOfToken1 = auctionCalculator(
      ether("1"),
      ether("0.5"),
      "86400",
      "30000" // say 20 000 seconds elapse.
    );

    await time.increase(time.duration.seconds(30000));

    let msgValue = ether("2");
    await steward.buyAuction(0, ether("2"), 500, {
      from: accounts[3],
      value: msgValue,
    });

    let remainingDepositCalc = msgValue.sub(costOfToken1);
    let actualDeposit = await steward.deposit.call(accounts[3]);
    assert.isTrue(
      Math.abs(actualDeposit.sub(remainingDepositCalc)) <= oneSecondTolerance
    );
  });
});

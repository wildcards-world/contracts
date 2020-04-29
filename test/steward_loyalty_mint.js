const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const {
  multiTokenCalculator,
  waitTillBeginningOfSecond,
  STEWARD_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
} = require("./helpers");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);

const SECONDS_IN_A_MINUTE = "60";
const TREASURY_NUMERATOR = "20"; // This indicates a 20% rate of tokens treasury collects
const TREASURY_DENOMINATOR = "100";
const tenMinPatronageAt1Eth = ether("1")
  .mul(new BN("600"))
  .mul(new BN("12"))
  .div(new BN("1"))
  .div(new BN("31536000"));

contract("WildcardSteward owed", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  const testToken1 = { id: 1, tokenGenerationRate: 1 };
  const testToken2 = { id: 2, tokenGenerationRate: 2 };
  const patronageNumerator = "12000000000000";
  const testTokenURI = "test token uri";

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

    // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(erc721.address, accounts[0]);
    await steward.updateToV2(mintManager.address, [], []);
    await steward.listNewTokens(
      [testToken1.id, testToken2.id],
      [accounts[0], accounts[0]],
      [patronageNumerator, patronageNumerator],
      [testToken1.tokenGenerationRate, testToken2.tokenGenerationRate]
    );
  });

  it("steward: loyalty-mint. Checking correct number of tokens are received after holding a token for  100min", async () => {
    await waitTillBeginningOfSecond();
    testTokenId1 = testToken1.id;
    const timeHeld = 100; // In minutes
    // Person buys a token
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    // TIME INCREASES HERE BY timeHeld
    await time.increase(time.duration.minutes(timeHeld));
    // First token bought from patron [Collect patronage will therefore be called]
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[3],
      value: ether("2"),
    });

    const expectedTokens = multiTokenCalculator(
      new BN(timeHeld).mul(new BN(SECONDS_IN_A_MINUTE)).toString(),
      [
        {
          tokenGenerationRate: testToken1.tokenGenerationRate.toString(),
        },
      ]
    );
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    const amountOfTreasuryToken = await erc20.balanceOf(accounts[0]); // stewards account
    const expectedTreasuryToken = new BN(expectedTokens)
      .mul(new BN(TREASURY_NUMERATOR))
      .div(new BN(TREASURY_DENOMINATOR));

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
    assert.equal(
      amountOfTreasuryToken.toString(),
      expectedTreasuryToken.toString()
    );
  });

  it("steward: loyalty-mint. Checking correct number of tokens received after holding 2 different token for  100min", async () => {
    await waitTillBeginningOfSecond();
    testTokenId1 = testToken1.id;
    testTokenId2 = testToken2.id;
    const timeHeld = 100; // In minutes
    // Person buys a token
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    await steward.buy(testTokenId2, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    // TIME INCREASES HERE BY timeHeld
    await time.increase(time.duration.minutes(timeHeld));
    // First token bought from patron [Collect patronage will therefore be called]
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[3],
      value: ether("2"),
    });
    await steward.buy(testTokenId2, ether("1"), ether("1"), {
      from: accounts[3],
      value: ether("2"),
    });

    const expectedTokens = multiTokenCalculator(
      new BN(timeHeld).mul(new BN(SECONDS_IN_A_MINUTE)).toString(),
      [
        {
          tokenGenerationRate: testToken1.tokenGenerationRate.toString(),
        },
        {
          tokenGenerationRate: testToken2.tokenGenerationRate.toString(),
        },
      ]
    );
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    const amountOfTreasuryToken = await erc20.balanceOf(accounts[0]); // stewards account
    const expectedTreasuryToken = new BN(expectedTokens)
      .mul(new BN(TREASURY_NUMERATOR))
      .div(new BN(TREASURY_DENOMINATOR));

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
    assert.equal(
      amountOfTreasuryToken.toString(),
      expectedTreasuryToken.toString()
    );
  });

  it("steward: loyalty-mint. Checking correct number of tokens are recieved/minted after foreclosure.", async () => {
    await waitTillBeginningOfSecond();
    testTokenId1 = testToken1.id;
    const timeHeld = 10; // In minutes
    const totalToBuy = new BN(tenMinPatronageAt1Eth);

    await steward.buy(testTokenId1, ether("1"), totalToBuy, {
      from: accounts[2],
      value: totalToBuy,
    });

    await time.increase(time.duration.minutes(15));
    // foreclosure should happen here (since patraonge was only for 10min)
    await steward._collectPatronage(testTokenId1, { from: accounts[2] });

    // should only receive 10min of tokens
    const expectedTokens = multiTokenCalculator(
      new BN(timeHeld).mul(new BN(SECONDS_IN_A_MINUTE)).toString(),
      [
        {
          tokenGenerationRate: testToken1.tokenGenerationRate.toString(),
        },
      ]
    );
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    const amountOfTreasuryToken = await erc20.balanceOf(accounts[0]); // stewards account
    const expectedTreasuryToken = new BN(expectedTokens)
      .mul(new BN(TREASURY_NUMERATOR))
      .div(new BN(TREASURY_DENOMINATOR));

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
    assert.equal(
      amountOfTreasuryToken.toString(),
      expectedTreasuryToken.toString()
    );
  });

  it("steward: loyalty-mint. Checking MintManager cannot be altered after intial set up.", async () => {
    await waitTillBeginningOfSecond();

    await expectRevert(
      steward.setMintManager(accounts[5], { from: accounts[5] }),
      "Only set on initialisation"
    );
  });

  it("steward: loyalty-mint. Checking Minted erc20's can be sent between parties for sanity.", async () => {
    await waitTillBeginningOfSecond();
    testTokenId1 = testToken1.id;
    const timeHeld = 100;

    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });
    await time.increase(time.duration.minutes(timeHeld));
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[7],
      value: ether("2"),
    });

    const amountToTransfer = 100;
    await erc20.transfer(accounts[3], amountToTransfer, {
      from: accounts[2],
    });
    const amountOfTokenTransferred = await erc20.balanceOf(accounts[3]);

    assert.equal(
      amountToTransfer.toString(),
      amountOfTokenTransferred.toString()
    );
  });
});

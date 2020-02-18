const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time
} = require("@openzeppelin/test-helpers");
const {
  multiTokenCalculator,
  waitTillBeginningOfSecond,
  STEWARD_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME
} = require("./helpers");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);

const PATRONAGE_DENOMINATOR = "1";

const tenMinPatronageAt1Eth = ether("1")
  .mul(new BN("600"))
  .mul(new BN("12"))
  .div(new BN("1"))
  .div(new BN("31536000"));

contract("WildcardSteward owed", accounts => {
  let erc721;
  let steward;
  let erc20;
  const testToken1 = { id: 1, tokenGenerationRate: 1 };
  const testToken2 = { id: 2, tokenGenerationRate: 2 };
  const patronageNumerator = 12;
  let testTokenURI = "test token uri";

  beforeEach(async () => {
    erc721 = await ERC721token.new({ from: accounts[0] });
    steward = await WildcardSteward.new({ from: accounts[0] });
    mintManager = await MintManager.new({ from: accounts[0] });
    erc20 = await ERC20token.new({
      from: accounts[0]
    });
    await mintManager.initialize(accounts[0], steward.address, erc20.address, {
      from: accounts[0]
    });
    await erc721.setup(
      steward.address,
      "ALWAYSFORSALETestToken",
      "AFSTT",
      accounts[0],
      { from: accounts[0] }
    );
    await erc20.initialize(
      "Wildcards Loyalty Token",
      "WLT",
      18,
      mintManager.address
    );
    await erc721.mintWithTokenURI(steward.address, 1, testTokenURI, {
      from: accounts[0]
    });
    await erc721.mintWithTokenURI(steward.address, 2, testTokenURI, {
      from: accounts[0]
    });
    // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(
      erc721.address,
      accounts[0],
      PATRONAGE_DENOMINATOR
    );
    await steward.setMintManager(mintManager.address);
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
    await steward.buy(testTokenId1, web3.utils.toWei("1", "ether"), {
      from: accounts[2],
      value: web3.utils.toWei("1", "ether")
    });

    // TIME INCREASES HERE BY timeHeld
    await time.increase(time.duration.minutes(timeHeld));
    // First token bought from patron [Collect patronage will therefore be called]
    await steward.buy(testTokenId1, ether("1"), {
      from: accounts[3],
      value: ether("2")
    });

    const expectedTokens = multiTokenCalculator(
      new BN(timeHeld).mul(new BN(60)).toString(),
      [
        {
          tokenGenerationRate: testToken1.tokenGenerationRate.toString()
        }
      ]
    );
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
  });

  it("steward: loyalty-mint. Checking correct number of tokens received after holding 2 different token for  100min", async () => {
    await waitTillBeginningOfSecond();
    testTokenId1 = testToken1.id;
    testTokenId2 = testToken2.id;
    const timeHeld = 100; // In minutes
    // Person buys a token
    await steward.buy(testTokenId1, web3.utils.toWei("1", "ether"), {
      from: accounts[2],
      value: web3.utils.toWei("1", "ether")
    });

    await steward.buy(testTokenId2, web3.utils.toWei("1", "ether"), {
      from: accounts[2],
      value: web3.utils.toWei("1", "ether")
    });

    // TIME INCREASES HERE BY timeHeld
    await time.increase(time.duration.minutes(timeHeld));
    // First token bought from patron [Collect patronage will therefore be called]
    await steward.buy(testTokenId1, ether("1"), {
      from: accounts[3],
      value: ether("2")
    });
    await steward.buy(testTokenId2, ether("1"), {
      from: accounts[3],
      value: ether("2")
    });

    const expectedTokens = multiTokenCalculator(
      new BN(timeHeld).mul(new BN(60)).toString(),
      [
        {
          tokenGenerationRate: testToken1.tokenGenerationRate.toString()
        },
        {
          tokenGenerationRate: testToken2.tokenGenerationRate.toString()
        }
      ]
    );
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
  });

  it("steward: loyalty-mint. Checking correct number of tokens after foreclosure.", async () => {
    await waitTillBeginningOfSecond();
    testTokenId1 = testToken1.id;
    const timeHeld = 10; // In minutes
    const totalToBuy = new BN(tenMinPatronageAt1Eth);

    await steward.buy(testTokenId1, ether("1"), {
      from: accounts[2],
      value: totalToBuy
    });

    await time.increase(time.duration.minutes(15));
    // foreclosure should happen here (since patraonge was only for 10min)
    await steward._collectPatronage(testTokenId1, { from: accounts[2] });

    // should only receive 10min of tokens
    const expectedTokens = multiTokenCalculator(
      new BN(timeHeld).mul(new BN(60)).toString(),
      [
        {
          tokenGenerationRate: testToken1.tokenGenerationRate.toString()
        }
      ]
    );
    const amountOfToken = await erc20.balanceOf(accounts[2]);

    assert.equal(amountOfToken.toString(), expectedTokens.toString());
  });
});

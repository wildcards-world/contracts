const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time
} = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
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
const patronageCalculator = multiPatronageCalculator(PATRONAGE_DENOMINATOR);

contract("WildcardSteward owed", accounts => {
  let erc721;
  let steward;
  let erc20;
  const testTokenId1 = 1;
  const testTokenId2 = 2;
  const patronageNumerator = 12;
  const tokenGenerationRate = 1; // should depend on token
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
    await erc721.mintWithTokenURI(steward.address, 0, testTokenURI, {
      from: accounts[0]
    });
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
      [0, 1, 2],
      [accounts[0], accounts[0], accounts[0]],
      [patronageNumerator, patronageNumerator, patronageNumerator],
      [tokenGenerationRate, tokenGenerationRate, tokenGenerationRate]
    );
  });

  //////////////////////////////////////
  /////////////////////////////////////
  //////////////////////////////////////
  //////////////////////////////////////
  // Needing to be written - but we are going to change mint function first

  it("steward: loyalty-mint. Checking tokens are received after 10min", async () => {
    await waitTillBeginningOfSecond();

    // Person buys a token
    await steward.buy(testTokenId1, web3.utils.toWei("1", "ether"), {
      from: accounts[2],
      value: web3.utils.toWei("1", "ether")
    });

    // TIME INCREASES HERE BY 10 MIN
    await time.increase(time.duration.minutes(1000));

    // First token bought from patron [Collect patronage will therefore be called]
    await steward.buy(testTokenId1, ether("1"), {
      from: accounts[3],
      value: ether("2")
    });
    // Now should receive 1000 minutes of tokens.

    const amountOfToken = await erc20.balanceOf(accounts[2]);
    console.log(amountOfToken.toString());
  });
});

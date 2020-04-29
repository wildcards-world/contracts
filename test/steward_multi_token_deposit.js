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

// todo: test over/underflows

contract("WildcardSteward owed", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  const testTokenId1 = 1;
  const testTokenId2 = 2;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  let testTokenURI = "test token uri";

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
      [0, 1, 2],
      [accounts[0], accounts[0], accounts[0]],
      [patronageNumerator, patronageNumerator, patronageNumerator],
      [tokenGenerationRate, tokenGenerationRate, tokenGenerationRate]
    );
  });

  it("steward: multi-token-deposit. On token buy, check that the remaining deposit is sent back to patron only if it is their only token", async () => {
    await waitTillBeginningOfSecond();

    //Buying 2 tokens. Setting selling price to 1 and 2 eth respectively. Sending 1 eth each for deposit.
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });
    await steward.buy(testTokenId2, ether("2"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    const priceOftoken1 = await steward.price.call(testTokenId1);
    const priceOftoken2 = await steward.price.call(testTokenId2);

    // TIME INCREASES HERE BY 10 MIN
    await time.increase(time.duration.minutes(10));

    const patronDepositBeforeSale = await steward.deposit.call(accounts[2]);
    const balancePatronBeforeSale = new BN(
      await web3.eth.getBalance(accounts[2])
    );
    // When first token is bought, deposit should remain.
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[3],
      value: ether("2"),
    });

    const patronDepositAfterFirstSale = await steward.deposit.call(accounts[2]);
    const balancePatronAfterFirstSale = new BN(
      await web3.eth.getBalance(accounts[2])
    );

    //Second token then bought. Deposit should now be added back the patrons balance
    await steward.buy(testTokenId2, ether("1"), ether("1"), {
      from: accounts[3],
      value: ether("3"),
    });

    const balancePatronAfterSecondSale = new BN(
      await web3.eth.getBalance(accounts[2])
    );
    const patronDepositAfterSecondSale = await steward.deposit.call(
      accounts[2]
    );

    const expectedPatronageAfter10min = patronageCalculator("600", [
      { patronageNumerator: "12", price: priceOftoken1.toString() },
      { patronageNumerator: "12", price: priceOftoken2.toString() },
    ]);

    assert.equal(
      patronDepositBeforeSale.toString(),
      patronDepositAfterFirstSale.add(expectedPatronageAfter10min).toString()
    );

    //Checking once no more tokens are owned, the deposit is set to zero
    assert.equal(patronDepositAfterSecondSale.toString(), "0");
    //Checking that the balance after selling 1 token has increased by only the amount recieved.
    assert.equal(
      balancePatronBeforeSale.add(ether("1")).toString(),
      balancePatronAfterFirstSale.toString()
    );
    //Checking owner gets deposit back on sale of final token plus sale price too.
    assert.equal(
      balancePatronAfterSecondSale.toString(),
      balancePatronAfterFirstSale
        .add(ether("2"))
        .add(patronDepositAfterFirstSale)
        .toString()
    );
  });
});

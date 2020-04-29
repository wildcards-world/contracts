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

contract("WildcardSteward owed", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  const testToken1 = { id: 1, patronageNumerator: 12 };
  const testToken2 = { id: 2, patronageNumerator: 12 };
  testTokenId1 = testToken1.id;
  testTokenId2 = testToken2.id;

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
      [0, testTokenId1, testTokenId2],
      [accounts[0], accounts[0], accounts[0]],
      [
        patronageNumerator,
        testToken1.patronageNumerator,
        testToken2.patronageNumerator,
      ],
      [tokenGenerationRate, tokenGenerationRate, tokenGenerationRate]
    );
  });

  it("steward: multi-token. check patronage of two tokens owed by the same patron after 10 minutes.", async () => {
    await waitTillBeginningOfSecond();

    // buy 2 tokens, with prices of 1 ether and 2 ether.
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });
    await steward.buy(testTokenId2, ether("2"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    await time.increase(time.duration.minutes(10));
    // What the smart contracts say should be owed
    const owed1 = await steward.patronageOwedWithTimestamp.call(testTokenId1, {
      from: accounts[2],
    });
    const owed2 = await steward.patronageOwedWithTimestamp.call(testTokenId2, {
      from: accounts[2],
    });
    const owedPatron = await steward.patronageOwedPatronWithTimestamp.call(
      accounts[2],
      { from: accounts[2] }
    );

    // What our functions calculate should be owed
    const priceOfToken1 = await steward.price.call(testTokenId1);
    const priceOfToken2 = await steward.price.call(testTokenId2);
    const expectedPatronageAfter10minToken1 = patronageCalculator("600", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
    const expectedPatronageAfter10minToken2 = patronageCalculator("600", [
      {
        patronageNumerator: testToken2.patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    const expectedPatronageBoth = patronageCalculator("600", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
      {
        patronageNumerator: testToken2.patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);

    assert.equal(
      owed1.patronageDue.toString(),
      expectedPatronageAfter10minToken1.toString()
    );
    assert.equal(
      owed2.patronageDue.toString(),
      expectedPatronageAfter10minToken2.toString()
    );
    assert.equal(
      owedPatron.patronageDue.toString(),
      expectedPatronageBoth.toString()
    );
    assert(true);
  });

  // buy 2 tokens, with prices of 1 ether and 2 ether.
  it("steward: multi-token. check patronage of two tokens owed by the same patron after 10 minutes one of the tokens gets bought.", async () => {
    await waitTillBeginningOfSecond();
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });
    await steward.buy(
      testTokenId2,
      ether("2"),
      web3.utils.toWei("0.1", "ether"),
      {
        from: accounts[2],
        value: web3.utils.toWei("0.1", "ether"),
      }
    );

    await time.increase(time.duration.minutes(10));
    // What the blockchain calculates
    const owed1 = await steward.patronageOwedWithTimestamp.call(testTokenId1, {
      from: accounts[2],
    });
    const owed2 = await steward.patronageOwedWithTimestamp.call(testTokenId2, {
      from: accounts[2],
    });
    const owedPatron = await steward.patronageOwedPatronWithTimestamp.call(
      accounts[2],
      { from: accounts[2] }
    );

    // What we calculate
    const priceOfToken1 = await steward.price.call(testTokenId1);
    const priceOfToken2 = await steward.price.call(testTokenId2);
    const expectedPatronageAfter10minToken1 = patronageCalculator("600", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
    ]);
    const expectedPatronageAfter10minToken2 = patronageCalculator("600", [
      {
        patronageNumerator: testToken2.patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    const expectedPatronageBoth = patronageCalculator("600", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1.toString(),
      },
      {
        patronageNumerator: testToken2.patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    // Token 1 bought
    await steward.buy(
      testTokenId1,
      ether("0.1"),
      web3.utils.toWei("0.1", "ether"),
      {
        from: accounts[3],
        value: ether("1.1"),
      }
    );
    // Time increases
    await time.increase(time.duration.minutes(10));

    const owed1Second = await steward.patronageOwedWithTimestamp.call(
      testTokenId1
    );
    const owed2Second = await steward.patronageOwedWithTimestamp.call(
      testTokenId2,
      { from: accounts[2] }
    );
    const owedPatronSecond = await steward.patronageOwedPatronWithTimestamp.call(
      accounts[2]
    );
    const owedPatron2Second = await steward.patronageOwedPatronWithTimestamp.call(
      accounts[3]
    );

    const priceOfToken1new = await steward.price.call(testTokenId1);
    const expectedPatronageAfter20minToken2 = patronageCalculator("1200", [
      {
        patronageNumerator: testToken2.patronageNumerator.toString(),
        price: priceOfToken2.toString(),
      },
    ]);
    const expectedPatronageAfter20minToken1 = patronageCalculator("600", [
      {
        patronageNumerator: testToken1.patronageNumerator.toString(),
        price: priceOfToken1new.toString(),
      },
    ]);

    assert.equal(
      owed1.patronageDue.toString(),
      expectedPatronageAfter10minToken1.toString()
    );
    assert.equal(
      owed2.patronageDue.toString(),
      expectedPatronageAfter10minToken2.toString()
    );
    assert.equal(
      owedPatron.patronageDue.toString(),
      expectedPatronageBoth.toString()
    );
    // collected double since 20 min
    // Here is the issue, when the token is bought from the guy, patronage is only collected on that token.
    // Not on the owner who might own multiple tokens??? V interesting consequences
    assert.equal(
      owed2Second.patronageDue.toString(),
      expectedPatronageAfter20minToken2.toString()
    );
    assert.equal(
      owed1Second.patronageDue.toString(),
      expectedPatronageAfter20minToken1.toString()
    );
    // Should only count since the last clearance (when token 1 was bought)
    assert.equal(
      owedPatronSecond.patronageDue.toString(),
      expectedPatronageAfter10minToken2.toString()
    );
    assert.equal(
      owedPatron2Second.patronageDue.toString(),
      expectedPatronageAfter20minToken1.toString()
    );
  });
});

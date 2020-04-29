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
  const testTokenId1 = 1;
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
    // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(erc721.address, accounts[0]);
    await steward.updateToV2(mintManager.address, [], []);
    await steward.listNewTokens(
      [1],
      [accounts[9]],
      [patronageNumerator],
      [tokenGenerationRate]
    );
  });

  it("steward: admin-change. On admin change, check that only the admin can change the admin address. Also checking withdraw benfactor funds can be called", async () => {
    await waitTillBeginningOfSecond();

    //Buy a token
    await steward.buy(testTokenId1, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("2", "ether"),
    });
    const priceOfToken1 = await steward.price.call(testTokenId1);

    // TEST 1:
    // Checking that when patronage owed is called immediately after a token is bought, nothing returned.
    const owed = await steward.patronageOwed(testTokenId1, {
      from: accounts[5],
    });
    assert.equal(owed, 0);

    // TIME INCREASES 10minutes
    await time.increase(time.duration.minutes(10));

    // TEST 2:
    // Checking that the patronage after 10min returns what is expected by the manual calculator.
    const owed10min = await steward.patronageOwed(testTokenId1, {
      from: accounts[5],
    });
    const expectedPatronageAfter10min = patronageCalculator("600", [
      {
        patronageNumerator: patronageNumerator,
        price: priceOfToken1.toString(),
      },
    ]);
    assert.equal(owed10min.toString(), expectedPatronageAfter10min.toString());

    // TEST 3:
    // Attempting to change the admin of the contract as a non-admin. Should fail
    await expectRevert(
      steward.changeAdmin(accounts[5], { from: accounts[5] }),
      "Not admin"
    );

    // TEST 4:
    // Revert as this account is not a benefactor and has no funds to withdraw. No funds available to withdraw.
    await expectRevert(
      steward.withdrawBenefactorFunds({ from: accounts[5] }),
      "No funds available"
    );

    //Changing the admin
    await steward.changeAdmin(accounts[1], { from: accounts[0] });

    // TEST 5:
    //Checking admin reflected correctly
    const theadmin = await steward.admin.call();
    assert.equal(accounts[1], theadmin);

    // TEST 6:
    // Checking that the patron is not foreclosed if they hold suffcient deposit.
    const result = await steward.foreclosedPatron(accounts[2], {
      from: accounts[0],
    });
    assert.equal(result, false);
  });
});

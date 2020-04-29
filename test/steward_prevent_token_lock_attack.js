const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const {
  waitTillBeginningOfSecond,
  STEWARD_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
  SENT_ATTACKER_CONTRACT_NAME,
} = require("./helpers");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);
const Attacker = artifacts.require(SENT_ATTACKER_CONTRACT_NAME);

// todo: test over/underflows

const TEST_ART_TOKEN_ID = "5";
const TEST_ART_TOKEN_ADDRESS = "0xb2930b35844a230f00e51431acae96fe533b0357";

contract("WildcardSteward fallback to pull mechanism", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  let mintManager;
  let testTokenURI = "test token uri";
  const testTokenId = 1;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
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

    // TODO: use this to make the contract address of the token deterministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(erc721.address, accounts[0], {
      from: accounts[0],
    });
    await steward.updateToV2(mintManager.address, [], [], {
      from: accounts[0],
    });

    await steward.listNewTokens(
      [0, 1, 2],
      [accounts[0], accounts[0], accounts[0]],
      [patronageNumerator, patronageNumerator, patronageNumerator],
      [tokenGenerationRate, tokenGenerationRate, tokenGenerationRate]
    );
  });

  it("steward: buy. Performing payout to the previous owner of deposit, or payment cannot block the transaction.", async () => {
    await waitTillBeginningOfSecond();

    const attacker = await Attacker.new();
    await attacker.buyOnBehalf(steward.address, 1, ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    const depositAbleToWithdrawBefore = await steward.depositAbleToWithdraw(
      attacker.address
    );
    await steward.buy(1, ether("1"), web3.utils.toWei("0.5", "ether"), {
      from: accounts[2],
      value: web3.utils.toWei("1.5", "ether"),
    });
    const depositAbleToWithdrawAfter = await steward.depositAbleToWithdraw(
      attacker.address
    );

    assert.equal(
      depositAbleToWithdrawBefore.add(new BN(ether("1"))).toString(),
      depositAbleToWithdrawAfter.toString(),
      "The deposit before and after + funds earned from token sale should be the same"
    );
  });
  it("steward: withdrawBenefactorFundsTo. if the benefactor has blocked receiving eth, the transaction should revert.", async () => {
    await waitTillBeginningOfSecond();

    const attacker = await Attacker.new();

    await steward.listNewTokens(
      [3],
      [attacker.address],
      [patronageNumerator],
      [tokenGenerationRate]
    );

    await steward.buy(3, ether("1"), ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    await time.increase(time.duration.minutes(10));

    await steward._collectPatronage(3);

    const benefactorFunds = await steward.benefactorFunds(attacker.address);
    assert(
      benefactorFunds.gt(new BN(0)),
      "the benefactor must have more than 0 wei available to withdraw"
    );

    await expectRevert(
      steward.withdrawBenefactorFundsTo(attacker.address, {
        from: accounts[2],
      }),
      "Unable to withdraw benefactor funds"
    );
  });
  it("steward: withdrawDeposit. if the benefactor has blocked receiving eth, the transaction should revert.", async () => {
    await waitTillBeginningOfSecond();

    const attacker = await Attacker.new();
    await attacker.buyOnBehalf(steward.address, 1, ether("1"), {
      from: accounts[2],
      value: ether("1"),
    });

    await expectRevert(
      attacker.withdrawDeposit(steward.address, "50000", {
        from: accounts[2],
      }),
      "Unable to withdraw deposit"
    );
  });
});

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
  const testTokenId2 = 2;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  const artistAddress = accounts[9]; // Artist is account 9
  const artistCommission = 100; // 1%

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
      [0, 1, 2],
      [accounts[0], accounts[0], accounts[0]],
      [patronageNumerator, patronageNumerator, patronageNumerator],
      [tokenGenerationRate, tokenGenerationRate, tokenGenerationRate],
      [artistAddress, artistAddress, artistAddress],
      [artistCommission, artistCommission, artistCommission],
      [0, 0, 0]
    );
    await steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
      from: accounts[0],
    });
  });

  it("steward: multi-token-deposit. On token buy, check that the remaining deposit is sent back to patron only if it is their only token", async () => {
    await waitTillBeginningOfSecond();

    // There seems to be a very slight error in the math regarding the actual cut wildcards and the artist recieves
    // This is possibly due to the gas fees of calling withdraw from these address.
    // Also the smart contract uses 10000 as the denominator for percentage calc so maybe not completely accurate.
    // We will use a tolerance to check if its an acceptable range
    let tolerance = ether("0.00005"); // $0.01 USD

    //Buying 2 tokens. Setting selling price to 1 and 2 eth respectively. Sending 1 eth each for deposit.
    // 5% wildcards commission
    await steward.buyAuction(testTokenId1, ether("1"), 500, {
      from: accounts[2],
      value: ether("1"),
    });
    // 10% wildcards commission set for sale.
    await steward.buyAuction(testTokenId2, ether("2"), 1000, {
      from: accounts[2],
      value: ether("1"),
    });

    const patronDepositBeforeSale = await steward.deposit.call(accounts[2]);
    const balancePatronBeforeSale = new BN(
      await web3.eth.getBalance(accounts[2])
    );
    // When first token is bought, deposit should remain.
    await steward.buy(testTokenId1, ether("1"), ether("1"), 500, {
      from: accounts[3],
      value: ether("2"),
    });

    const patronDepositAfterFirstSale = await steward.deposit.call(accounts[2]);
    const balancePatronAfterFirstSale = new BN(
      await web3.eth.getBalance(accounts[2])
    );

    // 1% to artist and 5% to wildcards on this token.
    assert.equal(
      patronDepositAfterFirstSale.toString(),
      patronDepositBeforeSale.add(ether("0.94")).toString(),
      "Deposit should be 94% of original, since 5% + 1% went to wildcards and the artist respectively."
    );

    assert.equal(
      balancePatronBeforeSale.toString(),
      balancePatronAfterFirstSale.toString()
    );

    const artistDepositAfterFirstSale = await steward.deposit.call(accounts[9]);
    assert.equal(
      artistDepositAfterFirstSale.toString(),
      ether("0.01").toString()
    );

    const wildcardsDepositAfterFirstSale = await steward.deposit.call(
      accounts[0]
    );
    assert.equal(
      wildcardsDepositAfterFirstSale.toString(),
      ether("0.05").toString(),
      "wildcards deposit should be 5% of the sale"
    );

    //Second token then bought. Deposit should now be added back the patrons balance
    await steward.buy(testTokenId2, ether("1"), ether("1"), 500, {
      from: accounts[3],
      value: ether("3"),
    });

    const balancePatronAfterSecondSale = new BN(
      await web3.eth.getBalance(accounts[2])
    );
    const patronDepositAfterSecondSale = await steward.deposit.call(
      accounts[2]
    );

    //Checking once no more tokens are owned, the deposit is set to zero
    assert.equal(patronDepositAfterSecondSale.toString(), "0");
    //Checking owner gets deposit back on sale of final token plus sale price too.
    assert.equal(
      balancePatronAfterSecondSale.toString(),
      balancePatronAfterFirstSale
        .add(ether("1.78"))
        .add(patronDepositAfterFirstSale)
        .toString(),
      "The user should get back their full deposit + sale price on last token sale."
    );

    const balanceArtistBeforeWithdraw = new BN(
      await web3.eth.getBalance(accounts[9])
    );

    const artistDepositAfterSecondSale = await steward.deposit.call(
      accounts[9]
    );
    assert.equal(
      artistDepositAfterSecondSale.toString(),
      ether("0.03").toString()
    );

    await steward.withdrawDeposit(ether("0.03"), {
      from: accounts[9],
      gasPrice: 0,
    });

    const balanceArtistAfterWithdraw = new BN(
      await web3.eth.getBalance(accounts[9])
    );

    assert.equal(
      balanceArtistBeforeWithdraw.toString(),
      balanceArtistAfterWithdraw.sub(ether("0.03")).toString(),
      "Artist should have received their 1% of the sales and be able to withdraw it."
    );

    const wildcardsDepositAfterSecondSale = await steward.deposit.call(
      accounts[0]
    );

    assert.equal(
      wildcardsDepositAfterSecondSale.toString(),
      ether("0.25").toString(),
      "Deposit for wildcards is incorrect after the first sale."
    );
  });
});

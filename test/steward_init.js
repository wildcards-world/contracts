const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const {
  STEWARD_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
} = require("./helpers");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);
contract("WildcardSteward", (accounts) => {
  let erc721;
  let steward;
  let mintManager;
  let erc20;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  const testTokenURI = "https://wildcards.xyz/token/";
  const artistAddress = accounts[9];
  const artistCommission = 0;

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
      [0],
      [accounts[0]],
      [patronageNumerator],
      [tokenGenerationRate],
      [artistAddress],
      [artistCommission]
    );
  });

  it("steward: init: erc721 minted", async () => {
    const currentOwner = await erc721.ownerOf.call(0);
    const uri = await erc721.tokenURI(0);
    assert.equal(uri, testTokenURI + "0");
    assert.equal(steward.address, currentOwner);
  });

  it("steward: listNewTokens: check that listing tokens generates the correct tokenURI", async () => {
    // NOTE: we could use a random number generator here, but we believe doing this by hand is sufficient evidence that this fuctionality works.
    const tokenIds = [
      "26",
      "33324444",
      "1769037077935057",
      "286700889698437237620075",
      "18996005233289629730294425308525",
      "7895270375841100968424756332558931212197",
      "99882326602754898771367107404518635245937227489",
      "20670427203223984744762315785080106542564404236226800687",
      "6721545738199856672125269086653289604269900124564247972084560669",
      "68034364559224586973560982971221276958307785832542578123533166765643299",
      // 2^256 is about 1.15×10^77
      "11224654786246821497865432975865479321456778185497321954776584625778642653489",
    ];
    const numberOfTokens = tokenIds.length;
    await steward.listNewTokens(
      tokenIds,
      Array(numberOfTokens).fill(accounts[0]),
      Array(numberOfTokens).fill(patronageNumerator),
      Array(numberOfTokens).fill(tokenGenerationRate),
      Array(numberOfTokens).fill(artistAddress),
      Array(numberOfTokens).fill(artistCommission)
    );
    for (let i = 0; i < tokenIds.length; ++i) {
      const tokenId = tokenIds[i];
      const currentOwner = await erc721.ownerOf.call(tokenId);
      const uri = await erc721.tokenURI(tokenId);
      assert.equal(uri, testTokenURI + tokenId);
      assert.equal(steward.address, currentOwner);
    }
  });

  // Can they still add deposit if it is foreclose? Since they only technically lose ownership on the
  // next collect patronage event?
  it("steward: init: deposit wei fail [foreclosed or don't own any tokens]", async () => {
    await expectRevert(
      steward.depositWei({
        from: accounts[2],
        value: ether("1"),
      }),
      "No tokens owned"
    );
  });

  it("steward: init: wait time. deposit wei fail [foreclosed]", async () => {
    await time.increase(1000); // 1000 seconds, arbitrary
    await expectRevert(
      steward.depositWei({
        from: accounts[2],
        value: ether("1"),
      }),
      "No tokens owned"
    );
  });

  it("steward: init: change price fail [not patron]", async () => {
    await expectRevert(
      steward.changePrice(0, 500, { from: accounts[2] }),
      "Not patron"
    );
  });

  it("steward: init: collect 0 patronage.", async () => {
    const totalBefore = await steward.totalCollected.call(1);
    await time.increase(1000); // 1000 seconds, arbitrary
    await steward._collectPatronage(1, { from: accounts[2] });
    const totalAfter = await steward.totalCollected.call(1);
    assert.equal(totalBefore.toString(), totalAfter.toString());
  });

  it("steward: init: buy with 1 ether but 0 price [fail on price]", async () => {
    await expectRevert(
      steward.buy(0, 0, web3.utils.toWei("0", "ether"), 500, {
        from: accounts[2],
        value: ether("1"),
      }),
      "Price is zero"
    );
  });

  // This doesn't fail if you don't set the auction price!
  // But this should never be an issue as intial token price should never be 0
  // and therefore safemath will prevent this. See next test.
  it("steward: init: buyAuction with zero wei [fail payable]", async () => {
    await steward.buyAuction(0, 1000, 500, {
      from: accounts[2],
      value: web3.utils.toWei("0", "ether"),
    });
  });

  it("steward: init: buyAuction with zero wei [fail payable]", async () => {
    await steward.changeAuctionParameters(ether("1"), ether("0.05"), 86400, {
      from: accounts[0],
    });

    await expectRevert(
      steward.buyAuction(0, 1000, 500, {
        from: accounts[2],
        value: web3.utils.toWei("0", "ether"),
      }),
      "SafeMath: subtraction overflow."
    );
  });

  it("steward: init: buyAuction with 1 ether but 0 price [fail on price]", async () => {
    await expectRevert(
      steward.buyAuction(0, 0, 500, {
        from: accounts[2],
        value: ether("1"),
      }),
      "Price is zero"
    );
  });

  it("steward: init: Cannot buy foreclosed token using normal buy function", async () => {
    await expectRevert(
      steward.buy(0, ether("1"), ether("1"), 500, {
        from: accounts[2],
        value: ether("1"),
      }),
      "Cannot buy foreclosed token using this function"
    );
  });

  it("steward: init: Cannot buy normal token using foreclosed buy function", async () => {
    await steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
      from: accounts[0],
    });
    await steward.buyAuction(0, ether("1"), 500, {
      from: accounts[2],
      value: ether("1"),
    });

    await expectRevert(
      steward.buyAuction(0, ether("1"), 500, {
        from: accounts[2],
        value: ether("2"),
      }),
      "Can only buy foreclosed tokens useing this function"
    );
  });

  it("steward: init: buy with 2 ether, price of 1 success [price = 1 eth, deposit = 1 eth]", async () => {
    await steward.changeAuctionParameters(ether("0"), ether("0"), 86400, {
      from: accounts[0],
    });

    const { logs } = await steward.buyAuction(0, ether("1"), 500, {
      from: accounts[2],
      value: ether("1"),
    });
    expectEvent.inLogs(logs, "Buy", { owner: accounts[2], price: ether("1") });
    const deposit = await steward.deposit.call(accounts[2]);
    const price = await steward.price.call(0);
    const state = await steward.state.call(0);
    assert.equal(deposit.toString(), ether("1").toString());
    assert.equal(price.toString(), ether("1").toString());
    assert.equal(state, 1);
  });

  it("steward: init: cannot buy nonexistent token", async () => {
    await steward.changeAuctionParameters(ether("1"), ether("0.05"), 86400, {
      from: accounts[0],
    });
    await expectRevert(
      steward.buyAuction(5, ether("1"), 500, {
        from: accounts[2],
        value: ether("2"),
      }),
      "owner query for nonexistent token"
    );
  });
});

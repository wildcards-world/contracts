const { expectRevert, ether, time } = require("@openzeppelin/test-helpers");
const {
  multiPatronageCalculator,
  initialize,
  isCoverage,
} = require("./helpers");

const patronageCalculator = multiPatronageCalculator();

contract("WildcardSteward admin change", (accounts) => {
  let erc721;
  let steward;
  const testTokenId1 = 1;
  const patronageNumerator = "12000000000000";
  const tokenGenerationRate = 10; // should depend on token
  const benefactorAddress = accounts[8];
  const artistAddress = accounts[9];
  const withdrawCheckerAdmin = accounts[6];
  const artistCommission = 0;
  const admin = accounts[0];
  const animalDetails = [
    {
      token: "1",
      benefactor: benefactorAddress,
      patronageNumerator,
      artist: artistAddress,
      artistCommission,
      releaseDate: Math.round(new Date().getTime() / 1000),
    },
  ];

  beforeEach(async () => {
    const result = await initialize(
      admin,
      withdrawCheckerAdmin,
      ether("1"),
      ether("0.05"),
      86400,
      animalDetails,
      [accounts[2]]
    );
    erc721 = result.erc721;
    erc20 = result.erc20;
    steward = result.steward;
    mintManager = result.mintManager;
  });

  it("steward: admin-change. On admin change, check that only the admin can change the admin address. Also checking withdraw benfactor funds can be called", async () => {
    //Buy a token
    await steward.buyAuction(testTokenId1, ether("1"), 50000, ether("1"), {
      from: accounts[2],
      // value: ether("2", "ether"),
    });
    const priceOfToken1 = await steward.price.call(testTokenId1);

    // TEST 1:
    // Checking that when patronage owed is called immediately after a token is bought, nothing returned.
    const owed = await steward.patronageOwedPatron(accounts[2], {
      from: accounts[5],
    });
    assert.equal(owed, 0);

    // TIME INCREASES 10minutes
    await time.increase(time.duration.minutes(10));

    // TEST 2:
    // Checking that the patronage after 10min returns what is expected by the manual calculator.
    const owed10min = await steward.patronageOwedPatron(accounts[2], {
      from: accounts[5],
    });
    const expectedPatronageAfter10min = patronageCalculator("600", [
      {
        patronageNumerator: patronageNumerator,
        price: priceOfToken1.toString(),
      },
    ]);

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
      "no funds"
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

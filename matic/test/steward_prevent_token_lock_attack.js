// NOTE: NOT USED FOR ERC20 tokens

// const { BN, expectRevert, ether, time } = require("@openzeppelin/test-helpers");
// const {
//   initialize,
//   setupTimeManager,
//   patronageDue,
//   withdrawBenefactorFundsAll,
//   isCoverage,
//   SENT_ATTACKER_CONTRACT_NAME,
// } = require("./helpers");

// const Attacker = artifacts.require(SENT_ATTACKER_CONTRACT_NAME);

// contract("WildcardSteward fallback to pull mechanism", (accounts) => {
//   let steward;
//   const patronageNumerator = "12000000000000";
//   const tokenGenerationRate = 10; // should depend on token
//   // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
//   const artistAddress = accounts[9];
//   const artistCommission = 0;

//   const benefactorAddress = accounts[8];
//   const withdrawCheckerAdmin = accounts[6];
//   const admin = accounts[0];
//   const zeroEther = ether("0");
//   const auctionEndPrice = zeroEther;
//   const auctionStartPrice = zeroEther;
//   const auctionDuration = new BN(86400);
//   const tokenDefaults = {
//     benefactor: benefactorAddress,
//     patronageNumerator,
//     artist: artistAddress,
//     artistCommission,
//     releaseDate: 0,
//     tokenGenerationRate: 1,
//   };
//   const tokenDetails = [
//     {
//       ...tokenDefaults,
//       token: "0",
//     },
//     {
//       ...tokenDefaults,
//       token: "1",
//     },
//     {
//       ...tokenDefaults,
//       token: "2",
//     },
//   ];
//   let setNextTxTimestamp,
//     timeSinceTimestamp,
//     getCurrentTimestamp,
//     timeSince,
//     txTimestamp,
//     withdrawMaxPermissioned,
//     setTimestamp;

//   before(async () => {
//     const timeManager = await setupTimeManager(web3);
//     setNextTxTimestamp = timeManager.setNextTxTimestamp; // takes in duration
//     timeSinceTimestamp = timeManager.timeSinceTimestamp; // takes in old timestamp, returns current time
//     getCurrentTimestamp = timeManager.getCurrentTimestamp; // returns timestamp of a given transaction
//     timeSince = timeManager.timeSince; // returns interval between two timestamps
//     txTimestamp = timeManager.txTimestamp; // returns timestamp of a given transaction
//     setTimestamp = async (duration) => {
//       await timeManager.setNextTxTimestamp(duration);
//       await web3.eth.sendTransaction({
//         from: accounts[5],
//         to: accounts[5],
//         value: "0",
//       });
//     };
//     withdrawMaxPermissioned = async (benefactor) =>
//       withdrawBenefactorFundsAll(
//         steward,
//         web3,
//         withdrawCheckerAdmin,
//         benefactor,
//         ether("100").toString(),
//         (await getCurrentTimestamp()).add(new BN(100000000)).toString(),
//         accounts[0]
//       );
//   });

//   beforeEach(async () => {
//     const result = await initialize(
//       admin,
//       withdrawCheckerAdmin,
//       auctionStartPrice,
//       auctionEndPrice,
//       auctionDuration,
//       tokenDetails
//     );
//     steward = result.steward;
//   });

//   it("steward: buy. Performing payout to the previous owner of deposit, or payment cannot block the transaction.", async () => {
//     const attacker = await Attacker.new();
//     await attacker.buyOnBehalf(
//       steward.address,
//       tokenDetails[0].token,
//       ether("1"),
//       {
//         from: accounts[2],
//         value: ether("1"),
//       }
//     );

//     const depositAbleToWithdrawBefore = await steward.depositAbleToWithdraw(
//       attacker.address
//     );
//     await steward.buy(tokenDetails[0].token, ether("1"), ether("1"), 50000, {
//       from: accounts[2],
//       value: web3.utils.toWei("1.5", "ether"),
//     });
//     const depositAbleToWithdrawAfter = await steward.depositAbleToWithdraw(
//       attacker.address
//     );

//     const expectedPatronageAfterFirstSale = patronageDue([
//       {
//         timeHeld: 1,
//         patronageNumerator: tokenDetails[0].patronageNumerator,
//         price: ether("1"),
//       },
//     ]);

//     if (!isCoverage)
//       assert.equal(
//         depositAbleToWithdrawBefore.add(ether("0.95")).toString(), //6% artist and wildcards default cut
//         depositAbleToWithdrawAfter
//           .add(expectedPatronageAfterFirstSale)
//           .toString(),
//         "The deposit before and after + funds earned from token sale should be the same"
//       );
//   });
//   it("steward: withdrawBenefactorFundsTo. if the benefactor has blocked receiving eth, the transaction should go through but the balance should be added to the benefactorFunds.", async () => {
//     const attacker = await Attacker.new();

//     await steward.listNewTokens(
//       [3],
//       [attacker.address],
//       [patronageNumerator],
//       [artistAddress],
//       [artistCommission],
//       [0]
//     );

//     await steward.buyAuction(3, ether("1"), 50000, {
//       from: accounts[2],
//       value: ether("1"),
//     });

//     await setNextTxTimestamp(time.duration.minutes(10));

//     await steward._collectPatronageAndSettleBenefactor(3);
//     await steward._updateBenefactorBalance(attacker.address);

//     const benefactorFunds = await steward.benefactorFunds.call(
//       attacker.address
//     );
//     assert(
//       benefactorFunds.gt(new BN(0)),
//       "the benefactor must have more than 0 wei available to withdraw"
//     );

//     await withdrawMaxPermissioned(attacker.address);
//     const benefactorFundsAfter = await steward.benefactorFunds.call(
//       attacker.address
//     );

//     const expectedPatronageFor1Second = patronageDue([
//       {
//         timeHeld: 1,
//         patronageNumerator: patronageNumerator,
//         price: ether("1"),
//       },
//     ]);
//     if (!isCoverage)
//       assert.equal(
//         benefactorFunds.toString(),
//         benefactorFundsAfter.sub(expectedPatronageFor1Second).toString(),
//         "benefactor funds should be unchanged"
//       );
//   });

//   it("steward: withdrawDeposit. if the benefactor has blocked receiving eth, the transaction should revert.", async () => {
//     const attacker = await Attacker.new();
//     await attacker.buyOnBehalf(
//       steward.address,
//       tokenDetails[0].token,
//       ether("1"),
//       {
//         from: accounts[2],
//         value: ether("1"),
//       }
//     );

//     await expectRevert(
//       attacker.withdrawDeposit(steward.address, "50000", {
//         from: accounts[2],
//       }),
//       "withdrawal failed"
//     );
//   });
// });

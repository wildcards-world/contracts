const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");
const { promisify } = require("util");
const {
  waitTillBeginningOfSecond,
  setupTimeManager,
  patronageDue,
  STEWARD_CONTRACT_NAME,
  ERC20_CONTRACT_NAME,
  ERC721_CONTRACT_NAME,
  MINT_MANAGER_CONTRACT_NAME,
} = require("./helpers");
// TODO: switch to the ethersjs version, for future typescript support? https://www.npmjs.com/package/@ethersproject/abi
const abi = require("ethereumjs-abi");

const ERC721token = artifacts.require(ERC721_CONTRACT_NAME);
const WildcardSteward = artifacts.require(STEWARD_CONTRACT_NAME);
const ERC20token = artifacts.require(ERC20_CONTRACT_NAME);
const MintManager = artifacts.require(MINT_MANAGER_CONTRACT_NAME);

// todo: test over/underflows

// const withdrawBenefactorFundsAll = async (
//   steward,
//   web3,
//   withdrawCheckerAdmin,
//   benefactor,
//   maxAmount,
//   expiry
// ) => {
//   //   function withdrawBenefactorFundsToValidated(
//   //     address payable benefactor,
//   //     uint256 maxAmount,
//   //     uint256 expiry,
//   //     bytes32 hash,
//   //     uint8 v,
//   //     bytes32 r,
//   //     bytes32 s
//   // ) public {

//   // // returns the encoded binary (as a Buffer) data to be sent
//   // var encoded = abi.rawEncode([ "address" ], [ "0x0000000000000000000000000000000000000000" ])

//   // recipient is the address that should be paid.
//   // amount, in wei, specifies how much ether should be sent.
//   // nonce can be any unique number to prevent replay attacks
//   // contractAddress is used to prevent cross-contract replay attacks
//   const hash =
//     "0x" +
//     abi
//       .soliditySHA3(
//         ["address", "uint256", "uint256"],
//         [benefactor, maxAmount, expiry]
//       )
//       .toString("hex");

//   const signature = await promisify(
//     web3.eth.personal.sign(hash, withdrawCheckerAdmin)
//   );

//   console.log("signature", { signature });

//   const r = signature.slice(0, 66);
//   const s = "0x" + signature.slice(66, 130);
//   const v = web3.toDecimal("0x" + signature.slice(130, 132)) + 27;

//   // this prefix is required by the `ecrecover` builtin solidity function (other than that it is pretty arbitrary)
//   const prefix = "\x19Ethereum Signed Message:\n32";
//   const prefixedBytes = web3.fromAscii(prefix) + hash.slice(2);
//   const prefixedHash = web3.sha3(prefixedBytes, { encoding: "hex" });

//   await steward.withdrawBenefactorFundsToValidated(
//     benefactor,
//     maxAmount,
//     expiry,
//     prefixedHash,
//     v,
//     r,
//     s,
//     {
//       from: benefactor,
//       gasPrice: "0", // Set gas price to 0 for simplicity
//     }
//   );
// };

contract("WildcardSteward Benefactor collection", (accounts) => {
  let erc721;
  let steward;
  let erc20;
  let mintManager;
  const patronageNumerator = "12000000000000";
  const patronageDenominator = "1000000000000";
  const tokenGenerationRate = 10; // should depend on token
  // price * amountOfTime * patronageNumerator/ patronageDenominator / 365 days;
  const artistAddress = accounts[9];
  const artistCommission = 0;

  const tenMinPatronageAt1Eth = ether("1")
    .mul(new BN("600"))
    .mul(new BN("12"))
    .div(new BN("1"))
    .div(new BN("31536000"));

  const admin = accounts[0];
  const benefactor1 = accounts[1];
  const benefactor2 = accounts[2];
  const patron1 = accounts[3];
  const patron2 = accounts[4];
  const withdrawCheckerAdmin = accounts[10];
  let setNextTxTimestamp,
    timeSinceTimestamp,
    getCurrentTimestamp,
    timeSince,
    txTimestamp;

  before(async () => {
    const timeManager = await setupTimeManager(web3);
    setNextTxTimestamp = timeManager.setNextTxTimestamp; // takes in duration
    timeSinceTimestamp = timeManager.timeSinceTimestamp; // takes in old timestamp, returns current time
    getCurrentTimestamp = timeManager.getCurrentTimestamp; // returns current time
    timeSince = timeManager.timeSince; // returns interval between two timestamps
    txTimestamp = timeManager.txTimestamp; // returns current time
  });

  beforeEach(async () => {
    erc721 = await ERC721token.new({ from: admin });
    steward = await WildcardSteward.new({ from: admin });
    mintManager = await MintManager.new({ from: admin });
    erc20 = await ERC20token.new("Wildcards Loyalty Token", "WLT", 18, {
      from: admin,
    });
    await mintManager.initialize(admin, steward.address, erc20.address, {
      from: admin,
    });
    await erc721.setup(
      steward.address,
      "ALWAYSFORSALETestToken",
      "AFSTT",
      admin,
      { from: admin }
    );
    await erc721.addMinter(steward.address, { from: admin });
    await erc721.renounceMinter({ from: admin });
    await erc20.addMinter(mintManager.address, {
      from: admin,
    });
    await erc20.renounceMinter({ from: admin });

    // TODO: use this to make the contract address of the token deterministic: https://ethereum.stackexchange.com/a/46960/4642
    await steward.initialize(
      erc721.address,
      admin,
      mintManager.address,
      0 /* auction start price: Set to zero for testing purposes*/,
      ether("0") /* auction end price: set this too high for the tests */,
      time.duration.days(
        1
      ) /* auction length; Set to 1 day, its minumum value for testing purposes*/
    );

    await steward.listNewTokens(
      [0, 1, 2, 3, 4],
      [benefactor1, benefactor1, benefactor1, benefactor2, benefactor2],
      [
        patronageNumerator,
        patronageNumerator,
        patronageNumerator,
        patronageNumerator,
        patronageNumerator,
      ],
      [
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
        tokenGenerationRate,
      ],
      [
        artistAddress,
        artistAddress,
        artistAddress,
        artistAddress,
        artistAddress,
      ],
      [
        artistCommission,
        artistCommission,
        artistCommission,
        artistCommission,
        artistCommission,
      ],
      [0, 0, 0, 0, 0]
    );
    await steward.changeAuctionParameters("0", "0", 86400, {
      from: admin,
    });
  });

  it("steward: benefactor withdrawal. A token is owned for 1 year.", async () => {
    const tokenPrice = ether("0.01");
    const deposit = ether("0.5");
    await steward.buyAuction(1, tokenPrice, 500, {
      from: accounts[2],
      value: deposit,
    });

    let timestampBefore = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;

    const balTrack = await balance.tracker(benefactor1);
    await setNextTxTimestamp(time.duration.days(365));

    // await steward.withdrawBenefactorFundsAll(
    //   steward,
    //   web3,
    //   withdrawCheckerAdmin,
    //   benefactor,
    //   ether(100),
    //   new BN(timestampBefore).add(new BN(1000)),
    //   {
    //     from: benefactor1,
    //     gasPrice: "0", // Set gas price to 0 for simplicity
    //   }
    // );
    await steward.withdrawBenefactorFunds({
      from: benefactor1,
      gasPrice: "0", // Set gas price to 0 for simplicity
    });
    // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
    const due = tokenPrice
      .mul(time.duration.days(365))
      .mul(new BN(patronageNumerator))
      .div(new BN(patronageDenominator))
      .div(time.duration.days(365));

    assert.equal((await balTrack.delta()).toString(), due.toString());
  });

  // it("steward: benefactor withdrawal. A token is owned for 1 year.", async () => {
  //   const tokenPrice = ether("0.01");
  //   const deposit = ether("0.5");
  //   await steward.buyAuction(1, tokenPrice, 500, {
  //     from: accounts[2],
  //     value: deposit,
  //   });

  //   let timestampBefore = (
  //     await web3.eth.getBlock(await web3.eth.getBlockNumber())
  //   ).timestamp;

  //   const balTrack = await balance.tracker(benefactor1);
  //   await setNextTxTimestamp(time.duration.days(365));

  //   await steward.withdrawBenefactorFunds({
  //     from: benefactor1,
  //     gasPrice: "0", // Set gas price to 0 for simplicity
  //   });

  //   // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
  //   const due = tokenPrice
  //     .mul(time.duration.days(365))
  //     .mul(new BN(patronageNumerator))
  //     .div(new BN(patronageDenominator))
  //     .div(time.duration.days(365));

  //   assert.equal((await balTrack.delta()).toString(), due.toString());
  // });

  describe("steward: benefactor withdrawal with token foreclosure", async () => {
    it("steward: benefactor withdrawal. A token is owned for 20 minutes, but forecloses after 10 minutes. The organisation withdraws their after 20 minutes.", async () => {
      const tokenPrice = ether("1");
      const deposit = tenMinPatronageAt1Eth;
      const buyToken2Timestamp = await txTimestamp(
        steward.buyAuction(1, tokenPrice, 500, {
          from: patron2,
          value: deposit.mul(new BN(10)),
        })
      );

      const buyToken1Timestamp = await txTimestamp(
        steward.buyAuction(0, tokenPrice, 500, {
          from: patron1,
          value: deposit,
        })
      );

      const token1ForeclosureTime = await steward.foreclosureTime.call(0);
      assert.equal(
        token1ForeclosureTime.toString(),
        buyToken1Timestamp.add(new BN(time.duration.minutes(10))).toString(),
        "foreclosure time should be 10 minutes after purchase"
      );

      const balTrack = await balance.tracker(benefactor1);
      const withdrawBenefactorFundstimestamp = await setNextTxTimestamp(
        time.duration.minutes(20)
      );
      await steward.withdrawBenefactorFunds({
        from: benefactor1,
        gasPrice: "0", // Set gas price to 0 for simplicity
      });

      // price * (now - timeLastCollected) * patronageNumerator/ patronageDenominator / 365 days;
      // TODO: create a function
      const totalDue = patronageDue([
        {
          price: tokenPrice,
          timeHeld: await timeSinceTimestamp(buyToken1Timestamp),
          patronageNumerator,
        },
        {
          price: tokenPrice,
          timeHeld: await timeSinceTimestamp(buyToken2Timestamp),
          patronageNumerator,
        },
      ]);

      assert.equal((await balTrack.delta()).toString(), totalDue.toString());

      const benefactorCreditBefore = await steward.benefactorCredit.call(
        benefactor1
      );
      const benefactorFundsBefore = await steward.benefactorFunds.call(
        benefactor1
      );
      const tokenPriceBefore = await steward.price.call("0");
      const patronScaledCostBefore = await steward.totalPatronOwnedTokenCost.call(
        patron1
      );
      const benefactorScaledCostBefore = await steward.benefactorTotalTokenNumerator.call(
        benefactor1
      );
      // After calling collect patronage a credit should reflect. tenMinPatronageAt1Eth
      await steward._collectPatronage(0);
      const benefactorCreditAfter = await steward.benefactorCredit.call(
        benefactor1
      );
      const benefactorFundsAfter = await steward.benefactorFunds.call(
        benefactor1
      );
      const tokenPriceAfter = await steward.price.call("0");
      const potronScaledCostAfter = await steward.totalPatronOwnedTokenCost.call(
        patron1
      );
      const benefactorScaledCostAfter = await steward.benefactorTotalTokenNumerator.call(
        benefactor1
      );

      assert.equal(
        "0",
        benefactorCreditBefore.toString(),
        "benefactor shouldn't have credit before token forecloses"
      );
      assert.equal(
        benefactorCreditAfter.toString(),
        tenMinPatronageAt1Eth.toString(),
        "benefactor should have correct credit after token is foreclosed"
      );
      assert.equal(
        benefactorFundsBefore.toString(),
        "0",
        "benefactor should start with a balance of zero"
      );
      assert.equal(
        patronScaledCostBefore.toString(),
        tokenPrice.mul(new BN(patronageNumerator)).toString(),
        "benefactor funds should stay zero"
      );
      assert.equal(
        benefactorFundsAfter.toString(),
        "0",
        "benefactor funds should stay zero"
      );
      assert.equal(
        tokenPriceBefore.toString(),
        tokenPriceAfter.toString(),
        "The token price shouldn't change"
      );
      assert.equal(
        "0",
        potronScaledCostAfter.toString(),
        "The patrons scaled cost should reset to zero when token forecloses"
      );
      assert.equal(
        benefactorScaledCostBefore.toString(),
        benefactorScaledCostAfter.mul(new BN(2)).toString(),
        "The benefactor scaled cost should be half (since half the tokens were foreclosed)"
      );

      const balTrack2 = await balance.tracker(benefactor1);
      await setNextTxTimestamp(time.duration.minutes(40));

      // the amount of credit should be tenMinPatronageAt1Eth;
      // the extra amount available to withdraw should be 3 * tenMinPatronageAt1Eth;

      // the error is the available to withdraw is at 1826484018264840 (8 * tenMinPatronageAt1Eth)
      // Since the foreclosure of token 1 is not Recognized here.
      await steward.withdrawBenefactorFunds({
        from: benefactor1,
        gasPrice: "0", // Set gas price to 0 for simplicity
      });

      const amountDueForToken2inSecondWithdrawal = patronageDue([
        {
          price: tokenPrice,
          timeHeld: await timeSinceTimestamp(withdrawBenefactorFundstimestamp),
          patronageNumerator,
        },
      ]);

      const totalDueInSecondWithdrawal = patronageDue([
        {
          price: tokenPrice,
          timeHeld: await timeSince(
            withdrawBenefactorFundstimestamp,
            token1ForeclosureTime
          ),
          patronageNumerator,
        },
        {
          price: tokenPrice,
          timeHeld: await timeSinceTimestamp(withdrawBenefactorFundstimestamp),
          patronageNumerator,
        },
      ]);

      const changeInBenefactorBalance = (await balTrack2.delta()).toString();
      assert.equal(
        changeInBenefactorBalance,
        totalDueInSecondWithdrawal.toString()
      );
      assert.equal(
        changeInBenefactorBalance,
        amountDueForToken2inSecondWithdrawal
          .sub(benefactorCreditAfter)
          .toString()
      );
    });
  });
});

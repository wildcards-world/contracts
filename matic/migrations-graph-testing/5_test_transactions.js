const WildcardSteward_v2 = artifacts.require("WildcardSteward_matic_v2");
const ERC721Patronage_v1 = artifacts.require("ERC721Patronage_v1");
const Dai = artifacts.require("./DaiMatic.sol");

const { ether, time } = require("@openzeppelin/test-helpers");
const { daiPermitGeneration } = require("../test/helpers");

const testAccountAddress = "0x8c7A88756EbbF46Ede65E4D678359cAC5f08f7b2";

const twentyPercentMonthlyHarbergerTax = "240" + "0000000000"; // Harberger tax rate of 240% per year

let org1 = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
let org2 = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    const steward = await WildcardSteward_v2.deployed();

    const paymentToken = await Dai.deployed();
    if (networkName != "matic") {
      console.log("Set up 6 accts");
      // for each test acc, mint 10,000 and approve steward to spend all of it
      for (var i = 1; i <= 6; i++) {
        await paymentToken.mint(accounts[i], ether("10000"));
        await paymentToken.approve(steward.address, ether("10000"), {
          from: accounts[i],
        });
      }

      console.log("Bunch of simple transactions");
      // e.g. test acc1 buys token 1. The SPgets 50000 (__ %)
      await steward.buyAuction("1", ether("50"), 50000, ether("1000"), {
        from: accounts[1],
      });
     
      await steward.buyAuction("2", ether("55"), 50000, ether("1000"), {
        from: accounts[1],
      });

      await steward.buyAuction("3", ether("60"), 50000, ether("1000"), {
        from: accounts[1],
      });

      await steward.buyAuction("4", ether("65"), 50000, ether("1000"), {
        from: accounts[3],
      });

      await steward.buyAuction("5", ether("70"), 50000, ether("1000"), {
        from: accounts[4],
      });

      await steward.buyAuction("6", ether("75"), 50000, ether("1000"), {
        from: accounts[5],
      });

      console.log("..advance time by one week");
      await time.increase("604800");

      console.log(
        "Acc6 buys all of Acc1's tokens for 10 eth more then their original price"
      );

      await steward.buy("1", ether("60"), ether("50"), 50000, ether("1000"), {
        from: accounts[6],
      });

      await steward.buy("2", ether("65"), ether("55"), 50000, ether("1000"), {
        from: accounts[6],
      });

      await steward.buy("3", ether("70"),ether("60"), 50000, ether("1000"), {
        from: accounts[6],
      });

      console.log("..advance time by one week");
      await time.increase("604800");

      console.log(
        "Acc1 buys token 5 from acc 4 for 100eth where prevPrice was 70eth"
      );
    
      await steward.buy("5", ether("100"), ether("70"), 50000, ether("1000"), {
        from: accounts[1],
      });

      console.log("..advance time by one week");
      await time.increase("604800");

      console.log("Acct 3 adds more deposit");

      await steward.depositWei(ether("50"), {
        from: accounts[3],
      });

      //// All orgs and patrons withdraw all //// 

      console.log("All orgs and patrons withdraw all"); 

      let org1Address = "0x707c0041f6e87411812f9e98fd99c9eddfd0b2a0";
      let org2Address = "0x2b48B87B7d168D0a8b7e1526ff90e10876E46067";
      // let org1Balance = await steward.BenefactorFunds()
      // let org2Balance = await steward.BenefactorFunds()
      console.log(steward.benefactorFunds(org1Address).toString());
      
      // await steward.withdrawBenefactorFunds(ether(org1Balance.toString()), {
      //   from: org1Address,
      // });

      // await steward.withdrawBenefactorFunds(ether(org2Balance.toString()), {
      //   from: org2Address,
      // });

      // iterate through all user accts and withdrawDeposit 
      for (var i = 1; i <= 6; i++) {
        let userDeposit = await steward.deposit(accounts[i]); 
        await steward.withdrawDeposit(userDeposit.toString(), {
          from: accounts[i],
        });
      }

      //// logging //// 

      // just to check: iterate through all user accts and print out the balance 
      for (var i = 1; i <= 6; i++) {
        let userDeposit = await steward.deposit(accounts[i]); 
        console.log(`account ${i} with address ${accounts[i]}'s deposit remaining is: `, userDeposit.toString());
      }

      //print out the currPrice of all tokens
      for (var i = 1; i <= 6; i++) {
        let tokenPrice = await steward.price(i); 
        console.log(`token ${i}'s price is:`, tokenPrice.toString()); 
      }

    }
    const stewardAddress = steward.address;
    const daiAddress = paymentToken.address;
    console.log(`let verifyingContract = "${daiAddress}";
      let spender = "${stewardAddress}";`);
  });
};

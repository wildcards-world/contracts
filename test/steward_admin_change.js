const { BN, expectRevert, ether, expectEvent, balance, time } = require('@openzeppelin/test-helpers');
const { multiPatronageCalculator } = require('./helpers')

const Artwork = artifacts.require('./ERC721Patronage_v0.sol');
const WildcardSteward = artifacts.require('./WildcardSteward_v0.sol');

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

// NOTE:: This was inspired by this question and the off by one second errors I was getting:
// https://ethereum.stackexchange.com/a/74558/4642
const waitTillBeginningOfSecond = () => new Promise(resolve => {
    const timeTilNextSecond = 1000 - new Date().getMilliseconds()
    setTimeout(resolve, timeTilNextSecond)
})

const PATRONAGE_DENOMINATOR = '1'
const patronageCalculator = multiPatronageCalculator(PATRONAGE_DENOMINATOR)

contract('WildcardSteward owed', (accounts) => {
    let artwork;
    let steward;
    const testTokenId1 = 1
    const patronageNumerator = 12;
    const patronageDenominator = 1;
    let testTokenURI = 'test token uri'

    beforeEach(async () => {
        artwork = await Artwork.new({ from: accounts[0] });
        steward = await WildcardSteward.new({ from: accounts[0] });
        await artwork.setup(steward.address, "ALWAYSFORSALETestToken", "AFSTT", accounts[0], { from: accounts[0] })
        await artwork.mintWithTokenURI(steward.address, 1, testTokenURI, { from: accounts[0] })
        // TODO: use this to make the contract address of the token deturministic: https://ethereum.stackexchange.com/a/46960/4642
        await steward.initialize(artwork.address, accounts[0], patronageDenominator)
        await steward.listNewTokens([1], [accounts[9]], [patronageNumerator])
    })

    it('steward: admin-management. On admin change, check that only the admin can change the admin address. Also checking withdraw benfactor funds can be called', async () => {
        await waitTillBeginningOfSecond()

        //Buy a token
        await steward.buy(testTokenId1, web3.utils.toWei('1', 'ether'), { from: accounts[2], value: web3.utils.toWei('1', 'ether') });
        const priceOfToken1 = await steward.price.call(testTokenId1)

        // TEST 1:
        // Checking that when patronage owed is called immediately after a token is bought, nothing returned.
        const owed = await steward.patronageOwed(testTokenId1, { from: accounts[5] })
        assert.equal(owed, 0);

        // TIME INCREASES 10minutes
        await time.increase(time.duration.minutes(10));

        // TEST 2:
        // Checking that the patronage after 10min returns what is expected by the manual calculator.
        const owed10min = await steward.patronageOwed(testTokenId1, { from: accounts[5] })
        const expectedPatronageAfter10min = patronageCalculator('600',
            [{ patronageNumerator: patronageNumerator, price: priceOfToken1.toString() }])
        assert.equal(owed10min.toString(), expectedPatronageAfter10min.toString());

        // TEST 3:
        // Attempting to change the admin of the contract as a non-admin. Should fail
        await expectRevert(steward.changeAdmin(accounts[5], { from: accounts[5] }), "Not admin");

        // TEST 4:
        // Revert as this account is not a benefactor and has no funds to withdraw. No funds available to withdraw.
        await expectRevert(steward.withdrawBenefactorFunds({ from: accounts[5] }), "No funds available");

        //Changing the admin
        await steward.changeAdmin(accounts[1], { from: accounts[0] });

        // TEST 5:
        //Checking admin reflected correctly
        const theadmin = await steward.admin.call()
        assert.equal(accounts[1], theadmin);

        // TEST 6:
        // Checking that the patron is not foreclosed if they hold suffcient deposit.
        const result = await steward.foreclosedPatron(accounts[2], { from: accounts[0] });
        assert.equal(result, false);
    });
});

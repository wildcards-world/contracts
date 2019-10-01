pragma solidity ^0.5.0;
import "./ERC721Patronage.sol";

contract WildcardSteward {
    
    /*
    This smart contract collects patronage from current owner through a Harberger tax model and 
    takes stewardship of the asset token if the patron can't pay anymore.

    Harberger Tax (COST): 
    - Asset is always on sale.
    - You have to have a price set.
    - Tax (Patronage) is paid to maintain ownership.
    - Steward maints control over ERC721.
    */
    using SafeMath for uint256;
    
    mapping(uint256 => uint256) public price; //in wei
    ERC721Patronage public assetToken; // ERC721 NFT.

    mapping(uint256 => uint256) public totalCollected; // all patronage ever collected
    mapping(uint256 => uint256) public currentCollected; // amount currently collected for patron
    mapping(uint256 => uint256) public timeLastCollected;
    mapping(address => uint256) public timeLastCollectedUser;
    mapping(address => uint256) public deposit;
    mapping(address => uint256) public totalUserOwnedTokenCost;

    // mapping(uint256 => uint256) public 

    address payable public organization; // non-profit organization
    uint256 public organizationFund;
    
    mapping(uint256 => address) public currentPatron; // This is different to the current token owner.
    mapping(uint256 => mapping (address => bool)) public patrons;
    mapping(uint256 => mapping (address => uint256)) public timeHeld;

    mapping(uint256 => uint256) public timeAcquired;
    
    // 1200% patronage
    uint256 patronageNumerator =  12;
    uint256 patronageDenominator = 1;

    enum StewardState { Foreclosed, Owned }
    mapping(uint256 => StewardState) public state;

    constructor(address payable _organization, address _assetToken) public {
        uint8 numberOfTokens = 9;
        assetToken = ERC721Patronage(_assetToken);
        assetToken.initialize(numberOfTokens, "FIX-ME");
        organization = _organization;
        for (uint8 i = 0; i < numberOfTokens; ++i){
          state[i] = StewardState.Foreclosed;
        }
    }

    event LogBuy(address indexed owner, uint256 indexed price);
    event LogPriceChange(uint256 indexed newPrice);
    event LogForeclosure(address indexed prevOwner);
    event LogCollection(uint256 indexed collected);

    modifier onlyPatron(uint256 tokenId) {
        require(msg.sender == assetToken.ownerOf(tokenId), "Not patron");
        _;
    }

    modifier onlyReceivingOrganization() {
        require(msg.sender == organization, "Not organization");
        _;
    }

    modifier collectPatronage(uint256 tokenId) {
       _collectPatronage(tokenId);
       _;
    }
    modifier collectPatronageAddress(address tokenHolder) {
       _collectPatronageUser(tokenHolder);
       _;
    }

    function changeReceivingOrganization(address payable _newReceivingOrganization) public onlyReceivingOrganization {
        organization = _newReceivingOrganization;
    }

    /* public view functions */
    function patronageOwed(uint256 tokenId) public view returns (uint256 patronageDue) {
        return price[tokenId].mul(now.sub(timeLastCollected[tokenId])).mul(patronageNumerator)
          .div(patronageDenominator).div(365 days);
    }

    function patronageOwedWithTimestamp(uint256 tokenId) public view returns (uint256 patronageDue, uint256 timestamp) {
        return (patronageOwed(tokenId), now);
    }

    // TODO: make a version of this function that is for patronage owed by token rather than by tokenHolder like it is now.
    function patronageOwedUser(address tokenHolder) public view returns (uint256 patronageDue) {
        // NOTE/TODO: to cater to different patronage rates, we should include it in the `totalUserOwnedTokenCost` (and probably rename that variable)
        return totalUserOwnedTokenCost[tokenHolder].mul(now.sub(timeLastCollectedUser[tokenHolder])).mul(patronageNumerator)
          .div(patronageDenominator).div(365 days);
    }

    function patronageOwedUserWithTimestamp(address tokenHolder) public view returns (uint256 patronageDue, uint256 timestamp) {
        return (patronageOwedUser(tokenHolder), now);
    }

    function foreclosedUser(address tokenHolder) public view returns (bool) {
        // returns whether it is in foreclosed state or not
        // depending on whether deposit covers patronage due
        // useful helper function when price should be zero, but contract doesn't reflect it yet.
        if (patronageOwedUser(tokenHolder) >= deposit[tokenHolder]) { // TODO: this condition is wrong
            return true;
        } else {
            return false;
        }
    }

    function foreclosed(uint256 tokenId) public view returns (bool) {
        // returns whether it is in foreclosed state or not
        // depending on whether deposit covers patronage due
        // useful helper function when price should be zero, but contract doesn't reflect it yet.
        address tokenHolder = currentPatron[tokenId];
        return foreclosedUser(tokenHolder);
    }

    // same function as above, basically
    function depositAbleToWithdraw(address tokenHolder) public view returns (uint256) {
        uint256 collection = patronageOwedUser(tokenHolder);
        if(collection >= deposit[tokenHolder]) {
            return 0;
        } else {
            return deposit[tokenHolder].sub(collection);
        }
    }

    /*
    now + deposit/patronage per second 
    now + depositAbleToWithdraw/(price*nume/denom/365).
    */
    function foreclosureTimeUser(address tokenHolder) public view returns (uint256) {
        // patronage per second
        uint256 pps = totalUserOwnedTokenCost[tokenHolder].mul(patronageNumerator).div(patronageDenominator).div(365 days);
        return now.add(depositAbleToWithdraw(tokenHolder).div(pps)); // zero division if price is zero.
    }
    function foreclosureTime(uint256 tokenId) public view returns (uint256) {
        address tokenHolder = currentPatron[tokenId];
        return foreclosureTimeUser(tokenHolder);
    }

    /* actions */
    // TODO:: think of more efficient ways for recipients to collect patronage for lots of tokens at the same time.
    function _collectPatronage(uint256 tokenId) public {
        // determine patronage to pay
        if (state[tokenId] == StewardState.Owned) {
            address tokenHolder = currentPatron[tokenId];
            uint256 previousTokenCollection = timeLastCollected[tokenId]; 
            uint256 patronageOwedByTokenOwner = patronageOwedUser(tokenHolder);
            uint256 collection;

            // should foreclose and stake stewardship
            if (patronageOwedByTokenOwner >= deposit[tokenHolder]) {
                // up to when was it actually paid for?
                uint256 newTimeLastCollected = timeLastCollectedUser[tokenHolder].add(((now.sub(timeLastCollectedUser[tokenHolder])).mul(deposit[tokenHolder]).div(patronageOwedByTokenOwner)));
                timeLastCollected[tokenId] = newTimeLastCollected;
                timeLastCollectedUser[tokenHolder] = newTimeLastCollected;
                collection = price[tokenId].mul(newTimeLastCollected.sub(previousTokenCollection)).mul(patronageNumerator).div(patronageDenominator).div(365 days);

                deposit[tokenHolder] = 0;
                _foreclose(tokenId);
            } else  {
                // just a normal collection
                collection = price[tokenId].mul(now.sub(previousTokenCollection)).mul(patronageNumerator).div(patronageDenominator).div(365 days);
                timeLastCollected[tokenId] = now;
                timeLastCollectedUser[tokenHolder] = now;
                currentCollected[tokenId] = currentCollected[tokenId].add(collection);
                deposit[tokenHolder] = deposit[tokenHolder].sub(patronageOwedByTokenOwner);
            }
            totalCollected[tokenId] = totalCollected[tokenId].add(collection);
            organizationFund = organizationFund.add(collection);
            emit LogCollection(collection);
        }
    }
    // This does accounting without transfering any tokens
    function _collectPatronageUser(address tokenHolder) public {
        uint256 patronageOwedByTokenOwner = patronageOwedUser(tokenHolder);
        if (patronageOwedByTokenOwner >= deposit[tokenHolder]) {
            uint256 previousCollectionTime = timeLastCollectedUser[tokenHolder];
            // up to when was it actually paid for?
            uint256 newTimeLastCollected = previousCollectionTime.add(((now.sub(previousCollectionTime)).mul(deposit[tokenHolder]).div(patronageOwedByTokenOwner)));
            timeLastCollectedUser[tokenHolder] = newTimeLastCollected;
            deposit[tokenHolder] = 0;
        } else  {
            timeLastCollectedUser[tokenHolder] = now;
            deposit[tokenHolder] = deposit[tokenHolder].sub(patronageOwedByTokenOwner);
        }

        // TODO: this should log a different kind of event, since this isn't transfering any tokens.
        // emit LogCollection(collection);
    }

    // note: anyone can deposit
    function depositWei() public payable {
      depositWeiUser(msg.sender);
    }
    function depositWeiUser(address user) public payable {
        require(totalUserOwnedTokenCost[user] > 0, "No tokens owned");
        deposit[user] = deposit[user].add(msg.value);
    }

    function buy(uint256 tokenId, uint256 _newPrice) public payable collectPatronage(tokenId) {
        require(_newPrice > 0, "Price is zero");
        require(msg.value > price[tokenId], "Not enough"); // >, coz need to have at least something for deposit
        address currentOwner = assetToken.ownerOf(tokenId);

        if (state[tokenId] == StewardState.Owned) {
            uint256 totalToPayBack = price[tokenId];
            // TODO: Don't pay back deposit if user has other tokens.
            //       Think exactly what to do in this situation.
            // if(deposit[tokenId] > 0) {
            //     totalToPayBack = totalToPayBack.add(deposit[tokenId]);
            // }

            // pay previous owner their price + deposit back.
            address payable payableCurrentOwner = address(uint160(currentOwner));
            payableCurrentOwner.transfer(totalToPayBack);
        } else if(state[tokenId] == StewardState.Foreclosed) {
            state[tokenId] = StewardState.Owned;
            timeLastCollected[tokenId] = now;
            timeLastCollectedUser[msg.sender] = now;
        }
        
        deposit[msg.sender] = msg.value.sub(price[tokenId]);
        transferAssetTokenTo(tokenId, currentOwner, msg.sender, _newPrice);
        emit LogBuy(msg.sender, _newPrice);
    }

    function changePrice(uint256 tokenId, uint256 _newPrice) public onlyPatron(tokenId) collectPatronage(tokenId) {
        require(state[tokenId] != StewardState.Foreclosed, "Foreclosed");
        require(_newPrice != 0, "Incorrect Price");
        
        price[tokenId] = _newPrice;
        emit LogPriceChange(price[tokenId]);
    }

    function withdrawDeposit(uint256 _wei) public collectPatronageAddress(msg.sender) returns (uint256) {
        _withdrawDeposit(_wei);
    }

    function withdrawOrganizationFunds() public {
        require(msg.sender == organization, "Not organization");
        organization.transfer(organizationFund);
        organizationFund = 0;
    }

    function exit() public collectPatronageAddress(msg.sender) {
        _withdrawDeposit(deposit[msg.sender]);
    }

    /* internal */

    function _withdrawDeposit(uint256 _wei) internal {
        // note: can withdraw whole deposit, which puts it in immediate to be foreclosed state.
        require(deposit[msg.sender] >= _wei, 'Withdrawing too much');

        deposit[msg.sender] = deposit[msg.sender].sub(_wei);
        msg.sender.transfer(_wei); // msg.sender == patron
    }

    function _foreclose(uint256 tokenId) internal {
        // become steward of assetToken (aka foreclose)
        address currentOwner = assetToken.ownerOf(tokenId);
        transferAssetTokenTo(tokenId, currentOwner, address(this), 0);
        state[tokenId] = StewardState.Foreclosed;
        currentCollected[tokenId] = 0;

        emit LogForeclosure(currentOwner);
    }

    function transferAssetTokenTo(uint256 tokenId, address _currentOwner, address _newOwner, uint256 _newPrice) internal {
        // TODO: add the patronage rate as a multiplier here: https://github.com/wild-cards/contracts/issues/7
        totalUserOwnedTokenCost[_newOwner] += _newPrice;
        totalUserOwnedTokenCost[_currentOwner] -= _newPrice;

        // note: it would also tabulate time held in stewardship by smart contract
        timeHeld[tokenId][_currentOwner] = timeHeld[tokenId][_currentOwner].add((timeLastCollected[tokenId].sub(timeAcquired[tokenId])));

        assetToken.transferFrom(_currentOwner, _newOwner, tokenId);

        currentPatron[tokenId] = _newOwner;

        price[tokenId] = _newPrice;
        timeAcquired[tokenId] = now;
        patrons[tokenId][_newOwner] = true;
    }
}

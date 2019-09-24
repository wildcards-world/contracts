pragma solidity ^0.5.0;
import "./interfaces/IERC721Full.sol";
import "./utils/SafeMath.sol";

contract VitalikSteward {
    
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

    uint8 constant numberOfTokens = 9;
    
    uint256[numberOfTokens] public price; //in wei
    IERC721Full public assetToken; // ERC721 NFT.
    string[numberOfTokens] public hashes; //Image hashes IPFS
    string[numberOfTokens] public urls;

    uint256[numberOfTokens] public totalCollected; // all patronage ever collected
    uint256[numberOfTokens] public currentCollected; // amount currently collected for patron
    uint256[numberOfTokens] public timeLastCollected;
    uint256[numberOfTokens] public deposit;

    address payable public organization; // non-profit organization
    uint256 public organizationFund;
    
    mapping(uint8 => mapping (address => bool)) public patrons;
    mapping(uint8 => mapping (address => uint256)) public timeHeld;

    uint256[numberOfTokens] public timeAcquired;
    
    // 1200% patronage
    uint256 patronageNumerator =  12000000000000;
    uint256 patronageDenominator = 1000000000000;

    enum StewardState { Foreclosed, Owned }
    StewardState[numberOfTokens] public state;

    constructor(address payable _organization, address _assetToken) public {
        assetToken = IERC721Full(_assetToken);
        assetToken.setup(numberOfTokens, "FIX-ME");
        organization = _organization;
        for (uint8 i = 0; i < numberOfTokens; ++i){
          state[i] = StewardState.Foreclosed;
        }
        for (uint8 i = 0; i < numberOfTokens; ++i){
          hashes[i] = "QmVxsQNfMR5kMUp9atgg3uWbjA4LZkUnz5MFHbK9WnXyHS";
        }
        for (uint8 i = 0; i < numberOfTokens; ++i){
          urls[i] = "https://wildcards.world";
        }
    }

    event LogBuy(address indexed owner, uint256 indexed price);
    event LogPriceChange(uint256 indexed newPrice);
    event LogImageChange(string indexed newImage);
    event LogUrlChange(string indexed newUrl);
    event LogForeclosure(address indexed prevOwner);
    event LogCollection(uint256 indexed collected);

    modifier onlyPatron(uint8 tokenIndex) {
        require(msg.sender == assetToken.ownerOf(tokenIndex), "Not patron");
        _;
    }

    modifier onlyReceivingOrganization() {
        require(msg.sender == organization, "Not organization");
        _;
    }

    modifier collectPatronage(uint8 tokenIndex) {
       _collectPatronage(tokenIndex);
       _;
    }

    function changeReceivingOrganization(address payable _newReceivingOrganization) public onlyReceivingOrganization {
        organization = _newReceivingOrganization;
    }

    /* public view functions */
    function patronageOwed(uint8 tokenIndex) public view returns (uint256 patronageDue) {
        return price[tokenIndex].mul(now.sub(timeLastCollected[tokenIndex])).mul(patronageNumerator)
          .div(patronageDenominator).div(365 days);
    }

    function patronageOwedWithTimestamp(uint8 tokenIndex) public view returns (uint256 patronageDue, uint256 timestamp) {
        return (patronageOwed(tokenIndex), now);
    }

    // TODO: currently patronage isn't shared. We need to think of best way to solve this.
    function foreclosed(uint8 tokenIndex) public view returns (bool) {
        // returns whether it is in foreclosed state or not
        // depending on whether deposit covers patronage due
        // useful helper function when price should be zero, but contract doesn't reflect it yet.
        uint256 collection = patronageOwed(tokenIndex);
        if(collection >= deposit[tokenIndex]) {
            return true;
        } else {
            return false;
        }
    }

    // same function as above, basically
    function depositAbleToWithdraw(uint8 tokenIndex) public view returns (uint256) {
        uint256 collection = patronageOwed(tokenIndex);
        if(collection >= deposit[tokenIndex]) {
            return 0;
        } else {
            return deposit[tokenIndex].sub(collection);
        }
    }

    /*
    now + deposit/patronage per second 
    now + depositAbleToWithdraw/(price*nume/denom/365).
    */
    function foreclosureTime(uint8 tokenIndex) public view returns (uint256) {
        // patronage per second
        uint256 pps = price[tokenIndex].mul(patronageNumerator).div(patronageDenominator).div(365 days);
        return now + depositAbleToWithdraw(tokenIndex).div(pps); // zero division if price is zero.
    }

    /* actions */
    function _collectPatronage(uint8 tokenIndex) public {
        // determine patronage to pay
        if (state[tokenIndex] == StewardState.Owned) {
            uint256 collection = patronageOwed(tokenIndex);

            // should foreclose and stake stewardship
            if (collection >= deposit[tokenIndex]) {
                // up to when was it actually paid for?
                timeLastCollected[tokenIndex] = timeLastCollected[tokenIndex].add(((now.sub(timeLastCollected[tokenIndex])).mul(deposit[tokenIndex]).div(collection)));
                collection = deposit[tokenIndex]; // take what's left.

                _foreclose(tokenIndex);
            } else  {
                // just a normal collection
                timeLastCollected[tokenIndex] = now;
                currentCollected[tokenIndex] = currentCollected[tokenIndex].add(collection);
            }

            deposit[tokenIndex] = deposit[tokenIndex].sub(collection);
            totalCollected[tokenIndex] = totalCollected[tokenIndex].add(collection);
            organizationFund = organizationFund.add(collection);
            emit LogCollection(collection);
        }
    }

    // note: anyone can deposit
    function depositWei(uint8 tokenIndex) public payable collectPatronage(tokenIndex) {
        require(state[tokenIndex] != StewardState.Foreclosed, "Foreclosed");
        deposit[tokenIndex] = deposit[tokenIndex].add(msg.value);
    }

    function buy(uint8 tokenIndex, uint256 _newPrice) public payable collectPatronage(tokenIndex) {
        require(_newPrice > 0, "Price is zero");
        require(msg.value > price[tokenIndex], "Not enough"); // >, coz need to have at least something for deposit
        address currentOwner = assetToken.ownerOf(tokenIndex);

        if (state[tokenIndex] == StewardState.Owned) {
            uint256 totalToPayBack = price[tokenIndex];
            if(deposit[tokenIndex] > 0) {
                totalToPayBack = totalToPayBack.add(deposit[tokenIndex]);
            }

            // pay previous owner their price + deposit back.
            address payable payableCurrentOwner = address(uint160(currentOwner));
            payableCurrentOwner.transfer(totalToPayBack);
        } else if(state[tokenIndex] == StewardState.Foreclosed) {
            state[tokenIndex] = StewardState.Owned;
            timeLastCollected[tokenIndex] = now;
        }
        
        deposit[tokenIndex] = msg.value.sub(price[tokenIndex]);
            transferAssetTokenTo(tokenIndex, currentOwner, msg.sender, _newPrice);
        emit LogBuy(msg.sender, _newPrice);
    }

    function changePrice(uint8 tokenIndex, uint256 _newPrice) public onlyPatron(tokenIndex) collectPatronage(tokenIndex) {
        require(state[tokenIndex] != StewardState.Foreclosed, "Foreclosed");
        require(_newPrice != 0, "Incorrect Price");
        
        price[tokenIndex] = _newPrice;
        emit LogPriceChange(price[tokenIndex]);
    }

    function changeImage(uint8 tokenIndex, string memory _newHash) public onlyPatron(tokenIndex) {
        require(state[tokenIndex] != StewardState.Foreclosed, "Foreclosed");
        require(bytes(_newHash).length == 46, "Hash not valid ");
        
        hashes[tokenIndex] = _newHash;
        emit LogImageChange(hashes[tokenIndex]);
    }

    function changeUrl(uint8 tokenIndex, string memory _newUrl) public onlyPatron(tokenIndex) {
        require(state[tokenIndex] != StewardState.Foreclosed, "Foreclosed");
        require(bytes(_newUrl).length < 164, "Url too long. ");
        
        urls[tokenIndex] = _newUrl;
        emit LogUrlChange(urls[tokenIndex]);
    }
    
    function withdrawDeposit(uint8 tokenIndex, uint256 _wei) public onlyPatron(tokenIndex) collectPatronage(tokenIndex) returns (uint256) {
        _withdrawDeposit(tokenIndex, _wei);
    }

    function withdrawOrganizationFunds() public {
        require(msg.sender == organization, "Not organization");
        organization.transfer(organizationFund);
        organizationFund = 0;
    }

    function exit(uint8 tokenIndex) public onlyPatron(tokenIndex) collectPatronage(tokenIndex) {
        _withdrawDeposit(tokenIndex, deposit[tokenIndex]);
    }

    /* internal */

    function _withdrawDeposit(uint8 tokenIndex, uint256 _wei) internal {
        // note: can withdraw whole deposit, which puts it in immediate to be foreclosed state.
        require(deposit[tokenIndex] >= _wei, 'Withdrawing too much');

        deposit[tokenIndex] = deposit[tokenIndex].sub(_wei);
        msg.sender.transfer(_wei); // msg.sender == patron

        if(deposit[tokenIndex] == 0) {
            _foreclose(tokenIndex);
        }
    }

    function _foreclose(uint8 tokenIndex) internal {
        // become steward of assetToken (aka foreclose)
        address currentOwner = assetToken.ownerOf(tokenIndex);
        transferAssetTokenTo(tokenIndex, currentOwner, address(this), 0);
        state[tokenIndex] = StewardState.Foreclosed;
        currentCollected[tokenIndex] = 0;

        emit LogForeclosure(currentOwner);
    }

    function transferAssetTokenTo(uint8 tokenIndex, address _currentOwner, address _newOwner, uint256 _newPrice) internal {
        // note: it would also tabulate time held in stewardship by smart contract
        timeHeld[tokenIndex][_currentOwner] = timeHeld[tokenIndex][_currentOwner].add((timeLastCollected[tokenIndex].sub(timeAcquired[tokenIndex])));
        
        assetToken.transferFrom(_currentOwner, _newOwner, tokenIndex);

        price[tokenIndex] = _newPrice;
        timeAcquired[tokenIndex] = now;
        patrons[tokenIndex][_newOwner] = true;
    }
}

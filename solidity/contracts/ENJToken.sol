pragma solidity ^0.4.15;
import './ERC20Token.sol';
import './Owned.sol';


contract ENJToken is ERC20Token, Owned {

///////////////////////////////////////// VARIABLE INITIALIZATION /////////////////////////////////////////

    uint256 public totalSupply = 1 * (10**9) * 10**18;
    uint256 public maxPresaleSupply = 600 * 10**6 * 10**18; // Total presale supply at max bonus
    uint256 public minCrowdsaleAllocation = 200 * 10**6 * 10**18; // Min amount for crowdsale
    uint256 public incentivisationAllocation = 100 * 10**6 * 10**18; // Total presale supply at max bonus
    uint256 public advisorsAllocation = 50 * 10**6 * 10**18; // Total presale supply at max bonus
    uint256 public enjinTeamAllocation = 50 * 10**6 * 10**18; // Total presale supply at max bonus
    uint256 public totalAllocated = 0;
    uint256 public startTime = 1507032000;              // 10/03/2017 @ 12:00pm (UTC) crowdsale start time (in seconds)
    uint256 public endTime = 1509494340;                // 10/31/2017 @ 11:59pm (UTC) crowdsale end time (in seconds)

    address public crowdFundAddress;
    address public advisorAddress;

    bool internal isReleasedToPublic = false;

///////////////////////////////////////// MODIFIERS /////////////////////////////////////////

    // Enjin Team timelock    
    modifier enjinTeamTimelock() {
        require(now >= startTime + 6 * 4 weeks);
        _;
    }

    // Time lock for all unsold tokens from the Crowdfund
    modifier unsoldTokensTimeLock() {
        require(now >= endTime + 6 * 4 weeks);
        _;
    }

    // Advisor Team timelock    
    modifier advisorTimelock() {
        require(now >= startTime + 2 * 4 weeks);
        _;
    }

    modifier advisorOnly() {
        require(msg.sender == advisorAddress);
        _;
    }

    modifier crowdfundOnly() {
        require(msg.sender == crowdFundAddress);
        _;
    }

    ///////////////////////////////////////// CONSTRUCTOR /////////////////////////////////////////

    /**
        @dev constructor
        @param _crowdFundAddress       token name
        @param _advisorAddress     token short symbol, 1-6 characters
    */

    function ENJToken(address _crowdFundAddress, address _advisorAddress)
    ERC20Token("ENJ Token", "ENJ", 18)
     {
        balanceOf[_crowdFundAddress] = minCrowdsaleAllocation + maxPresaleSupply; // Total presale + crowdfund tokens
        crowdFundAddress = _crowdFundAddress;
        advisorAddress = _advisorAddress;
    }

///////////////////////////////////////// ERC20 OVERRIDE /////////////////////////////////////////

    /**
        @dev send coins
        throws on any error rather then return a false flag to minimize user errors
        in addition to the standard checks, the function throws if transfers are disabled

        @param _to      target address
        @param _value   transfer amount

        @return true if the transfer was successful, throws if it wasn't
    */
    function transfer(address _to, uint256 _value) public returns (bool success) {
        if (msg.sender == crowdFundAddress || isTransferAllowed() == true) {
            assert(super.transfer(_to, _value));
            return true;
        }
        revert();        
    }

    /**
        @dev an account/contract attempts to get the coins
        throws on any error rather then return a false flag to minimize user errors
        in addition to the standard checks, the function throws if transfers are disabled

        @param _from    source address
        @param _to      target address
        @param _value   transfer amount

        @return true if the transfer was successful, throws if it wasn't
    */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        if (msg.sender == crowdFundAddress || isTransferAllowed() == true) {        
            assert(super.transferFrom(_from, _to, _value));
            return true;
        }
        revert();
    }

///////////////////////////////////////// ALLOCATION FUNCTIONS /////////////////////////////////////////

    /**
        @dev release Enjin Team Token allocation
        throws if before timelock (6 months) ends and if no initiated by the owner of the contract
        returns true if valid

        @return true if successful, throws if not
    */
    function releaseEnjinTeamTokens() enjinTeamTimelock ownerOnly returns(bool success) {
        require(enjinTeamAllocation > 0);
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], enjinTeamAllocation);
        Transfer(this, msg.sender, enjinTeamAllocation);
        totalAllocated = safeAdd(totalAllocated, enjinTeamAllocation);
        enjinTeamAllocation = 0;
        return true;
    }

    /**
        @dev release Advisors Token allocation
        throws if before timelock (2 months) ends and if no initiated by the advisors address
        returns true if valid

        @return true if successful, throws if not
    */
    function releaseAdvisorTokens() advisorTimelock advisorOnly returns(bool success) {
        require(advisorsAllocation > 0);
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], advisorsAllocation);
        Transfer(this, msg.sender, advisorsAllocation);
        totalAllocated = safeAdd(totalAllocated, advisorsAllocation);
        advisorsAllocation = 0;
        return true;
    }

    /**
        @dev Retrive unsold tokens from the crowdfund
        throws if before timelock (6 months from end of Crowdfund) ends and if no initiated by the owner of the contract
        returns true if valid

        @return true if successful, throws if not
    */
    function retrieveUnsoldTokens() unsoldTokensTimeLock ownerOnly returns(bool success) {
        uint256 amountOfTokens = balanceOf[crowdFundAddress];
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], amountOfTokens);
        totalAllocated = safeAdd(totalAllocated, amountOfTokens);
        balanceOf[crowdFundAddress] = 0;
        return true;        
    }

    /**
        @dev Keep track of token allocations
        can only be called by the crowdfund contract
    */
    function addToAllocation(uint256 _amount) crowdfundOnly {
        totalAllocated = safeAdd(totalAllocated, _amount);
    }

    /**
        @dev Function to allow transfers
        can only be called by the owner of the contract
        Transfers will be allowed regradless after the crowdfund end time.
    */
    function allowTransfers() ownerOnly {
        isReleasedToPublic = true;
    } 

    /**
        @dev User transfers are allowed/rejected
        Transfers are forbidden before the end of the crowdfund
    */
    function isTransferAllowed() internal returns(bool) {
        if (now > endTime || isReleasedToPublic == true) {
            return true;
        }
        return false;
    }
}

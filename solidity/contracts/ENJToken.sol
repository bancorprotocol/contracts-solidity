pragma solidity ^0.4.15;
import './ERC20Token.sol';
import './TokenHolder.sol';


contract ENJToken is ERC20Token, TokenHolder {

///////////////////////////////////////// VARIABLE INITIALIZATION /////////////////////////////////////////

    uint256 constant public ENJ_UNIT = 10 ** 18;
    uint256 public totalSupply = 1 * (10**9) * ENJ_UNIT;

    //  Constants 
    uint256 constant public maxPresaleSupply = 600 * 10**6 * ENJ_UNIT;           // Total presale supply at max bonus
    uint256 constant public minCrowdsaleAllocation = 200 * 10**6 * ENJ_UNIT;     // Min amount for crowdsale
    uint256 constant public incentivisationAllocation = 100 * 10**6 * ENJ_UNIT;  // Incentivisation Allocation
    uint256 constant public advisorsAllocation = 26 * 10**6 * ENJ_UNIT;          // Advisors Allocation
    uint256 constant public enjinTeamAllocation = 74 * 10**6 * ENJ_UNIT;         // Enjin Team allocation

    address public crowdFundAddress;                                             // Address of the crowdfund
    address public advisorAddress;                                               // Enjin advisor's address
    address public incentivisationFundAddress;                                   // Address that holds the incentivization funds
    address public enjinTeamAddress;                                             // Enjin Team address

    //  Variables

    uint256 public totalAllocatedToAdvisors = 0;                                 // Counter to keep track of advisor token allocation
    uint256 public totalAllocatedToTeam = 0;                                     // Counter to keep track of team token allocation
    uint256 public totalAllocated = 0;                                           // Counter to keep track of overall token allocation
    uint256 constant public endTime = 1509494340;                                // 10/31/2017 @ 11:59pm (UTC) crowdsale end time (in seconds)

    bool internal isReleasedToPublic = false;                         // Flag to allow transfer/transferFrom before the end of the crowdfund

    uint256 internal teamTranchesReleased = 0;                          // Track how many tranches (allocations of 12.5% team tokens) have been released
    uint256 internal maxTeamTranches = 8;                               // The number of tranches allowed to the team until depleted

///////////////////////////////////////// MODIFIERS /////////////////////////////////////////

    // Enjin Team timelock    
    modifier safeTimelock() {
        require(now >= endTime + 6 * 4 weeks);
        _;
    }

    // Advisor Team timelock    
    modifier advisorTimelock() {
        require(now >= endTime + 2 * 4 weeks);
        _;
    }

    // Function only accessible by the Crowdfund contract
    modifier crowdfundOnly() {
        require(msg.sender == crowdFundAddress);
        _;
    }

    ///////////////////////////////////////// CONSTRUCTOR /////////////////////////////////////////

    /**
        @dev constructor
        @param _crowdFundAddress   Crowdfund address
        @param _advisorAddress     Advisor address
    */
    function ENJToken(address _crowdFundAddress, address _advisorAddress, address _incentivisationFundAddress, address _enjinTeamAddress)
    ERC20Token("Enjin Coin", "ENJ", 18)
     {
        crowdFundAddress = _crowdFundAddress;
        advisorAddress = _advisorAddress;
        enjinTeamAddress = _enjinTeamAddress;
        incentivisationFundAddress = _incentivisationFundAddress;
        balanceOf[_crowdFundAddress] = minCrowdsaleAllocation + maxPresaleSupply; // Total presale + crowdfund tokens
        balanceOf[_incentivisationFundAddress] = incentivisationAllocation;       // 10% Allocated for Marketing and Incentivisation
        totalAllocated += incentivisationAllocation;                              // Add to total Allocated funds
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
        if (isTransferAllowed() == true || msg.sender == crowdFundAddress || msg.sender == incentivisationFundAddress) {
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
        if (isTransferAllowed() == true || msg.sender == crowdFundAddress || msg.sender == incentivisationFundAddress) {        
            assert(super.transferFrom(_from, _to, _value));
            return true;
        }
        revert();
    }

///////////////////////////////////////// ALLOCATION FUNCTIONS /////////////////////////////////////////

    /**
        @dev Release one single tranche of the Enjin Team Token allocation
        throws if before timelock (6 months) ends and if not initiated by the owner of the contract
        returns true if valid
        Schedule goes as follows:
        3 months: 12.5% (this tranche can only be released after the initial 6 months has passed)
        6 months: 12.5%
        9 months: 12.5%
        12 months: 12.5%
        15 months: 12.5%
        18 months: 12.5%
        21 months: 12.5%
        24 months: 12.5%
        @return true if successful, throws if not
    */
    function releaseEnjinTeamTokens() safeTimelock ownerOnly returns(bool success) {
        require(totalAllocatedToTeam < enjinTeamAllocation);

        uint256 enjinTeamAlloc = enjinTeamAllocation / 1000;
        uint256 currentTranche = uint256(now - endTime) / 12 weeks;     // "months" after crowdsale end time (division floored)

        if(teamTranchesReleased < maxTeamTranches && currentTranche > teamTranchesReleased) {
            teamTranchesReleased++;

            uint256 amount = safeMul(enjinTeamAlloc, 125);
            balanceOf[enjinTeamAddress] = safeAdd(balanceOf[enjinTeamAddress], amount);
            Transfer(0x0, enjinTeamAddress, amount);
            totalAllocated = safeAdd(totalAllocated, amount);
            totalAllocatedToTeam = safeAdd(totalAllocatedToTeam, amount);
            return true;
        }
        revert();
    }

    /**
        @dev release Advisors Token allocation
        throws if before timelock (2 months) ends or if no initiated by the advisors address
        or if there is no more allocation to give out
        returns true if valid

        @return true if successful, throws if not
    */
    function releaseAdvisorTokens() advisorTimelock ownerOnly returns(bool success) {
        require(totalAllocatedToAdvisors == 0);
        balanceOf[advisorAddress] = safeAdd(balanceOf[advisorAddress], advisorsAllocation);
        totalAllocated = safeAdd(totalAllocated, advisorsAllocation);
        totalAllocatedToAdvisors = advisorsAllocation;
        Transfer(0x0, advisorAddress, advisorsAllocation);
        return true;
    }

    /**
        @dev Retrieve unsold tokens from the crowdfund
        throws if before timelock (6 months from end of Crowdfund) ends and if no initiated by the owner of the contract
        returns true if valid

        @return true if successful, throws if not
    */
    function retrieveUnsoldTokens() safeTimelock ownerOnly returns(bool success) {
        uint256 amountOfTokens = balanceOf[crowdFundAddress];
        balanceOf[crowdFundAddress] = 0;
        balanceOf[incentivisationFundAddress] = safeAdd(balanceOf[incentivisationFundAddress], amountOfTokens);
        totalAllocated = safeAdd(totalAllocated, amountOfTokens);
        Transfer(crowdFundAddress, incentivisationFundAddress, amountOfTokens);
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
        Transfers will be allowed regardless after the crowdfund end time.
    */
    function allowTransfers() ownerOnly {
        isReleasedToPublic = true;
    } 

    /**
        @dev User transfers are allowed/rejected
        Transfers are forbidden before the end of the crowdfund
    */
    function isTransferAllowed() internal constant returns(bool) {
        if (now > endTime || isReleasedToPublic == true) {
            return true;
        }
        return false;
    }
}

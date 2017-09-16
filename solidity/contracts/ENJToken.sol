pragma solidity ^0.4.15;
import './ERC20Token.sol';
import './Owned.sol';


contract ENJToken is ERC20Token, Owned {

///////////////////////////////////////// VARIABLE INITIALIZATION /////////////////////////////////////////

    uint256 public totalSupply = 1 * (10**9) * 10**18;

    //  Constants 
    uint256 public maxPresaleSupply = 600 * 10**6 * 10**18;           // Total presale supply at max bonus
    uint256 public minCrowdsaleAllocation = 200 * 10**6 * 10**18;     // Min amount for crowdsale
    uint256 public incentivisationAllocation = 100 * 10**6 * 10**18;  // Incentivisation Allocation
    uint256 public advisorsAllocation = 50 * 10**6 * 10**18;          // Advisors Allocation
    uint256 public enjinTeamAllocation = 50 * 10**6 * 10**18;         // Enjin Team allocation

    address public crowdFundAddress;                                  // Address of the crowdfund
    address public advisorAddress;                                    // Enjin advisor's address
    address public incentivisationFundAddress;                        // Address that holds the incentivization funds

    //  Variables
    uint256 public totalAllocatedToAdvisors = 0;                      // Counter to keep track of total Advisor allocation
    uint256 public totalAllocatedToTeam = 0;                          // Counter to keep track of team token allocation
    uint256 public totalAllocated = 0;                                // Counter to keep track of team token allocation
    uint256 public startTime = 1507032000;                            // 10/03/2017 @ 12:00pm (UTC) crowdsale start time (in seconds)
    uint256 public endTime = 1509494340;                              // 10/31/2017 @ 11:59pm (UTC) crowdsale end time (in seconds)

    bool internal isReleasedToPublic = false;                         // Flag to allow transfer/transferFrom before the end of the crowdfund
    
    bool internal releaseFirstAllocationTranche = false;              // Flags to keep track of Team allocation tranches
    bool internal releaseSecondAllocationTranche = false;             // Flags to keep track of Team allocation tranches
    bool internal releaseThirdAllocationTranche = false;              // Flags to keep track of Team allocation tranches
    bool internal releaseFourthAllocationTranche = false;             // Flags to keep track of Team allocation tranches
    bool internal releaseFifthAllocationTranche = false;              // Flags to keep track of Team allocation tranches
    bool internal releaseSixthAllocationTranche = false;              // Flags to keep track of Team allocation tranches
    bool internal releaseSeventhAllocationTranche = false;            // Flags to keep track of Team allocation tranches

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

    // Function only accessible by the Advisor address
    modifier advisorOnly() {
        require(msg.sender == advisorAddress);
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
    function ENJToken(address _crowdFundAddress, address _advisorAddress, address _incentivisationFundAddress)
    ERC20Token("ENJ Coin", "ENJ", 18)
     {
        crowdFundAddress = _crowdFundAddress;
        advisorAddress = _advisorAddress;
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
    function transfer(address _to, uint256 _value) greaterThanZero(_value) public returns (bool success) {
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
    function transferFrom(address _from, address _to, uint256 _value) greaterThanZero(_value) public returns (bool success) {
        if (isTransferAllowed() == true || msg.sender == crowdFundAddress || msg.sender == incentivisationFundAddress) {        
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
        Schedule goes as follows:
        6 months: 25%
        9 months: 12.5%
        12 months: 12.5%
        15 months: 12.5%
        18 months: 12.5%
        21 months: 12.5%
        24 months: 12.5%
        @return true if successful, throws if not
    */
    function releaseEnjinTeamTokens() ownerOnly returns(bool success) {
        require(totalAllocatedToTeam < enjinTeamAllocation);
        uint256 enjinTeamAlloc = enjinTeamAllocation / 1000;

        if (now > endTime + 6 * 4 weeks && !releaseFirstAllocationTranche) {
            releaseFirstAllocationTranche = true;
            transferTeamAllocation(safeMul(enjinTeamAlloc, 250));
            return true;
        } else  if (now > endTime + 9 * 4 weeks && !releaseSecondAllocationTranche) {
            releaseSecondAllocationTranche = true;
            transferTeamAllocation(safeMul(enjinTeamAlloc, 125));
            return true;
        } else  if (now > endTime + 12 * 4 weeks && !releaseThirdAllocationTranche) {
            releaseThirdAllocationTranche = true;
            transferTeamAllocation(safeMul(enjinTeamAlloc, 125));
            return true;
        } else  if (now > endTime + 15 * 4 weeks && !releaseFourthAllocationTranche) {
            releaseFourthAllocationTranche = true;
            transferTeamAllocation(safeMul(enjinTeamAlloc, 125));
            return true;
        } else  if (now > endTime + 18 * 4 weeks && !releaseFifthAllocationTranche) {
            releaseFifthAllocationTranche = true;
            transferTeamAllocation(safeMul(enjinTeamAlloc, 125));
            return true;
        } else  if (now > endTime + 21 * 4 weeks && !releaseSixthAllocationTranche) {
            releaseSixthAllocationTranche = true;
            transferTeamAllocation(safeMul(enjinTeamAlloc, 125));
            return true;
        } else  if (now > endTime + 24 * 4 weeks && !releaseSeventhAllocationTranche) {
            releaseSeventhAllocationTranche = true;
            transferTeamAllocation(safeMul(enjinTeamAlloc, 125));
            return true;
        }
        revert();
    }
    
    /**
        @dev transfers Tokens from Enjin allocation to Team
        throws if before first timelock (6 months) ends and if no initiated by the owner of the contract
        @return true if successful, throws if not
    */
    function transferTeamAllocation(uint256 _amount) ownerOnly internal {
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], _amount);
        Transfer(this, msg.sender, _amount);
        totalAllocated = safeAdd(totalAllocated, _amount);
        totalAllocatedToTeam = safeAdd(totalAllocatedToTeam, _amount);
    }

    /**
        @dev release Advisors Token allocation
        throws if before timelock (2 months) ends or if no initiated by the advisors address
        or if there is no more allocation to give out
        returns true if valid

        @return true if successful, throws if not
    */
    function releaseAdvisorTokens() advisorTimelock advisorOnly returns(bool success) {
        require(totalAllocatedToAdvisors == 0);
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], advisorsAllocation);
        Transfer(this, msg.sender, advisorsAllocation);
        totalAllocated = safeAdd(totalAllocated, advisorsAllocation);
        totalAllocatedToAdvisors = advisorsAllocation;
        return true;
    }

    /**
        @dev Retrive unsold tokens from the crowdfund
        throws if before timelock (6 months from end of Crowdfund) ends and if no initiated by the owner of the contract
        returns true if valid

        @return true if successful, throws if not
    */
    function retrieveUnsoldTokens() safeTimelock ownerOnly returns(bool success) {
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

    /**
        @dev
        Function to show the total Incentivisation tokens allocated
    */
    function totalAllocatedToIncentives() public constant returns(uint256) {
        return incentivisationAllocation - balanceOf[incentivisationFundAddress];
    }

    function () {
        revert();
    }
}

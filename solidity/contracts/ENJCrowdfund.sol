pragma solidity ^0.4.15;
import './TokenHolder.sol';
import './ENJToken.sol';


contract ENJCrowdfund is TokenHolder {

///////////////////////////////////////// VARIABLE INITIALIZATION /////////////////////////////////////////

    uint256 constant public startTime = 1507032000;                // 10/03/2017 @ 12:00pm (UTC) crowdsale start time (in seconds)
    uint256 constant public endTime = 1509494340;                  // 10/31/2017 @ 11:59pm (UTC) crowdsale end time (in seconds)
    uint256 constant internal week2Start = startTime + (7 days);   // 10/10/2017 @ 12:00pm (UTC) week 2 price begins
    uint256 constant internal week3Start = week2Start + (7 days);  // 10/17/2017 @ 12:00pm (UTC) week 3 price begins
    uint256 constant internal week4Start = week3Start + (7 days);  // 10/25/2017 @ 12:00pm (UTC) week 4 price begins

    uint256 public totalPresaleTokensYetToAllocate;     // Counter that keeps track of presale tokens yet to allocate
    address public beneficiary = 0x0;                   // address to receive all ether contributions
    address public tokenAddress = 0x0;                  // address of the token itself

    ENJToken token;                                     // ENJ Token interface

///////////////////////////////////////// EVENTS /////////////////////////////////////////

    event CrowdsaleContribution(address indexed _contributor, uint256 _amount, uint256 _return);
    event PresaleContribution(address indexed _contributor, uint256 _amountOfTokens);

///////////////////////////////////////// CONSTRUCTOR /////////////////////////////////////////

    /**
        @dev constructor
        @param _totalPresaleTokensYetToAllocate     Total amount of presale tokens sold
        @param _beneficiary                         Address that will be receiving the ETH contributed
    */
    function ENJCrowdfund(uint256 _totalPresaleTokensYetToAllocate, address _beneficiary) 
    validAddress(_beneficiary) 
    {
        totalPresaleTokensYetToAllocate = _totalPresaleTokensYetToAllocate;
        beneficiary = _beneficiary;
    }

///////////////////////////////////////// MODIFIERS /////////////////////////////////////////

    // Ensures that the current time is between startTime (inclusive) and endTime (exclusive)
    modifier between() {
        assert(now >= startTime && now < endTime);
        _;
    }

    // Ensures the Token address is set
    modifier tokenIsSet() {
        require(tokenAddress != 0x0);
        _;
    }

///////////////////////////////////////// OWNER FUNCTIONS /////////////////////////////////////////

    /**
        @dev Sets the ENJ Token address
        Can only be called once by the owner
        @param _tokenAddress    ENJ Token Address
    */
    function setToken(address _tokenAddress) validAddress(_tokenAddress) ownerOnly {
        require(tokenAddress == 0x0);
        tokenAddress = _tokenAddress;
        token = ENJToken(_tokenAddress);
    }

    /**
        @dev Sets a new Beneficiary address
        Can only be called by the owner
        @param _newBeneficiary    Beneficiary Address
    */
    function changeBeneficiary(address _newBeneficiary) validAddress(_newBeneficiary) ownerOnly {
        beneficiary = _newBeneficiary;
    }

    /**
        @dev Function to send ENJ to presale investors
        Can only be called while the presale is not over.
        @param _batchOfAddresses list of addresses
        @param _amountofENJ matching list of address balances
    */
    function deliverPresaleTokens(address[] _batchOfAddresses, uint256[] _amountofENJ) external tokenIsSet ownerOnly returns (bool success) {
        require(now < startTime);
        for (uint256 i = 0; i < _batchOfAddresses.length; i++) {
            deliverPresaleTokenToClient(_batchOfAddresses[i], _amountofENJ[i]);            
        }
        return true;
    }

    /**
        @dev Logic to transfer presale tokens
        Can only be called while the there are leftover presale tokens to allocate. Any multiple contribution from 
        the same address will be aggregated.
        @param _accountHolder user address
        @param _amountofENJ balance to send out
    */
    function deliverPresaleTokenToClient(address _accountHolder, uint256 _amountofENJ) internal ownerOnly {
        require(totalPresaleTokensYetToAllocate > 0);
        token.transfer(_accountHolder, _amountofENJ);
        token.addToAllocation(_amountofENJ);
        totalPresaleTokensYetToAllocate = safeSub(totalPresaleTokensYetToAllocate, _amountofENJ);
        PresaleContribution(_accountHolder, _amountofENJ);
    }

///////////////////////////////////////// PUBLIC FUNCTIONS /////////////////////////////////////////
    /**
        @dev ETH contribution function
        Can only be called during the crowdsale. Also allows a person to buy tokens for another address

        @return tokens issued in return
    */
    function contributeETH(address _to) public validAddress(_to) between tokenIsSet payable returns (uint256 amount) {
        return processContribution(_to);
    }

    /**
        @dev handles contribution logic
        note that the Contribution event is triggered using the sender as the contributor, regardless of the actual contributor

        @return tokens issued in return
    */
    function processContribution(address _to) private returns (uint256 amount) {

        uint256 tokenAmount = getTotalAmountOfTokens(msg.value);
        beneficiary.transfer(msg.value);
        token.transfer(_to, tokenAmount);
        token.addToAllocation(tokenAmount);
        CrowdsaleContribution(_to, msg.value, tokenAmount);
        return tokenAmount;
    }



///////////////////////////////////////// CONSTANT FUNCTIONS /////////////////////////////////////////
    
    /**
        @dev Returns total tokens allocated so far
        Constant function that simply returns a number

        @return total tokens allocated so far
    */
    function totalEnjSold() public constant returns(uint256 total) {
        return token.totalAllocated();
    }
    
    /**
        @dev computes the number of tokens that should be issued for a given contribution
        @param _contribution    contribution amount
        @return computed number of tokens
    */
    function getTotalAmountOfTokens(uint256 _contribution) public constant returns (uint256 amountOfTokens) {
        uint256 currentTokenRate = 0;
        if (now < week2Start) {
            return currentTokenRate = safeMul(_contribution, 6000);
        } else if (now < week3Start) {
            return currentTokenRate = safeMul(_contribution, 5000);
        } else if (now < week4Start) {
            return currentTokenRate = safeMul(_contribution, 4000);
        } else {
            return currentTokenRate = safeMul(_contribution, 3000);
        }
        
    }

    /**
        @dev Fallback function
        Main entry to buy into the crowdfund, all you need to do is send a value transaction
        to this contract address. Please include at least 100 000 gas in the transaction.
    */
    function() payable {
        contributeETH(msg.sender);
    }
}

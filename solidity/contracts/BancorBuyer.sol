pragma solidity ^0.4.11;
import './TokenHolder.sol';
import './ISmartToken.sol';
import './IEtherToken.sol';
import './ITokenChanger.sol';

/*
    Bancor Changer interface
*/
contract IBancorChanger is ITokenChanger {
    function token() public constant returns (ISmartToken _token) { _token; }
    function getReserveBalance(IERC20Token _reserveToken) public constant returns (uint256 balance);
}

/*
    BancorBuyer v0.1

    The bancor buyer contract is a simple bancor changer wrapper that allows buying smart tokens with ETH

    WARNING: the contract will make the purchase using the current price at transaction mining time
*/
contract BancorBuyer is TokenHolder {
    string public version = '0.1';
    IBancorChanger public tokenChanger; // bancor ETH <-> smart token changer
    IEtherToken public etherToken;      // ether token

    /**
        @dev constructor

        @param _changer     bancor token changer that actually does the purchase
        @param _etherToken  ether token used as a reserve in the token changer
    */
    function BancorBuyer(IBancorChanger _changer, IEtherToken _etherToken)
        validAddress(_changer)
        validAddress(_etherToken)
    {
        tokenChanger = _changer;
        etherToken = _etherToken;

        // ensure that the ether token is used as one of the changer's reserves
        tokenChanger.getReserveBalance(etherToken);
    }

    /**
        @dev buys the smart token with ETH
        note that the purchase will use the price at the time of the purchase

        @return tokens issued in return
    */
    function buy() public payable returns (uint256 amount) {
        etherToken.deposit.value(msg.value)(); // deposit ETH in the reserve
        assert(etherToken.approve(tokenChanger, 0)); // need to reset the allowance to 0 before setting a new one
        assert(etherToken.approve(tokenChanger, msg.value)); // approve the changer to use the ETH amount for the purchase

        ISmartToken smartToken = tokenChanger.token();
        uint256 returnAmount = tokenChanger.change(etherToken, smartToken, msg.value, 1); // do the actual change using the current price
        assert(smartToken.transfer(msg.sender, returnAmount)); // transfer the tokens to the sender
        return returnAmount;
    }

    // fallback
    function() payable {
        buy();
    }
}

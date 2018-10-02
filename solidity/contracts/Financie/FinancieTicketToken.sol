pragma solidity ^0.4.18;
import '../utility/Utils.sol';
import '../token/ERC20Token.sol';
import './FinancieNotifierDelegate.sol';
import './IFinancieIssuerToken.sol';

/**
* Financie Ticket Token implementation
*/
contract FinancieTicketToken is ERC20Token, FinancieNotifierDelegate, IFinancieIssuerToken {
    address issuer;

    /**
        @dev constructor
        @param _name        token name
        @param _symbol      token symbol
    */
    constructor(string _name, string _symbol, address _issuer, uint32 _supply, address _notifier)
        public
        ERC20Token(_name, _symbol, 0)
        FinancieNotifierDelegate(_notifier)
    {
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;

        issuer = _issuer;
    }

    function burnFrom(address _from, uint256 _amount) public {
        assert(transferFrom(_from, msg.sender, _amount));
        require(balanceOf[msg.sender] >= _amount);
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount);
        totalSupply = safeSub(totalSupply, _amount);

        notifyBurnTickets(_from, _amount);
    }

    function burn(uint256 _amount) public {
        require(balanceOf[msg.sender] >= _amount);
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount);
        totalSupply = safeSub(totalSupply, _amount);

        notifyBurnTickets(msg.sender, _amount);
    }

    function getIssuer() public view returns(address) {
        return issuer;
    }

}

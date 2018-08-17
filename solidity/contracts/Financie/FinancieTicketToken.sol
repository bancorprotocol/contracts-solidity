pragma solidity ^0.4.18;
import '../Utils.sol';
import '../ERC20Token.sol';
import '../interfaces/IFinancieTicketStore.sol';
import '../interfaces/IFinancieIssuerToken.sol';

/**
* Financie Ticket Token implementation
*/
contract FinancieTicketToken is ERC20Token, IFinancieIssuerToken {
    IFinancieTicketStore notifier;
    address issuer;

    /**
        @dev constructor
        @param _name        token name
        @param _symbol      token symbol
    */
    function FinancieTicketToken(string _name, string _symbol, address _issuer, uint32 _supply, address _notifier)
        public
        ERC20Token(_name, _symbol, 0) {
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;

        issuer = _issuer;

        notifier = IFinancieTicketStore(_notifier);
    }

    function burnFrom(address _from, uint256 _amount) public {
        assert(transferFrom(_from, msg.sender, _amount));
        require(balanceOf[msg.sender] >= _amount);
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount);
        totalSupply = safeSub(totalSupply, _amount);

        notifier.notifyBurnTickets(_from, _amount);
    }

    function burn(uint256 _amount) public {
        require(balanceOf[msg.sender] >= _amount);
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount);
        totalSupply = safeSub(totalSupply, _amount);

        notifier.notifyBurnTickets(msg.sender, _amount);
    }

    function getIssuer() public returns(address) {
        return issuer;
    }

}

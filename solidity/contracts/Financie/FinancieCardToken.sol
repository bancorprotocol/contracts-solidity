pragma solidity ^0.4.18;
import '../Utils.sol';
import '../ERC20Token.sol';
import './FinancieNotifierDelegate.sol';
import './IFinancieIssuerToken.sol';

/**
* Financie Card Token implementation
*/
contract FinancieCardToken is ERC20Token, FinancieNotifierDelegate, IFinancieIssuerToken {
    uint256 private constant FIXED_INITIAL_SUPPLY = 20000000 * 1 ether;

    address issuer;

    /**
    *   @dev constructor
    *
    *   @param _name        token name
    *   @param _symbol      token symbol
    */
    function FinancieCardToken(string _name, string _symbol, address _issuer, address _notifier_address)
        public
        ERC20Token(_name, _symbol, 18)
        FinancieNotifierDelegate(_notifier_address)
    {
        totalSupply = FIXED_INITIAL_SUPPLY;
        balanceOf[msg.sender] = FIXED_INITIAL_SUPPLY;

        issuer = _issuer;
    }

    function burnFrom(address _from, uint256 _amount) public {
        assert(transferFrom(_from, msg.sender, _amount));
        require(balanceOf[msg.sender] >= _amount);
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount);
        totalSupply = safeSub(totalSupply, _amount);

        notifyBurnCards(_from, _amount);
    }

    function burn(uint256 _amount) public {
        require(balanceOf[msg.sender] >= _amount);
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount);
        totalSupply = safeSub(totalSupply, _amount);

        notifyBurnCards(msg.sender, _amount);
    }

    function getIssuer() public view returns(address) {
        return issuer;
    }

}

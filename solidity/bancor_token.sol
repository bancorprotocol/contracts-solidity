pragma solidity ^0.4.9;
import "owned.sol";

/*
    Open issues:
    - throw vs. return value?
    - possibly add modifiers for each stage
    - possibly create a shared standard token contract and inherit from it, both for the BancorToken and for the BancorEtherToken
    - add miner abuse protection
    - allow exchanging between 2 reserve tokens directly? can be done through a 3rd party contract
    - startTrading - looping over the reserve - can run out of gas. Possibly split it and do it as a multi-step process
    - approve - to minimize the risk of the approve/transferFrom attack vector
                (see https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/), approve has to be called twice
                in 2 separate transactions - once to change the allowance to 0 and secondly to change it to the new allowance value.
                Also relevant to the BancorEtherToken
*/

// interfaces

contract ReserveToken { // any ERC20 standard token
    function balanceOf(address _owner) public constant returns (uint256 balance);
    function transfer(address _to, uint256 _value) public returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
}

contract BancorFormula {
    function calculatePurchaseValue(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _depositAmount) public constant returns (uint256 value);
    function calculateSaleValue(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _sellAmount) public constant returns (uint256 value);
    function newFormula() public constant returns (address newFormula);
}

contract BancorEvents {
    function newToken() public;
    function tokenUpdate() public;
    function tokenTransfer(address _from, address _to, uint256 _value) public;
    function tokenApproval(address _owner, address _spender, uint256 _value) public;
    function tokenConversion(address _reserveToken, address _trader, bool _isPurchase, uint256 _totalSupply,
                             uint256 _reserveBalance, uint256 _tokenAmount, uint256 _reserveAmount) public;
}

/*
    Bancor Token v0.2
*/
contract BancorToken is owned {
    enum Stage { Managed, Crowdsale, Traded }

    string public standard = 'Token 0.1';
    string public name = "";
    string public symbol = "";                          // 1-6 characters
    uint8 public numDecimalUnits = 0;                   // for display purposes only
    uint256 public totalSupply = 0;
    address public formula = 0x0;                       // bancor calculation formula contract address
    address public events = 0x0;                        // bancor events contract address
    address public crowdsale = 0x0;                     // crowdsale contract address
    uint256 public crowdsaleAllowance = 0;              // current number of tokens the crowdsale contract is allowed to issue
    Stage public stage = Stage.Managed;                 // token stage
    address[] public reserveTokens;                     // ERC20 standard token addresses
    mapping (address => uint8) public reserveRatioOf;   // token addresses -> constant reserve ratio, 1-99
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    // events, can be used to listen to the contract directly, as opposed to through the events contract
    event Update();
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
    event Conversion(address indexed _reserveToken, address indexed _trader, bool _isPurchase,
                     uint256 _totalSupply, uint256 _reserveBalance, uint256 _tokenAmount, uint256 _reserveAmount);

    /*
        _name               token name
        _symbol             token short symbol
        _numDecimalUnits    for display purposes only
        _formula            address of a bancor formula contract
        _events             optional, address of a bancor events contract
    */
    function BancorToken(string _name, string _symbol, uint8 _numDecimalUnits, address _formula, address _events) {
        if (bytes(_name).length == 0 || bytes(_symbol).length < 1 || bytes(_symbol).length > 6 || _formula == 0x0) // validate input
            throw;

        name = _name;
        symbol = _symbol;
        numDecimalUnits = _numDecimalUnits;
        formula = _formula;
        events = _events;

        if (events == 0x0)
            return;

        BancorEvents eventsContract = BancorEvents(events);
        eventsContract.newToken();
    }

    // allows executing a function by the owner in managed stage or by the crowdsale contract in crowdsale stage
    modifier onlyManager {
        if (stage == Stage.Traded ||
            stage == Stage.Managed && msg.sender != owner ||
            stage == Stage.Crowdsale && msg.sender != crowdsale) // validate state & permissions
            throw;
        _;
    }

    /*
        updates the bancor calculation formula contract address
        can only be called by the token owner

        the owner can only update the formula to a new one approved by the current formula's owner

        _formula     new formula contract address
    */
    function setFormula(address _formula) public onlyOwner returns (bool success) {
        BancorFormula formulaContract = BancorFormula(formula);
        if (formulaContract.newFormula() != _formula)
            throw;

        formula = _formula;
        return true;
    }

    /*
        returns the number of reserve tokens defined
    */
    function reserveTokenCount() public constant returns (uint8 count) {
        return uint8(reserveTokens.length);
    }

    /*
        defines a new reserve for the token (managed stage only)
        can only be called by the token owner

        _token  address of the reserve token
        _ratio  constant reserve ratio, 1-99
    */
    function addReserve(address _token, uint8 _ratio) public onlyOwner returns (bool success) {
        if (reserveRatioOf[_token] != 0 || _ratio < 1 || _ratio > 99) // validate input
            throw;
        if (stage != Stage.Managed) // validate state
            throw;

        reserveRatioOf[_token] = _ratio;
        reserveTokens.push(_token);
        dispatchUpdate();
        return true;
    }

    /*
        increases the token supply and sends the new tokens to an account
        can only be called by the token owner (in managed stage only) or the crowdsale contract (in a non manged stage only)

        _to         account to receive the new amount
        _amount     amount to increase the supply by
    */
    function issue(address _to, uint256 _amount) public returns (bool success) {
        if (stage == Stage.Managed && msg.sender != owner ||
            stage != Stage.Managed && msg.sender != crowdsale) // validate permissions
            throw;
        if (totalSupply + _amount < totalSupply) // supply overflow protection
            throw;
        if (balanceOf[_to] + _amount < balanceOf[_to]) // target account balance overflow protection
            throw;
        if (stage != Stage.Managed && _amount > crowdsaleAllowance) // check if the crowdsale contract is trying to issue more tokens than allowed
            throw;

        totalSupply += _amount;
        balanceOf[_to] += _amount;
        if (stage != Stage.Managed)
            crowdsaleAllowance -= _amount;

        dispatchUpdate();
        dispatchTransfer(this, _to, _amount);
        return true;
    }

    /*
        Removes tokens from an account and decreases the token supply
        can only be called by the token owner (in managed stage only) or the crowdsale contract (in crowdsale stage only)

        _from       account to remove the new amount from
        _amount     amount to decrease the supply by
    */
    function destroy(address _from, uint256 _amount) public onlyManager returns (bool success) {
        if (_amount > totalSupply) // negative supply protection
            throw;
        if (_amount > balanceOf[_from]) // target account negative balance protection
            throw;

        totalSupply -= _amount;
        balanceOf[_from] -= _amount;
        dispatchUpdate();
        dispatchTransfer(_from, this, _amount);
        return true;
    }

    /*
        withdraws tokens from the reserve and sends them to an account
        can only be called by the token owner (in managed stage only) or the crowdsale contract (in crowdsale stage only)

        _reserveToken    reserve token contract address
        _to              account to receive the new amount
        _amount          amount to withdraw (in the reserve token)
    */
    function withdraw(address _reserveToken, address _to, uint256 _amount) public onlyManager returns (bool success) {
        if (reserveRatioOf[_reserveToken] == 0 || _amount == 0) // validate input
            throw;

        ReserveToken reserveToken = ReserveToken(_reserveToken);
        return reserveToken.transfer(_to, _amount);
    }

    /*
        starts the crowdsale stage (managed stage only)
        can only be called by the token owner

        _crowdsale      new crowdsale contract address
        _allowance      maximum number of tokens that can be issued by the crowdsale contract
    */
    function startCrowdsale(address _crowdsale, uint256 _allowance) public onlyOwner returns (bool success) {
        if (_crowdsale == 0x0 || _allowance == 0) // validate input
            throw;
        if (stage != Stage.Managed || reserveTokens.length == 0) // validate state
            throw;

        crowdsale = _crowdsale;
        crowdsaleAllowance = _allowance;
        stage = Stage.Crowdsale;
        dispatchUpdate();
        return true;
    }

    /*
        starts the traded stage
        can only be called by the token owner (in managed stage only) or the crowdsale contract (in crowdsale stage only)
    */
    function startTrading() public onlyManager returns (bool success) {
        if (totalSupply == 0) // validate state
            throw;

        // make sure that there's balance in all the reserves 
        for (uint16 i = 0; i < reserveTokens.length; ++i) {
            ReserveToken reserveToken = ReserveToken(reserveTokens[i]);
            if (reserveToken.balanceOf(this) == 0)
                throw;
        }

        stage = Stage.Traded;
        dispatchUpdate();
        return true;
    }

    /*
        buys the token by depositing one of its reserve tokens

        _reserveToken   reserve token contract address
        _depositAmount  amount to deposit (in the reserve token)
        _minimumValue   if the conversion results in a value smaller than this value, it is cancelled
    */
    function buy(address _reserveToken, uint256 _depositAmount, uint256 _minimumValue) public returns (uint256 value) {
        uint8 reserveRatio = reserveRatioOf[_reserveToken];
        if (reserveRatio == 0 || _depositAmount == 0) // validate input
            throw;
        if (stage != Stage.Traded) // validate state
            throw;

        ReserveToken reserveToken = ReserveToken(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);

        BancorFormula formulaContract = BancorFormula(formula);
        value = formulaContract.calculatePurchaseValue(totalSupply, reserveBalance, reserveRatio, _depositAmount);
        if (value == 0 || value < _minimumValue) // trade gave nothing in return or didn't return a value that meets the minimum requested value
            throw;
        if (totalSupply + value < totalSupply) // supply overflow protection
            throw;
        if (!reserveToken.transferFrom(msg.sender, this, _depositAmount)) // can't withdraw funds from the reserve token
            throw;

        uint256 startSupply = totalSupply;
        totalSupply += value;
        balanceOf[msg.sender] += value;
        dispatchConversion(_reserveToken, msg.sender, true, startSupply, reserveBalance, value, _depositAmount);
        return value;
    }

    /*
        sells the token by withdrawing from one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the token)
        _minimumValue   if the conversion results in a value smaller than this value, it is cancelled
    */
    function sell(address _reserveToken, uint256 _sellAmount, uint256 _minimumValue) public returns (uint256 value) {
        uint8 reserveRatio = reserveRatioOf[_reserveToken];
        if (reserveRatio == 0 || _sellAmount == 0) // validate input
            throw;
        if (stage != Stage.Traded) // validate state
            throw;
        if (balanceOf[msg.sender] < _sellAmount) // balance check
            throw;

        ReserveToken reserveToken = ReserveToken(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);

        BancorFormula formulaContract = BancorFormula(formula);
        value = formulaContract.calculateSaleValue(totalSupply, reserveBalance, reserveRatio, _sellAmount);
        if (value == 0 || value < _minimumValue) // trade gave nothing in return or didn't return a value that meets the minimum requested value
            throw;
        if (reserveBalance <= value) // trade will deplete the reserve
            throw;

        uint256 startSupply = totalSupply;
        totalSupply -= _sellAmount;
        balanceOf[msg.sender] -= _sellAmount;
        if (!reserveToken.transfer(msg.sender, value)) // can't transfer funds to the caller
            throw;

        // if the supply was totally depleted, return to managed stage
        if (totalSupply == 0) {
            crowdsale = 0x0;
            crowdsaleAllowance = 0;
            stage = Stage.Managed;
        }

        dispatchConversion(_reserveToken, msg.sender, false, startSupply, reserveBalance, _sellAmount, value);
        return value;
    }

    // ERC20 standard methods

    // send coins
    function transfer(address _to, uint256 _value) public returns (bool success) {
        if (balanceOf[msg.sender] < _value) // balance check
            throw;
        if (balanceOf[_to] + _value < balanceOf[_to]) // overflow protection
            throw;

        balanceOf[msg.sender] -= _value;
        if (_to == address(this)) // transferring to the contract address destroys tokens
            totalSupply -= _value;
        else
            balanceOf[_to] += _value;

        dispatchTransfer(msg.sender, _to, _value);
        return true;
    }

    // allow another account/contract to spend some tokens on your behalf
    function approve(address _spender, uint256 _value) public returns (bool success) {
        // if the allowance isn't 0, it can only be updated to 0 to prevent an allowance change immediately after withdrawal
        if (_value != 0 && allowance[msg.sender][_spender] != 0)
            throw;

        allowance[msg.sender][_spender] = _value;

        Approval(msg.sender, _spender, _value);
        if (events == 0x0)
            return true;

        BancorEvents eventsContract = BancorEvents(events);
        eventsContract.tokenApproval(msg.sender, _spender, _value);
        return true;
    }

    // an account/contract attempts to get the coins
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        if (balanceOf[_from] < _value) // balance check
            throw;
        if (balanceOf[_to] + _value < balanceOf[_to]) // overflow protection
            throw;
        if (_value > allowance[_from][msg.sender]) // allowance check
            throw;

        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;

        dispatchTransfer(_from, _to, _value);
        return true;
    }

    // utility

    function dispatchUpdate() private {
        Update();
        if (events == 0x0)
            return;

        BancorEvents eventsContract = BancorEvents(events);
        eventsContract.tokenUpdate();
    }

    function dispatchTransfer(address _from, address _to, uint256 _value) private {
        Transfer(_from, _to, _value);
        if (events == 0x0)
            return;

        BancorEvents eventsContract = BancorEvents(events);
        eventsContract.tokenTransfer(_from, _to, _value);
    }

    function dispatchConversion(address _reserveToken, address _trader, bool _isPurchase,
                                uint256 _totalSupply, uint256 _reserveBalance, uint256 _tokenAmount, uint256 _reserveAmount) private {
        Conversion(_reserveToken, _trader, _isPurchase, _totalSupply, _reserveBalance, _tokenAmount, _reserveAmount);
        if (events == 0x0)
            return;

        BancorEvents eventsContract = BancorEvents(events);
        eventsContract.tokenConversion(_reserveToken, _trader, _isPurchase, _totalSupply, _reserveBalance, _tokenAmount, _reserveAmount);
    }

    // fallback

    function() {
        throw;
    }
}

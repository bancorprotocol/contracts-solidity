pragma solidity ^0.4.8;
import "./Owned.sol";

/*
    Open issues:
    - throw vs. return value?
    - possibly add modifiers for each stage
    - possibly create a shared standard token contract and inherit from it, both for the BancorToken and for the BancorEtherToken
    - add miner abuse protection
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
    function calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _depositAmount) public constant returns (uint256 amount);
    function calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _sellAmount) public constant returns (uint256 amount);
    function newFormula() public constant returns (address newFormula);
}

contract BancorEvents {
    function newToken() public;
    function tokenUpdate() public;
    function newTokenOwner(address _prevOwner, address _newOwner) public;
    function tokenTransfer(address _from, address _to, uint256 _value) public;
    function tokenApproval(address _owner, address _spender, uint256 _value) public;
    function tokenChange(address _fromToken, address _toToken, address _changer, uint256 _amount, uint256 _return) public;
}

/*
    Bancor Token v0.4
*/
contract BancorToken is Owned {
    struct Reserve {
        uint8 ratio;    // constant reserve ratio (CRR), 1-100
        bool isEnabled; // is purchase of the token enabled with the reserve, can be set by the owner
        bool isSet;     // is the reserve set, used to tell if the mapping element is defined
    }

    enum Stage { Managed, Crowdsale, Traded }

    string public standard = 'Token 0.1';
    string public name = "";
    string public symbol = "";                          // 1-6 characters
    uint8 public numDecimalUnits = 0;                   // for display purposes only
    uint256 public totalSupply = 0;
    address public formula = 0x0;                       // bancor calculation formula contract address
    address public events = 0x0;                        // bancor events contract address
    address public crowdsale = 0x0;                     // crowdsale contract address
    int256 public crowdsaleAllowance = 0;               // current number of tokens the crowdsale contract is allowed to issue, or -1 for unlimited
    Stage public stage = Stage.Managed;                 // token stage
    address[] public reserveTokens;                     // ERC20 standard token addresses
    mapping (address => Reserve) public reserves;       // reserve token addresses -> reserve data
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    uint8 private totalReserveRatio = 0;                // used to prevent increasing the total reserve ratio above 100% efficiently

    // events, can be used to listen to the contract directly, as opposed to through the events contract
    event Update();
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
    event Change(address indexed _fromToken, address indexed _toToken, address indexed _changer, uint256 _amount, uint256 _return);

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

    function setOwner(address _newOwner) public onlyOwner {
        address prevOwner = owner;
        super.setOwner(_newOwner);
        if (events == 0x0)
            return;

        BancorEvents eventsContract = BancorEvents(events);
        eventsContract.newTokenOwner(prevOwner, owner);
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
    function reserveTokenCount() public constant returns (uint16 count) {
        return uint16(reserveTokens.length);
    }

    /*
        returns the constant reserve ratio for the given reserve contract address

        _reserveToken    reserve token contract address
    */
    function reserveRatioOf(address _reserveToken) public constant returns (uint8 ratio) {
        return reserves[_reserveToken].ratio;
    }

    /*
        returns a value indicating whether purchasing is enabled with the given reserve

        _reserveToken    reserve token contract address
    */
    function isReserveEnabled(address _reserveToken) public constant returns (bool isEnabled) {
        return reserves[_reserveToken].isEnabled;
    }

    /*
        returns the number of changeable tokens supported by the contract
        note that the number of changable tokens is the number of reserve token, plus 1 (that represents the bancor token itself)
    */
    function changeableTokenCount() public constant returns (uint16 count) {
        return reserveTokenCount() + 1;
    }

    /*
        given a changable token index, returns the changable token contract address
    */
    function changeableToken(uint16 _tokenIndex) public constant returns (address tokenAddress) {
        if (_tokenIndex == 0)
            return this;
        return reserveTokens[_tokenIndex - 1];
    }

    /*
        defines a new reserve for the token (managed stage only)
        can only be called by the token owner

        _token  address of the reserve token
        _ratio  constant reserve ratio, 1-100
    */
    function addReserve(address _token, uint8 _ratio) public onlyOwner returns (bool success) {
        if (_token == address(this) || reserves[_token].isSet || _ratio < 1 || _ratio > 100 || totalReserveRatio + _ratio > 100) // validate input
            throw;
        if (stage != Stage.Managed) // validate state
            throw;

        reserves[_token].ratio = _ratio;
        reserves[_token].isEnabled = true;
        reserves[_token].isSet = true;
        reserveTokens.push(_token);
        totalReserveRatio += _ratio;
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
        if (_amount == 0) // validate input
            throw;
        if (stage == Stage.Managed && msg.sender != owner ||
            stage != Stage.Managed && msg.sender != crowdsale) // validate permissions
            throw;
        if (totalSupply + _amount < totalSupply) // supply overflow protection
            throw;
        if (balanceOf[_to] + _amount < balanceOf[_to]) // target account balance overflow protection
            throw;
        if (stage != Stage.Managed && crowdsaleAllowance >= 0 && _amount > uint256(crowdsaleAllowance)) // check if the crowdsale contract is trying to issue more tokens than allowed
            throw;

        totalSupply += _amount;
        balanceOf[_to] += _amount;
        if (stage != Stage.Managed && crowdsaleAllowance >= 0)
            crowdsaleAllowance -= int256(_amount);

        dispatchUpdate();
        dispatchTransfer(this, _to, _amount);
        return true;
    }

    /*
        removes tokens from an account and decreases the token supply
        can only be called by the token owner (in managed stage only) or the crowdsale contract (in crowdsale stage only)

        _from       account to remove the new amount from
        _amount     amount to decrease the supply by
    */
    function destroy(address _from, uint256 _amount) public onlyManager returns (bool success) {
        if (_amount == 0) // validate input
            throw;
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
        if (!reserves[_reserveToken].isSet || _amount == 0) // validate input
            throw;

        ReserveToken reserveToken = ReserveToken(_reserveToken);
        return reserveToken.transfer(_to, _amount);
    }

    /*
        disables purchasing with the given reserve token in case the reserve token got compromised
        can only be called by the token owner
        note that selling is still enabled regardless of this flag and it cannot be disabled by the owner

        _reserveToken    reserve token contract address
        _disable         true to disable the token, false to re-enable it
    */
    function disableReserve(address _reserveToken, bool _disable) public onlyOwner {
        if (!reserves[_reserveToken].isSet) // validate input
            throw;

        reserves[_reserveToken].isEnabled = !_disable;
        dispatchUpdate();
    }

    /*
        starts the crowdsale stage (managed stage only)
        can only be called by the token owner

        _crowdsale      new crowdsale contract address
        _allowance      maximum number of tokens that can be issued by the crowdsale contract, or -1 for unlimited
    */
    function startCrowdsale(address _crowdsale, int256 _allowance) public onlyOwner returns (bool success) {
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
        returns the expected return for changing a specific amount of _fromToken to _toToken

        _fromToken  token to change from
        _toToken    token to change to
        _amount     amount to change, in fromToken
    */
    function getReturn(address _fromToken, address _toToken, uint256 _amount) public constant returns (uint256 amount) {
        if (_fromToken == _toToken) // validate input
            throw;
        if (_fromToken != address(this) && !reserves[_fromToken].isSet) // validate from token input
            throw;
        if (_toToken != address(this) && !reserves[_toToken].isSet) // validate to token input
            throw;

        // change between the token and one of its reserves
        if (_toToken == address(this))
            return getPurchaseReturn(_fromToken, _amount);
        else if (_fromToken == address(this))
            return getSaleReturn(_toToken, _amount);

        // change between 2 reserves
        uint256 tempAmount = getPurchaseReturn(_fromToken, _amount);
        return getSaleReturn(_toToken, tempAmount);
    }

    /*
        changes a specific amount of _fromToken to _toToken

        _fromToken  token to change from
        _toToken    token to change to
        _amount     amount to change, in fromToken
        _minReturn  if the change results in an amount smaller than the minimum return, it is cancelled
    */
    function change(address _fromToken, address _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256 amount) {
        if (_fromToken == _toToken) // validate input
            throw;
        if (_fromToken != address(this) && !reserves[_fromToken].isSet) // validate from token input
            throw;
        if (_toToken != address(this) && !reserves[_toToken].isSet) // validate to token input
            throw;

        // change between the token and one of its reserves
        if (_toToken == address(this))
            return buy(_fromToken, _amount, _minReturn);
        else if (_fromToken == address(this))
            return sell(_toToken, _amount, _minReturn);

        // change between 2 reserves
        uint256 tempAmount = buy(_fromToken, _amount, 0);
        return sell(_toToken, tempAmount, _minReturn);
    }

    /*
        returns the expected return for buying the token for a reserve token

        _reserveToken   reserve token contract address
        _depositAmount  amount to deposit (in the reserve token)
    */
    function getPurchaseReturn(address _reserveToken, uint256 _depositAmount) public constant returns (uint256 amount) {
        Reserve reserve = reserves[_reserveToken];
        if (!reserve.isSet || !reserve.isEnabled || _depositAmount == 0) // validate input
            throw;
        if (stage != Stage.Traded) // validate state
            throw;

        ReserveToken reserveToken = ReserveToken(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);

        BancorFormula formulaContract = BancorFormula(formula);
        return formulaContract.calculatePurchaseReturn(totalSupply, reserveBalance, reserve.ratio, _depositAmount);
    }

    /*
        returns the expected return for selling the token for one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the bancor token)
    */
    function getSaleReturn(address _reserveToken, uint256 _sellAmount) public constant returns (uint256 amount) {
        Reserve reserve = reserves[_reserveToken];
        if (!reserve.isSet || _sellAmount == 0) // validate input
            throw;
        if (stage != Stage.Traded) // validate state
            throw;

        ReserveToken reserveToken = ReserveToken(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);

        BancorFormula formulaContract = BancorFormula(formula);
        return formulaContract.calculateSaleReturn(totalSupply, reserveBalance, reserve.ratio, _sellAmount);
    }

    /*
        buys the token by depositing one of its reserve tokens

        _reserveToken   reserve token contract address
        _depositAmount  amount to deposit (in the reserve token)
        _minReturn      if the change results in an amount smaller than the minimum return, it is cancelled
    */
    function buy(address _reserveToken, uint256 _depositAmount, uint256 _minReturn) public returns (uint256 amount) {
        amount = getPurchaseReturn(_reserveToken, _depositAmount);
        if (amount == 0 || amount < _minReturn) // trade gave nothing in return or didn't return an amount that meets the minimum requested amount
            throw;
        if (totalSupply + amount < totalSupply) // supply overflow protection
            throw;

        ReserveToken reserveToken = ReserveToken(_reserveToken);
        if (!reserveToken.transferFrom(msg.sender, this, _depositAmount)) // can't withdraw funds from the reserve token
            throw;

        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        dispatchChange(_reserveToken, this, msg.sender, _depositAmount, amount);
        return amount;
    }

    /*
        sells the token by withdrawing from one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the bancor token)
        _minReturn      if the change results in an amount smaller the minimum return, it is cancelled
    */
    function sell(address _reserveToken, uint256 _sellAmount, uint256 _minReturn) public returns (uint256 amount) {
        if (balanceOf[msg.sender] < _sellAmount) // balance check
            throw;

        amount = getSaleReturn(_reserveToken, _sellAmount);
        if (amount == 0 || amount < _minReturn) // trade gave nothing in return or didn't return an amount that meets the minimum requested amount
            throw;
        
        ReserveToken reserveToken = ReserveToken(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);
        if (reserveBalance <= amount) // trade will deplete the reserve
            throw;

        totalSupply -= _sellAmount;
        balanceOf[msg.sender] -= _sellAmount;
        if (!reserveToken.transfer(msg.sender, amount)) // can't transfer funds to the caller
            throw;

        // if the supply was totally depleted, return to managed stage
        if (totalSupply == 0) {
            crowdsale = 0x0;
            crowdsaleAllowance = 0;
            stage = Stage.Managed;
        }

        dispatchChange(this, _reserveToken, msg.sender, _sellAmount, amount);
        return amount;
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

    function dispatchChange(address _fromToken, address _toToken, address _changer, uint256 _amount, uint256 _return) private {
        Change(_fromToken, _toToken, _changer, _amount, _return);
        if (events == 0x0)
            return;

        BancorEvents eventsContract = BancorEvents(events);
        eventsContract.tokenChange(_fromToken, _toToken, _changer, _amount, _return);
    }

    // fallback

    function() {
        throw;
    }
}

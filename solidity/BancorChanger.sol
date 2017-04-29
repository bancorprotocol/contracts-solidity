pragma solidity ^0.4.10;
import './Owned.sol';
import './TokenChangerInterface.sol';
import './ERC20TokenInterface.sol';
import './BancorEventsInterface.sol';

/*
    Open issues:
    - add miner abuse protection
    - assumes that the reserve tokens either return true for transfer/transferFrom or throw - possibly remove the reliance on the return value
*/

// interfaces

contract SmartToken {
    function totalSupply() public constant returns (uint256 totalSupply);

    function issue(address _to, uint256 _amount) public returns (bool success);
    function destroy(address _from, uint256 _amount) public returns (bool success);
    function setChanger(address _changer, bool _disableTransfers) public returns (bool success);
}

contract BancorFormula {
    function calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _depositAmount) public constant returns (uint256 amount);
    function calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _sellAmount) public constant returns (uint256 amount);
    function newFormula() public constant returns (address newFormula);
}

contract BancorEvents is BancorEventsInterface {
    function tokenChange(address _fromToken, address _toToken, address _changer, uint256 _amount, uint256 _return) public;
}

/*
    Bancor Changer v0.1
*/
contract BancorChanger is Owned, TokenChangerInterface {
    struct Reserve {
        uint8 ratio;    // constant reserve ratio (CRR), 1-100
        bool isEnabled; // is purchase of the token enabled with the reserve, can be set by the owner
        bool isSet;     // is the reserve set, used to tell if the mapping element is defined
    }

    address public token = 0x0;                     // main token governed by the changer
    address public formula = 0x0;                   // bancor calculation formula contract address
    address public events = 0x0;                    // bancor events contract address
    bool public isActive = false;                   // true if the change functionality can now be used, false if not
    address[] public reserveTokens;                 // ERC20 standard token addresses
    mapping (address => Reserve) public reserves;   // reserve token addresses -> reserve data
    uint8 private totalReserveRatio = 0;            // used to prevent increasing the total reserve ratio above 100% efficiently

    // events, can be used to listen to the contract directly, as opposed to through the events contract
    event Change(address indexed _fromToken, address indexed _toToken, address indexed _changer, uint256 _amount, uint256 _return);

    /*
        _token              main token governed by the changer
        _formula            address of a bancor formula contract
        _events             optional, address of a bancor events contract
    */
    function BancorChanger(address _token, address _formula, address _events)
        validAddress(_token)
        validAddress(_formula)
    {
        token = _token;
        formula = _formula;
        events = _events;
    }

    // validates an address - currently only checks that it isn't null
    modifier validAddress(address _address) {
        assert(_address != 0x0);
        _;
    }

    // validates a reserve token address - verifies that the address belongs to one of the reserve tokens
    modifier validReserve(address _address) {
        assert(reserves[_address].isSet);
        _;
    }

    // validates a token address - verifies that the address belongs to one of the changable tokens
    modifier validToken(address _address) {
        assert(_address == token || reserves[_address].isSet);
        _;
    }

    // ensures that changing is activated
    modifier activeOnly() {
        assert(isActive);
        _;
    }

    /*
        updates the bancor calculation formula contract address
        can only be called by the owner

        the owner can only update the formula to a new one approved by the current formula's owner

        _formula     new formula contract address
    */
    function setFormula(address _formula)
        public
        ownerOnly
        validAddress(_formula)
        returns (bool success)
    {
        BancorFormula formulaContract = BancorFormula(formula);
        require(_formula == formulaContract.newFormula());
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
        returns the number of changeable tokens supported by the contract
        note that the number of changable tokens is the number of reserve token, plus 1 (that represents the main token)
    */
    function changeableTokenCount() public constant returns (uint16 count) {
        return reserveTokenCount() + 1;
    }

    /*
        given a changable token index, returns the changable token contract address
    */
    function changeableToken(uint16 _tokenIndex) public constant returns (address tokenAddress) {
        if (_tokenIndex == 0)
            return token;
        return reserveTokens[_tokenIndex - 1];
    }

    /*
        defines a new reserve for the token (managed stage only)
        can only be called by the token owner

        _token  address of the reserve token
        _ratio  constant reserve ratio, 1-100
    */
    function addReserve(address _token, uint8 _ratio)
        public
        ownerOnly
        validAddress(_token)
        returns (bool success)
    {
        require(_token != address(this) && _token != token && !reserves[_token].isSet && _ratio > 0 && _ratio <= 100 && totalReserveRatio + _ratio <= 100); // validate input

        reserves[_token].ratio = _ratio;
        reserves[_token].isEnabled = true;
        reserves[_token].isSet = true;
        reserveTokens.push(_token);
        totalReserveRatio += _ratio;
        return true;
    }

    /*
        withdraws tokens from the reserve and sends them to an account
        can only be called by the token owner (in managed stage only) or the crowdsale contract (in crowdsale stage only)

        _reserveToken    reserve token contract address
        _to              account to receive the new amount
        _amount          amount to withdraw (in the reserve token)
    */
    function withdraw(address _reserveToken, address _to, uint256 _amount)
        public
        ownerOnly
        validReserve(_reserveToken)
        returns (bool success)
    {
        require(_amount != 0); // validate input
        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        return reserveToken.transfer(_to, _amount);
    }

    /*
        disables purchasing with the given reserve token in case the reserve token got compromised
        can only be called by the token owner
        note that selling is still enabled regardless of this flag and it cannot be disabled by the owner

        _reserveToken    reserve token contract address
        _disable         true to disable the token, false to re-enable it
    */
    function disableReserve(address _reserveToken, bool _disable)
        public
        ownerOnly
        validReserve(_reserveToken)
    {
        reserves[_reserveToken].isEnabled = !_disable;
    }

    /*
        activates the change logic
        can only be called by the owner
        once changing is activated, it cannot be deactivated by the owner anymore
    */
    function activate() public ownerOnly returns (bool success) {
        SmartToken mainToken = SmartToken(token);
        assert(mainToken.totalSupply() != 0 && reserveTokens.length > 0); // validate state
        isActive = true;
        return true;
    }

    /*
        returns the expected return for changing a specific amount of _fromToken to _toToken

        _fromToken  token to change from
        _toToken    token to change to
        _amount     amount to change, in fromToken
    */
    function getReturn(address _fromToken, address _toToken, uint256 _amount)
        public
        constant
        validToken(_fromToken)
        validToken(_toToken)
        returns (uint256 amount)
    {
        require(_fromToken != _toToken); // validate input

        // change between the token and one of its reserves
        if (_toToken == token)
            return getPurchaseReturn(_fromToken, _amount);
        else if (_fromToken == token)
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
    function change(address _fromToken, address _toToken, uint256 _amount, uint256 _minReturn)
        public
        validToken(_fromToken)
        validToken(_toToken)
        returns (uint256 amount)
    {
        require(_fromToken != _toToken); // validate input

        // change between the token and one of its reserves
        if (_toToken == token)
            return buy(_fromToken, _amount, _minReturn);
        else if (_fromToken == token)
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
    function getPurchaseReturn(address _reserveToken, uint256 _depositAmount)
        public
        constant
        activeOnly
        validReserve(_reserveToken)
        returns (uint256 amount)
    {
        Reserve reserve = reserves[_reserveToken];
        require(reserve.isEnabled && _depositAmount != 0); // validate input

        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);
        assert(reserveBalance != 0); // validate state

        ERC20TokenInterface mainToken = ERC20TokenInterface(token);
        uint256 mainSupply = mainToken.totalSupply();
        BancorFormula formulaContract = BancorFormula(formula);
        return formulaContract.calculatePurchaseReturn(mainSupply, reserveBalance, reserve.ratio, _depositAmount);
    }

    /*
        returns the expected return for selling the token for one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the main token)
    */
    function getSaleReturn(address _reserveToken, uint256 _sellAmount)
        public
        constant
        activeOnly
        validReserve(_reserveToken)
        returns (uint256 amount)
    {
        ERC20TokenInterface mainToken = ERC20TokenInterface(token);
        require(_sellAmount != 0 && _sellAmount <= mainToken.balanceOf(msg.sender)); // validate input

        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);
        assert(reserveBalance != 0); // validate state
        
        uint256 mainSupply = mainToken.totalSupply();
        Reserve reserve = reserves[_reserveToken];
        BancorFormula formulaContract = BancorFormula(formula);
        return formulaContract.calculateSaleReturn(mainSupply, reserveBalance, reserve.ratio, _sellAmount);
    }

    /*
        buys the token by depositing one of its reserve tokens

        _reserveToken   reserve token contract address
        _depositAmount  amount to deposit (in the reserve token)
        _minReturn      if the change results in an amount smaller than the minimum return, it is cancelled
    */
    function buy(address _reserveToken, uint256 _depositAmount, uint256 _minReturn) public returns (uint256 amount) {
        amount = getPurchaseReturn(_reserveToken, _depositAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        assert(reserveToken.transferFrom(msg.sender, this, _depositAmount)); // transfer _depositAmount funds from the caller in the reserve token

        SmartToken mainToken = SmartToken(token);
        assert(mainToken.issue(msg.sender, amount)); // issue new funds to the caller in the main token
        dispatchChange(_reserveToken, token, msg.sender, _depositAmount, amount);
        return amount;
    }

    /*
        sells the token by withdrawing from one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the main token)
        _minReturn      if the change results in an amount smaller the minimum return, it is cancelled
    */
    function sell(address _reserveToken, uint256 _sellAmount, uint256 _minReturn) public returns (uint256 amount) {
        amount = getSaleReturn(_reserveToken, _sellAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount
        
        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);
        assert(amount < reserveBalance); // ensuring that the trade won't deplete the reserve

        SmartToken mainToken = SmartToken(token);
        assert(mainToken.destroy(msg.sender, _sellAmount)); // destroy _sellAmount from the caller in the main token
        assert(reserveToken.transfer(msg.sender, amount)); // transfer funds to the caller in the reserve token

        dispatchChange(this, _reserveToken, msg.sender, _sellAmount, amount);

        // if the supply was totally depleted, disconnect from the main token
        if (mainToken.totalSupply() == 0)
            mainToken.setChanger(0x0, false);

        return amount;
    }

    // utility

    function dispatchChange(address _fromToken, address _toToken, address _changer, uint256 _amount, uint256 _return) private {
        Change(_fromToken, _toToken, _changer, _amount, _return);
        if (events == 0x0)
            return;

        BancorEventsInterface eventsContract = BancorEventsInterface(events);
        eventsContract.tokenChange(_fromToken, _toToken, _changer, _amount, _return);
    }

    // fallback
    function() {
        assert(false);
    }
}

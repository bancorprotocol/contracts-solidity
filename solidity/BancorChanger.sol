pragma solidity ^0.4.10;
import './BancorEventsDispatcher.sol';
import './TokenChangerInterface.sol';
import './SmartTokenInterface.sol';

/*
    Open issues:
    - add miner abuse protection
    - assumes that the reserve tokens either return true for transfer/transferFrom or throw - possibly remove the reliance on the return value
*/

// interfaces

contract BancorFormula {
    function calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _depositAmount) public constant returns (uint256 amount);
    function calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _sellAmount) public constant returns (uint256 amount);
}

/*
    Bancor Changer v0.1
*/
contract BancorChanger is BancorEventsDispatcher, TokenChangerInterface {
    struct Reserve {
        uint8 ratio;    // constant reserve ratio (CRR), 1-100
        bool isEnabled; // is purchase of the smart token enabled with the reserve, can be set by the owner
        bool isSet;     // is the reserve set, used to tell if the mapping element is defined
    }

    SmartTokenInterface public token;               // smart token governed by the changer
    BancorFormula public formula;                   // bancor calculation formula contract
    bool public isActive = false;                   // true if the change functionality can now be used, false if not
    address[] public reserveTokens;                 // ERC20 standard token addresses
    mapping (address => Reserve) public reserves;   // reserve token addresses -> reserve data
    uint8 private totalReserveRatio = 0;            // used to prevent increasing the total reserve ratio above 100% efficiently

    // events, can be used to listen to the contract directly, as opposed to through the events contract
    event Change(address indexed _fromToken, address indexed _toToken, address indexed _trader, uint256 _amount, uint256 _return);

    /*
        _token      smart token governed by the changer
        _formula    address of a bancor formula contract
        _events     optional, address of a bancor events contract
    */
    function BancorChanger(address _token, address _formula, address _events)
        BancorEventsDispatcher(_events)
        validAddress(_token)
        validAddress(_formula)
    {
        token = SmartTokenInterface(_token);
        formula = BancorFormula(_formula);
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
        assert(_address == address(token) || reserves[_address].isSet);
        _;
    }

    // ensures that token changing is active
    modifier active() {
        assert(isActive);
        _;
    }

    // ensures that token changing is not active
    modifier inactive() {
        assert(!isActive);
        _;
    }

    /*
        returns the number of reserve tokens defined
    */
    function reserveTokenCount() public constant returns (uint16 count) {
        return uint16(reserveTokens.length);
    }

    /*
        returns the number of changeable tokens supported by the contract
        note that the number of changable tokens is the number of reserve token, plus 1 (that represents the smart token)
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
        defines a new reserve for the token
        can only be called by the changer owner while the changer is inactive

        _token  address of the reserve token
        _ratio  constant reserve ratio, 1-100
    */
    function addReserve(address _token, uint8 _ratio)
        public
        ownerOnly
        inactive
        validAddress(_token)
        returns (bool success)
    {
        require(_token != address(this) && _token != address(token) && !reserves[_token].isSet && _ratio > 0 && _ratio <= 100 && totalReserveRatio + _ratio <= 100); // validate input

        reserves[_token].ratio = _ratio;
        reserves[_token].isEnabled = true;
        reserves[_token].isSet = true;
        reserveTokens.push(_token);
        totalReserveRatio += _ratio;
        return true;
    }

    /*
        allows the owner to execute the smart token's issue function

        _to         account to receive the new amount
        _amount     amount to increase the supply by
    */
    function issueToken(address _to, uint256 _amount) public ownerOnly returns (bool success) {
        return token.issue(_to, _amount);
    }

    /*
        allows the owner to execute the smart token's destroy function

        _from       account to remove the new amount from
        _amount     amount to decrease the supply by
    */
    function destroyToken(address _from, uint256 _amount) public ownerOnly returns (bool success) {
        return token.destroy(_from, _amount);
    }

    /*
        withdraws tokens from the reserve and sends them to an account
        can only be called by the changer owner while the changer is inactive

        _reserveToken    reserve token contract address
        _to              account to receive the new amount
        _amount          amount to withdraw (in the reserve token)
    */
    function withdraw(address _reserveToken, address _to, uint256 _amount)
        public
        ownerOnly
        validReserve(_reserveToken)
        validAddress(_to)
        returns (bool success)
    {
        require(_to != address(this) && _amount != 0); // validate input
        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        return reserveToken.transfer(_to, _amount);
    }

    /*
        disables purchasing with the given reserve token in case the reserve token got compromised
        can only be called by the changer owner
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
        sets the smart token's changer address to a different one instead of the current contract address
        can only be called by the owner
        the changer can be set to null to transfer ownership from the changer to the original smart token's owner

        _changer    new changer contract address (can also be set to 0x0 to remove the current changer)
    */
    function setTokenChanger(address _changer)
        public
        ownerOnly
        validAddress(_changer)
        returns (bool success)
    {
        require(_changer != address(this));
        return token.setChanger(_changer);
    }

    /*
        activates the change logic
        can only be called by the owner
        once changing is activated, it cannot be deactivated by the owner anymore
        activating the change logic also enables transfers in the smart token
    */
    function activate()
        public
        ownerOnly
        inactive
        returns (bool success)
    {
        assert(token.totalSupply() != 0 && reserveTokens.length > 0); // validate state
        token.disableTransfers(false);
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
        address tokenAddress = address(token);
        if (_toToken == tokenAddress)
            return getPurchaseReturn(_fromToken, _amount);
        else if (_fromToken == tokenAddress)
            return getSaleReturn(_toToken, _amount);

        // change between 2 reserves
        uint256 tempAmount = getPurchaseReturn(_fromToken, _amount);
        return getSaleReturn(_toToken, tempAmount);
    }

    /*
        returns the expected return for buying the token for a reserve token

        _reserveToken   reserve token contract address
        _depositAmount  amount to deposit (in the reserve token)
    */
    function getPurchaseReturn(address _reserveToken, uint256 _depositAmount)
        public
        constant
        active
        validReserve(_reserveToken)
        returns (uint256 amount)
    {
        Reserve reserve = reserves[_reserveToken];
        require(reserve.isEnabled && _depositAmount != 0); // validate input

        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);
        assert(reserveBalance != 0); // validate state

        uint256 tokenSupply = token.totalSupply();
        return formula.calculatePurchaseReturn(tokenSupply, reserveBalance, reserve.ratio, _depositAmount);
    }

    /*
        returns the expected return for selling the token for one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the smart token)
    */
    function getSaleReturn(address _reserveToken, uint256 _sellAmount)
        public
        constant
        active
        validReserve(_reserveToken)
        returns (uint256 amount)
    {
        require(_sellAmount != 0 && _sellAmount <= token.balanceOf(msg.sender)); // validate input

        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);
        assert(reserveBalance != 0); // validate state
        
        uint256 tokenSupply = token.totalSupply();
        Reserve reserve = reserves[_reserveToken];
        return formula.calculateSaleReturn(tokenSupply, reserveBalance, reserve.ratio, _sellAmount);
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
        address tokenAddress = address(token);
        if (_toToken == tokenAddress)
            return buy(_fromToken, _amount, _minReturn);
        else if (_fromToken == tokenAddress)
            return sell(_toToken, _amount, _minReturn);

        // change between 2 reserves
        uint256 tempAmount = buy(_fromToken, _amount, 0);
        return sell(_toToken, tempAmount, _minReturn);
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
        assert(token.issue(msg.sender, amount)); // issue new funds to the caller in the smart token

        dispatchChange(_reserveToken, token, msg.sender, _depositAmount, amount);
        return amount;
    }

    /*
        sells the token by withdrawing from one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the smart token)
        _minReturn      if the change results in an amount smaller the minimum return, it is cancelled
    */
    function sell(address _reserveToken, uint256 _sellAmount, uint256 _minReturn) public returns (uint256 amount) {
        amount = getSaleReturn(_reserveToken, _sellAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount
        
        ERC20TokenInterface reserveToken = ERC20TokenInterface(_reserveToken);
        uint256 reserveBalance = reserveToken.balanceOf(this);
        assert(amount <= reserveBalance); // ensure that the trade won't result in negative reserve

        uint256 tokenSupply = token.totalSupply();
        assert(amount < reserveBalance || _sellAmount == tokenSupply); // ensure that the trade will only deplete the reserve if the total supply is depleted as well
        assert(token.destroy(msg.sender, _sellAmount)); // destroy _sellAmount from the caller in the smart token
        assert(reserveToken.transfer(msg.sender, amount)); // transfer funds to the caller in the reserve token

        // if the supply was totally depleted, disconnect from the smart token
        if (_sellAmount == tokenSupply)
            token.setChanger(0x0);

        dispatchChange(this, _reserveToken, msg.sender, _sellAmount, amount);
        return amount;
    }

    // utility

    function dispatchChange(address _fromToken, address _toToken, address _trader, uint256 _amount, uint256 _return) private {
        Change(_fromToken, _toToken, _trader, _amount, _return);

        if (address(events) != 0x0)
            events.tokenChange(_fromToken, _toToken, _trader, _amount, _return);
    }

    // fallback
    function() {
        assert(false);
    }
}

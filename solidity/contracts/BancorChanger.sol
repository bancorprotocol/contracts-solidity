pragma solidity ^0.4.10;
import './Owned.sol';
import './SafeMath.sol';
import './ITokenChanger.sol';
import './ISmartToken.sol';
import './IBancorFormula.sol';

/*
    Open issues:
    - add miner abuse protection
    - possibly add getters for reserve fields so that the client won't need to rely on the order in the struct
*/

/*
    Bancor Changer v0.1

    The Bancor version of the token changer, allows changing between a smart token and other ERC20 tokens and between different ERC20 tokens and themselves

    ERC20 reserve token balance can be virtual, meaning that the calculations are based on the virtual balance instead of relying on
    the actual reserve balance. This is a security mechanism that prevents the need to keep a very large (and valuable) balance in a single contract

    The changer is upgradable - the owner can replace it with a new version by calling setTokenChanger, it's a safety mechanism in case of bugs/exploits
*/
contract BancorChanger is Owned, SafeMath, ITokenChanger {
    struct Reserve {
        uint256 virtualBalance;         // virtual balance
        uint8 ratio;                    // constant reserve ratio (CRR), 1-100
        bool isVirtualBalanceEnabled;   // true if virtual balance is enabled, false if not
        bool isEnabled;                 // is purchase of the smart token enabled with the reserve, can be set by the owner
        bool isSet;                     // used to tell if the mapping element is defined
    }

    string public version = '0.1';
    string public changerType = 'bancor';

    ISmartToken public token;                       // smart token governed by the changer
    IBancorFormula public formula;                  // bancor calculation formula contract
    address[] public reserveTokens;                 // ERC20 standard token addresses
    mapping (address => Reserve) public reserves;   // reserve token addresses -> reserve data
    uint8 private totalReserveRatio = 0;            // used to prevent increasing the total reserve ratio above 100% efficiently

    // triggered when a change between two tokens occurs
    event Change(address indexed _fromToken, address indexed _toToken, address indexed _trader, uint256 _amount, uint256 _return);

    /*
        _token      smart token governed by the changer
        _formula    address of a bancor formula contract
    */
    function BancorChanger(ISmartToken _token, IBancorFormula _formula, IERC20Token _reserveToken, uint8 _reserveRatio)
        validAddress(_token)
        validAddress(_formula)
    {
        token = _token;
        formula = _formula;

        if (address(_reserveToken) != 0x0)
            addReserve(_reserveToken, _reserveRatio, false);
    }

    // validates an address - currently only checks that it isn't null
    modifier validAddress(address _address) {
        require(_address != 0x0);
        _;
    }

    // validates a reserve token address - verifies that the address belongs to one of the reserve tokens
    modifier validReserve(address _address) {
        require(reserves[_address].isSet);
        _;
    }

    // validates a token address - verifies that the address belongs to one of the changeable tokens
    modifier validToken(address _address) {
        require(_address == address(token) || reserves[_address].isSet);
        _;
    }

    // validates reserve ratio range
    modifier validReserveRatio(uint8 _ratio) {
        require(_ratio > 0 && _ratio <= 100);
        _;
    }

    // verifies that an amount is greater than zero
    modifier validAmount(uint256 _amount) {
        require(_amount > 0);
        _;
    }

    // ensures that token changing is connected to the smart token
    modifier active() {
        assert(token.changer() == this);
        _;
    }

    // ensures that token changing is not conneccted to the smart token
    modifier inactive() {
        assert(token.changer() != this);
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
        note that the number of changeable tokens is the number of reserve token, plus 1 (that represents the smart token)
    */
    function changeableTokenCount() public constant returns (uint16 count) {
        return reserveTokenCount() + 1;
    }

    /*
        given a changeable token index, returns the changeable token contract address
    */
    function changeableToken(uint16 _tokenIndex) public constant returns (address tokenAddress) {
        if (_tokenIndex == 0)
            return token;
        return reserveTokens[_tokenIndex - 1];
    }

    /*
        defines a new reserve for the token
        can only be called by the changer owner while the changer is inactive

        _token                  address of the reserve token
        _ratio                  constant reserve ratio, 1-100
        _enableVirtualBalance   true to enable virtual balance for the reserve, false to disable it
    */
    function addReserve(IERC20Token _token, uint8 _ratio, bool _enableVirtualBalance)
        public
        ownerOnly
        inactive
        validAddress(_token)
        validReserveRatio(_ratio)
    {
        require(_token != address(this) && _token != address(token) && !reserves[_token].isSet && totalReserveRatio + _ratio <= 100); // validate input

        reserves[_token].virtualBalance = 0;
        reserves[_token].ratio = _ratio;
        reserves[_token].isVirtualBalanceEnabled = _enableVirtualBalance;
        reserves[_token].isEnabled = true;
        reserves[_token].isSet = true;
        reserveTokens.push(_token);
        totalReserveRatio += _ratio;
    }

    /*
        updates one of the token reserves
        can only be called by the changer owner

        _reserveToken           address of the reserve token
        _ratio                  constant reserve ratio, 1-100
        _enableVirtualBalance   true to enable virtual balance for the reserve, false to disable it
        _virtualBalance         new reserve's virtual balance
    */
    function updateReserve(IERC20Token _reserveToken, uint8 _ratio, bool _enableVirtualBalance, uint256 _virtualBalance)
        public
        ownerOnly
        validReserve(_reserveToken)
        validReserveRatio(_ratio)
    {
        Reserve reserve = reserves[_reserveToken];
        require(totalReserveRatio - reserve.ratio + _ratio <= 100); // validate input

        totalReserveRatio = totalReserveRatio - reserve.ratio + _ratio;
        reserve.ratio = _ratio;
        reserve.isVirtualBalanceEnabled = _enableVirtualBalance;
        reserve.virtualBalance = _virtualBalance;
    }

    /*
        disables purchasing with the given reserve token in case the reserve token got compromised
        can only be called by the changer owner
        note that selling is still enabled regardless of this flag and it cannot be disabled by the owner

        _reserveToken    reserve token contract address
        _disable         true to disable the token, false to re-enable it
    */
    function disableReserve(IERC20Token _reserveToken, bool _disable)
        public
        ownerOnly
        validReserve(_reserveToken)
    {
        reserves[_reserveToken].isEnabled = !_disable;
    }

    /*
        returns the reserve's virtual balance if one is defined, otherwise returns the actual balance

        _reserveToken    reserve token contract address
    */
    function getReserveBalance(IERC20Token _reserveToken)
        public
        constant
        validReserve(_reserveToken)
        returns (uint256 balance)
    {
        Reserve reserve = reserves[_reserveToken];
        return reserve.isVirtualBalanceEnabled ? reserve.virtualBalance : _reserveToken.balanceOf(this);
    }

    /*
        allows the owner to execute the smart token's issue function

        _to         account to receive the new amount
        _amount     amount to increase the supply by
    */
    function issueTokens(address _to, uint256 _amount) public ownerOnly {
        token.issue(_to, _amount);
    }

    /*
        allows the owner to execute the smart token's destroy function

        _from       account to remove the new amount from
        _amount     amount to decrease the supply by
    */
    function destroyTokens(address _from, uint256 _amount) public ownerOnly {
        token.destroy(_from, _amount);
    }

    /*
        withdraws tokens from the reserve and sends them to an account
        can only be called by the changer owner

        _reserveToken    reserve token contract address
        _to              account to receive the new amount
        _amount          amount to withdraw (in the reserve token)
    */
    function withdraw(IERC20Token _reserveToken, address _to, uint256 _amount)
        public
        ownerOnly
        validReserve(_reserveToken)
        validAddress(_to)
        validAmount(_amount)
    {
        require(_to != address(this) && _to != address(token)); // validate input

        assert(_reserveToken.transfer(_to, _amount));

        // update virtual balance if relevant
        Reserve reserve = reserves[_reserveToken];
        if (reserve.isVirtualBalanceEnabled)
            reserve.virtualBalance = safeSub(reserve.virtualBalance, _amount);
    }

    /*
        sets the smart token's changer address to a different one instead of the current contract address
        can only be called by the owner
        the changer can be set to null to transfer ownership from the changer to the original smart token's owner

        _changer    new changer contract address (can also be set to 0x0 to remove the current changer)
    */
    function setTokenChanger(ITokenChanger _changer) public ownerOnly {
        require(_changer != this && _changer != address(token)); // validate input
        token.setChanger(_changer);
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
        IERC20Token fromToken = IERC20Token(_fromToken);
        IERC20Token toToken = IERC20Token(_toToken);

        // change between the token and one of its reserves
        if (toToken == token)
            return getPurchaseReturn(fromToken, _amount);
        else if (fromToken == token)
            return getSaleReturn(toToken, _amount);

        // change between 2 reserves
        uint256 purchaseReturnAmount = getPurchaseReturn(fromToken, _amount);
        return getSaleReturn(toToken, purchaseReturnAmount, safeAdd(token.totalSupply(), purchaseReturnAmount));
    }

    /*
        returns the expected return for buying the token for a reserve token

        _reserveToken   reserve token contract address
        _depositAmount  amount to deposit (in the reserve token)
    */
    function getPurchaseReturn(IERC20Token _reserveToken, uint256 _depositAmount)
        public
        constant
        active
        validReserve(_reserveToken)
        validAmount(_depositAmount)
        returns (uint256 amount)
    {
        Reserve reserve = reserves[_reserveToken];
        require(reserve.isEnabled); // validate input

        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        return formula.calculatePurchaseReturn(tokenSupply, reserveBalance, reserve.ratio, _depositAmount);
    }

    /*
        returns the expected return for selling the token for one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the smart token)
    */
    function getSaleReturn(IERC20Token _reserveToken, uint256 _sellAmount) public constant returns (uint256 amount) {
        return getSaleReturn(_reserveToken, _sellAmount, token.totalSupply());
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
        IERC20Token fromToken = IERC20Token(_fromToken);
        IERC20Token toToken = IERC20Token(_toToken);

        // change between the token and one of its reserves
        if (toToken == token)
            return buy(fromToken, _amount, _minReturn);
        else if (fromToken == token)
            return sell(toToken, _amount, _minReturn);

        // change between 2 reserves
        uint256 purchaseAmount = buy(fromToken, _amount, 0);
        return sell(toToken, purchaseAmount, _minReturn);
    }

    /*
        buys the token by depositing one of its reserve tokens

        _reserveToken   reserve token contract address
        _depositAmount  amount to deposit (in the reserve token)
        _minReturn      if the change results in an amount smaller than the minimum return, it is cancelled
    */
    function buy(IERC20Token _reserveToken, uint256 _depositAmount, uint256 _minReturn) public returns (uint256 amount) {
        amount = getPurchaseReturn(_reserveToken, _depositAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        // update virtual balance if relevant
        Reserve reserve = reserves[_reserveToken];
        if (reserve.isVirtualBalanceEnabled)
            reserve.virtualBalance = safeAdd(reserve.virtualBalance, _depositAmount);

        assert(_reserveToken.transferFrom(msg.sender, this, _depositAmount)); // transfer _depositAmount funds from the caller in the reserve token
        token.issue(msg.sender, amount); // issue new funds to the caller in the smart token

        Change(_reserveToken, token, msg.sender, _depositAmount, amount);
        return amount;
    }

    /*
        sells the token by withdrawing from one of its reserve tokens

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the smart token)
        _minReturn      if the change results in an amount smaller the minimum return, it is cancelled
    */
    function sell(IERC20Token _reserveToken, uint256 _sellAmount, uint256 _minReturn) public returns (uint256 amount) {
        require(_sellAmount <= token.balanceOf(msg.sender)); // validate input

        amount = getSaleReturn(_reserveToken, _sellAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        uint256 reserveBalance = getReserveBalance(_reserveToken);
        assert(amount <= reserveBalance); // ensure that the trade won't result in negative reserve

        uint256 tokenSupply = token.totalSupply();
        assert(amount < reserveBalance || _sellAmount == tokenSupply); // ensure that the trade will only deplete the reserve if the total supply is depleted as well
        token.destroy(msg.sender, _sellAmount); // destroy _sellAmount from the caller's balance in the smart token
        assert(_reserveToken.transfer(msg.sender, amount)); // transfer funds to the caller in the reserve token
                                                           // note that it might fail if the actual reserve balance is smaller than the virtual balance

        // update virtual balance if relevant
        Reserve reserve = reserves[_reserveToken];
        if (reserve.isVirtualBalanceEnabled)
            reserve.virtualBalance = safeSub(reserve.virtualBalance, amount);

        // if the supply was totally depleted, disconnect from the smart token
        if (_sellAmount == tokenSupply)
            token.setChanger(ITokenChanger(0x0));

        Change(token, _reserveToken, msg.sender, _sellAmount, amount);
        return amount;
    }

    /*
        utility, returns the expected return for selling the token for one of its reserve tokens, given a total supply override

        _reserveToken   reserve token contract address
        _sellAmount     amount to sell (in the smart token)
        _totalSupply    total token supply, overrides the actual token total supply when calculating the return
    */
    function getSaleReturn(IERC20Token _reserveToken, uint256 _sellAmount, uint256 _totalSupply)
        private
        constant
        active
        validReserve(_reserveToken)
        validAmount(_sellAmount)
        validAmount(_totalSupply)
        returns (uint256 amount)
    {
        Reserve reserve = reserves[_reserveToken];
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        return formula.calculateSaleReturn(_totalSupply, reserveBalance, reserve.ratio, _sellAmount);
    }

    // fallback
    function() {
        assert(false);
    }
}

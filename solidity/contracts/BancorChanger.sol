pragma solidity ^0.4.11;
import './SmartTokenController.sol';
import './Managed.sol';
import './Utils.sol';
import './interfaces/ITokenChanger.sol';
import './interfaces/ISmartToken.sol';
import './interfaces/IBancorFormula.sol';
import './interfaces/IEtherToken.sol';

/*
    Open issues:
    - Add miner front-running attack protection. The issue is somewhat mitigated by the use of _minReturn when changing
    - Possibly add getters for reserve fields so that the client won't need to rely on the order in the struct
*/

/*
    Bancor Changer v0.2

    The Bancor version of the token changer, allows changing between a smart token and other ERC20 tokens and between different ERC20 tokens and themselves.

    ERC20 reserve token balance can be virtual, meaning that the calculations are based on the virtual balance instead of relying on
    the actual reserve balance. This is a security mechanism that prevents the need to keep a very large (and valuable) balance in a single contract.

    The changer is upgradable (just like any SmartTokenController).

    A note on change paths -
    Change path is a data structure that's used when changing a token to another token in the bancor network
    when the change cannot necessarily be done by single changer and might require multiple 'hops'.
    The path defines which changers should be used and what kind of change should be done in each step.

    The path format doesn't include complex structure and instead, it is represented by a single array
    in which each 'hop' is represented by a 2-tuple - smart token & to token.
    In addition, the first element is always the source token.
    The smart token is only used as a pointer to a changer (since changer addresses are more likely to change).

    Format:
    [source token, smart token, to token, smart token, to token...]


    WARNING: It is NOT RECOMMENDED to use the changer with Smart Tokens that have less than 8 decimal digits
             or with very small numbers because of precision loss
*/
contract BancorChanger is ITokenChanger, SmartTokenController, Managed {
    uint32 private constant MAX_CRR = 1000000;
    uint32 private constant MAX_CHANGE_FEE = 1000000;

    struct Reserve {
        uint256 virtualBalance;         // virtual balance
        uint32 ratio;                   // constant reserve ratio (CRR), represented in ppm, 1-1000000
        bool isVirtualBalanceEnabled;   // true if virtual balance is enabled, false if not
        bool isPurchaseEnabled;         // is purchase of the smart token enabled with the reserve, can be set by the owner
        bool isSet;                     // used to tell if the mapping element is defined
    }

    string public version = '0.2';
    string public changerType = 'bancor';

    IBancorFormula public formula;                  // bancor calculation formula contract
    IERC20Token[] public reserveTokens;             // ERC20 standard token addresses
    IERC20Token[] public quickBuyPath;              // change path that's used in order to buy the token with ETH
    mapping (address => Reserve) public reserves;   // reserve token addresses -> reserve data
    uint32 private totalReserveRatio = 0;           // used to efficiently prevent increasing the total reserve ratio above 100%
    uint32 public maxChangeFee = 0;                 // maximum change fee for the lifetime of the contract, represented in ppm, 0...1000000 (0 = no fee, 100 = 0.01%, 1000000 = 100%)
    uint32 public changeFee = 0;                    // current change fee, represented in ppm, 0...maxChangeFee
    bool public changingEnabled = true;             // true if token changing is enabled, false if not

    // triggered when a change between two tokens occurs (TokenChanger event)
    event Change(address indexed _fromToken, address indexed _toToken, address indexed _trader, uint256 _amount, uint256 _return,
                 uint256 _currentPriceN, uint256 _currentPriceD);

    /**
        @dev constructor

        @param  _token          smart token governed by the changer
        @param  _formula        address of a bancor formula contract
        @param  _maxChangeFee   maximum change fee, represented in ppm
        @param  _reserveToken   optional, initial reserve, allows defining the first reserve at deployment time
        @param  _reserveRatio   optional, ratio for the initial reserve
    */
    function BancorChanger(ISmartToken _token, IBancorFormula _formula, uint32 _maxChangeFee, IERC20Token _reserveToken, uint32 _reserveRatio)
        SmartTokenController(_token)
        validAddress(_formula)
        validMaxChangeFee(_maxChangeFee)
    {
        formula = _formula;
        maxChangeFee = _maxChangeFee;

        if (address(_reserveToken) != 0x0)
            addReserve(_reserveToken, _reserveRatio, false);
    }

    // validates a reserve token address - verifies that the address belongs to one of the reserve tokens
    modifier validReserve(IERC20Token _address) {
        require(reserves[_address].isSet);
        _;
    }

    // validates a token address - verifies that the address belongs to one of the changeable tokens
    modifier validToken(IERC20Token _address) {
        require(_address == token || reserves[_address].isSet);
        _;
    }

    // validates maximum change fee
    modifier validMaxChangeFee(uint32 _changeFee) {
        require(_changeFee >= 0 && _changeFee <= MAX_CHANGE_FEE);
        _;
    }

    // validates change fee
    modifier validChangeFee(uint32 _changeFee) {
        require(_changeFee >= 0 && _changeFee <= maxChangeFee);
        _;
    }

    // validates reserve ratio range
    modifier validReserveRatio(uint32 _ratio) {
        require(_ratio > 0 && _ratio <= MAX_CRR);
        _;
    }

    // validates a change path - verifies that the number of elements is odd and that maximum number of 'hops' is 10
    modifier validChangePath(IERC20Token[] _path) {
        require(_path.length > 2 && _path.length <= (1 + 2 * 10) && _path.length % 2 == 1);
        _;
    }

    // allows execution only when changing isn't disabled
    modifier changingAllowed {
        assert(changingEnabled);
        _;
    }

    /**
        @dev returns the number of reserve tokens defined

        @return number of reserve tokens
    */
    function reserveTokenCount() public constant returns (uint16 count) {
        return uint16(reserveTokens.length);
    }

    /**
        @dev returns the number of changeable tokens supported by the contract
        note that the number of changeable tokens is the number of reserve token, plus 1 (that represents the smart token)

        @return number of changeable tokens
    */
    function changeableTokenCount() public constant returns (uint16 count) {
        return reserveTokenCount() + 1;
    }

    /**
        @dev given a changeable token index, returns the changeable token contract address

        @param _tokenIndex  changeable token index

        @return number of changeable tokens
    */
    function changeableToken(uint16 _tokenIndex) public constant returns (address tokenAddress) {
        if (_tokenIndex == 0)
            return token;
        return reserveTokens[_tokenIndex - 1];
    }

    /*
        @dev allows the owner to update the formula contract address

        @param _formula    address of a bancor formula contract
    */
    function setFormula(IBancorFormula _formula)
        public
        ownerOnly
        validAddress(_formula)
        notThis(_formula)
    {
        formula = _formula;
    }

    /*
        @dev allows the manager to update the quick buy path

        @param _path    new quick buy path, see change path format above
    */
    function setQuickBuyPath(IERC20Token[] _path)
        public
        ownerOnly
        validChangePath(_path)
    {
        quickBuyPath = _path;
    }

    /*
        @dev allows the manager to clear the quick buy path
    */
    function clearQuickBuyPath() public ownerOnly {
        quickBuyPath.length = 0;
    }

    /**
        @dev returns the length of the quick buy path array

        @return quick buy path length
    */
    function getQuickBuyPathLength() public constant returns (uint256 length) {
        return quickBuyPath.length;
    }

    /**
        @dev returns true if ether token exists in the quick buy path, false if not
        note that there should always be one in the quick buy path, if one is set

        @return true if ether token exists, false if not
    */
    function hasQuickBuyEtherToken() public constant returns (bool) {
        return quickBuyPath.length > 0;
    }

    /**
        @dev returns the address of the ether token used by the quick buy functionality
        note that it should always be the first element in the quick buy path, if one is set

        @return ether token address
    */
    function getQuickBuyEtherToken() public constant returns (IEtherToken etherToken) {
        assert(quickBuyPath.length > 0);
        return IEtherToken(quickBuyPath[0]);
    }

    /**
        @dev disables the entire change functionality
        this is a safety mechanism in case of a emergency
        can only be called by the manager

        @param _disable true to disable changing, false to re-enable it
    */
    function disableChanging(bool _disable) public managerOnly {
        changingEnabled = !_disable;
    }

    /**
        @dev updates the current change fee
        can only be called by the manager

        @param _changeFee new change fee, represented in ppm
    */
    function setChangeFee(uint32 _changeFee)
        public
        managerOnly
        validChangeFee(_changeFee)
    {
        changeFee = _changeFee;
    }

    /*
        @dev returns the change fee amount for a given return amount

        @return change fee amount
    */
    function getChangeFeeAmount(uint256 _amount) public constant returns (uint256 feeAmount) {
        return safeMul(_amount, changeFee) / MAX_CHANGE_FEE;
    }

    /**
        @dev defines a new reserve for the token
        can only be called by the owner while the changer is inactive

        @param _token                  address of the reserve token
        @param _ratio                  constant reserve ratio, represented in ppm, 1-1000000
        @param _enableVirtualBalance   true to enable virtual balance for the reserve, false to disable it
    */
    function addReserve(IERC20Token _token, uint32 _ratio, bool _enableVirtualBalance)
        public
        ownerOnly
        inactive
        validAddress(_token)
        notThis(_token)
        validReserveRatio(_ratio)
    {
        require(_token != token && !reserves[_token].isSet && totalReserveRatio + _ratio <= MAX_CRR); // validate input

        reserves[_token].virtualBalance = 0;
        reserves[_token].ratio = _ratio;
        reserves[_token].isVirtualBalanceEnabled = _enableVirtualBalance;
        reserves[_token].isPurchaseEnabled = true;
        reserves[_token].isSet = true;
        reserveTokens.push(_token);
        totalReserveRatio += _ratio;
    }

    /**
        @dev updates one of the token reserves
        can only be called by the owner

        @param _reserveToken           address of the reserve token
        @param _ratio                  constant reserve ratio, represented in ppm, 1-1000000
        @param _enableVirtualBalance   true to enable virtual balance for the reserve, false to disable it
        @param _virtualBalance         new reserve's virtual balance
    */
    function updateReserve(IERC20Token _reserveToken, uint32 _ratio, bool _enableVirtualBalance, uint256 _virtualBalance)
        public
        ownerOnly
        validReserve(_reserveToken)
        validReserveRatio(_ratio)
    {
        Reserve storage reserve = reserves[_reserveToken];
        require(totalReserveRatio - reserve.ratio + _ratio <= MAX_CRR); // validate input

        totalReserveRatio = totalReserveRatio - reserve.ratio + _ratio;
        reserve.ratio = _ratio;
        reserve.isVirtualBalanceEnabled = _enableVirtualBalance;
        reserve.virtualBalance = _virtualBalance;
    }

    /**
        @dev disables purchasing with the given reserve token in case the reserve token got compromised
        can only be called by the owner
        note that selling is still enabled regardless of this flag and it cannot be disabled by the owner

        @param _reserveToken    reserve token contract address
        @param _disable         true to disable the token, false to re-enable it
    */
    function disableReservePurchases(IERC20Token _reserveToken, bool _disable)
        public
        ownerOnly
        validReserve(_reserveToken)
    {
        reserves[_reserveToken].isPurchaseEnabled = !_disable;
    }

    /**
        @dev returns the reserve's virtual balance if one is defined, otherwise returns the actual balance

        @param _reserveToken    reserve token contract address

        @return reserve balance
    */
    function getReserveBalance(IERC20Token _reserveToken)
        public
        constant
        validReserve(_reserveToken)
        returns (uint256 balance)
    {
        Reserve storage reserve = reserves[_reserveToken];
        return reserve.isVirtualBalanceEnabled ? reserve.virtualBalance : _reserveToken.balanceOf(this);
    }

    /**
        @dev returns the expected return for changing a specific amount of _fromToken to _toToken

        @param _fromToken  ERC20 token to change from
        @param _toToken    ERC20 token to change to
        @param _amount     amount to change, in fromToken

        @return expected change return amount
    */
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public constant returns (uint256 amount) {
        require(_fromToken != _toToken); // validate input

        // change between the token and one of its reserves
        if (_toToken == token)
            return getPurchaseReturn(_fromToken, _amount);
        else if (_fromToken == token)
            return getSaleReturn(_toToken, _amount);

        // change between 2 reserves
        uint256 purchaseReturnAmount = getPurchaseReturn(_fromToken, _amount);
        return getSaleReturn(_toToken, purchaseReturnAmount, safeAdd(token.totalSupply(), purchaseReturnAmount));
    }

    /**
        @dev returns the expected return for buying the token for a reserve token

        @param _reserveToken   reserve token contract address
        @param _depositAmount  amount to deposit (in the reserve token)

        @return expected purchase return amount
    */
    function getPurchaseReturn(IERC20Token _reserveToken, uint256 _depositAmount)
        public
        constant
        active
        validReserve(_reserveToken)
        returns (uint256 amount)
    {
        Reserve storage reserve = reserves[_reserveToken];
        require(reserve.isPurchaseEnabled); // validate input

        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        amount = formula.calculatePurchaseReturn(tokenSupply, reserveBalance, reserve.ratio, _depositAmount);

        // deduct the fee from the return amount
        uint256 feeAmount = getChangeFeeAmount(amount);
        return safeSub(amount, feeAmount);
    }

    /**
        @dev returns the expected return for selling the token for one of its reserve tokens

        @param _reserveToken   reserve token contract address
        @param _sellAmount     amount to sell (in the smart token)

        @return expected sale return amount
    */
    function getSaleReturn(IERC20Token _reserveToken, uint256 _sellAmount) public constant returns (uint256 amount) {
        return getSaleReturn(_reserveToken, _sellAmount, token.totalSupply());
    }

    /**
        @dev changes a specific amount of _fromToken to _toToken

        @param _fromToken  ERC20 token to change from
        @param _toToken    ERC20 token to change to
        @param _amount     amount to change, in fromToken
        @param _minReturn  if the change results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return change return amount
    */
    function change(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256 amount) {
        require(_fromToken != _toToken); // validate input

        // change between the token and one of its reserves
        if (_toToken == token)
            return buy(_fromToken, _amount, _minReturn);
        else if (_fromToken == token)
            return sell(_toToken, _amount, _minReturn);

        // change between 2 reserves
        uint256 purchaseAmount = buy(_fromToken, _amount, 1);
        return sell(_toToken, purchaseAmount, _minReturn);
    }

    /**
        @dev buys the token by depositing one of its reserve tokens

        @param _reserveToken   reserve token contract address
        @param _depositAmount  amount to deposit (in the reserve token)
        @param _minReturn      if the change results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return buy return amount
    */
    function buy(IERC20Token _reserveToken, uint256 _depositAmount, uint256 _minReturn)
        public
        changingAllowed
        greaterThanZero(_minReturn)
        returns (uint256 amount)
    {
        amount = getPurchaseReturn(_reserveToken, _depositAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        // update virtual balance if relevant
        Reserve storage reserve = reserves[_reserveToken];
        if (reserve.isVirtualBalanceEnabled)
            reserve.virtualBalance = safeAdd(reserve.virtualBalance, _depositAmount);

        assert(_reserveToken.transferFrom(msg.sender, this, _depositAmount)); // transfer _depositAmount funds from the caller in the reserve token
        token.issue(msg.sender, amount); // issue new funds to the caller in the smart token

        // calculate the new price using the simple price formula
        // price = reserve balance / (supply * CRR)
        // CRR is represented in ppm, so multiplying by 1000000
        uint256 reserveAmount = safeMul(getReserveBalance(_reserveToken), MAX_CRR);
        uint256 tokenAmount = safeMul(token.totalSupply(), reserve.ratio);
        Change(_reserveToken, token, msg.sender, _depositAmount, amount, reserveAmount, tokenAmount);
        return amount;
    }

    /**
        @dev sells the token by withdrawing from one of its reserve tokens

        @param _reserveToken   reserve token contract address
        @param _sellAmount     amount to sell (in the smart token)
        @param _minReturn      if the change results in an amount smaller the minimum return - it is cancelled, must be nonzero

        @return sell return amount
    */
    function sell(IERC20Token _reserveToken, uint256 _sellAmount, uint256 _minReturn)
        public
        changingAllowed
        greaterThanZero(_minReturn)
        returns (uint256 amount)
    {
        require(_sellAmount <= token.balanceOf(msg.sender)); // validate input

        amount = getSaleReturn(_reserveToken, _sellAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        // ensure that the trade will only deplete the reserve if the total supply is depleted as well
        assert(amount < reserveBalance || (amount == reserveBalance && _sellAmount == tokenSupply));

        // update virtual balance if relevant
        Reserve storage reserve = reserves[_reserveToken];
        if (reserve.isVirtualBalanceEnabled)
            reserve.virtualBalance = safeSub(reserve.virtualBalance, amount);

        token.destroy(msg.sender, _sellAmount); // destroy _sellAmount from the caller's balance in the smart token
        assert(_reserveToken.transfer(msg.sender, amount)); // transfer funds to the caller in the reserve token
                                                            // note that it might fail if the actual reserve balance is smaller than the virtual balance
        // calculate the new price using the simple price formula
        // price = reserve balance / (supply * CRR)
        // CRR is represented in ppm, so multiplying by 1000000
        uint256 reserveAmount = safeMul(getReserveBalance(_reserveToken), MAX_CRR);
        uint256 tokenAmount = safeMul(token.totalSupply(), reserve.ratio);
        Change(token, _reserveToken, msg.sender, _sellAmount, amount, tokenAmount, reserveAmount);
        return amount;
    }

    /**
        @dev changes the token to any other token in the bancor network by following a predefined change path
        note that when changing from an ERC20 token (as opposed to a smart token), allowance must be set beforehand

        @param _path        change path, see change path format above
        @param _amount      amount to change from (in the initial source token)
        @param _minReturn   if the change results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return tokens issued in return
    */
    function quickChange(IERC20Token[] _path, uint256 _amount, uint256 _minReturn)
        public
        validChangePath(_path)
        returns (uint256 amount)
    {
        // we need to transfer the tokens from the caller to the local contract before we
        // follow the change path, to allow it to execute the change on behalf of the caller
        IERC20Token fromToken = _path[0];
        claimTokens(fromToken, msg.sender, _amount);

        ISmartToken smartToken;
        IERC20Token toToken;
        BancorChanger changer;
        uint256 pathLength = _path.length;

        // iterate over the change path
        for (uint256 i = 1; i < pathLength; i += 2) {
            smartToken = ISmartToken(_path[i]);
            toToken = _path[i + 1];
            changer = BancorChanger(smartToken.owner());

            // if the smart token isn't the source (from token), the changer doesn't have control over it and thus we need to approve the request
            if (smartToken != fromToken)
                ensureAllowance(fromToken, changer, _amount);

            // make the change - if it's the last one, also provide the minimum return value
            _amount = changer.change(fromToken, toToken, _amount, i == pathLength - 2 ? _minReturn : 1);
            fromToken = toToken;
        }

        // finished the change, transfer the funds back to the caller
        // if the last change resulted in ether tokens, withdraw them and send them as ETH to the caller
        if (changer.hasQuickBuyEtherToken() && changer.getQuickBuyEtherToken() == toToken) {
            IEtherToken etherToken = IEtherToken(toToken);
            etherToken.withdrawTo(msg.sender, _amount);
        }
        else {
            // not ETH, transfer the tokens to the caller
            assert(toToken.transfer(msg.sender, _amount));
        }

        return _amount;
    }

    /**
        @dev buys the smart token with ETH if the return amount meets the minimum requested
        note that this function can eventually be moved into a separate contract

        @param _minReturn  if the change results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return tokens issued in return
    */
    function quickBuy(uint256 _minReturn) public payable returns (uint256 amount) {
        // ensure that the quick buy path was set
        assert(quickBuyPath.length > 0);
        // we assume that the initial source in the quick buy path is always an ether token
        IEtherToken etherToken = IEtherToken(quickBuyPath[0]);
        // deposit ETH in the ether token
        etherToken.deposit.value(msg.value)();
        // get the initial changer in the path
        ISmartToken smartToken = ISmartToken(quickBuyPath[1]);
        BancorChanger changer = BancorChanger(smartToken.owner());
        // approve allowance for the changer in the ether token
        ensureAllowance(etherToken, changer, msg.value);
        // execute the change
        uint256 returnAmount = changer.quickChange(quickBuyPath, msg.value, _minReturn);
        // transfer the tokens to the caller
        assert(token.transfer(msg.sender, returnAmount));
        return returnAmount;
    }

    /**
        @dev utility, returns the expected return for selling the token for one of its reserve tokens, given a total supply override

        @param _reserveToken   reserve token contract address
        @param _sellAmount     amount to sell (in the smart token)
        @param _totalSupply    total token supply, overrides the actual token total supply when calculating the return

        @return sale return amount
    */
    function getSaleReturn(IERC20Token _reserveToken, uint256 _sellAmount, uint256 _totalSupply)
        private
        constant
        active
        validReserve(_reserveToken)
        greaterThanZero(_totalSupply)
        returns (uint256 amount)
    {
        Reserve storage reserve = reserves[_reserveToken];
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        amount = formula.calculateSaleReturn(_totalSupply, reserveBalance, reserve.ratio, _sellAmount);

        // deduct the fee from the return amount
        uint256 feeAmount = getChangeFeeAmount(amount);
        return safeSub(amount, feeAmount);
    }

    /**
        @dev utility, checks whether allowance for the given spender exists and approves one if it doesn't

        @param _token   token to check the allowance in
        @param _spender approved address
        @param _value   allowance amount
    */
    function ensureAllowance(IERC20Token _token, address _spender, uint256 _value) private {
        // check if allowance for the given amount already exists
        if (_token.allowance(this, _spender) >= _value)
            return;

        // if the allowance is nonzero, must reset it to 0 first
        if (_token.allowance(this, _spender) != 0)
            assert(_token.approve(_spender, 0));

        // approve the new allowance
        assert(_token.approve(_spender, _value));
    }

    /**
        @dev utility, transfers tokens from an account to the local contract

        @param _token   token to claim
        @param _from    account to claim the tokens from
        @param _amount  amount to claim
    */
    function claimTokens(IERC20Token _token, address _from, uint256 _amount) private {
        // if the token is the smart token, no allowance is required - destroy the tokens from the caller and issue them to the local contract
        if (_token == token) {
            token.destroy(_from, _amount); // destroy _amount tokens from the caller's balance in the smart token
            token.issue(this, _amount); // issue _amount new tokens to the local contract
            return;
        }

        // otherwise, we assume we already have allowance
        assert(_token.transferFrom(_from, this, _amount));
    }

    /**
        @dev fallback, buys the smart token with ETH
        note that the purchase will use the price at the time of the purchase
    */
    function() payable {
        quickBuy(1);
    }
}

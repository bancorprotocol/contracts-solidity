pragma solidity ^0.4.10;
import './BancorEventsDispatcher.sol';
import './TokenChangerInterface.sol';
import './SmartTokenInterface.sol';
import './SafeMath.sol';

/*
    Open issues:
    - all values are placeholders, need to update them with real values
    - verify ERC20 token addresses, transferFrom (must return a boolean flag) and update them with the correct values
    - possibly move all the ERC20 token initialization from the initERC20Tokens function to a different contract to lower the gas cost and make the crowdsale changer more generic
    - possibly add getters for ERC20 token fields so that the client won't need to rely on the order in the struct
*/

// interfaces

contract EtherToken {
    function deposit() public payable;
    function transfer(address _to, uint256 _value) public returns (bool success);
}

/*
    Crowdsale Changer v0.1

    The crowdsale version of the token changer, allows buying the smart token with ether/other ERC20 tokens
*/
contract CrowdsaleChanger is BancorEventsDispatcher, TokenChangerInterface, SafeMath {
    struct ERC20TokenData {
        uint256 valueN;     // 1 smallest unit in wei (numerator)
        uint256 valueD;     // 1 smallest unit in wei (denominator)
        uint16 limit;       // maximum contribution in percentage out of the total ETH raised so far. 1-1000 (10 == 1%), divided by 1000, 0 to disable
        bool isEnabled;     // is purchase of the smart token enabled with the ERC20 token, can be set by the owner
        bool isSet;         // used to tell if the mapping element is defined
    }

    uint256 public constant DURATION = 30 days;                     // crowdsale duration
    uint256 public constant ETHER_CAP = 1000000 ether;              // maximum ether contribution
    uint256 public constant BITCOIN_SUISSE_ETHER_CAP = 20000 ether; // maximum bitcoin suisse ether contribution
    uint256 public constant INITIAL_PRICE_N = 1;                    // initial price in wei (numerator)
    uint256 public constant INITIAL_PRICE_D = 100;                  // initial price in wei (denominator)
    uint8 public constant RESERVE_RATIO = 21;                       // constant reserve ratio for the new token, used to calculate the current price
    uint8 public constant BENEFICIARY_PERCENTAGE = 30;              // percentage out of the total supply that should be issued to the beneficiary

    // phases
    uint256 public constant PHASE1_MIN_CONTRIBUTION = 0 ether;
    uint256 public constant PHASE2_MIN_CONTRIBUTION = 100000 ether;
    uint256 public constant PHASE3_MIN_CONTRIBUTION = 300000 ether;
    // % of contribution allocated to the reserve
    uint8 public constant PHASE1_RESERVE_ALLOCATION = 30;
    uint8 public constant PHASE2_RESERVE_ALLOCATION = 50;
    uint8 public constant PHASE3_RESERVE_ALLOCATION = 70;

    string public version = '0.1';
    string public changerType = 'crowdsale';

    uint256 public startTime = 0;                               // crowdsale start time (in seconds)
    uint256 public endTime = 0;                                 // crowdsale end time (in seconds)
    uint256 public totalEtherContributed = 0;                   // ether contributed so far
    uint256 public tokenReserveBalance = 0;                     // amount of the ether contributed so far that gets into the smart token's reserve, used to calculate the current price
    address public etherToken = 0x0;                            // ether token contract address
    address public beneficiary = 0x0;                           // address to receive all contributed ether
    address public bitcoinSuisse = 0x0;                         // bitcoin suisse address
    SmartTokenInterface public token;                           // smart token governed by the changer
    address[] public acceptedTokens;                            // ERC20 standard token addresses
    mapping (address => ERC20TokenData) public tokenData;       // ERC20 token addresses -> ERC20 token data
    mapping (address => uint256) public beneficiaryBalances;    // beneficiary balances in the different tokens

    // events, can be used to listen to the contract directly, as opposed to through the events contract
    event Change(address indexed _fromToken, address indexed _toToken, address indexed _trader, uint256 _amount, uint256 _return);

    /*
        _token          smart token governed by the changer
        _etherToken     ether token contract address
        _startTime      crowdsale start time
        _beneficiary    address to receive all contributed ether
        _bitcoinSuisse  bitcoin suisse address
        _events         optional, address of a bancor events contract
    */
    function CrowdsaleChanger(address _token, address _etherToken, uint256 _startTime, address _beneficiary, address _bitcoinSuisse, address _events)
        BancorEventsDispatcher(_events)
        validAddress(_token)
        validAddress(_etherToken)
        validAddress(_beneficiary)
        validAddress(_bitcoinSuisse)
        earlierThan(_startTime)
    {
        token = SmartTokenInterface(_token);
        etherToken = _etherToken;
        startTime = _startTime;
        endTime = startTime + DURATION;
        beneficiary = _beneficiary;
        bitcoinSuisse = _bitcoinSuisse;

        addERC20Token(_etherToken, 0, 1, 1); // Ether
    }

    // validates an address - currently only checks that it isn't null
    modifier validAddress(address _address) {
        require(_address != 0x0);
        _;
    }

    // validates an ERC20 token address - verifies that the address belongs to one of the ERC20 tokens
    modifier validERC20Token(address _address) {
        require(tokenData[_address].isSet);
        _;
    }

    // validates a token address - verifies that the address belongs to one of the changeable tokens
    modifier validToken(address _address) {
        require(_address == address(token) || tokenData[_address].isSet);
        _;
    }

    // validates ERC20 token limit
    modifier validERC20TokenLimit(uint16 _limit) {
        require(_limit <= 1000);
        _;
    }

    // ensures that token changing is connected to the smart token
    modifier active() {
        assert(token.changer() == address(this));
        _;
    }

    // ensures that token changing is not conneccted to the smart token
    modifier inactive() {
        assert(token.changer() != address(this));
        _;
    }

    // ensures that it's earlier than the given time
    modifier earlierThan(uint256 _time) {
        assert(now < _time);
        _;
    }

    // ensures that it's later than the given time
    modifier laterThan(uint256 _time) {
        assert(now > _time);
        _;
    }

    // ensures that we didn't reach the ether cap
    modifier etherCapNotReached() {
        assert(totalEtherContributed < ETHER_CAP);
        _;
    }

    // ensures that the sender is bitcoin suisse
    modifier bitcoinSuisseOnly() {
        assert(msg.sender == bitcoinSuisse);
        _;
    }

    // ensures that we didn't reach the bitcoin suisse ether cap
    modifier bitcoinSuisseEtherCapNotReached(uint256 _ethContribution) {
        require(safeAdd(totalEtherContributed, _ethContribution) <= BITCOIN_SUISSE_ETHER_CAP);
        _;
    }

    /*
        returns the number of changeable tokens supported by the contract
        note that the number of changeable tokens is the number of ERC20 tokens plus the smart token
    */
    function changeableTokenCount() public constant returns (uint16 count) {
        return uint16(acceptedTokens.length + 1);
    }

    /*
        given a changeable token index, returns the changeable token contract address
    */
    function changeableToken(uint16 _tokenIndex) public constant returns (address tokenAddress) {
        if (_tokenIndex == 0)
            return token;
        return acceptedTokens[_tokenIndex - 1];
    }

    function initERC20Tokens()
        public
        ownerOnly
        inactive
    {
        addERC20Token(0xa74476443119A942dE498590Fe1f2454d7D4aC0d, 20, 1, 1); // Golem
        addERC20Token(0x48c80F1f4D53D5951e5D5438B54Cba84f29F32a5, 20, 1, 1); // Augur

        addERC20Token(0x6810e776880C02933D47DB1b9fc05908e5386b96, 10, 1, 1); // Gnosis
        addERC20Token(0xaeC2E87E0A235266D9C5ADc9DEb4b2E29b54D009, 10, 1, 1); // SingularDTV
        addERC20Token(0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A, 10, 1, 1); // DigixDAO

        addERC20Token(0x4993CB95c7443bdC06155c5f5688Be9D8f6999a5, 5, 1, 1); // ROUND
        addERC20Token(0x607F4C5BB672230e8672085532f7e901544a7375, 5, 1, 1); // iEx.ec
        addERC20Token(0x888666CA69E0f178DED6D75b5726Cee99A87D698, 5, 1, 1); // ICONOMI
        addERC20Token(0xAf30D2a7E90d7DC361c8C4585e9BB7D2F6f15bc7, 5, 1, 1); // FirstBlood
        addERC20Token(0xBEB9eF514a379B997e0798FDcC901Ee474B6D9A1, 5, 1, 1); // Melon
        addERC20Token(0x667088b212ce3d06a1b553a7221E1fD19000d9aF, 5, 1, 1); // Wings
    }

    /*
        defines a new ERC20 token
        can only be called by the changer owner while the changer is inactive

        _token      address of the ERC20 token
        _limit      maximum contribution in percentage out of the total ETH raised so far. 1-1000 (10 == 1%), divided by 1000
        _valueN     1 smallest unit in wei (numerator)
        _valueD     1 smallest unit in wei (denominator)
    */
    function addERC20Token(address _token, uint16 _limit, uint256 _valueN, uint256 _valueD)
        public
        ownerOnly
        inactive
        validAddress(_token)
        validERC20TokenLimit(_limit)
    {
        require(_token != address(this) && _token != address(token) && !tokenData[_token].isSet && _valueN != 0 && _valueD != 0); // validate input

        tokenData[_token].limit = _limit;
        tokenData[_token].valueN = _valueN;
        tokenData[_token].valueD = _valueD;
        tokenData[_token].isEnabled = true;
        tokenData[_token].isSet = true;
        acceptedTokens.push(_token);
    }

    /*
        updates one of the ERC20 tokens
        can only be called by the changer owner
        note that the function can be called during the crowdsale as well, mainly to update the ERC20 token ETH value

        _erc20Token     address of the ERC20 token
        _limit          maximum contribution in percentage out of the total ETH raised so far. 1-1000 (10 == 1%), divided by 1000
        _valueN         1 smallest unit in wei (numerator)
        _valueD         1 smallest unit in wei (denominator)
    */
    function updateERC20Token(address _erc20Token, uint16 _limit, uint256 _valueN, uint256 _valueD)
        public
        ownerOnly
        validERC20Token(_erc20Token)
        validERC20TokenLimit(_limit)
    {
        require(_valueN != 0 && _valueD != 0); // validate input
        ERC20TokenData data = tokenData[_erc20Token];
        data.limit = _limit;
        data.valueN = _valueN;
        data.valueD = _valueD;
    }

    /*
        disables purchasing with the given ERC20 token in case the token got compromised
        can only be called by the changer owner

        _erc20Token     ERC20 token contract address
        _disable        true to disable the token, false to re-enable it
    */
    function disableERC20Token(address _erc20Token, bool _disable)
        public
        ownerOnly
        validERC20Token(_erc20Token)
    {
        tokenData[_erc20Token].isEnabled = !_disable;
    }

    /*
        withdraws tokens from one of the ERC20 tokens and sends them to an account
        can only be called by the changer owner
        this is a safety mechanism that allows the owner to return tokens that were sent directly to this contract by mistake

        _erc20Token     ERC20 token contract address
        _to             account to receive the new amount
        _amount         amount to withdraw (in the ERC20 token)
    */
    function withdraw(address _erc20Token, address _to, uint256 _amount)
        public
        ownerOnly
        validERC20Token(_erc20Token)
        validAddress(_to)
    {
        require(_to != address(this) && _to != address(token) && _amount != 0); // validate input

        ERC20TokenInterface erc20Token = ERC20TokenInterface(_erc20Token);
        assert(erc20Token.transfer(_to, _amount));
    }

    /*
        sets the smart token's changer address to a different one instead of the current contract address
        can only be called by the owner
        the changer can be set to null to transfer ownership from the changer to the original smart token's owner

        _changer    new changer contract address (can also be set to 0x0 to remove the current changer)
    */
    function setTokenChanger(address _changer) public ownerOnly {
        require(_changer != address(this) && _changer != address(token)); // validate input
        token.setChanger(_changer);
    }

    /*
        returns the expected return for changing a specific amount of _fromToken to _toToken

        _fromToken  token to change from
        _toToken    token to change to
        _amount     amount to change, in fromToken
    */
    function getReturn(address _fromToken, address _toToken, uint256 _amount) public constant returns (uint256 amount) {
        require(_toToken == address(token)); // validate input
        return getPurchaseReturn(_fromToken, _amount);
    }

    /*
        returns the expected return for buying the token for an ERC20 token

        _erc20Token     ERC20 token contract address
        _depositAmount  amount to deposit (in the ERC20 token)
    */
    function getPurchaseReturn(address _erc20Token, uint256 _depositAmount)
        public
        constant
        active
        etherCapNotReached
        validERC20Token(_erc20Token)
        returns (uint256 amount)
    {
        ERC20TokenData data = tokenData[_erc20Token];
        require(data.isEnabled && _depositAmount != 0); // validate input

        uint256 depositEthValue = safeMul(_depositAmount, data.valueN) / data.valueD;
        if (depositEthValue == 0)
            return 0;

        // check ether cap
        require(safeAdd(totalEtherContributed, depositEthValue) <= ETHER_CAP);

        // check limit
        if (data.limit != 0) {
            uint256 balance = beneficiaryBalances[_erc20Token];
            uint256 balanceEthValue = safeMul(balance, data.valueN) / data.valueD;  // ether value of the ERC20 token beneficiary balance 
            uint256 limit = safeMul(totalEtherContributed, data.limit) / 1000; // current limit of the ERC20 token
            require(safeAdd(balanceEthValue, depositEthValue) <= limit);
        }

        // first contribution can't use the simplified bancor formula, so using the predefined initial price instead
        if (tokenReserveBalance == 0 || token.totalSupply() == 0)
            return safeMul(depositEthValue, INITIAL_PRICE_D) / INITIAL_PRICE_N;

        // using the simplified bancor formula -
        // Price = Reserve / (Supply * CRR)
        uint256 temp = safeMul(depositEthValue, token.totalSupply());
        temp = safeMul(temp, RESERVE_RATIO);
        return temp / 100 / tokenReserveBalance;
    }

    /*
        changes a specific amount of _fromToken to _toToken

        _fromToken  token to change from
        _toToken    token to change to
        _amount     amount to change, in fromToken
        _minReturn  if the change results in an amount smaller than the minimum return, it is cancelled
    */
    function change(address _fromToken, address _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256 amount) {
        require(_toToken == address(token)); // validate input
        return buyERC20(_fromToken, _amount, _minReturn);
    }

    /*
        buys the token with one of the ERC20 tokens
        requires the called to approve and allowance for the crowdsale contract

        _erc20Token     ERC20 token contract address
        _depositAmount  amount to deposit (in the ERC20 token)
        _minReturn      if the change results in an amount smaller than the minimum return, it is cancelled
    */
    function buyERC20(address _erc20Token, uint256 _depositAmount, uint256 _minReturn)
        public
        laterThan(startTime)
        earlierThan(endTime)
        returns (uint256 amount)
    {
        amount = getPurchaseReturn(_erc20Token, _depositAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        ERC20TokenInterface erc20Token = ERC20TokenInterface(_erc20Token);
        assert(erc20Token.transferFrom(msg.sender, beneficiary, _depositAmount)); // transfer _depositAmount funds from the caller in the ERC20 token
        beneficiaryBalances[erc20Token] = safeAdd(beneficiaryBalances[erc20Token], _depositAmount); // increase beneficiary ERC20 balance

        ERC20TokenData data = tokenData[_erc20Token];
        uint256 depositEthValue = safeMul(_depositAmount, data.valueN) / data.valueD;
        handleContribution(msg.sender, depositEthValue, amount);
        dispatchChange(_erc20Token, token, msg.sender, _depositAmount, amount);
        return amount;
    }

    /*
        buys the token with ETH
    */
    function buyETH()
        public
        payable
        laterThan(startTime)
        earlierThan(endTime)
        returns (uint256 amount)
    {
        amount = handleETHDeposit(msg.sender, msg.value);
        dispatchChange(etherToken, token, msg.sender, msg.value, amount);
        return amount;
    }

    /*
        buys the token with BTCs (Bitcoin Suisse only)
        can only be called before the crowdsale started

        _contributor    account that should receive the new tokens
    */
    function buyBitcoinSuisse(address _contributor)
        public
        payable
        bitcoinSuisseOnly
        bitcoinSuisseEtherCapNotReached(msg.value)
        earlierThan(startTime)
        returns (uint256 amount)
    {
        amount = handleETHDeposit(_contributor, msg.value);
        dispatchChange(etherToken, token, msg.sender, msg.value, amount);
        return amount;
    }

    /*
        handles direct ETH deposits (as opposed to ERC20 contributions)

        _contributor    account that should receive the new tokens
        _depositAmount  amount contributed by the account, in wei
    */
    function handleETHDeposit(address _contributor, uint256 _depositAmount) private returns (uint256 amount) {
        require(_depositAmount > 0); // validate input
        amount = getPurchaseReturn(etherToken, _depositAmount);
        assert(amount != 0); // ensure the trade gives something in return

        EtherToken ethToken = EtherToken(etherToken);
        ethToken.deposit.value(_depositAmount)(); // transfer the ether to the ether contract
        assert(ethToken.transfer(beneficiary, _depositAmount)); // transfer the ether to the beneficiary account
        beneficiaryBalances[etherToken] = safeAdd(beneficiaryBalances[etherToken], _depositAmount); // increase beneficiary ETH balance
        handleContribution(_contributor, _depositAmount, amount);
        return amount;
    }

    /*
        handles the generic part of the contribution - regardless of the type of contribution
        assumes that the contribution was already added to the beneficiary account in the different tokens
        updates the reserve balance, total contributed amount and issues new tokens to the contributor and to the beneficiary

        _contributor        account that should the new tokens
        _depositEthValue    amount contributed by the account, in wei
        _return             amount to be issued to the contributor, in the smart token
    */
    function handleContribution(address _contributor, uint256 _depositEthValue, uint256 _return) private {
        // update the reserve balance
        uint8 reserveAllocationPercentage;
        if (totalEtherContributed >= PHASE3_MIN_CONTRIBUTION)
            reserveAllocationPercentage = PHASE3_RESERVE_ALLOCATION;
        else if (totalEtherContributed >= PHASE2_MIN_CONTRIBUTION)
            reserveAllocationPercentage = PHASE2_RESERVE_ALLOCATION;
        else if (totalEtherContributed >= PHASE1_MIN_CONTRIBUTION)
            reserveAllocationPercentage = PHASE1_RESERVE_ALLOCATION;

        uint256 addToReserve = safeMul(_depositEthValue, reserveAllocationPercentage) / 100;
        tokenReserveBalance = safeAdd(tokenReserveBalance, addToReserve);

        // update the total contribution amount
        totalEtherContributed = safeAdd(totalEtherContributed, _depositEthValue);
        // issue new funds to the contributor in the smart token
        token.issue(_contributor, _return);

        // issue tokens to the beneficiary
        uint256 amount = safeMul(100, _return) / (100 - BENEFICIARY_PERCENTAGE);
        amount = safeSub(amount, _return);
        if (amount == 0)
            return;

        token.issue(beneficiary, amount);
    }

    // utility

    function dispatchChange(address _fromToken, address _toToken, address _trader, uint256 _amount, uint256 _return) private {
        Change(_fromToken, _toToken, _trader, _amount, _return);

        if (address(events) != 0x0)
            events.tokenChange(_fromToken, _toToken, _trader, _amount, _return);
    }

    // fallback
    function() payable {
        buyETH();
    }
}

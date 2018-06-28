pragma solidity ^0.4.23;
import './IBancorNetwork.sol';
import './ContractIds.sol';
import './FeatureIds.sol';
import './converter/interfaces/IBancorConverter.sol';
import './converter/interfaces/IBancorFormula.sol';
import './converter/interfaces/IBancorGasPriceLimit.sol';
import './utility/TokenHolder.sol';
import './utility/interfaces/IContractRegistry.sol';
import './utility/interfaces/IContractFeatures.sol';
import './utility/interfaces/IWhitelist.sol';
import './token/interfaces/IEtherToken.sol';
import './token/interfaces/ISmartToken.sol';

/*
    The BancorNetwork contract is the main entry point for bancor token conversions.
    It also allows converting between any token in the bancor network to any other token
    in a single transaction by providing a conversion path.

    A note on conversion path -
    Conversion path is a data structure that's used when converting a token to another token in the bancor network
    when the conversion cannot necessarily be done by single converter and might require multiple 'hops'.
    The path defines which converters should be used and what kind of conversion should be done in each step.

    The path format doesn't include complex structure and instead, it is represented by a single array
    in which each 'hop' is represented by a 2-tuple - smart token & to token.
    In addition, the first element is always the source token.
    The smart token is only used as a pointer to a converter (since converter addresses are more likely to change).

    Format:
    [source token, smart token, to token, smart token, to token...]
*/
contract BancorNetwork is IBancorNetwork, TokenHolder, ContractIds, FeatureIds {
    uint64 private constant MAX_CONVERSION_FEE = 1000000;

    address public signerAddress = 0x0;         // verified address that allows conversions with higher gas price
    IContractRegistry public registry;          // contract registry contract address

    mapping (address => bool) public etherTokens;       // list of all supported ether tokens
    mapping (bytes32 => bool) public conversionHashes;  // list of conversion hashes, to prevent re-use of the same hash

    /**
        @dev constructor

        @param _registry    address of a contract registry contract
    */
    constructor(IContractRegistry _registry) public validAddress(_registry) {
        registry = _registry;
    }

    // validates a conversion path - verifies that the number of elements is odd and that maximum number of 'hops' is 10
    modifier validConversionPath(IERC20Token[] _path) {
        require(_path.length > 2 && _path.length <= (1 + 2 * 10) && _path.length % 2 == 1);
        _;
    }

    /*
        @dev allows the owner to update the contract registry contract address

        @param _registry   address of a contract registry contract
    */
    function setRegistry(IContractRegistry _registry)
        public
        ownerOnly
        validAddress(_registry)
        notThis(_registry)
    {
        registry = _registry;
    }

    /*
        @dev allows the owner to update the signer address

        @param _signerAddress    new signer address
    */
    function setSignerAddress(address _signerAddress)
        public
        ownerOnly
        validAddress(_signerAddress)
        notThis(_signerAddress)
    {
        signerAddress = _signerAddress;
    }

    /**
        @dev allows the owner to register/unregister ether tokens

        @param _token       ether token contract address
        @param _register    true to register, false to unregister
    */
    function registerEtherToken(IEtherToken _token, bool _register)
        public
        ownerOnly
        validAddress(_token)
        notThis(_token)
    {
        etherTokens[_token] = _register;
    }

    /**
        @dev verifies that the signer address is trusted by recovering 
        the address associated with the public key from elliptic 
        curve signature, returns zero on error.
        notice that the signature is valid only for one conversion
        and expires after the give block.

        @return true if the signer is verified
    */
    function verifyTrustedSender(IERC20Token[] _path, uint256 _amount, uint256 _block, address _addr, uint8 _v, bytes32 _r, bytes32 _s) private returns(bool) {
        bytes32 hash = keccak256(_block, tx.gasprice, _addr, msg.sender, _amount, _path);

        // checking that it is the first conversion with the given signature
        // and that the current block number doesn't exceeded the maximum block
        // number that's allowed with the current signature
        require(!conversionHashes[hash] && block.number <= _block);

        // recovering the signing address and comparing it to the trusted signer
        // address that was set in the contract
        bytes32 prefixedHash = keccak256("\x19Ethereum Signed Message:\n32", hash);
        bool verified = ecrecover(prefixedHash, _v, _r, _s) == signerAddress;

        // if the signer is the trusted signer - mark the hash so that it can't
        // be used multiple times
        if (verified)
            conversionHashes[hash] = true;
        return verified;
    }

    /**
        @dev converts the token to any other token in the bancor network by following
        a predefined conversion path and transfers the result tokens to a target account
        note that the converter should already own the source tokens

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _for         account that will receive the conversion result

        @return tokens issued in return
    */
    function convertFor(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) public payable returns (uint256) {
        return convertForPrioritized2(_path, _amount, _minReturn, _for, 0x0, 0x0, 0x0, 0x0);
    }

    /**
        @dev converts the token to any other token in the bancor network
        by following a predefined conversion path and transfers the result
        tokens to a target account.
        this version of the function also allows the verified signer
        to bypass the universal gas price limit.
        note that the converter should already own the source tokens

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _for         account that will receive the conversion result

        @return tokens issued in return
    */
    function convertForPrioritized2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)
        public
        payable
        validConversionPath(_path)
        returns (uint256)
    {
        // if ETH is provided, ensure that the amount is identical to _amount and verify that the source token is an ether token
        IERC20Token fromToken = _path[0];
        require(msg.value == 0 || (_amount == msg.value && etherTokens[fromToken]));

        // if ETH was sent with the call, the source is an ether token - deposit the ETH in it
        // otherwise, we assume we already have the tokens
        if (msg.value > 0)
            IEtherToken(fromToken).deposit.value(msg.value)();

        return convertForInternal(_path, _amount, _minReturn, _for, _block, _v, _r, _s);
    }

    /**
        @dev converts token to any other token in the bancor network
        by following the predefined conversion paths and transfers the result
        tokens to a targeted account.
        this version of the function also allows multiple conversions
        in a single atomic transaction.
        note that the converter should already own the source tokens

        @param _paths           merged conversion paths, i.e. [path1, path2, ...]. see conversion path format above
        @param _pathStartIndex  each item in the array is the start index of the nth path in _paths
        @param _amounts         amount to convert from (in the initial source token) for each path
        @param _minReturns      minimum return for each path. if the conversion results in an amount 
                                smaller than the minimum return - it is cancelled, must be nonzero
        @param _for             account that will receive the conversions result

        @return amount of conversion result for each path
    */
    function convertForMultiple(IERC20Token[] _paths, uint256[] _pathStartIndex, uint256[] _amounts, uint256[] _minReturns, address _for)
        public
        payable
        returns (uint256[])
    {
        // if ETH is provided, ensure that the total amount was converted into other tokens
        uint256 convertedValue = 0;
        uint256 pathEndIndex;
        
        // iterate over the conversion paths
        for (uint256 i = 0; i < _pathStartIndex.length; i += 1) {
            pathEndIndex = i == (_pathStartIndex.length - 1) ? _paths.length : _pathStartIndex[i + 1];

            // copy a single path from _paths into an array
            IERC20Token[] memory path = new IERC20Token[](pathEndIndex - _pathStartIndex[i]);
            for (uint256 j = _pathStartIndex[i]; j < pathEndIndex; j += 1) {
                path[j - _pathStartIndex[i]] = _paths[j];
            }

            // if ETH is provided, ensure that the amount is lower than the path amount and
            // verify that the source token is an ether token. otherwise ensure that 
            // the source is not an ether token
            IERC20Token fromToken = path[0];
            require(msg.value == 0 || (_amounts[i] <= msg.value && etherTokens[fromToken]) || !etherTokens[fromToken]);

            // if ETH was sent with the call, the source is an ether token - deposit the ETH path amount in it.
            // otherwise, we assume we already have the tokens
            if (msg.value > 0 && etherTokens[fromToken]) {
                IEtherToken(fromToken).deposit.value(_amounts[i])();
                convertedValue += _amounts[i];
            }
            _amounts[i] = convertForInternal(path, _amounts[i], _minReturns[i], _for, 0x0, 0x0, 0x0, 0x0);
        }

        // if ETH was provided, ensure that the full amount was converted
        require(convertedValue == msg.value);

        return _amounts;
    }

    /**
        @dev converts token to any other token in the bancor network
        by following a predefined conversion paths and transfers the result
        tokens to a target account.

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _for         account that will receive the conversion result
        @param _block       if the current block exceeded the given parameter - it is cancelled
        @param _v           (signature[128:130]) associated with the signer address and helps to validate if the signature is legit
        @param _r           (signature[0:64]) associated with the signer address and helps to validate if the signature is legit
        @param _s           (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

        @return tokens issued in return
    */
    function convertForInternal(
        IERC20Token[] _path, 
        uint256 _amount, 
        uint256 _minReturn, 
        address _for, 
        uint256 _block, 
        uint8 _v, 
        bytes32 _r, 
        bytes32 _s
    )
        private
        validConversionPath(_path)
        returns (uint256)
    {
        if (_v == 0x0 && _r == 0x0 && _s == 0x0) {
            IBancorGasPriceLimit gasPriceLimit = IBancorGasPriceLimit(registry.addressOf(ContractIds.BANCOR_GAS_PRICE_LIMIT));
            gasPriceLimit.validateGasPrice(tx.gasprice);
        }
        else {
            require(verifyTrustedSender(_path, _amount, _block, _for, _v, _r, _s));
        }

        // if ETH is provided, ensure that the amount is identical to _amount and verify that the source token is an ether token
        IERC20Token fromToken = _path[0];

        IERC20Token toToken;
        
        (toToken, _amount) = convertByPath(_path, _amount, _minReturn, fromToken, _for);

        // finished the conversion, transfer the funds to the target account
        // if the target token is an ether token, withdraw the tokens and send them as ETH
        // otherwise, transfer the tokens as is
        if (etherTokens[toToken])
            IEtherToken(toToken).withdrawTo(_for, _amount);
        else
            assert(toToken.transfer(_for, _amount));

        return _amount;
    }

    /**
        @dev executes the actual conversion by following the conversion path

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _fromToken   ERC20 token to convert from (the first element in the path)
        @param _for         account that will receive the conversion result

        @return ERC20 token to convert to (the last element in the path) & tokens issued in return
    */
    function convertByPath(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        IERC20Token _fromToken,
        address _for
    ) private returns (IERC20Token, uint256) {
        ISmartToken smartToken;
        IERC20Token toToken;
        IBancorConverter converter;

        // get the contract features address from the registry
        IContractFeatures features = IContractFeatures(registry.addressOf(ContractIds.CONTRACT_FEATURES));

        // iterate over the conversion path
        uint256 pathLength = _path.length;
        for (uint256 i = 1; i < pathLength; i += 2) {
            smartToken = ISmartToken(_path[i]);
            toToken = _path[i + 1];
            converter = IBancorConverter(smartToken.owner());
            checkWhitelist(converter, _for, features);

            // if the smart token isn't the source (from token), the converter doesn't have control over it and thus we need to approve the request
            if (smartToken != _fromToken)
                ensureAllowance(_fromToken, converter, _amount);

            // make the conversion - if it's the last one, also provide the minimum return value
            _amount = converter.change(_fromToken, toToken, _amount, i == pathLength - 2 ? _minReturn : 1);
            _fromToken = toToken;
        }
        return (toToken, _amount);
    }

    /**
        @dev returns the expected return amount for converting a specific amount by following
        a given conversion path.
        notice that there is no support for circular paths.

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)

        @return expected conversion return amount
    */
    function getReturnByPath(IERC20Token[] _path, uint256 _amount) public view returns (uint256) {
        IERC20Token fromToken;
        ISmartToken smartToken; 
        IERC20Token toToken;
        IBancorConverter converter;
        uint32 weight;
        uint256 amount;
        uint256 supply;
        ISmartToken prevSmartToken;
        IBancorFormula formula = IBancorFormula(registry.getAddress(ContractIds.BANCOR_FORMULA));

        amount = _amount;
        fromToken = _path[0];
        uint256 pathLength = _path.length;

        // iterate over the conversion path
        for (uint256 i = 1; i < pathLength; i += 2) {
            smartToken = ISmartToken(_path[i]);
            toToken = _path[i + 1];
            converter = IBancorConverter(smartToken.owner());

            if (toToken == smartToken) { // buy the smart token
                // check if the current smart token supply was changed in the previous iteration
                supply = smartToken == prevSmartToken ? supply : smartToken.totalSupply();

                // validate input
                require(getConnectorPurchaseEnabled(converter, fromToken));

                weight = getConnectorWeight(converter, fromToken);

                // calculate the amount minus the conversion fee
                amount = formula.calculatePurchaseReturn(supply, converter.getConnectorBalance(fromToken), weight, amount);
                amount = safeMul(amount, (MAX_CONVERSION_FEE - converter.conversionFee())) / MAX_CONVERSION_FEE;

                // update the smart token supply for the next iteration
                supply = smartToken.totalSupply() + amount;
            }
            else if (fromToken == smartToken) { // sell the smart token
                // check if the current smart token supply was changed in the previous iteration
                supply = smartToken == prevSmartToken ? supply : smartToken.totalSupply();

                weight = getConnectorWeight(converter, toToken);

                // calculate the amount minus the conversion fee
                amount = formula.calculateSaleReturn(supply, converter.getConnectorBalance(toToken), weight, amount);
                amount = safeMul(amount, (MAX_CONVERSION_FEE - converter.conversionFee())) / MAX_CONVERSION_FEE;

                // update the smart token supply for the next iteration
                supply = smartToken.totalSupply() - amount;
            }
            else { // cross connector conversion
                amount = converter.getReturn(fromToken, toToken, amount);
            }

            prevSmartToken = smartToken;
            fromToken = toToken;
        }
        return amount;
    }

    /**
        @dev checks whether the given converter supports a whitelist and if so, ensures that
        the account that should receive the conversion result is actually whitelisted

        @param _converter   converter to check for whitelist
        @param _for         account that will receive the conversion result
        @param _features    contract features contract address
    */
    function checkWhitelist(IBancorConverter _converter, address _for, IContractFeatures _features) private view {
        IWhitelist whitelist;

        // check if the converter supports the conversion whitelist feature
        if (!_features.isSupported(_converter, FeatureIds.CONVERTER_CONVERSION_WHITELIST))
            return;

        // get the whitelist contract from the converter
        whitelist = _converter.conversionWhitelist();
        if (whitelist == address(0))
            return;

        // check if the account that should receive the conversion result is actually whitelisted
        require(whitelist.isWhitelisted(_for));
    }

    /**
        @dev claims the caller's tokens, converts them to any other token in the bancor network
        by following a predefined conversion path and transfers the result tokens to a target account
        note that allowance must be set beforehand

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _for         account that will receive the conversion result

        @return tokens issued in return
    */
    function claimAndConvertFor(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) public returns (uint256) {
        // we need to transfer the tokens from the caller to the converter before we follow
        // the conversion path, to allow it to execute the conversion on behalf of the caller
        // note: we assume we already have allowance
        IERC20Token fromToken = _path[0];
        assert(fromToken.transferFrom(msg.sender, this, _amount));
        return convertFor(_path, _amount, _minReturn, _for);
    }

    /**
        @dev converts the token to any other token in the bancor network by following
        a predefined conversion path and transfers the result tokens back to the sender
        note that the converter should already own the source tokens

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return tokens issued in return
    */
    function convert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256) {
        return convertFor(_path, _amount, _minReturn, msg.sender);
    }

    /**
        @dev claims the caller's tokens, converts them to any other token in the bancor network
        by following a predefined conversion path and transfers the result tokens back to the sender
        note that allowance must be set beforehand

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return tokens issued in return
    */
    function claimAndConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public returns (uint256) {
        return claimAndConvertFor(_path, _amount, _minReturn, msg.sender);
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
        @dev returns the connector weight

        @param _converter       converter contract address
        @param _connector       connector's address to read from

        @return connector's weight
    */
    function getConnectorWeight(IBancorConverter _converter, IERC20Token _connector) 
        private
        view
        returns(uint32)
    {
        uint256 virtualBalance;
        uint32 weight;
        bool isVirtualBalanceEnabled;
        bool isPurchaseEnabled;
        bool isSet;
        (virtualBalance, weight, isVirtualBalanceEnabled, isPurchaseEnabled, isSet) = _converter.connectors(_connector);
        return weight;
    }

    /**
        @dev returns true if connector purchase enabled

        @param _converter       converter contract address
        @param _connector       connector's address to read from

        @return true if connector purchase enabled, otherwise - false
    */
    function getConnectorPurchaseEnabled(IBancorConverter _converter, IERC20Token _connector) 
        private
        view
        returns(bool)
    {
        uint256 virtualBalance;
        uint32 weight;
        bool isVirtualBalanceEnabled;
        bool isPurchaseEnabled;
        bool isSet;
        (virtualBalance, weight, isVirtualBalanceEnabled, isPurchaseEnabled, isSet) = _converter.connectors(_connector);
        return isPurchaseEnabled;
    }

    // deprecated, backward compatibility
    function convertForPrioritized(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256 _block,
        uint256 _nonce,
        uint8 _v,
        bytes32 _r,
        bytes32 _s)
        public payable returns (uint256)
    {
        _nonce;
        convertForPrioritized2(_path, _amount, _minReturn, _for, _block, _v, _r, _s);
    }
}

pragma solidity ^0.4.24;
import './IBancorNetwork.sol';
import './ContractIds.sol';
import './FeatureIds.sol';
import './converter/interfaces/IBancorConverter.sol';
import './converter/interfaces/IBancorFormula.sol';
import './converter/interfaces/IBancorGasPriceLimit.sol';
import './utility/TokenHolder.sol';
import './utility/SafeMath.sol';
import './utility/interfaces/IContractRegistry.sol';
import './utility/interfaces/IContractFeatures.sol';
import './utility/interfaces/IWhitelist.sol';
import './utility/interfaces/IAddressList.sol';
import './token/interfaces/IEtherToken.sol';
import './token/interfaces/ISmartToken.sol';
import './token/interfaces/INonStandardERC20.sol';
import './bancorx/interfaces/IBancorX.sol';

/**
    @dev The BancorNetwork contract is the main entry point for Bancor token conversions. It also allows for the conversion of any token in the Bancor Network to any other token in a single transaction by providing a conversion path. 

    A note on Conversion Path: Conversion path is a data structure that is used when converting a token to another token in the Bancor Network when the conversion cannot necessarily be done by a single converter and might require multiple 'hops'. The path defines which converters should be used and what kind of conversion should be done in each step. 
    
    The path format doesn't include complex structure; instead, it is represented by a single array in which each 'hop' is represented by a 2-tuple - smart token & to token. In addition, the first element is always the source token. The smart token is only used as a pointer to a converter (since converter addresses are more likely to change as opposed to smart token addresses).

    Format:
    [source token, smart token, to token, smart token, to token...]
*/
contract BancorNetwork is IBancorNetwork, TokenHolder, ContractIds, FeatureIds {
    using SafeMath for uint256;

    uint256 private constant CONVERSION_FEE_RESOLUTION = 1000000;
    uint256 private constant AFFILIATE_FEE_RESOLUTION = 1000000;

    uint256 public maxAffiliateFee = 30000;     // maximum affiliate-fee
    address public signerAddress = 0x0;         // verified address that allows conversions with higher gas price
    IContractRegistry public registry;          // contract registry contract address

    mapping (address => bool) public etherTokens;       // list of all supported ether tokens
    mapping (bytes32 => bool) public conversionHashes;  // list of conversion hashes, to prevent re-use of the same hash

    /**
        @dev initializes a new BancorNetwork instance

        @param _registry    address of a contract registry contract
    */
    constructor(IContractRegistry _registry) public validAddress(_registry) {
        registry = _registry;
    }

    /**
        @dev allows the owner to update the maximum affiliate-fee

        @param _maxAffiliateFee   maximum affiliate-fee
    */
    function setMaxAffiliateFee(uint256 _maxAffiliateFee)
        public
        ownerOnly
    {
        require(_maxAffiliateFee <= AFFILIATE_FEE_RESOLUTION);
        maxAffiliateFee = _maxAffiliateFee;
    }

    /**
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

    /**
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
    function verifyTrustedSender(IERC20Token[] _path, uint256 _customVal, uint256 _block, address _addr, uint8 _v, bytes32 _r, bytes32 _s) private returns(bool) {
        bytes32 hash = keccak256(abi.encodePacked(_block, tx.gasprice, _addr, msg.sender, _customVal, _path));

        // checking that it is the first conversion with the given signature
        // and that the current block number doesn't exceeded the maximum block
        // number that's allowed with the current signature
        require(!conversionHashes[hash] && block.number <= _block);

        // recovering the signing address and comparing it to the trusted signer
        // address that was set in the contract
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
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

        @param _path                conversion path, see conversion path format above
        @param _amount              amount to convert from (in the initial source token)
        @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _for                 account that will receive the conversion result
        @param _affiliateAccount    affiliate account
        @param _affiliateFee        affiliate fee in PPM

        @return tokens issued in return
    */
    function convertFor2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256) {
        return convertForPrioritized4(_path, _amount, _minReturn, _for, getSignature(0x0, 0x0, 0x0, 0x0, 0x0), _affiliateAccount, _affiliateFee);
    }

    /**
        @dev converts the token to any other token in the bancor network
        by following a predefined conversion path and transfers the result
        tokens to a target account.
        this version of the function also allows the verified signer
        to bypass the universal gas price limit.
        note that the converter should already own the source tokens

        @param _path                conversion path, see conversion path format above
        @param _amount              amount to convert from (in the initial source token)
        @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _for                 account that will receive the conversion result
        @param _signature           an array of the following elements:
                                    [0] uint256      custom value that was signed for prioritized conversion
                                    [1] uint256      if the current block exceeded the given parameter - it is cancelled
                                    [2] uint8        (signature[128:130]) associated with the signer address and helps to validate if the signature is legit
                                    [3] bytes32      (signature[0:64]) associated with the signer address and helps to validate if the signature is legit
                                    [4] bytes32      (signature[64:128]) associated with the signer address and helps to validate if the signature is legit
        @param _affiliateAccount    affiliate account
        @param _affiliateFee        affiliate fee in PPM

        @return tokens issued in return
    */
    function convertForPrioritized4(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256[] memory _signature,
        address _affiliateAccount,
        uint256 _affiliateFee
    )
        public
        payable
        returns (uint256)
    {
        // verify that the conversion parameters are legal
        verifyConversionParams(_path, _for, _for, _signature);

        // handle msg.value
        handleValue(_path[0], _amount, false);

        // convert and get the resulting amount
        uint256 amount = convertByPath(_path, _amount, _minReturn, _affiliateAccount, _affiliateFee);

        // finished the conversion, transfer the funds to the target account
        // if the target token is an ether token, withdraw the tokens and send them as ETH
        // otherwise, transfer the tokens as is
        IERC20Token toToken = _path[_path.length - 1];
        if (etherTokens[toToken])
            IEtherToken(toToken).withdrawTo(_for, amount);
        else
            ensureTransfer(toToken, _for, amount);

        return amount;
    }

    /**
        @dev converts any other token to BNT in the bancor network
        by following a predefined conversion path and transfers the resulting
        tokens to BancorX.
        note that the network should already have been given allowance of the source token (if not ETH)

        @param _path             conversion path, see conversion path format above
        @param _amount           amount to convert from (in the initial source token)
        @param _minReturn        if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _toBlockchain     blockchain BNT will be issued on
        @param _to               address/account on _toBlockchain to send the BNT to
        @param _conversionId     pre-determined unique (if non zero) id which refers to this transaction 

        @return the amount of BNT received from this conversion
    */
    function xConvert(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _conversionId
    )
        public
        payable
        returns (uint256)
    {
        return xConvertPrioritized(_path, _amount, _minReturn, _toBlockchain, _to, _conversionId, 0x0, 0x0, 0x0, 0x0);
    }

    /**
        @dev converts any other token to BNT in the bancor network
        by following a predefined conversion path and transfers the resulting
        tokens to BancorX.
        this version of the function also allows the verified signer
        to bypass the universal gas price limit.
        note that the network should already have been given allowance of the source token (if not ETH)

        @param _path            conversion path, see conversion path format above
        @param _amount          amount to convert from (in the initial source token)
        @param _minReturn       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _toBlockchain    blockchain BNT will be issued on
        @param _to              address/account on _toBlockchain to send the BNT to
        @param _conversionId    pre-determined unique (if non zero) id which refers to this transaction 
        @param _block           if the current block exceeded the given parameter - it is cancelled
        @param _v               (signature[128:130]) associated with the signer address and helps to validate if the signature is legit
        @param _r               (signature[0:64]) associated with the signer address and helps to validate if the signature is legit
        @param _s               (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

        @return the amount of BNT received from this conversion
    */
    function xConvertPrioritized(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _conversionId,
        uint256 _block,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        payable
        returns (uint256)
    {
        // verify that the conversion parameters are legal
        verifyConversionParams(_path, msg.sender, this, getSignature(_amount, _block, _v, _r, _s));

        // verify that the destination token is BNT
        require(_path[_path.length - 1] == registry.addressOf(ContractIds.BNT_TOKEN));

        // handle msg.value
        handleValue(_path[0], _amount, true);

        // convert and get the resulting amount
        uint256 amount = convertByPath(_path, _amount, _minReturn, address(0), 0);

        // transfer the resulting amount to BancorX
        IBancorX(registry.addressOf(ContractIds.BANCOR_X)).xTransfer(_toBlockchain, _to, amount, _conversionId);

        return amount;
    }

    /**
        @dev executes the actual conversion by following the conversion path

        @param _path                conversion path, see conversion path format above
        @param _amount              amount to convert from (in the initial source token)
        @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _affiliateAccount    affiliate account
        @param _affiliateFee        affiliate fee in PPM

        @return amount of tokens issued
    */
    function convertByPath(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) private returns (uint256) {
        uint256 amount = _amount;
        uint256 lastIndex = _path.length - 1;

        address bntToken;
        if (address(_affiliateAccount) == 0) {
            require(_affiliateFee == 0);
            bntToken = address(0);
        }
        else {
            require(0 < _affiliateFee && _affiliateFee <= maxAffiliateFee);
            bntToken = registry.addressOf(ContractIds.BNT_TOKEN);
        }

        // iterate over the conversion path
        for (uint256 i = 2; i <= lastIndex; i += 2) {
            IBancorConverter converter = IBancorConverter(ISmartToken(_path[i - 1]).owner());

            // if the smart token isn't the source (from token), the converter doesn't have control over it and thus we need to approve the request
            if (_path[i - 1] != _path[i - 2])
                ensureAllowance(_path[i - 2], converter, amount);

            // make the conversion - if it's the last one, also provide the minimum return value
            amount = converter.change(_path[i - 2], _path[i], amount, i == lastIndex ? _minReturn : 1);

            // pay affiliate-fee if needed
            if (address(_path[i]) == bntToken) {
                uint256 affiliateAmount = amount.mul(_affiliateFee).div(AFFILIATE_FEE_RESOLUTION);
                require(_path[i].transfer(_affiliateAccount, affiliateAmount));
                amount -= affiliateAmount;
                bntToken = address(0);
            }
        }

        return amount;
    }

    bytes4 private constant GET_RETURN_FUNC_SELECTOR = bytes4(uint256(keccak256("getReturn(address,address,uint256)") >> (256 - 4 * 8)));

    function getReturn(address _dest, address _fromToken, address _toToken, uint256 _amount) internal view returns (uint256, uint256) {
        uint256[2] memory ret;
        bytes memory data = abi.encodeWithSelector(GET_RETURN_FUNC_SELECTOR, _fromToken, _toToken, _amount);

        assembly {
            let success := staticcall(
                gas,           // gas remaining
                _dest,         // destination address
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data),   // input length (loaded from the first 32 bytes in the `data` array)
                ret,           // output buffer
                64             // output length
            )
            if iszero(success) {
                revert(0, 0)
            }
        }

        return (ret[0], ret[1]);
    }

    /**
        @dev returns the expected return amount for converting a specific amount by following
        a given conversion path.
        notice that there is no support for circular paths.

        @param _path        conversion path, see conversion path format above
        @param _amount      amount to convert from (in the initial source token)

        @return expected conversion return amount and conversion fee
    */
    function getReturnByPath(IERC20Token[] _path, uint256 _amount) public view returns (uint256, uint256) {
        IERC20Token fromToken;
        ISmartToken smartToken; 
        IERC20Token toToken;
        IBancorConverter converter;
        uint256 amount;
        uint256 fee;
        uint256 supply;
        uint256 balance;
        uint32 weight;
        ISmartToken prevSmartToken;
        IBancorFormula formula = IBancorFormula(registry.getAddress(ContractIds.BANCOR_FORMULA));

        amount = _amount;
        fromToken = _path[0];

        // iterate over the conversion path
        for (uint256 i = 1; i < _path.length; i += 2) {
            smartToken = ISmartToken(_path[i]);
            toToken = _path[i + 1];
            converter = IBancorConverter(smartToken.owner());

            if (toToken == smartToken) { // buy the smart token
                // check if the current smart token supply was changed in the previous iteration
                supply = smartToken == prevSmartToken ? supply : smartToken.totalSupply();

                // validate input
                require(getConnectorSaleEnabled(converter, fromToken));

                // calculate the amount & the conversion fee
                balance = converter.getConnectorBalance(fromToken);
                weight = getConnectorWeight(converter, fromToken);
                amount = formula.calculatePurchaseReturn(supply, balance, weight, amount);
                fee = amount.mul(converter.conversionFee()).div(CONVERSION_FEE_RESOLUTION);
                amount -= fee;

                // update the smart token supply for the next iteration
                supply = smartToken.totalSupply() + amount;
            }
            else if (fromToken == smartToken) { // sell the smart token
                // check if the current smart token supply was changed in the previous iteration
                supply = smartToken == prevSmartToken ? supply : smartToken.totalSupply();

                // calculate the amount & the conversion fee
                balance = converter.getConnectorBalance(toToken);
                weight = getConnectorWeight(converter, toToken);
                amount = formula.calculateSaleReturn(supply, balance, weight, amount);
                fee = amount.mul(converter.conversionFee()).div(CONVERSION_FEE_RESOLUTION);
                amount -= fee;

                // update the smart token supply for the next iteration
                supply = smartToken.totalSupply() - amount;
            }
            else { // cross connector conversion
                (amount, fee) = getReturn(converter, fromToken, toToken, amount);
            }

            prevSmartToken = smartToken;
            fromToken = toToken;
        }

        return (amount, fee);
    }

    /**
        @dev claims the caller's tokens, converts them to any other token in the bancor network
        by following a predefined conversion path and transfers the result tokens to a target account
        note that allowance must be set beforehand

        @param _path                conversion path, see conversion path format above
        @param _amount              amount to convert from (in the initial source token)
        @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _for                 account that will receive the conversion result
        @param _affiliateAccount    affiliate account
        @param _affiliateFee        affiliate fee in PPM

        @return tokens issued in return
    */
    function claimAndConvertFor2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee) public returns (uint256) {
        // we need to transfer the tokens from the caller to the converter before we follow
        // the conversion path, to allow it to execute the conversion on behalf of the caller
        // note: we assume we already have allowance
        IERC20Token fromToken = _path[0];
        ensureTransferFrom(fromToken, msg.sender, this, _amount);
        return convertFor2(_path, _amount, _minReturn, _for, _affiliateAccount, _affiliateFee);
    }

    /**
        @dev converts the token to any other token in the bancor network by following
        a predefined conversion path and transfers the result tokens back to the sender
        note that the converter should already own the source tokens

        @param _path                conversion path, see conversion path format above
        @param _amount              amount to convert from (in the initial source token)
        @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _affiliateAccount    affiliate account
        @param _affiliateFee        affiliate fee in PPM

        @return tokens issued in return
    */
    function convert2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256) {
        return convertFor2(_path, _amount, _minReturn, msg.sender, _affiliateAccount, _affiliateFee);
    }

    /**
        @dev claims the caller's tokens, converts them to any other token in the bancor network
        by following a predefined conversion path and transfers the result tokens back to the sender
        note that allowance must be set beforehand

        @param _path                conversion path, see conversion path format above
        @param _amount              amount to convert from (in the initial source token)
        @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
        @param _affiliateAccount    affiliate account
        @param _affiliateFee        affiliate fee in PPM

        @return tokens issued in return
    */
    function claimAndConvert2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) public returns (uint256) {
        return claimAndConvertFor2(_path, _amount, _minReturn, msg.sender, _affiliateAccount, _affiliateFee);
    }

    /**
        @dev ensures transfer of tokens, taking into account that some ERC-20 implementations don't return
        true on success but revert on failure instead

        @param _token     the token to transfer
        @param _to        the address to transfer the tokens to
        @param _amount    the amount to transfer
    */
    function ensureTransfer(IERC20Token _token, address _to, uint256 _amount) private {
        IAddressList addressList = IAddressList(registry.addressOf(ContractIds.NON_STANDARD_TOKEN_REGISTRY));

        if (addressList.listedAddresses(_token)) {
            uint256 prevBalance = _token.balanceOf(_to);
            // we have to cast the token contract in an interface which has no return value
            INonStandardERC20(_token).transfer(_to, _amount);
            uint256 postBalance = _token.balanceOf(_to);
            assert(postBalance > prevBalance);
        } else {
            // if the token isn't whitelisted, we assert on transfer
            assert(_token.transfer(_to, _amount));
        }
    }

    /**
        @dev ensures transfer of tokens, taking into account that some ERC-20 implementations don't return
        true on success but revert on failure instead

        @param _token     the token to transfer
        @param _from      the address to transfer the tokens from
        @param _to        the address to transfer the tokens to
        @param _amount    the amount to transfer
    */
    function ensureTransferFrom(IERC20Token _token, address _from, address _to, uint256 _amount) private {
        IAddressList addressList = IAddressList(registry.addressOf(ContractIds.NON_STANDARD_TOKEN_REGISTRY));

        if (addressList.listedAddresses(_token)) {
            uint256 prevBalance = _token.balanceOf(_to);
            // we have to cast the token contract in an interface which has no return value
            INonStandardERC20(_token).transferFrom(_from, _to, _amount);
            uint256 postBalance = _token.balanceOf(_to);
            assert(postBalance > prevBalance);
        } else {
            // if the token isn't whitelisted, we assert on transfer
            assert(_token.transferFrom(_from, _to, _amount));
        }
    }

    /**
        @dev utility, checks whether allowance for the given spender exists and approves one if it doesn't.
        Note that we use the non standard erc-20 interface in which `approve` has no return value so that
        this function will work for both standard and non standard tokens

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
            INonStandardERC20(_token).approve(_spender, 0);

        // approve the new allowance
        INonStandardERC20(_token).approve(_spender, _value);
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
        bool isSaleEnabled;
        bool isSet;
        (virtualBalance, weight, isVirtualBalanceEnabled, isSaleEnabled, isSet) = _converter.connectors(_connector);
        return weight;
    }

    /**
        @dev returns true if connector sale is enabled

        @param _converter       converter contract address
        @param _connector       connector's address to read from

        @return true if connector sale is enabled, otherwise - false
    */
    function getConnectorSaleEnabled(IBancorConverter _converter, IERC20Token _connector) 
        private
        view
        returns(bool)
    {
        uint256 virtualBalance;
        uint32 weight;
        bool isVirtualBalanceEnabled;
        bool isSaleEnabled;
        bool isSet;
        (virtualBalance, weight, isVirtualBalanceEnabled, isSaleEnabled, isSet) = _converter.connectors(_connector);
        return isSaleEnabled;
    }

    function getSignature(
        uint256 _customVal,
        uint256 _block,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) private pure returns (uint256[] memory) {
        uint256[] memory signature = new uint256[](5);
        signature[0] = _customVal;
        signature[1] = _block;
        signature[2] = uint256(_v);
        signature[3] = uint256(_r);
        signature[4] = uint256(_s);
        return signature;
    }

    function verifyConversionParams(
        IERC20Token[] _path,
        address _sender,
        address _receiver,
        uint256[] memory _signature
    )
        private
    {
        // verify that the number of elements is odd and that maximum number of 'hops' is 10
        require(_path.length > 2 && _path.length <= (1 + 2 * 10) && _path.length % 2 == 1);

        // verify that the account which should receive the conversion result is whitelisted
        IContractFeatures features = IContractFeatures(registry.addressOf(ContractIds.CONTRACT_FEATURES));
        for (uint256 i = 1; i < _path.length; i += 2) {
            IBancorConverter converter = IBancorConverter(ISmartToken(_path[i]).owner());
            if (features.isSupported(converter, FeatureIds.CONVERTER_CONVERSION_WHITELIST)) {
                IWhitelist whitelist = converter.conversionWhitelist();
                require (whitelist == address(0) || whitelist.isWhitelisted(_receiver));
            }
        }

        uint8 _v = uint8(_signature[2]);
        bytes32 _r = bytes32(_signature[3]);
        bytes32 _s = bytes32(_signature[4]);

        // verify gas price limit
        if (_v == 0x0 && _r == 0x0 && _s == 0x0) {
            IBancorGasPriceLimit gasPriceLimit = IBancorGasPriceLimit(registry.addressOf(ContractIds.BANCOR_GAS_PRICE_LIMIT));
            gasPriceLimit.validateGasPrice(tx.gasprice);
        }
        else {
            require(verifyTrustedSender(_path, _signature[0], _signature[1], _sender, _v, _r, _s));
        }
    }

    function handleValue(IERC20Token _token, uint256 _amount, bool _claim) private {
        // if ETH is provided, ensure that the amount is identical to _amount, verify that the source token is an ether token and deposit the ETH in it
        if (msg.value > 0) {
            require(_amount == msg.value && etherTokens[_token]);
            IEtherToken(_token).deposit.value(msg.value)();
        }
        // Otherwise, claim the tokens from the sender if needed
        else if (_claim) {
            ensureTransferFrom(_token, msg.sender, this, _amount);
        }
    }

    /**
        @dev deprecated, backward compatibility
    */
    function convert(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn
    ) public payable returns (uint256)
    {
        return convert2(_path, _amount, _minReturn, address(0), 0);
    }

    /**
        @dev deprecated, backward compatibility
    */
    function claimAndConvert(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn
    ) public returns (uint256)
    {
        return claimAndConvert2(_path, _amount, _minReturn, address(0), 0);
    }

    /**
        @dev deprecated, backward compatibility
    */
    function convertFor(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for
    ) public payable returns (uint256)
    {
        return convertFor2(_path, _amount, _minReturn, _for, address(0), 0);
    }

    /**
        @dev deprecated, backward compatibility
    */
    function claimAndConvertFor(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for
    ) public returns (uint256)
    {
        return claimAndConvertFor2(_path, _amount, _minReturn, _for, address(0), 0);
    }

    /**
        @dev deprecated, backward compatibility
    */
    function convertForPrioritized3(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256 _customVal,
        uint256 _block,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        payable
        returns (uint256)
    {
        return convertForPrioritized4(_path, _amount, _minReturn, _for, getSignature(_customVal, _block, _v, _r, _s), address(0), 0);
    }

    /**
        @dev deprecated, backward compatibility
    */
    function convertForPrioritized2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256 _block,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        payable
        returns (uint256)
    {
        return convertForPrioritized4(_path, _amount, _minReturn, _for, getSignature(_amount, _block, _v, _r, _s), address(0), 0);
    }

    /**
        @dev deprecated, backward compatibility
    */
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
        return convertForPrioritized4(_path, _amount, _minReturn, _for, getSignature(_amount, _block, _v, _r, _s), address(0), 0);
    }
}

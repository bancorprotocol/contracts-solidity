pragma solidity 0.4.26;
import './IBancorNetwork.sol';
import './FeatureIds.sol';
import './converter/interfaces/IBancorConverter.sol';
import './converter/interfaces/IBancorFormula.sol';
import './utility/TokenHolder.sol';
import './utility/SafeMath.sol';
import './utility/ContractRegistryClient.sol';
import './utility/interfaces/IContractFeatures.sol';
import './utility/interfaces/IWhitelist.sol';
import './token/interfaces/IEtherToken.sol';
import './token/interfaces/ISmartToken.sol';
import './token/interfaces/INonStandardERC20.sol';
import './bancorx/interfaces/IBancorX.sol';

/**
  * @dev The BancorNetwork contract is the main entry point for Bancor token conversions.
  * It also allows for the conversion of any token in the Bancor Network to any other token in a single transaction by providing a conversion path.
  * 
  * A note on Conversion Path: Conversion path is a data structure that is used when converting a token to another token in the Bancor Network,
  * when the conversion cannot necessarily be done by a single converter and might require multiple 'hops'.
  * The path defines which converters should be used and what kind of conversion should be done in each step.
  * 
  * The path format doesn't include complex structure; instead, it is represented by a single array in which each 'hop' is represented by a 2-tuple - smart token & to token.
  * In addition, the first element is always the source token.
  * The smart token is only used as a pointer to a converter (since converter addresses are more likely to change as opposed to smart token addresses).
  * 
  * Format:
  * [source token, smart token, to token, smart token, to token...]
*/
contract BancorNetwork is IBancorNetwork, TokenHolder, ContractRegistryClient, FeatureIds {
    using SafeMath for uint256;

    uint256 private constant CONVERSION_FEE_RESOLUTION = 1000000;
    uint256 private constant AFFILIATE_FEE_RESOLUTION = 1000000;

    uint256 public maxAffiliateFee = 30000;     // maximum affiliate-fee

    mapping (address => bool) public etherTokens;       // list of all supported ether tokens
    mapping (bytes32 => bool) public conversionHashes;  // list of conversion hashes, to prevent re-use of the same hash

    /**
      * @dev triggered when a conversion between two tokens occurs
      * 
      * @param _smartToken      smart token governed by the converter
      * @param _fromToken       ERC20 token converted from
      * @param _toToken         ERC20 token converted to
      * @param _fromAmount      amount converted, in fromToken
      * @param _toAmount        amount returned, minus conversion fee
      * @param _trader          wallet that initiated the trade
    */
    event Conversion(
        address indexed _smartToken,
        address indexed _fromToken,
        address indexed _toToken,
        uint256 _fromAmount,
        uint256 _toAmount,
        address _trader
    );

    /**
      * @dev initializes a new BancorNetwork instance
      * 
      * @param _registry    address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev allows the owner to update the maximum affiliate-fee
      * 
      * @param _maxAffiliateFee   maximum affiliate-fee
    */
    function setMaxAffiliateFee(uint256 _maxAffiliateFee)
        public
        ownerOnly
    {
        require(_maxAffiliateFee <= AFFILIATE_FEE_RESOLUTION);
        maxAffiliateFee = _maxAffiliateFee;
    }

    /**
      * @dev allows the owner to register/unregister ether tokens
      * 
      * @param _token       ether token contract address
      * @param _register    true to register, false to unregister
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
      * @dev converts the token to any other token in the bancor network by following
      * a predefined conversion path and transfers the result tokens to a target account
      * note that the network should already own the source tokens
      * 
      * @param _path                conversion path, see conversion path format above
      * @param _amount              amount to convert from (in the initial source token)
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _for                 account that will receive the conversion result
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return tokens issued in return
    */
    function convertFor2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256) {
        // verify that the number of elements is odd and that maximum number of 'hops' is 10
        require(_path.length > 2 && _path.length <= (1 + 2 * 10) && _path.length % 2 == 1);

        // verify that the account which should receive the conversion result is whitelisted
        require(isWhitelisted(_path, _for));

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
            ensureTransferFrom(toToken, this, _for, amount);

        return amount;
    }

    /**
      * @dev converts any other token to BNT in the bancor network
      * by following a predefined conversion path and transfers the resulting
      * tokens to BancorX.
      * note that the network should already have been given allowance of the source token (if not ETH)
      * 
      * @param _path                conversion path, see conversion path format above
      * @param _amount              amount to convert from (in the initial source token)
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _toBlockchain        blockchain BNT will be issued on
      * @param _to                  address/account on _toBlockchain to send the BNT to
      * @param _conversionId        pre-determined unique (if non zero) id which refers to this transaction 
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return the amount of BNT received from this conversion
    */
    function xConvert2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _conversionId,
        address _affiliateAccount,
        uint256 _affiliateFee
    )
        public
        payable
        returns (uint256)
    {
        // verify that the number of elements is odd and that maximum number of 'hops' is 10
        require(_path.length > 2 && _path.length <= (1 + 2 * 10) && _path.length % 2 == 1);

        // verify that the destination token is BNT
        require(_path[_path.length - 1] == addressOf(BNT_TOKEN));

        // handle msg.value
        handleValue(_path[0], _amount, true);

        // convert and get the resulting amount
        uint256 amount = convertByPath(_path, _amount, _minReturn, _affiliateAccount, _affiliateFee);

        // transfer the resulting amount to BancorX
        IBancorX(addressOf(BANCOR_X)).xTransfer(_toBlockchain, _to, amount, _conversionId);

        return amount;
    }

    /**
      * @dev executes the actual conversion by following the conversion path
      * 
      * @param _path                conversion path, see conversion path format above
      * @param _amount              amount to convert from (in the initial source token)
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return amount of tokens issued
    */
    function convertByPath(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) private returns (uint256) {
        uint256 toAmount;
        uint256 fromAmount = _amount;
        uint256 lastIndex = _path.length - 1;

        address bntToken;
        if (address(_affiliateAccount) == 0) {
            require(_affiliateFee == 0);
            bntToken = address(0);
        }
        else {
            require(0 < _affiliateFee && _affiliateFee <= maxAffiliateFee);
            bntToken = addressOf(BNT_TOKEN);
        }

        // iterate over the conversion path
        for (uint256 i = 2; i <= lastIndex; i += 2) {
            IBancorConverter converter = IBancorConverter(ISmartToken(_path[i - 1]).owner());

            // if the smart token isn't the source (from token), the converter doesn't have control over it and thus we need to approve the request
            if (_path[i - 1] != _path[i - 2])
                ensureAllowance(_path[i - 2], converter, fromAmount);

            // make the conversion - if it's the last one, also provide the minimum return value
            toAmount = converter.change(_path[i - 2], _path[i], fromAmount, i == lastIndex ? _minReturn : 1);

            // pay affiliate-fee if needed
            if (address(_path[i]) == bntToken) {
                uint256 affiliateAmount = toAmount.mul(_affiliateFee).div(AFFILIATE_FEE_RESOLUTION);
                require(_path[i].transfer(_affiliateAccount, affiliateAmount));
                toAmount -= affiliateAmount;
                bntToken = address(0);
            }

            emit Conversion(_path[i - 1], _path[i - 2], _path[i], fromAmount, toAmount, msg.sender);
            fromAmount = toAmount;
        }

        return toAmount;
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
      * @dev calculates the expected return of converting a given amount on a given path
      * note that there is no support for circular paths
      * 
      * @param _path        conversion path (see conversion path format above)
      * @param _amount      amount of _path[0] tokens received from the user
      * 
      * @return amount of _path[_path.length - 1] tokens that the user will receive
      * @return amount of _path[_path.length - 1] tokens that the user will pay as fee
    */
    function getReturnByPath(IERC20Token[] _path, uint256 _amount) public view returns (uint256, uint256) {
        uint256 amount;
        uint256 fee;
        uint256 supply;
        uint256 balance;
        uint32 ratio;
        IBancorConverter converter;
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));

        amount = _amount;

        // verify that the number of elements is larger than 2 and odd
        require(_path.length > 2 && _path.length % 2 == 1);

        // iterate over the conversion path
        for (uint256 i = 2; i < _path.length; i += 2) {
            IERC20Token fromToken = _path[i - 2];
            IERC20Token smartToken = _path[i - 1];
            IERC20Token toToken = _path[i];

            if (toToken == smartToken) { // buy the smart token
                // check if the current smart token has changed
                if (i < 3 || smartToken != _path[i - 3]) {
                    supply = smartToken.totalSupply();
                    converter = IBancorConverter(ISmartToken(smartToken).owner());
                }

                // calculate the amount & the conversion fee
                balance = converter.getConnectorBalance(fromToken);
                (, ratio, , , ) = converter.connectors(fromToken);
                amount = formula.calculatePurchaseReturn(supply, balance, ratio, amount);
                fee = amount.mul(converter.conversionFee()).div(CONVERSION_FEE_RESOLUTION);
                amount -= fee;

                // update the smart token supply for the next iteration
                supply += amount;
            }
            else if (fromToken == smartToken) { // sell the smart token
                // check if the current smart token has changed
                if (i < 3 || smartToken != _path[i - 3]) {
                    supply = smartToken.totalSupply();
                    converter = IBancorConverter(ISmartToken(smartToken).owner());
                }

                // calculate the amount & the conversion fee
                balance = converter.getConnectorBalance(toToken);
                (, ratio, , , ) = converter.connectors(toToken);
                amount = formula.calculateSaleReturn(supply, balance, ratio, amount);
                fee = amount.mul(converter.conversionFee()).div(CONVERSION_FEE_RESOLUTION);
                amount -= fee;

                // update the smart token supply for the next iteration
                supply -= amount;
            }
            else { // cross reserve conversion
                // check if the current smart token has changed
                if (i < 3 || smartToken != _path[i - 3]) {
                    converter = IBancorConverter(ISmartToken(smartToken).owner());
                }

                (amount, fee) = getReturn(converter, fromToken, toToken, amount);
            }
        }

        return (amount, fee);
    }

    /**
      * @dev claims the caller's tokens, converts them to any other token in the bancor network
      * by following a predefined conversion path and transfers the result tokens to a target account
      * note that allowance must be set beforehand
      * 
      * @param _path                conversion path, see conversion path format above
      * @param _amount              amount to convert from (in the initial source token)
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _for                 account that will receive the conversion result
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return tokens issued in return
    */
    function claimAndConvertFor2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee) public returns (uint256) {
        // we need to transfer the tokens from the caller to the network before we follow
        // the conversion path, to allow it to execute the conversion on behalf of the caller
        // note: we assume we already have allowance
        IERC20Token fromToken = _path[0];
        ensureTransferFrom(fromToken, msg.sender, this, _amount);
        return convertFor2(_path, _amount, _minReturn, _for, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev converts the token to any other token in the bancor network by following
      * a predefined conversion path and transfers the result tokens back to the sender
      * note that the network should already own the source tokens
      * 
      * @param _path                conversion path, see conversion path format above
      * @param _amount              amount to convert from (in the initial source token)
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return tokens issued in return
    */
    function convert2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256) {
        return convertFor2(_path, _amount, _minReturn, msg.sender, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev claims the caller's tokens, converts them to any other token in the bancor network
      * by following a predefined conversion path and transfers the result tokens back to the sender
      * note that allowance must be set beforehand
      * 
      * @param _path                conversion path, see conversion path format above
      * @param _amount              amount to convert from (in the initial source token)
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return tokens issued in return
    */
    function claimAndConvert2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) public returns (uint256) {
        return claimAndConvertFor2(_path, _amount, _minReturn, msg.sender, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev ensures transfer of tokens, taking into account that some ERC-20 implementations don't return
      * true on success but revert on failure instead
      * 
      * @param _token     the token to transfer
      * @param _from      the address to transfer the tokens from
      * @param _to        the address to transfer the tokens to
      * @param _amount    the amount to transfer
    */
    function ensureTransferFrom(IERC20Token _token, address _from, address _to, uint256 _amount) private {
        // We must assume that functions `transfer` and `transferFrom` do not return anything,
        // because not all tokens abide the requirement of the ERC20 standard to return success or failure.
        // This is because in the current compiler version, the calling contract can handle more returned data than expected but not less.
        // This may change in the future, so that the calling contract will revert if the size of the data is not exactly what it expects.
        uint256 prevBalance = _token.balanceOf(_to);
        if (_from == address(this))
            INonStandardERC20(_token).transfer(_to, _amount);
        else
            INonStandardERC20(_token).transferFrom(_from, _to, _amount);
        uint256 postBalance = _token.balanceOf(_to);
        require(postBalance > prevBalance);
    }

    /**
      * @dev utility, checks whether allowance for the given spender exists and approves one if it doesn't.
      * Note that we use the non standard erc-20 interface in which `approve` has no return value so that
      * this function will work for both standard and non standard tokens
      * 
      * @param _token   token to check the allowance in
      * @param _spender approved address
      * @param _value   allowance amount
    */
    function ensureAllowance(IERC20Token _token, address _spender, uint256 _value) private {
        uint256 allowance = _token.allowance(this, _spender);
        if (allowance < _value) {
            if (allowance > 0)
                INonStandardERC20(_token).approve(_spender, 0);
            INonStandardERC20(_token).approve(_spender, _value);
        }
    }

    function isWhitelisted(IERC20Token[] _path, address _receiver) private view returns (bool) {
        IContractFeatures features = IContractFeatures(addressOf(CONTRACT_FEATURES));
        for (uint256 i = 1; i < _path.length; i += 2) {
            IBancorConverter converter = IBancorConverter(ISmartToken(_path[i]).owner());
            if (features.isSupported(converter, FeatureIds.CONVERTER_CONVERSION_WHITELIST)) {
                IWhitelist whitelist = converter.conversionWhitelist();
                if (whitelist != address(0) && !whitelist.isWhitelisted(_receiver))
                    return false;
            }
        }
        return true;
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
      * @dev deprecated, backward compatibility
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
      * @dev deprecated, backward compatibility
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
      * @dev deprecated, backward compatibility
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
      * @dev deprecated, backward compatibility
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
      * @dev deprecated, backward compatibility
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
        return xConvert2(_path, _amount, _minReturn, _toBlockchain, _to, _conversionId, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function xConvertPrioritized3(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _conversionId,
        uint256[] memory,
        address _affiliateAccount,
        uint256 _affiliateFee
    )
        public
        payable
        returns (uint256)
    {
        return xConvert2(_path, _amount, _minReturn, _toBlockchain, _to, _conversionId, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function xConvertPrioritized2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _conversionId,
        uint256[] memory
    )
        public
        payable
        returns (uint256)
    {
        return xConvert2(_path, _amount, _minReturn, _toBlockchain, _to, _conversionId, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function xConvertPrioritized(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _conversionId,
        uint256,
        uint8,
        bytes32,
        bytes32
    )
        public
        payable
        returns (uint256)
    {
        return xConvert2(_path, _amount, _minReturn, _toBlockchain, _to, _conversionId, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function convertForPrioritized4(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256[] memory,
        address _affiliateAccount,
        uint256 _affiliateFee
    )
        public
        payable
        returns (uint256)
    {
        return convertFor2(_path, _amount, _minReturn, _for, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function convertForPrioritized3(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256,
        uint256,
        uint8,
        bytes32,
        bytes32
    )
        public
        payable
        returns (uint256)
    {
        return convertFor2(_path, _amount, _minReturn, _for, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function convertForPrioritized2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256,
        uint8,
        bytes32,
        bytes32
    )
        public
        payable
        returns (uint256)
    {
        return convertFor2(_path, _amount, _minReturn, _for, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function convertForPrioritized(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256,
        uint256,
        uint8,
        bytes32,
        bytes32
    )
        public payable returns (uint256)
    {
        return convertFor2(_path, _amount, _minReturn, _for, address(0), 0);
    }
}

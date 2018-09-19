pragma solidity ^0.4.18;
import '../converter/BancorConverter.sol';
import './FinancieFee.sol';
import './FinancieNotifierDelegate.sol';
import '../token/interfaces/IEtherToken.sol';

/**
* Financie Bancor Converter
*
*  Based on BancorConverter, extended and overriden for...
*    - allow conversion only from ETH/Card to Card/ETH
*    - ignore base fee model and use Financie fee model
*
*/
contract FinancieBancorConverter is BancorConverter, FinancieNotifierDelegate, FinancieFee {

    IERC20Token[] public quickSellPath;

    /**
    *   @dev constructor
    *
    *   @param  _token              smart token governed by the converter
    *   @param  _etherToken         ether-pegged token
    *   @param  _connectorToken     card connector for defining the first connector at deployment time
    *   @param  _hero_wallet        issuer's wallet
    *   @param  _team_wallet        Financie team wallet
    *   @param  _registry           address of a bancor converter extensions contract
    *   @param  _notifier_address   address of Financie Notifier contract
    *   @param  _heroFee            fee for financie hero, represented in ppm
    *   @param  _teamFee            fee for financie team, represented in ppm
    *   @param  _connectorWeight    optional, weight for the initial connector
    */
    function FinancieBancorConverter(
        ISmartToken _token,
        IEtherToken _etherToken,
        IERC20Token _connectorToken,
        address _hero_wallet,
        address _team_wallet,
        IContractRegistry _registry,
        address _notifier_address,
        uint32 _heroFee,
        uint32 _teamFee,
        uint32 _connectorWeight)
        public
        BancorConverter(_token, _registry, 0, _connectorToken, _connectorWeight)
        FinancieFee(_heroFee, _teamFee, _hero_wallet, _team_wallet)
        FinancieNotifierDelegate(_notifier_address)
    {
        // when receiving ether, then deposit to ether token -> change to smart token -> change to connector token
        quickBuyPath.push(_etherToken);
        quickBuyPath.push(_token);
        quickBuyPath.push(_connectorToken);

        quickSellPath.push(_connectorToken);
        quickSellPath.push(_token);
        quickSellPath.push(_etherToken);
    }

    function getVersion() public pure returns (uint256) {
        return 10;
    }

    function acceptTokenOwnership() public {
        super.acceptTokenOwnership();
        notifyApproveNewBancor(address(quickSellPath[0]), address(this));
    }

    /**
    *   @dev Sell Card Tokens - required approval for this contract before calling this function
    *
    *   @param  _amount           amount of sale tokens in wei
    *   @param  _minReturn        minimum demands ether in wei, in case of lower result, the function will be failed
    */
    function sellCards(uint256 _amount, uint256 _minReturn) public returns (uint256) {
        uint256 result = quickConvertInternal(quickSellPath, _amount, 0, 1, this);

        uint256 feeAmount = distributeFees(result);
        uint256 net = safeSub(result, feeAmount);

        msg.sender.transfer(net);

        notifyConvertCards(msg.sender, address(quickSellPath[0]), address(quickSellPath[2]), _amount, net);
        assert(net >= _minReturn);

        return net;
    }

    /**
    *   @dev Buy Card Tokens - required specified amount of ether as msg.value
    *
    *   @param  _amount           amount of purchase payment ether in wei
    *   @param  _minReturn        minimum demands cards in wei, in case of lower result, the function will be failed
    */
    function buyCards(uint256 _amount, uint256 _minReturn) payable public returns (uint256) {
        uint256 feeAmount = distributeFees(_amount);
        uint256 net = safeSub(_amount, feeAmount);

        uint256 result = quickConvertInternal(quickBuyPath, net, net, 1, msg.sender);

        notifyConvertCards(msg.sender, address(quickBuyPath[0]), address(quickBuyPath[2]), _amount, result);
        assert(result >= _minReturn);

        return result;
    }

    /**
    *   @dev Convert with Quick Converter - overriden for specified amount conversion
    */
    function quickConvertInternal(IERC20Token[] _path, uint256 _amount, uint256 _value, uint256 _minReturn, address _spender)
        internal
        validConversionPath(_path)
        returns (uint256)
    {
        IERC20Token fromToken = _path[0];
        IBancorNetwork bancorNetwork = IBancorNetwork(registry.addressOf(ContractIds.BANCOR_NETWORK));

        // we need to transfer the source tokens from the caller to the BancorNetwork contract,
        // so it can execute the conversion on behalf of the caller
        if (msg.value == 0) {
            // not ETH, send the source tokens to the BancorNetwork contract
            // if the token is the smart token, no allowance is required - destroy the tokens
            // from the caller and issue them to the BancorNetwork contract
            if (fromToken == token) {
                token.destroy(msg.sender, _amount); // destroy _amount tokens from the caller's balance in the smart token
                token.issue(bancorNetwork, _amount); // issue _amount new tokens to the BancorNetwork contract
            } else {
                // otherwise, we assume we already have allowance, transfer the tokens directly to the BancorNetwork contract
                assert(fromToken.transferFrom(msg.sender, bancorNetwork, _amount));
            }
        }

        // execute the conversion and pass on the ETH with the call
        return bancorNetwork.convertForPrioritized2.value(_value)(_path, _amount, _minReturn, _spender, 0x0, 0x0, 0x0, 0x0);
    }

    /**
    *   @dev Overridden to prevent super contract payable function
    */
    function() payable public {
    }

    /**
    *   @dev Overridden for original fee model
    */
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public view returns (uint256) {
        require(_fromToken == quickSellPath[0] || _fromToken == quickBuyPath[0]);
        require(_toToken == quickSellPath[2] || _toToken == quickBuyPath[2]);

        if ( _fromToken == quickSellPath[0] ) {
            uint256 grossSell = super.getReturn(_fromToken, _toToken, _amount);
            return safeSub(grossSell, getFinancieFee(grossSell));
        } else {
            return super.getReturn(_fromToken, _toToken, safeSub(_amount, getFinancieFee(_amount)));
        }

    }

}

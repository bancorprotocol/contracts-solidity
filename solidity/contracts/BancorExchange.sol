pragma solidity ^0.4.23;

import "./converter/BancorConverter.sol";

contract BancorExchange is Owned {

    ISmartToken public smartToken;
    IBancorNetwork public bancorNetwork;
    BancorConverter public bancorConverter;
    address clockAuction;

    IERC20Token[] public quickSellPath;
    IERC20Token[] public quickBuyPath;

    // validates a conversion path - verifies that the number of elements is odd and that maximum number of 'hops' is 10
    modifier validConversionPath(IERC20Token[] _path) {
        require(_path.length > 2 && _path.length <= (1 + 2 * 10) && _path.length % 2 == 1);
        _;
    }

    constructor(address _st, address _bn, address _bc) public {
        smartToken = ISmartToken(_st);
        bancorNetwork = IBancorNetwork(_bn);
        bancorConverter = BancorConverter(_bc);
    }

    function() payable {
        // this is necessary!
    }

    function setSmartToken(address _st) public ownerOnly {
        smartToken = ISmartToken(_st);
    }

    function setBancorNetwork(address _bn) public ownerOnly {
        bancorNetwork = IBancorNetwork(_bn);
    }

    function setBancorConverter(address _bc) public ownerOnly {
        bancorConverter = BancorConverter(_bc);
    }

    function setQuickSellPath(IERC20Token[] _path)
    public
    ownerOnly
    validConversionPath(_path)
    {
        quickSellPath = _path;
    }

    function setQuickBuyPath(IERC20Token[] _path)
    public
    ownerOnly
    validConversionPath(_path)
    {
        quickBuyPath = _path;
    }

    function buyRING(uint _minReturn) payable public returns (uint) {
        uint amount = bancorConverter.quickConvert.value(msg.value)(quickBuyPath, msg.value, _minReturn);
        smartToken.transfer(msg.sender, amount);
        return amount;
    }

    function exchangeRingInBid(uint _minReturn, address _buyer) payable public returns (uint) {
        require(msg.sender == clockAuction);
        uint connectorBalance = bancorConverter.getConnectorBalance(quickBuyPath[0]);
        uint supply = smartToken.totalSupply();
        uint cw = bancorConverter.connectors(quickBuyPath[0]).weight;
        uint amountRequired = bancorConverter.getPurchaseRequire(connectorBalance, supply, cw, _minReturn);
        require(msg.value >= amountRequired);
        uint amount = bancorConverter.quickConvert.value(amountRequired)(quickBuyPath, msg.value, _minReturn);
        uint refundEth = msg.value - amountRequired;
        if (refundEth > 0) {
            _buyer.transfer(refundEth);
        }
        return amount;
    }

    function tokenFallback(address _from, uint256 _value, bytes _data) public {
        if (address(smartToken) == msg.sender) {
            uint minReturn = bytesToUint256(_data);
            smartToken.transfer(address(bancorNetwork), _value);
            // cant replace address(this) with _from
            // because of whitelist mechanism in bancor protocol
            uint amount = bancorNetwork.convertForPrioritized2(quickSellPath, _value, minReturn, address(this), 0, 0, 0x0, 0x0);
            _from.transfer(amount);
        }
    }

    // @dev before invoke sellRING, make sure approve to exchange before in RING contract
    // @param _sellAmount amount of ring you want to sell
    // @param _minReturn minimum amount of ETH you expect
    function sellRING(uint _sellAmount, uint _minReturn) public {
        smartToken.transferFrom(msg.sender, address(bancorNetwork), _sellAmount);
        // cant replace address(this) with msg.sender
        // because of whitelist mechanism in bancor protocol
        uint amount = bancorNetwork.convertForPrioritized2(quickSellPath, _sellAmount, _minReturn, address(this), 0, 0, 0x0, 0x0);
        msg.sender.transfer(amount);
    }


    function bytesToUint256(bytes b) public pure returns (uint256) {
        bytes32 out;

        for (uint i = 0; i < 32; i++) {
            out |= bytes32(b[i] & 0xFF) >> (i * 8);
        }
        return uint256(out);
    }


    function claimTokens(address _token) public ownerOnly {
        if (_token == 0x0) {
            owner.transfer(address(this).balance);
            return;
        }
        IERC20Token token = IERC20Token(_token);
        uint balance = token.balanceOf(address(this));
        token.transfer(owner, balance);
    }

    function setClockAuction(address _clockAuction) public ownerOnly {
        clockAuction = _clockAuction;
    }


}
pragma solidity ^0.4.18;
import '../utility/Utils.sol';
import './IFinancieInternalBank.sol';
import '../utility/Owned.sol';
import '../token/interfaces/IERC20Token.sol';

contract FinancieInternalBank is IFinancieInternalBank, Utils, Owned {

    IERC20Token paymentCurrencyToken;
    mapping (uint32 => uint256) balanceOfConsumableCurrencyTokens;
    mapping (uint32 => uint256) balanceOfWithdrawableCurrencyTokens;
    mapping (uint32 => uint256) balanceOfPendingRevenueCurrencyTokens;
    mapping (address => mapping (uint32 => uint256)) balanceOfTokens;
    mapping (address => mapping (uint32 => bool)) holderOfTokens;
    mapping (address => mapping (uint32 => uint256)) bidsOfAuctions;
    mapping (address => uint256) totalBidsOfAuctions;
    mapping (address => uint256) receivedCardsOfAuctions;

    constructor(address _paymentCurrencyToken) public {
        paymentCurrencyToken = IERC20Token(_paymentCurrencyToken);
    }

    function transferTokens(address _tokenAddress, address _to, uint256 _amount)
        public
        ownerOnly
    {
        assert(_tokenAddress != address(paymentCurrencyToken));
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transfer(_to, _amount);
    }

    function transferCurrencyTokens(address _to, uint256 _amount)
        public
        ownerOnly
    {
        paymentCurrencyToken.transfer(_to, _amount);
    }

    function setBalanceOfToken(address _tokenAddress, uint32 _userId, uint256 _amount)
        public
        ownerOnly
    {
        assert(_tokenAddress != address(paymentCurrencyToken));
        balanceOfTokens[_tokenAddress][_userId] = _amount;
    }

    function getBalanceOfToken(address _tokenAddress, uint32 _userId)
        public
        view
        returns(uint256)
    {
        assert(_tokenAddress != address(paymentCurrencyToken));
        return balanceOfTokens[_tokenAddress][_userId];
    }

    function setBalanceOfConsumableCurrencyToken(uint32 _userId, uint256 _amount)
        public
        ownerOnly
    {
        balanceOfConsumableCurrencyTokens[_userId] = _amount;
    }

    function getBalanceOfConsumableCurrencyToken(uint32 _userId)
        public
        view
        returns(uint256)
    {
        return balanceOfConsumableCurrencyTokens[_userId];
    }

    function setBalanceOfWithdrawableCurrencyToken(uint32 _userId, uint256 _amount)
        public
        ownerOnly
    {
        balanceOfWithdrawableCurrencyTokens[_userId] = _amount;
    }

    function getBalanceOfWithdrawableCurrencyToken(uint32 _userId)
        public
        view
        returns(uint256)
    {
        return balanceOfWithdrawableCurrencyTokens[_userId];
    }

    function setBalanceOfPendingRevenueCurrencyToken(uint32 _userId, uint256 _amount)
        public
        ownerOnly
    {
        balanceOfPendingRevenueCurrencyTokens[_userId] = _amount;
    }

    function getBalanceOfPendingRevenueCurrencyToken(uint32 _userId)
        public
        view
        returns(uint256)
    {
        return balanceOfPendingRevenueCurrencyTokens[_userId];
    }

    function setHolderOfToken(address _tokenAddress, uint32 _userId, bool _flg)
        public
        ownerOnly
    {
        holderOfTokens[_tokenAddress][_userId] = _flg;
    }

    function getHolderOfToken(address _tokenAddress, uint32 _userId)
        public
        view
        returns(bool)
    {
        return holderOfTokens[_tokenAddress][_userId];
    }

    function setBidsOfAuctions(address _auctionAddress, uint32 _userId, uint256 _amount)
        public
        ownerOnly
    {
        bidsOfAuctions[_auctionAddress][_userId] = _amount;
    }

    function getBidsOfAuctions(address _auctionAddress, uint32 _userId)
        public
        view
        returns(uint256)
    {
        return bidsOfAuctions[_auctionAddress][_userId];
    }

    function setTotalBidsOfAuctions(address _auctionAddress, uint256 _amount)
        public
        ownerOnly
    {
        totalBidsOfAuctions[_auctionAddress] = _amount;
    }

    function getTotalBidsOfAuctions(address _auctionAddress)
        public
        view
        returns(uint256)
    {
        return totalBidsOfAuctions[_auctionAddress];
    }

    function setRecvCardsOfAuctions(address _auctionAddress, uint256 _amount)
        public
        ownerOnly
    {
        receivedCardsOfAuctions[_auctionAddress] = _amount;
    }

    function getRecvCardsOfAuctions(address _auctionAddress)
        public
        view
        returns(uint256)
    {
        return receivedCardsOfAuctions[_auctionAddress];
    }

}

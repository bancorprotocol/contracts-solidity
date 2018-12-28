pragma solidity ^0.4.18;
import '../utility/Utils.sol';
import './IFinancieInternalBank.sol';
import '../utility/Owned.sol';
import '../token/interfaces/IERC20Token.sol';

contract FinancieInternalBank is IFinancieInternalBank, Utils, Owned {

    mapping (address => mapping (uint32 => uint256)) balanceOfTokens;
    mapping (address => mapping (uint32 => bool)) holderOfTokens;
    mapping (address => mapping (uint32 => uint256)) bidsOfAuctions;
    mapping (address => uint256) totalBidsOfAuctions;
    mapping (address => uint256) receivedCardsOfAuctions;

    function withdrawTokens(address _tokenAddress, address _to, uint256 _amount)
        public
        ownerOnly
    {
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transfer(_to, _amount);
    }

    function setBalanceOfToken(address _tokenAddress, uint32 _userId, uint256 _amount)
        public
        ownerOnly
    {
        balanceOfTokens[_tokenAddress][_userId] = _amount;
    }

    function getBalanceOfToken(address _tokenAddress, uint32 _userId)
        public
        view
        returns(uint256)
    {
        return balanceOfTokens[_tokenAddress][_userId];
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

pragma solidity ^0.4.18;
import '../utility/interfaces/IOwned.sol';

/**
* Financie Internal Wallet interface
*/
contract IFinancieInternalWallet is IOwned{
    function setInternalBank(address _bank) public;
    function transferBnakOwnership(address _newOwner);
    function getBalanceOfToken(address _tokenAddress, uint32 _userId) public view returns(uint256);
    function getBalanceOfConsumableCurrencyToken(uint32 _userId) public view returns(uint256);
    function getBalanceOfWithdrawableCurrencyToken(uint32 _userId) public view returns(uint256);
    function depositTokens(uint32 _userId, uint256 _amount, address _tokenAddress);
    function depositConsumableCurrencyTokens(uint32 _userId, uint256 _amount);
    function depositWithdrawableCurrencyTokens(uint32 _userId, uint256 _amount);
    function convertWithdrawableToConsumableCurrencyTokens(uint32 _userId, uint256 _amount);
    function withdrawTokens(uint32 _userId, uint256 _amount, address _tokenAddress);
    function withdrawCurrencyTokens(uint32 _userId, uint256 _amount);
    function delegateBuyCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress);
    function delegateSellCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress);
    function delegateBidCards(uint32 _userId, uint256 _amount, address _auctionAddress);
    function delegateReceiveCards(uint32 _userId, address _auctionAddress);
    function delegateCanClaimTokens(uint32 _userId, address _auctionAddress) public view returns(bool);
    function delegateEstimateClaimTokens(uint32 _userId, address _auctionAddress) public view returns(uint256);
}

pragma solidity ^0.4.18;
import '../utility/interfaces/IOwned.sol';

/**
* Financie Internal WalletData interface
*/
contract IFinancieInternalWalletData  is IOwned {
  function setBalanceOfToken(address _tokenAddress, uint32 _userId, uint256 _amount) public;
  function getBalanceOfToken(address _tokenAddress, uint32 _userId) public view returns(uint256);
  function setHolderOfToken(address _tokenAddress, uint32 _userId, bool _flg) public;
  function getHolderOfToken(address _tokenAddress, uint32 _userId) public view returns(bool);
  function setBidsOfAuctions(address _auctionAddress, uint32 _userId, uint256 _amount) public;
  function getBidsOfAuctions(address _auctionAddress, uint32 _userId) public view returns(uint256);
  function setTotalBidsOfAuctions(address _auctionAddress, uint256 _amount) public ;
  function getTotalBidsOfAuctions(address _auctionAddress) public view returns(uint256);
  function setRecvCardsOfAuctions(address _auctionAddress, uint256 _amount) public;
  function getRecvCardsOfAuctions(address _auctionAddress) public view returns(uint256);
}

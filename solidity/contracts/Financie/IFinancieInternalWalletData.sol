pragma solidity ^0.4.18;
import '../utility/interfaces/IOwned.sol';

/**
* Financie Internal WalletData interface
*/
contract IFinancieInternalWalletData  is IOwned {
  function setBalanceOfToken(address _tokenAddress, uint32 _userId, uint256 _amount);
  function getBalanceOfToken(address _tokenAddress, uint32 _userId) public view returns(uint256);
  function setBidsOfAuctions(address _auctionAddress, uint32 _userId, uint256 _amount);
  function getBidsOfAuctions(address _auctionAddress, uint32 _userId) view returns(uint256);
  function setTotalBidsOfAuctions(address _auctionAddress, uint256 _amount);
  function getTotalBidsOfAuctions(address _auctionAddress) view returns(uint256);
  function setRecvCardsOfAuctions(address _auctionAddress, uint256 _amount);
  function getRecvCardsOfAuctions(address _auctionAddress) view returns(uint256);
}

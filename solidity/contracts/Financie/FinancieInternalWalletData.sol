pragma solidity ^0.4.18;
import '../utility/Utils.sol';
import './FinancieCoreComponents.sol';
import './IFinancieInternalWalletData.sol';

contract FinancieInternalWalletData is IFinancieInternalWalletData, FinancieCoreComponents, Utils {

  mapping (address => mapping (uint32 => uint256)) balanceOfTokens;
  mapping (address => mapping (uint32 => uint256)) bidsOfAuctions;
  mapping (address => uint256) totalBidsOfAuctions;
  mapping (address => uint256) receivedCardsOfAuctions;

  constructor(address _managedContracts, address _platformToken, address _currency_token)
    public
    FinancieCoreComponents(_managedContracts, _platformToken, _currency_token) {
  }

  function setBalanceOfToken(address _tokenAddress, uint32 _userId, uint256 _amount)
    public
    validTargetContract(msg.sender)
    validTargetContract(_tokenAddress) {

    balanceOfTokens[_tokenAddress][_userId] = _amount;
  }

  function getBalanceOfToken(address _tokenAddress, uint32 _userId)
    public
    validTargetContract(msg.sender)
    validTargetContract(_tokenAddress)
    view returns(uint256) {

    return balanceOfTokens[_tokenAddress][_userId];
  }

  function setBidsOfAuctions(address _auctionAddress, uint32 _userId, uint256 _amount)
    public
    validTargetContract(msg.sender)
    validTargetContract(_auctionAddress) {

    bidsOfAuctions[_auctionAddress][_userId] = _amount;
  }

  function getBidsOfAuctions(address _auctionAddress, uint32 _userId)
    public
    validTargetContract(msg.sender)
    validTargetContract(_auctionAddress)
    view returns(uint256) {

    return bidsOfAuctions[_auctionAddress][_userId];
  }

  function setTotalBidsOfAuctions(address _auctionAddress, uint256 _amount)
    public
    validTargetContract(msg.sender)
    validTargetContract(_auctionAddress) {

    totalBidsOfAuctions[_auctionAddress] = _amount;
  }

  function getTotalBidsOfAuctions(address _auctionAddress)
    public
    validTargetContract(msg.sender)
    validTargetContract(_auctionAddress)
    view returns(uint256) {

    return totalBidsOfAuctions[_auctionAddress];
  }

  function setRecvCardsOfAuctions(address _auctionAddress, uint256 _amount)
    public
    validTargetContract(msg.sender)
    validTargetContract(_auctionAddress) {

    receivedCardsOfAuctions[_auctionAddress] = _amount;
  }

  function getRecvCardsOfAuctions(address _auctionAddress)
    public
    validTargetContract(msg.sender)
    validTargetContract(_auctionAddress)
    view returns(uint256) {

    return receivedCardsOfAuctions[_auctionAddress];
  }

}

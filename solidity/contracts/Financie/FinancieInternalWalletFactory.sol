pragma solidity ^0.4.18;
import './FinancieInternalWallet.sol';
import './IFinancieInternalWalletFactory.sol';

contract FinancieInternalWalletFactory is IFinancieInternalWalletFactory {

  event NewWallet(address indexed _walletAddress, address indexed _owner);
  /**
      @dev constructor
  */
  constructor() public{}

  function createInternalWallet(
    address _teamWallet,
    address _paymentCurrencyToken,
    address _walletdata
    ) public returns(address) {
    FinancieInternalWallet intwallet = new FinancieInternalWallet(
      _teamWallet, _paymentCurrencyToken, _walletdata);

    intwallet.transferOwnership(msg.sender);

    address _walletAddress = address(intwallet);
    emit NewWallet(_walletAddress, msg.sender);

    return _walletAddress;
  }
}

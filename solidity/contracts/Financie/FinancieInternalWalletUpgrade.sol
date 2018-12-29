pragma solidity ^0.4.18;
import '../utility/Owned.sol';
import './IFinancieInternalWallet.sol';
import './IFinancieInternalWalletFactory.sol';

contract FinancieInternalWalletUpgrade is Owned {
  address walletFactory;
  address teamwallet;
  address walletdata;
  address paymentCurrencyToken;

  event WalletUpgrade(address indexed _oldWallet, address indexed _newWallet);

  event WalletOwned(address indexed _oldWallet, address indexed _owner);

  constructor(
    address _walletFactory,
    address _teamwallet,
    address _paymentCurrencyToken,
    address _walletdata
    ) public {
    walletFactory = _walletFactory;
    teamwallet = _teamwallet;
    walletdata = _walletdata;
    paymentCurrencyToken = _paymentCurrencyToken;
  }

  function upgrade(IFinancieInternalWallet _oldWallet) public {
    acceptConverterOwnership(_oldWallet);

    IFinancieInternalWallet newWallet = createWallet();

    _oldWallet.transferBnakOwnership(newWallet);
    newWallet.setInternalBank(walletdata);

    _oldWallet.transferOwnership(msg.sender);
    newWallet.transferOwnership(msg.sender);

    emit WalletUpgrade(address(_oldWallet), address(newWallet));
  }

  function acceptConverterOwnership(IFinancieInternalWallet _oldWallet) private {
      require(msg.sender == _oldWallet.owner());
      _oldWallet.acceptOwnership();
      emit WalletOwned(_oldWallet, this);
  }

  function createWallet() private returns(IFinancieInternalWallet) {
    IFinancieInternalWalletFactory factory = IFinancieInternalWalletFactory(walletFactory);

    address walletAdderess  = factory.createInternalWallet(
        teamwallet,
        paymentCurrencyToken,
        walletdata
    );

    IFinancieInternalWallet wallet = IFinancieInternalWallet(walletAdderess);
    wallet.acceptOwnership();

    return wallet;
  }
}

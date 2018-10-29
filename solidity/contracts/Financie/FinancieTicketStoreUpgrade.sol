pragma solidity ^0.4.18;
import '../utility/Owned.sol';
import './IFinancieTicketStore.sol';
import './IFinancieNotifier.sol';
import './IFinancieTicketStoreFactory.sol';
import './IFinancieManagedContracts.sol';
import './FinancieNotifierDelegate.sol';
import './FinancieCoreComponents.sol';
import './FinancieTicketStore.sol';

contract FinancieTicketStoreUpgrade is Owned {
  address public ticketStoreFactory;

  event TicketStoreUpgrade(address indexed _oldStore, address indexed _newStore);

  event TicketStoreOwned(address indexed _oldStore, address indexed __owner);

  constructor(address _ticketStoreFactory) public {
    ticketStoreFactory = _ticketStoreFactory;
  }

  function upgrade(IFinancieTicketStore _oldStore) public {
    acceptConverterOwnership(_oldStore);
    IFinancieTicketStore newStore = createTicketStore(_oldStore);
    copyTicketSales(_oldStore, newStore);
    transferTicketSaleBalances(_oldStore, newStore);

    _oldStore.transferOwnership(msg.sender);
    newStore.transferOwnership(msg.sender);

    emit TicketStoreUpgrade(address(_oldStore), address(newStore));
  }

  function acceptConverterOwnership(IFinancieTicketStore _oldStore) private {
      require(msg.sender == _oldStore.owner());
      _oldStore.acceptOwnership();
      emit TicketStoreOwned(_oldStore, this);
  }

  function createTicketStore(IFinancieTicketStore _oldStore) private returns(IFinancieTicketStore) {
    FinancieNotifierDelegate notifierdelgate = FinancieNotifierDelegate(_oldStore);
    IFinancieNotifier notifier = notifierdelgate.notifier();

    FinancieCoreComponents core = FinancieCoreComponents(_oldStore);
    IFinancieManagedContracts managedContracts = core.managedContracts();
    IERC20Token platformtoken = core.platformToken();
    IERC20Token etherToken = core.etherToken();

    IFinancieTicketStoreFactory factory = IFinancieTicketStoreFactory(ticketStoreFactory);

    address ticketStoreAdderess  = factory.createTicketStore(
        notifier,
        managedContracts,
        platformtoken,
        etherToken
    );

    IFinancieTicketStore ticketStore = IFinancieTicketStore(ticketStoreAdderess);
    ticketStore.acceptOwnership();

    return ticketStore;
  }

  function copyTicketSales(IFinancieTicketStore _oldStore, IFinancieTicketStore _newStore) private {
    FinancieTicketStore oldStore = FinancieTicketStore(_oldStore);
    FinancieTicketStore newStore = FinancieTicketStore(_newStore);

    uint16 ticketSaleTokenCount = oldStore.ticketsaleTokenCount();

    for (uint16 i = 0; i < ticketSaleTokenCount; i++) {
      IERC20Token ticketaddress = oldStore.ticketsaleTokens(i);
      IFinancieIssuerToken ticket = IFinancieIssuerToken(ticketaddress);
      newStore.setTicketSale(ticketaddress,
        oldStore.getTicketCurrency(ticketaddress),
        oldStore.getTicketPrice(ticketaddress),
        oldStore.getTicketStartAt(ticketaddress),
        oldStore.getTicketEndAt(ticketaddress)
        );
    }
  }

  function transferTicketSaleBalances(IFinancieTicketStore _oldStore, IFinancieTicketStore _newStore) private {
    FinancieTicketStore oldStore = FinancieTicketStore(_oldStore);
    FinancieTicketStore newStore = FinancieTicketStore(_newStore);

    uint16 ticketSaleTokenCount = oldStore.ticketsaleTokenCount();

    for (uint16 i = 0; i < ticketSaleTokenCount; i++) {
      address ticketaddress = oldStore.ticketsaleTokens(i);
      IERC20Token tokenTicket = IERC20Token(ticketaddress);

      uint256 amount = tokenTicket.balanceOf(_oldStore);
      oldStore.approveTicket(ticketaddress, _newStore, amount);
      newStore.transferTicket(ticketaddress, _oldStore, _newStore, amount);

    }
  }
}

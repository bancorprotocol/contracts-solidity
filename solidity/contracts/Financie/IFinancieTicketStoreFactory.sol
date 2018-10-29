pragma solidity ^0.4.18;
import '../token/interfaces/IERC20Token.sol';
import './IFinancieNotifier.sol';
import './IFinancieManagedContracts.sol';
import './IFinancieTicketStoreFactory.sol';

/*
    TicketStore Factory interface
*/
contract IFinancieTicketStoreFactory {
    function createTicketStore(
      IFinancieNotifier _notifier_address,
      IFinancieManagedContracts _managedContracts,
      IERC20Token _platformToken,
      IERC20Token _ether_token
    )
    public returns (address);
}

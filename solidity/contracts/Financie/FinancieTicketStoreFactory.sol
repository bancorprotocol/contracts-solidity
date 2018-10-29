pragma solidity ^0.4.18;
import './IFinancieNotifier.sol';
import './IFinancieManagedContracts.sol';
import './IFinancieTicketStoreFactory.sol';
import './FinancieTicketStore.sol';


contract FinancieTicketStoreFactory is IFinancieTicketStoreFactory {

  event NewTicketStore(address indexed _storeAddress, address indexed _owner);

    /**
        @dev constructor
    */
    constructor() public{}

    /**
        @dev creates a new ticketstore with the given arguments and transfers
        the ownership and management to the sender.

        @param  _notifier_address      FinancieNotifier
        @param  _managedContracts      FnancieMangeContracts
        @param  _platformToken         FinanciePlatformToken
        @param  _ether_token           EtherToken

        @return a new ticketstore
    */
    function createTicketStore(
        IFinancieNotifier _notifier_address,
        IFinancieManagedContracts _managedContracts,
        IERC20Token _platformToken,
        IERC20Token _ether_token
    ) public returns(address storeAddress) {
        FinancieTicketStore store = new FinancieTicketStore(
            address(_notifier_address),
            address(_managedContracts),
            address(_platformToken),
            address(_ether_token)
        );

        store.transferOwnership(msg.sender);

        address _storeAddress = address(store);
        emit NewTicketStore(_storeAddress, msg.sender);
        return _storeAddress;
    }

}

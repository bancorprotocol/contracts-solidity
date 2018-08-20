pragma solidity ^0.4.18;
import '../interfaces/IFinancieManagedContracts.sol';
import '../interfaces/IFinancieUserData.sol';
import '../interfaces/IFinancieLog.sol';
import '../interfaces/IERC20Token.sol';
import '../Owned.sol';

contract FinancieCoreComponents is Owned {

    IFinancieLog log;
    IFinancieManagedContracts managedContracts;
    IFinancieUserData userData;

    IERC20Token platformToken;
    IERC20Token etherToken;

    function FinancieCoreComponents(
        address _log,
        address _managedContracts,
        address _userData,
        address _platformToken,
        address _etherToken
    ) public {
        log = IFinancieLog(_log);
        managedContracts = IFinancieManagedContracts(_managedContracts);
        userData = IFinancieUserData(_userData);
        platformToken = IERC20Token(_platformToken);
        etherToken = IERC20Token(_etherToken);
    }

    modifier validTargetContract(address _contract) {
        require(managedContracts.validTargetContract(_contract));
        _;
    }

    function addOwnedCardList(address _sender, address _address)
        internal
        validTargetContract(_address)
    {
        userData.addOwnedCardList(_sender, _address);
    }

    function addOwnedTicketList(address _sender, address _ticket)
        internal
        validTargetContract(_ticket)
    {
        userData.addOwnedTicketList(_sender, _ticket);
    }

    function addPaidTicketList(address _sender, address _ticket, uint256 _amount)
        internal
        validTargetContract(_ticket)
    {
        userData.addPaidTicketList(_sender, _ticket, _amount);
    }

}

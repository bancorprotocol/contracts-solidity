pragma solidity ^0.4.18;
import '../interfaces/IFinancieUserData.sol';
import './FinancieCoreComponents.sol';
import '../Utils.sol';
import '../Owned.sol';

contract FinancieUserData is IFinancieUserData, Owned, Utils {

    mapping (address => uint32) userIds;
    mapping (address => address[]) ownedCardList;
    mapping (address => address[]) ownedTicketList;
    mapping (address => mapping (address => uint256)) paidTicketList;

    event ActivateUser(address _sender, uint32 _userId);

    function activateUser(uint32 _userId)
        public
        greaterThanZero(_userId)
    {
        // set new account
        userIds[msg.sender] = _userId;

        ActivateUser(msg.sender, _userId);
    }

    /**
    *
    */
    function addOwnedCardList(address _sender, address _address)
        public
        ownerDelegatedOnly
    {
        bool exist = false;
        for (uint32 i = 0; i < ownedCardList[_sender].length; i++) {
            if ( ownedCardList[_sender][i] == _address ) {
                exist = true;
                break;
            }
        }
        if ( !exist ) {
            ownedCardList[_sender].push(_address);
        }
    }

    /**
    *
    */
    function addOwnedTicketList(address _sender, address _ticket)
        public
        ownerDelegatedOnly
    {
        ownedTicketList[_sender].push(_ticket);
    }

    /**
    *
    */
    function addPaidTicketList(address _sender, address _ticket, uint256 _amount)
        public
        ownerDelegatedOnly
    {
        paidTicketList[_ticket][_sender] = safeAdd(paidTicketList[_ticket][_sender], _amount);
    }

    function getTicketList(address _sender) public returns(address[]) {
        return ownedTicketList[_sender];
    }

    function getPaidTicketCounts(address _sender, address _ticket) public returns(uint256) {
        return paidTicketList[_sender][_ticket];
    }

    function checkUserActivation(address _sender, uint32 _userId) public returns(bool) {
        return userIds[_sender] == _userId;
    }

    function getCardList(address _sender) public returns(address[]) {
        return ownedCardList[_sender];
    }

}

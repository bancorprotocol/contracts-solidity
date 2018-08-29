pragma solidity ^0.4.18;
import './IFinancieNotifier.sol';
import './FinancieCoreComponents.sol';
import '../Utils.sol';

contract FinancieNotifier is IFinancieNotifier, FinancieCoreComponents, Utils {
    address latest;

    event ActivateUser(address _sender, uint32 _userId);

    event ApproveNewCards(address _card);
    event CardAuctionFinalized(address _card, address _auction);
    event ApproveNewBancor(address _card, address _bancor);

    event Log(address _sender, address _target, EventType _eventType, address _from, address _to, uint256 _paidAmount, uint256 _receivedAmount);

    event AddOwnedCardList(address _sender, address _address);
    event AddOwnedTicketList(address _sender, address _ticket);
    event AddPaidTicketList(address _sender, address _ticket, uint256 _amount);

    event ConvertCards(address _sender, address _from, address _to, uint256 _amountFrom, uint256 _amountTo);
    event BidCards(address _sender, address _to, uint256 _amount);
    event WithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount);
    event BurnCards(address _sender, address _card, uint256 _amount);

    event BurnTickets(address _sender, address _ticket, uint256 _amount);

    function FinancieNotifier(address _managedContracts, address _platformToken, address _ether_token)
        public
        FinancieCoreComponents(_managedContracts, _platformToken, _ether_token)
    {
        latest = address(this);
    }

    /**
    *   @notice Set latest notifier
    */
    function setLatestNotifier(address _latest)
        public
        ownerDelegatedOnly
    {
        latest = _latest;
    }

    /**
    *   @notice returns latest notifier and update itself if expired
    */
    function latestNotifier()
        public
        returns (address)
    {
        // this contract is latest
        if ( latest == address(this) ) {
            return latest;
        }

        // up to date?
        address _latest = IFinancieNotifier(latest).latestNotifier();
        if ( latest == _latest ) {
            return latest;
        }

        // update and return
        latest = _latest;
        return latest;
    }

    /**
    *   @notice To prevent receiving ether
    */
    function() payable public {
        revert();
    }

    /**
    *
    */
    function activateUser(uint32 _userId)
        public
        greaterThanZero(_userId)
    {
        emit ActivateUser(msg.sender, _userId);
    }

    /**
    *
    */
    function notifyApproveNewCards(address _card)
        public
        ownerDelegatedOnly
    {
        emit ApproveNewCards(_card);
    }

    /**
    *
    */
    function notifyCardAuctionFinalized(address _card, address _auction)
        public
        ownerDelegatedOnly
    {
        emit CardAuctionFinalized(_card, _auction);
    }

    /**
    *
    */
    function notifyApproveNewBancor(address _card, address _bancor)
        public
        ownerDelegatedOnly
    {
        emit ApproveNewBancor(_card, _bancor);
    }

    /**
    *   @notice log the purchase of ticket
    */
    function notifyPurchaseTickets(address _sender, address _card, address _ticket, uint256 _price, uint256 _amount)
        public
        ownerDelegatedOnly
    {
        emit AddOwnedTicketList(_sender, _ticket);

        emit Log(
          _sender,
          msg.sender,
          EventType.BuyTicket,
          _card,
          _ticket,
          _price,
          _amount);
    }

    /**
    *   @notice log the burn of tickets
    */
    function notifyBurnTickets(address _sender, uint256 _amount)
        public
        ownerDelegatedOnly
    {
        emit AddPaidTicketList(_sender, msg.sender, _amount);

        emit Log(
          _sender,
          msg.sender,
          EventType.BurnTicket,
          msg.sender,
          0x0,
          _amount,
          0);

        emit BurnTickets(_sender, msg.sender, _amount);
    }

    function notifyConvertCards(
        address _sender,
        address _from,
        address _to,
        uint256 _amountFrom,
        uint256 _amountTo)
        public
        ownerDelegatedOnly
    {
        if ( _to == address(etherToken) ) {
            emit Log(
              _sender,
              msg.sender,
              EventType.SellCards,
              _from,
              _to,
              _amountFrom,
              _amountTo);
        } else {
            emit Log(
              _sender,
              msg.sender,
              EventType.BuyCards,
              _from,
              _to,
              _amountFrom,
              _amountTo);
            emit AddOwnedCardList(_sender, _to);
        }
        emit ConvertCards(_sender, _from, _to, _amountFrom, _amountTo);
    }

    /**
    *   @notice log the bid of cards for sales contract
    */
    function notifyBidCards(address _sender, address _to, uint256 _amount)
        public
        ownerDelegatedOnly
    {
        emit Log(
          _sender,
          msg.sender,
          EventType.BidCards,
          etherToken,
          _to,
          _amount,
          0);

        emit BidCards(_sender, _to, _amount);
    }

    /**
    *   @notice log the withdrawal of cards from sales contract
    */
    function notifyWithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount)
        public
        ownerDelegatedOnly
    {
        emit AddOwnedCardList(_sender, _to);

        emit Log(
          _sender,
          msg.sender,
          EventType.WithdrawCards,
          0x0,
          _to,
          0,
          _amount);

        emit WithdrawalCards(_sender, _to, _bids, _amount);
    }

    /**
    *   @notice log the burn of cards
    */
    function notifyBurnCards(address _sender, uint256 _amount)
        public
        ownerDelegatedOnly
    {
        emit Log(
          _sender,
          msg.sender,
          EventType.BurnCards,
          msg.sender,
          0x0,
          _amount,
          0);

        emit BurnCards(msg.sender, msg.sender, _amount);
    }

}

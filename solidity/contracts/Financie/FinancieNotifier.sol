pragma solidity ^0.4.18;
import './IFinancieNotifier.sol';
import './FinancieCoreComponents.sol';
import '../utility/Utils.sol';

contract FinancieNotifier is IFinancieNotifier, FinancieCoreComponents, Utils {
    address latest;

    event ActivateUser(address indexed _sender, uint32 indexed _userId);

    event ApproveNewCards(address indexed _card);
    event CardAuctionFinalized(address indexed _card, address indexed _auction);
    event ApproveNewBancor(address indexed _card, address indexed _bancor);

    event Log(address indexed _sender, address indexed _target, EventType indexed _eventType, address _from, address _to, uint256 _paidAmount, uint256 _receivedAmount, uint _timestamp);

    event AddOwnedCardList(address indexed _sender, address indexed _address);
    event AddOwnedTicketList(address indexed _sender, address indexed _ticket);
    event AddPaidTicketList(address indexed _sender, address indexed _ticket, uint256 _amount);

    event ConvertCards(address indexed _sender, address indexed _from, address indexed _to, uint256 _amountFrom, uint256 _amountTo);
    event BidCards(address indexed _sender, address indexed _to, uint256 _amount);
    event WithdrawalCards(address indexed _sender, address indexed _to, uint256 _bids, uint256 _amount);
    event BurnCards(address indexed _sender, address indexed _card, uint256 _amount);

    event BurnTickets(address indexed _sender, address indexed _ticket, uint256 _amount);

    constructor(address _managedContracts, address _platformToken, address _ether_token)
        public
        FinancieCoreComponents(_managedContracts, _platformToken, _ether_token)
    {
        latest = address(this);
    }

    modifier sameOwner {
        assert(msg.sender == owner || IOwned(msg.sender).owner() == owner);
        _;
    }

    /**
    *   @notice Set latest notifier
    */
    function setLatestNotifier(address _latest)
        public
        sameOwner
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
        ActivateUser(msg.sender, _userId);
    }

    /**
    *
    */
    function notifyApproveNewCards(address _card)
        public
        sameOwner
    {
        ApproveNewCards(_card);
    }

    /**
    *
    */
    function notifyCardAuctionFinalized(address _card, address _auction)
        public
        sameOwner
    {
        CardAuctionFinalized(_card, _auction);
    }

    /**
    *
    */
    function notifyApproveNewBancor(address _card, address _bancor)
        public
        sameOwner
    {
        ApproveNewBancor(_card, _bancor);
    }

    /**
    *   @notice log the purchase of ticket
    */
    function notifyPurchaseTickets(address _sender, address _card, address _ticket, uint256 _price, uint256 _amount)
        public
        sameOwner
    {
        AddOwnedTicketList(_sender, _ticket);

        Log(
          _sender,
          msg.sender,
          EventType.BuyTicket,
          _card,
          _ticket,
          _price,
          _amount,
          now);
    }

    /**
    *   @notice log the burn of tickets
    */
    function notifyBurnTickets(address _sender, uint256 _amount)
        public
        sameOwner
    {
        AddPaidTicketList(_sender, msg.sender, _amount);

        Log(
          _sender,
          msg.sender,
          EventType.BurnTicket,
          msg.sender,
          0x0,
          _amount,
          0,
          now);

        BurnTickets(_sender, msg.sender, _amount);
    }

    function notifyConvertCards(
        address _sender,
        address _from,
        address _to,
        uint256 _amountFrom,
        uint256 _amountTo)
        public
        sameOwner
    {
        if ( _to == address(etherToken) ) {
            Log(
              _sender,
              msg.sender,
              EventType.SellCards,
              _from,
              _to,
              _amountFrom,
              _amountTo,
              now);
        } else {
            Log(
              _sender,
              msg.sender,
              EventType.BuyCards,
              _from,
              _to,
              _amountFrom,
              _amountTo,
              now);
            AddOwnedCardList(_sender, _to);
        }
        ConvertCards(_sender, _from, _to, _amountFrom, _amountTo);
    }

    /**
    *   @notice log the bid of cards for sales contract
    */
    function notifyBidCards(address _sender, address _to, uint256 _amount)
        public
        sameOwner
    {
        Log(
          _sender,
          msg.sender,
          EventType.BidCards,
          etherToken,
          _to,
          _amount,
          0,
          now);

        BidCards(_sender, _to, _amount);
    }

    /**
    *   @notice log the withdrawal of cards from sales contract
    */
    function notifyWithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount)
        public
        sameOwner
    {
        AddOwnedCardList(_sender, _to);

        Log(
          _sender,
          msg.sender,
          EventType.WithdrawCards,
          0x0,
          _to,
          0,
          _amount,
          now);

        WithdrawalCards(_sender, _to, _bids, _amount);
    }

    /**
    *   @notice log the burn of cards
    */
    function notifyBurnCards(address _sender, uint256 _amount)
        public
        sameOwner
    {
        Log(
          _sender,
          msg.sender,
          EventType.BurnCards,
          msg.sender,
          0x0,
          _amount,
          0,
          now);

        BurnCards(msg.sender, msg.sender, _amount);
    }

}

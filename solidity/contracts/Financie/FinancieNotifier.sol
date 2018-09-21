pragma solidity ^0.4.18;
import './IFinancieNotifier.sol';
import './FinancieCoreComponents.sol';
import '../utility/Utils.sol';

contract FinancieNotifier is IFinancieNotifier, FinancieCoreComponents, Utils {
    address latest;

    event ActivateUser(address indexed _sender, uint32 indexed _userId, uint _timestamp);

    event ApproveNewCards(address indexed _card, uint _timestamp);
    event CardAuctionFinalized(address indexed _card, address indexed _auction, uint _timestamp);
    event ApproveNewBancor(address indexed _card, address indexed _bancor, uint _timestamp);

    event Log(address indexed _sender, address indexed _target, EventType indexed _eventType, address _from, address _to, uint256 _paidAmount, uint256 _receivedAmount, uint _timestamp);

    event AddOwnedCardList(address indexed _sender, address indexed _address, uint _timestamp);
    event AddOwnedTicketList(address indexed _sender, address indexed _ticket, uint _timestamp);
    event AddPaidTicketList(address indexed _sender, address indexed _ticket, uint256 _amount, uint _timestamp);

    event ConvertCards(address indexed _sender, address indexed _from, address indexed _to, uint256 _amountFrom, uint256 _amountTo, uint _timestamp);
    event BidCards(address indexed _sender, address indexed _to, uint256 _amount, uint _timestamp);
    event WithdrawalCards(address indexed _sender, address indexed _to, uint256 _bids, uint256 _amount, uint _timestamp);
    event BurnCards(address indexed _sender, address indexed _card, uint256 _amount, uint _timestamp);

    event BurnTickets(address indexed _sender, address indexed _ticket, uint256 _amount, uint _timestamp);

    event AuctionRevenue(address _sender, address indexed _target, address indexed _card, address indexed _receiver, uint256 _amount, uint _timestamp);
    event ExchangeRevenue(address _sender, address indexed _target, address indexed _card, address indexed _receiver, uint256 _amount, uint _timestamp);

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
        emit ActivateUser(msg.sender, _userId, now);
    }

    /**
    *
    */
    function notifyApproveNewCards(address _card)
        public
        sameOwner
    {
        emit ApproveNewCards(_card, now);
    }

    /**
    *
    */
    function notifyCardAuctionFinalized(address _card, address _auction)
        public
        sameOwner
    {
        emit CardAuctionFinalized(_card, _auction, now);
    }

    /**
    *
    */
    function notifyApproveNewBancor(address _card, address _bancor)
        public
        sameOwner
    {
        emit ApproveNewBancor(_card, _bancor, now);
    }

    /**
    *   @notice log the purchase of ticket
    */
    function notifyPurchaseTickets(address _sender, address _card, address _ticket, uint256 _price, uint256 _amount)
        public
        sameOwner
    {
        emit AddOwnedTicketList(_sender, _ticket, now);

        emit Log(
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
        emit AddPaidTicketList(_sender, msg.sender, _amount, now);

        emit Log(
          _sender,
          msg.sender,
          EventType.BurnTicket,
          msg.sender,
          0x0,
          _amount,
          0,
          now);

        emit BurnTickets(_sender, msg.sender, _amount, now);
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
            emit Log(
              _sender,
              msg.sender,
              EventType.SellCards,
              _from,
              _to,
              _amountFrom,
              _amountTo,
              now);
        } else {
            emit Log(
              _sender,
              msg.sender,
              EventType.BuyCards,
              _from,
              _to,
              _amountFrom,
              _amountTo,
              now);
            emit AddOwnedCardList(_sender, _to, now);
        }
        emit ConvertCards(_sender, _from, _to, _amountFrom, _amountTo, now);
    }

    /**
    *   @notice log the bid of cards for sales contract
    */
    function notifyBidCards(address _sender, address _to, uint256 _amount)
        public
        sameOwner
    {
        emit Log(
          _sender,
          msg.sender,
          EventType.BidCards,
          etherToken,
          _to,
          _amount,
          0,
          now);

        emit BidCards(_sender, _to, _amount, now);
    }

    /**
    *   @notice log the withdrawal of cards from sales contract
    */
    function notifyWithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount)
        public
        sameOwner
    {
        emit AddOwnedCardList(_sender, _to, now);

        emit Log(
          _sender,
          msg.sender,
          EventType.WithdrawCards,
          0x0,
          _to,
          0,
          _amount,
          now);

        emit WithdrawalCards(_sender, _to, _bids, _amount, now);
    }

    /**
    *   @notice log the burn of cards
    */
    function notifyBurnCards(address _sender, uint256 _amount)
        public
        sameOwner
    {
        emit Log(
          _sender,
          msg.sender,
          EventType.BurnCards,
          msg.sender,
          0x0,
          _amount,
          0,
          now);

        emit BurnCards(msg.sender, msg.sender, _amount, now);
    }

    /**
    *   @notice log the revenue of auction
    */
    function notifyAuctionRevenue(
        address _sender,
        address _target,
        address _card,
        address _hero,
        uint256 _hero_amount,
        address _team,
        uint256 _team_amount)
        public
        ownerDelegatedOnly
    {
        emit AuctionRevenue(_sender, _target, _card, _hero, _hero_amount, now);
        emit AuctionRevenue(_sender, _target, _card, _team, _team_amount, now);
    }

    /**
    *   @notice log the revenue of exchange
    */
    function notifyExchangeRevenue(
        address _sender,
        address _target,
        address _card,
        address _hero,
        uint256 _hero_amount,
        address _team,
        uint256 _team_amount)
        public
        ownerDelegatedOnly
    {
        emit ExchangeRevenue(_sender, _target, _card, _hero, _hero_amount, now);
        emit ExchangeRevenue(_sender, _target, _card, _team, _team_amount, now);
    }

}

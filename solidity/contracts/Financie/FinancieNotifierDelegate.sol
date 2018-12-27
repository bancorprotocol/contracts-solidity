pragma solidity ^0.4.18;
import './IFinancieNotifier.sol';
import '../utility/Owned.sol';

contract FinancieNotifierDelegate is Owned {
    IFinancieNotifier public notifier;

    constructor(address _notifier)
        public
    {
        notifier = IFinancieNotifier(_notifier);
    }

    function activateUser(uint32 _userId)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.activateUser(_userId);
    }

    function notifyApproveNewCards(address _card)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyApproveNewCards(_card);
    }

    function notifyCardAuctionFinalized(address _card, address _auction)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyCardAuctionFinalized(_card, _auction);
    }

    function notifyApproveNewBancor(address _card, address _bancor)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyApproveNewBancor(_card, _bancor);
    }

    function notifyPurchaseTickets(address _sender, address _card, address _ticket, uint256 _price, uint256 _amount)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyPurchaseTickets(_sender, _card, _ticket, _price, _amount);
    }

    function notifyBurnTickets(address _sender, uint256 _amount)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyBurnTickets(_sender, _amount);
    }

    function notifyConvertCards(
        address _sender,
        address _from,
        address _to,
        uint256 _amountFrom,
        uint256 _amountTo)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyConvertCards(_sender, _from, _to, _amountFrom, _amountTo);
    }

    function notifyBidCards(address _sender, address _to, uint256 _amount)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyBidCards(_sender, _to, _amount);
    }

    function notifyWithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyWithdrawalCards(_sender, _to, _bids, _amount);
    }

    function notifyBurnCards(address _sender, uint256 _amount)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyBurnCards(_sender, _amount);
    }

    function notifyAuctionRevenue(
        address _sender,
        address _target,
        address _card,
        uint32  _hero,
        uint256 _hero_amount,
        uint256 _team_amount)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyAuctionRevenue(_sender, _target, _card, _hero, _hero_amount, _team_amount);
    }

    function notifyExchangeRevenue(
        address _sender,
        address _target,
        address _card,
        uint32  _hero,
        uint256 _hero_amount,
        uint256 _team_amount)
        internal
    {
        notifier = IFinancieNotifier(notifier.latestNotifier());
        notifier.notifyExchangeRevenue(_sender, _target, _card, _hero, _hero_amount, _team_amount);
    }

}

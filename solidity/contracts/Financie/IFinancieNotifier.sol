pragma solidity ^0.4.18;

/*
    Financie Notifier contract interface
*/
contract IFinancieNotifier {
    /*
     * Enums
     */
    enum EventType {
        BidCards,
        WithdrawCards,
        SellCards,
        BuyCards,
        BurnCards,
        BuyTicket,
        BurnTicket
    }

    function latestNotifier() public returns (address);
    function setLatestNotifier(address _latest) public;

    function activateUser(uint32 _userId) public;

    function notifyApproveNewCards(address _card) public;
    function notifyCardAuctionFinalized(address _card, address _auction) public;
    function notifyApproveNewBancor(address _card, address _bancor) public;

    function notifyConvertCards(address _sender, address _from, address _to, uint256 _amountFrom, uint256 _amountTo) public;
    function notifyBidCards(address _sender, address _to, uint256 _amount) public;
    function notifyWithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount) public;
    function notifyBurnCards(address _sender, uint256 _amount) public;
    function notifyPurchaseTickets(address _sender, address _card, address _ticket, uint256 _price, uint256 _amount) public;
    function notifyBurnTickets(address _sender, uint256 _amount) public;

    function notifyAuctionRevenue(address _sender, address _target, address _card, uint32 _hero, uint256 _hero_amount, uint256 _team_amount) public;
    function notifyExchangeRevenue(address _sender, address _target, address _card, uint32 _hero, uint256 _hero_amount, uint256 _team_amount) public;

}

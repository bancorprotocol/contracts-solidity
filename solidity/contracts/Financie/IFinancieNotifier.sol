pragma solidity ^0.4.18;

/*
    Financie Notifier contract interface
*/
contract IFinancieNotifier {
    function notifyConvertCards(address _sender, address _from, address _to, uint256 _amountFrom, uint256 _amountTo) public;
    function notifyBidCards(address _sender, address _to, uint256 _amount) public;
    function notifyWithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount) public;
    function notifyBurnCards(address _sender, uint256 _amount) public;
}

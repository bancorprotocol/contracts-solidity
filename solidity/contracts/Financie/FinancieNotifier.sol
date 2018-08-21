pragma solidity ^0.4.18;
import './IFinancieNotifier.sol';
import './FinancieCoreComponents.sol';
import '../Utils.sol';

contract FinancieNotifier is IFinancieNotifier, FinancieCoreComponents, Utils {

    event ConvertCards(address _sender, address _from, address _to, uint256 _amountFrom, uint256 _amountTo);
    event BidCards(address _sender, address _to, uint256 _amount);
    event WithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount);
    event BurnCards(address _sender, address _card, uint256 _amount);

    function FinancieNotifier(address _log, address _managedContracts, address _userData, address _platformToken, address _ether_token)
        public
        FinancieCoreComponents(_log, _managedContracts, _userData, _platformToken, _ether_token) {
    }

    function() payable public {
        revert();
    }

    function notifyConvertCards(
        address _sender,
        address _from,
        address _to,
        uint256 _amountFrom,
        uint256 _amountTo)
        public
    {
        if ( _to == address(etherToken) ) {
            log.recordLog(
              _sender,
              this,
              IFinancieLog.EventType.SellCards,
              _from,
              _to,
              _amountFrom,
              _amountTo);
        } else {
            log.recordLog(
              _sender,
              this,
              IFinancieLog.EventType.BuyCards,
              _from,
              _to,
              _amountFrom,
              _amountTo);
            addOwnedCardList(_sender, _to);
        }
        ConvertCards(_sender, _from, _to, _amountFrom, _amountTo);
    }

    /**
    * log the bid of cards for sales contract
    */
    function notifyBidCards(address _sender, address _to, uint256 _amount)
        public
        validTargetContract(msg.sender)
        validTargetContract(_to)
    {
        log.recordLog(
          _sender,
          msg.sender,
          IFinancieLog.EventType.BidCards,
          etherToken,
          _to,
          _amount,
          0);

        BidCards(_sender, _to, _amount);
    }

    /**
    * log the withdrawal of cards from sales contract
    */
    function notifyWithdrawalCards(address _sender, address _to, uint256 _bids, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        addOwnedCardList(_sender, _to);

        log.recordLog(
          _sender,
          msg.sender,
          IFinancieLog.EventType.WithdrawCards,
          0x0,
          _to,
          0,
          _amount);

        WithdrawalCards(_sender, _to, _bids, _amount);
    }

    /**
    * log the burn of cards
    */
    function notifyBurnCards(address _sender, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        log.recordLog(
          _sender,
          msg.sender,
          IFinancieLog.EventType.BurnCards,
          msg.sender,
          0x0,
          _amount,
          0);

        BurnCards(msg.sender, msg.sender, _amount);
    }

}

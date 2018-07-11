pragma solidity ^0.4.18;
import './interfaces/IFinancieCore.sol';
import './interfaces/IFinancieIssuerToken.sol';
import './interfaces/IERC20Token.sol';
import './interfaces/IFinancieLog.sol';
import './Utils.sol';
import './Owned.sol';

contract FinancieCore is IFinancieCore, Owned, Utils {

    mapping (address => uint32) userIds;
    mapping (address => bool) targetContracts;
    mapping (address => address[]) ownedCardList;
    mapping (address => address[]) ownedTicketList;
    mapping (address => mapping (address => uint256)) paidTicketList;

    struct TicketSale {
        address issuer;
        address card;
        uint256 price;
    }

    mapping (address => TicketSale) ticketSales;
    IFinancieLog log;

    IERC20Token platformToken;
    IERC20Token etherToken;

    event ActivateUser(address _sender, uint32 _userId);
    event ConvertCards(address _sender, address _from, address _to, uint256 _amountFrom, uint256 _amountTo);
    event BidCards(address _sender, address _to, uint256 _amount);
    event WithdrawalCards(address _sender, address _to, uint256 _amount);
    event BurnCards(address _sender, address _card, uint256 _amount);
    event BurnTickets(address _sender, address _ticket, uint256 _amount);
    event DepositTickets(address _sender, address _issuer, address _ticket, address _card, uint256 _amount, uint256 _price);
    event BuyTicket(address _sender, address _issuer, address _ticket);

    function FinancieCore(address _pf_token, address _ether_token) public {
        platformToken = IERC20Token(_pf_token);
        etherToken = IERC20Token(_ether_token);
    }

    function setFinancieLog(address _log) public ownerOnly {
        log = IFinancieLog(_log);
        log.acceptOwnership();
    }

    modifier validTargetContract(address _contract) {
        require(targetContracts[_contract]);
        _;
    }

    function() payable public {
        uint256 value = safeMul(safeMul(100000, 10 ** 18), msg.value / 1 ether);
        platformToken.transfer(msg.sender, value);
        owner.transfer(msg.value);
    }

    function activateUser(uint32 _userId)
        public
        greaterThanZero(_userId)
    {
        // set new account
        userIds[msg.sender] = _userId;

        ActivateUser(msg.sender, _userId);
    }

    function activateTargetContract(address _contract, bool _enabled)
        public
        validAddress(_contract)
    {
        targetContracts[_contract] = _enabled;
    }

    function notifyConvertCards(
        address _sender,
        address _from,
        address _to,
        uint256 _amountFrom,
        uint256 _amountTo)
        public
    {
        ConvertCards(_sender, _from, _to, _amountFrom, _amountTo);
    }

    /**
    *
    */
    function addOwnedCardList(address _sender, address _address) private {
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
    * log the bid of cards for sales contract
    */
    function notifyBidCards(address _sender, address _to, uint256 _amount)
        public
        validTargetContract(msg.sender)
        validTargetContract(_to)
    {
        log.recordLog(
          _sender,
          IFinancieLog.EventType.BidCards,
          IFinancieLog.CurrencyType.Ethereum,
          _to,
          _amount,
          0);

        BidCards(_sender, _to, _amount);
    }

    /**
    * log the withdrawal of cards from sales contract
    */
    function notifyWithdrawalCards(address _sender, address _to, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        addOwnedCardList(_sender, _to);
        log.recordLog(
          _sender,
          IFinancieLog.EventType.WithdrawCards,
          IFinancieLog.CurrencyType.None,
          _to,
          0,
          _amount);

        WithdrawalCards(_sender, _to, _amount);
    }

    /**
    * log the burn of cards
    */
    function notifyBurnCards(address _sender, address _card, uint256 _amount)
        public
        validTargetContract(msg.sender)
        validTargetContract(_card)
    {
        log.recordLog(
          _sender,
          IFinancieLog.EventType.BurnCards,
          IFinancieLog.CurrencyType.None,
          _card,
          _amount,
          0);

        BurnCards(msg.sender, _card, _amount);
    }

    /**
    * log the burn of tickets
    */
    function notifyBurnTickets(address _sender, address _ticket, uint256 _amount)
        public
        validTargetContract(msg.sender)
        validTargetContract(_ticket)
    {
        paidTicketList[_ticket][_sender] = safeAdd(paidTicketList[_ticket][_sender], _amount);

        BurnTickets(_sender, _ticket, _amount);
    }

    /**
    * issuer deposits tickets into this contract and register it as a sales item
    */
    function depositTickets(address _ticket, address _card, uint256 _amount, uint256 _price)
        public
        validTargetContract(_ticket)
        validTargetContract(_card)
    {
        require(_amount > 0);
        require(_price > 0);

        /**
        * check ticket issuer and deposit tickets into this contract
        */
        IFinancieIssuerToken ticket = IFinancieIssuerToken(_ticket);
        require(msg.sender == ticket.getIssuer() || msg.sender == owner );

        IERC20Token tokenTicket = IERC20Token(_ticket);
        assert(tokenTicket.transferFrom(msg.sender, this, _amount));

        /**
        * register it as a sales item
        */
        ticketSales[_ticket] = TicketSale(ticket.getIssuer(), _card, _price);

        DepositTickets(msg.sender, ticket.getIssuer(), _ticket, _card, _amount, _price);
    }

    function getTicketPrice(address _ticket) public returns(uint256) {
        return ticketSales[_ticket].price;
    }

    function getTicketStock(address _ticket) public returns(uint256) {
        IERC20Token tokenTicket = IERC20Token(_ticket);
        return tokenTicket.balanceOf(this);
    }

    function getTicketCurrency(address _ticket) public returns(address) {
        return ticketSales[_ticket].card;
    }

    function buyTicket(address _ticket) public {
        TicketSale ticketSale = ticketSales[_ticket];

        /**
        * check currency balance and burn the number of price from the buyer
        */
        IERC20Token cardToken = IERC20Token(ticketSale.card);
        require(cardToken.balanceOf(msg.sender) >= ticketSale.price);

        IFinancieIssuerToken card = IFinancieIssuerToken(ticketSale.card);
        card.burnFrom(msg.sender, ticketSale.price);

        ownedTicketList[msg.sender].push(_ticket);

        /**
        * check tickets in stock and transfer a ticket to the buyer
        */
        IERC20Token ticket = IERC20Token(_ticket);
        require(ticket.balanceOf(address(this)) >= 1);
        ticket.transfer(msg.sender, 1);

        BuyTicket(msg.sender, card.getIssuer(), _ticket);
    }

    function checkUserActivation(address _sender, uint32 _userId) public returns(bool) {
        return userIds[_sender] == _userId;
    }

    function getCardList(address _sender) public returns(address[]) {
        return ownedCardList[_sender];
    }

    function getTicketList(address _sender) public returns(address[]) {
        return ownedTicketList[_sender];
    }

    function getPaidTicketCounts(address _sender, address _ticket) public returns(uint256) {
        return paidTicketList[_sender][_ticket];
    }
}

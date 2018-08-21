pragma solidity ^0.4.18;
import './IFinancieTicketStore.sol';
import './IFinancieIssuerToken.sol';
import '../interfaces/IERC20Token.sol';
import './FinancieCoreComponents.sol';
import '../Utils.sol';

contract FinancieTicketStore is IFinancieTicketStore, FinancieCoreComponents, Utils {

    struct TicketSale {
        address issuer;
        address card;
        uint256 price;
    }

    mapping (address => TicketSale) ticketSales;

    event BurnTickets(address _sender, address _ticket, uint256 _amount);
    event DepositTickets(address _sender, address _issuer, address _ticket, address _card, uint256 _amount, uint256 _price);
    event BuyTicket(address _sender, address _issuer, address _ticket, uint256 _amount, uint256 _price);

    function FinancieTicketStore(address _log, address _managedContracts, address _userData, address _platformToken, address _ether_token)
        public
        FinancieCoreComponents(_log, _managedContracts, _userData, _platformToken, _ether_token)
    {
    }

    function() payable public {
        revert();
    }

    /**
    * log the burn of tickets
    */
    function notifyBurnTickets(address _sender, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        addPaidTicketList(_sender, msg.sender, _amount);

        log.recordLog(
          _sender,
          msg.sender,
          IFinancieLog.EventType.BurnTicket,
          msg.sender,
          0x0,
          _amount,
          0);

        BurnTickets(_sender, msg.sender, _amount);
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

        addOwnedTicketList(msg.sender, _ticket);

        /**
        * check tickets in stock and transfer a ticket to the buyer
        */
        IERC20Token ticket = IERC20Token(_ticket);
        require(ticket.balanceOf(address(this)) >= 1);
        ticket.transfer(msg.sender, 1);

        log.recordLog(
          msg.sender,
          address(this),
          IFinancieLog.EventType.BuyTicket,
          card,
          _ticket,
          ticketSale.price,
          1);

        BuyTicket(msg.sender, card.getIssuer(), _ticket, 1, ticketSale.price);
    }
}

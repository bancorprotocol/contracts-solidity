pragma solidity ^0.4.18;
import './IFinancieTicketStore.sol';
import './IFinancieIssuerToken.sol';
import './FinancieNotifierDelegate.sol';
import '../token/interfaces/IERC20Token.sol';
import './FinancieCoreComponents.sol';
import '../utility/Utils.sol';

contract FinancieTicketStore is IFinancieTicketStore, FinancieNotifierDelegate, FinancieCoreComponents, Utils {

    struct TicketSale {
        address issuer;
        address card;
        uint256 price;
        uint256 start_at;
        uint256 end_at;
    }

    mapping (address => TicketSale) ticketSales;

    IERC20Token[] public ticketsaleTokens;

    event DepositTickets(address _sender, address indexed _issuer, address _ticket, address indexed _card, uint256 _amount, uint256 _price);
    event BuyTicket(address indexed _sender, address indexed _issuer, address indexed _ticket, uint256 _amount, uint256 _price);

    constructor(address _notifier_address, address _managedContracts, address _platformToken, address _ether_token)
        public
        FinancieCoreComponents(_managedContracts, _platformToken, _ether_token)
        FinancieNotifierDelegate(_notifier_address)
    {
    }

    function() payable public {
        revert();
    }

    /**
    *   @dev issuer deposits tickets into this contract and register it as a sales item
    */
    function depositTickets(address _ticket, address _card, uint256 _amount, uint256 _price, uint256 _start_at, uint256 _end_at)
        public
        validTargetContract(_ticket)
        validTargetContract(_card)
    {
        require(_amount > 0);
        require(_price > 0);
        require(_start_at > 0);
        require(_end_at > 0);

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
        setTicketSale(_ticket, _card, _price, _start_at, _end_at);

        DepositTickets(msg.sender, ticket.getIssuer(), _ticket, _card, _amount, _price);
    }

    function getTicketPrice(address _ticket) public view returns(uint256) {
        return ticketSales[_ticket].price;
    }

    function getTicketStock(address _ticket) public view returns(uint256) {
        IERC20Token tokenTicket = IERC20Token(_ticket);
        return tokenTicket.balanceOf(this);
    }

    function getTicketCurrency(address _ticket) public view returns(address) {
        return ticketSales[_ticket].card;
    }

    function getTicketStartAt(address _ticket) public view returns(uint256) {
        return ticketSales[_ticket].start_at;
    }

    function getTicketEndAt(address _ticket) public view returns(uint256) {
        return ticketSales[_ticket].end_at;
    }

    function ticketsaleTokenCount() public view returns (uint16) {
        return uint16(ticketsaleTokens.length);
    }

    function setTicketSale(address _ticket, address _card, uint256 _price, uint256 _start_at, uint256 _end_at) public {
      IFinancieIssuerToken ticket = IFinancieIssuerToken(_ticket);
      ticketSales[_ticket] = TicketSale(ticket.getIssuer(), _card, _price, _start_at, _end_at);
      ticketsaleTokens.push(IERC20Token(_ticket));
    }

    function approveTicket(address _ticket, address _spender, uint256 _amount) public ownerOnly {
      IERC20Token tokenTicket = IERC20Token(_ticket);
      tokenTicket.approve(_spender, _amount);
    }

    function transferTicket(address _ticket, address _from, address _to, uint256 _amount) public ownerOnly {
      IERC20Token tokenTicket = IERC20Token(_ticket);
      assert(tokenTicket.transferFrom(_from, _to, _amount));
    }

    function buyTicket(address _ticket) public {
        TicketSale ticketSale = ticketSales[_ticket];
        require(now >= ticketSale.start_at && now < ticketSale.end_at);
        /**
        * check currency balance and burn the number of price from the buyer
        */
        IERC20Token cardToken = IERC20Token(ticketSale.card);
        require(cardToken.balanceOf(msg.sender) >= ticketSale.price);

        IFinancieIssuerToken card = IFinancieIssuerToken(ticketSale.card);
        card.burnFrom(msg.sender, ticketSale.price);

        /**
        * check tickets in stock and transfer a ticket to the buyer
        */
        IERC20Token ticket = IERC20Token(_ticket);
        require(ticket.balanceOf(address(this)) >= 1);
        ticket.transfer(msg.sender, 1);

        notifyPurchaseTickets(msg.sender, card, ticket, ticketSale.price, 1);

        BuyTicket(msg.sender, card.getIssuer(), _ticket, 1, ticketSale.price);
    }
}

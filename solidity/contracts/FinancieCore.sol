pragma solidity ^0.4.18;
import './interfaces/IFinancieCore.sol';
import './interfaces/IFinancieIssuerToken.sol';
import './interfaces/IERC20Token.sol';
import './Utils.sol';

contract FinancieCore is IFinancieCore, Utils {

    mapping (address => uint32) userIds;
    mapping (uint32 => address[]) userAddresses;
    mapping (address => bool) targetContracts;
    mapping (address => address[]) ownedCardList;
    mapping (address => mapping (address => uint256)) paidTicketList;

    struct TicketSale {
        address issuer;
        address card;
        uint256 price;
    }

    mapping (address => TicketSale) ticketSales;

    struct Logs {
        EventType[] eventType;
        CurrencyType[] currencyType;
        address[] target;
        uint256[] amountFrom;
        uint256[] amountTo;
    }

    mapping (address => Logs) allLogs;

    IERC20Token platformToken;
    address public owner_address;

    function FinancieCore(address _token) public {
        platformToken = IERC20Token(_token);
        owner_address = msg.sender;
    }

    modifier validTargetContract(address _contract) {
        require(targetContracts[_contract]);
        _;
    }

    function() payable public {
        uint256 value = safeMul(safeMul(100000, 10 ** 18), msg.value / 1 ether);
        platformToken.transfer(msg.sender, value);
        owner_address.transfer(msg.value);
    }

    function activateUser(uint32 _userId)
        public
        greaterThanZero(_userId)
    {
        assert(_userId != userIds[msg.sender]);

        // remove from previous account
        uint32 prev = userIds[msg.sender];
        if ( prev > 0 ) {
            for (uint32 i = 0; i < userAddresses[prev].length; i++) {
                if ( msg.sender == userAddresses[prev][i] ) {
                    userAddresses[prev][i] = 0;
                }
            }
        }

        // set new account
        userIds[msg.sender] = _userId;
        userAddresses[_userId].push(msg.sender);
    }

    function activateTargetContract(address _contract, bool _enabled)
        public
        validAddress(_contract)
    {
        targetContracts[_contract] = _enabled;
    }

    function notifyConvertCards(address _sender,
        address _from,
        address _to,
        uint256 _amountFrom,
        uint256 _amountTo)
        public
    {
        require(_from == address(platformToken) || _to == address(platformToken));
        if ( _from == address(platformToken) ) {
            recordLog(_sender, EventType.BuyCards, CurrencyType.PlatformCoin, _to, _amountFrom, _amountTo);
            addOwnedCardList(_sender, _to);
        } else {
            recordLog(_sender, EventType.SellCards, CurrencyType.PlatformCoin, _from, _amountFrom, _amountTo);
        }
    }

    /**
    *
    */
    function addOwnedCardList(address _sender, address _address) {
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
    function notifyBidCards(address _sender, address _to, CurrencyType _type, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        recordLog(_sender, EventType.BidCards, _type, _to, _amount, 0);
    }

    /**
    * log the withdrawal of cards from sales contract
    */
    function notifyWithdrawalCards(address _sender, address _to, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        addOwnedCardList(_sender, _to);
        recordLog(_sender, EventType.WithdrawCards, CurrencyType.None, _to, 0, _amount);
    }

    /**
    * log the burn of cards
    */
    function notifyBurnCards(address _sender, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        recordLog(_sender, EventType.BurnCards, CurrencyType.None, msg.sender, _amount, 0);
    }

    /**
    * log the burn of tickets
    */
    function notifyBurnTickets(address _sender, uint256 _amount)
        public
        validTargetContract(msg.sender)
    {
        paidTicketList[_sender][msg.sender] = safeAdd(paidTicketList[_sender][msg.sender], _amount);
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
        require(msg.sender == ticket.getIssuer() || msg.sender == owner_address );

        IERC20Token tokenTicket = IERC20Token(_ticket);
        assert(tokenTicket.transferFrom(msg.sender, this, _amount));

        /**
        * register it as a sales item
        */
        ticketSales[_ticket] = TicketSale(ticket.getIssuer(), _card, _price);
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

        /**
        * check tickets in stock and transfer a ticket to the buyer
        */
        IERC20Token ticket = IERC20Token(_ticket);
        require(ticket.balanceOf(address(this)) >= 1);
        ticket.transfer(msg.sender, 1);
    }

    function recordLog(address _sender,
        EventType _eventType,
        CurrencyType _currencyType,
        address _target,
        uint256 _paidAmount,
        uint256 _receivedAmount)
        public
        validAddress(_target)
        validTargetContract(_target)
    {
        allLogs[_sender].eventType.push(_eventType);
        allLogs[_sender].currencyType.push(_currencyType);
        allLogs[_sender].target.push(_target);
        allLogs[_sender].amountFrom.push(_paidAmount);
        allLogs[_sender].amountTo.push(_receivedAmount);
    }

    function getLogs(address _sender)
        public returns(EventType[], CurrencyType[], address[], uint256[], uint256[])
    {
        return (allLogs[_sender].eventType,
          allLogs[_sender].currencyType,
          allLogs[_sender].target,
          allLogs[_sender].amountFrom,
          allLogs[_sender].amountTo);
    }

    function getAddressList(uint32 _userId) returns(address[]) {
        return userAddresses[_userId];
    }

    function getCardList(address _sender) returns(address[]) {
        return ownedCardList[_sender];
    }

    function getPaidTicketCounts(address _sender, address _ticket) public returns(uint256) {
        return paidTicketList[_sender][_ticket];
    }
}

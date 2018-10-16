pragma solidity ^0.4.18;
import '../token/interfaces/IERC20Token.sol';
import './IFinancieInternalWallet.sol';
import './IFinancieBancorConverter.sol';
import './IFinancieTicketStore.sol';
import './IFinancieAuction.sol';
import '../utility/Owned.sol';
import '../utility/Utils.sol';

contract FinancieInternalWallet is IFinancieInternalWallet, Owned, Utils {

    address coldWallet;
    mapping (uint32 => uint256) public balanceOfEther;
    mapping (address => mapping (uint32 => uint256)) public balanceOfTokens;
    mapping (address => mapping (uint32 => uint256)) public bidsOfAuctions;
    mapping (address => uint256) public totalBidsOfAuctions;
    mapping (address => uint256) public receivedCardsOfAuctions;

    constructor(address _coldWallet) public {
        coldWallet = _coldWallet;
    }

    modifier sameOwner {
        assert(msg.sender == owner || IOwned(msg.sender).owner() == owner);
        _;
    }

    function() payable public {
    }

    function depositEther(uint32 _userId)
        public
        payable
        sameOwner {
        require(msg.value > 0);
        balanceOfEther[_userId] = safeAdd(balanceOfEther[_userId], msg.value);
    }

    function depositToken(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        sameOwner {
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transferFrom(msg.sender, this, _amount);
        balanceOfTokens[_tokenAddress][_userId] = safeAdd(balanceOfTokens[_tokenAddress][_userId], _amount);
    }

    function withdrawEther(uint32 _userId, uint256 _amount)
        public
        sameOwner {
        require(balanceOfEther[_userId] >= _amount);
        coldWallet.transfer(_amount);
        balanceOfEther[_userId] = safeSub(balanceOfEther[_userId], _amount);
    }

    function withdrawToken(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        sameOwner {
        require(balanceOfTokens[_tokenAddress][_userId] >= _amount);
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transfer(coldWallet, _amount);
        balanceOfTokens[_tokenAddress][_userId] = safeSub(balanceOfTokens[_tokenAddress][_userId], _amount);
    }

    function delegateBuyCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        sameOwner {
        require(balanceOfEther[_userId] >= _amount);
        require(IOwned(_bancorAddress).owner() == owner);

        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result = converter.buyCards.value(_amount)(_amount, _minReturn);
        balanceOfEther[_userId] = safeSub(balanceOfEther[_userId], _amount);

        balanceOfTokens[_tokenAddress][_userId] = safeAdd(balanceOfTokens[_tokenAddress][_userId], result);
    }

    function delegateSellCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        sameOwner {
        require(balanceOfTokens[_tokenAddress][_userId] >= _amount);
        require(IOwned(_bancorAddress).owner() == owner);

        IERC20Token token = IERC20Token(_tokenAddress);
        if ( token.allowance(this, _bancorAddress) != 0 )
            assert(token.approve(_bancorAddress, 0));
        assert(token.approve(_bancorAddress, _amount));

        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result = converter.sellCards(_amount, _minReturn);
        balanceOfTokens[_tokenAddress][_userId] = safeSub(balanceOfTokens[_tokenAddress][_userId], _amount);

        balanceOfEther[_userId] = safeAdd(balanceOfEther[_userId], result);
    }

    function delegateBuyTicket(uint32 _userId, uint256 _price, address _ticketAddress, address _tokenAddress, address _storeAddress)
        public
        sameOwner {
        require(IOwned(_storeAddress).owner() == owner);
        require(balanceOfTokens[_tokenAddress][_userId] >= _price);

        IERC20Token token = IERC20Token(_tokenAddress);
        if ( token.allowance(this, _storeAddress) != 0 )
            assert(token.approve(_storeAddress, 0));
        assert(token.approve(_storeAddress, _price));

        IERC20Token ticket = IERC20Token(_ticketAddress);

        uint256 tokenBefore = token.balanceOf(this);
        uint256 ticketBefore = ticket.balanceOf(this);

        IFinancieTicketStore store = IFinancieTicketStore(_storeAddress);
        store.buyTicket(_ticketAddress);

        uint256 tokenAfter = token.balanceOf(this);
        uint256 ticketAfter = ticket.balanceOf(this);

        assert(safeSub(tokenBefore, tokenAfter) == _price);
        assert(safeSub(ticketAfter, ticketBefore) == 1);

        balanceOfTokens[_ticketAddress][_userId] = safeAdd(balanceOfTokens[_ticketAddress][_userId], 1);
        balanceOfTokens[_tokenAddress][_userId] = safeSub(balanceOfTokens[_tokenAddress][_userId], _price);
    }

    function delegateBidCards(uint32 _userId, uint256 _amount, address _auctionAddress)
        public
        sameOwner {
        require(IOwned(_auctionAddress).owner() == owner);
        require(balanceOfEther[_userId] >= _amount);

        uint256 etherBefore = address(this).balance;

        // receive tokens on this wallet if available
        IFinancieAuction auction = IFinancieAuction(_auctionAddress);
        auction.bid.value(_amount)();

        uint256 etherAfter = address(this).balance;

        uint256 result = safeSub(etherBefore, etherAfter);

        bidsOfAuctions[_auctionAddress][_userId] = safeAdd(bidsOfAuctions[_auctionAddress][_userId], result);
        balanceOfEther[_userId] = safeSub(balanceOfEther[_userId], result);
    }

    function delegateReceiveCards(uint32 _userId, address _auctionAddress)
        public
        sameOwner {
        require(IOwned(_auctionAddress).owner() == owner);

        address tokenAddress = auction.targetToken();
        IERC20Token token = IERC20Token(tokenAddress);

        // receive tokens on this wallet if available
        IFinancieAuction auction = IFinancieAuction(_auctionAddress);
        if ( auction.canClaimTokens(this) ) {
            uint256 amount = auction.estimateClaimTokens(this);
            assert(amount > 0);

            uint256 tokenBefore = token.balanceOf(this);
            auction.proxyClaimTokens(this);
            uint256 tokenAfter = token.balanceOf(this);

            assert(safeSub(tokenAfter, tokenBefore) == amount);

            receivedCardsOfAuctions[_auctionAddress] = safeAdd(receivedCardsOfAuctions[_auctionAddress], amount);
        }

        // assign tokens amount as received * bids / total
        if ( bidsOfAuctions[_auctionAddress][_userId] > 0 ) {
            uint256 result = safeMul(receivedCardsOfAuctions[_auctionAddress] / (10 ** 10), bidsOfAuctions[_auctionAddress][_userId]) / (totalBidsOfAuctions[_auctionAddress] / (10 ** 10));
            balanceOfTokens[tokenAddress][_userId] = safeAdd(balanceOfTokens[tokenAddress][_userId], result);
            bidsOfAuctions[_auctionAddress][_userId] = 0;
        }
    }

    function delegateCanClaimTokens(uint32 _userId, address _auctionAddress)
        public
        view
        returns(bool) {
        require(IOwned(_auctionAddress).owner() == owner);

        if ( bidsOfAuctions[_auctionAddress][_userId] > 0 ) {
            IFinancieAuction auction = IFinancieAuction(_auctionAddress);
            if ( auction.canClaimTokens(this) ) {
                return true;
            }

            uint256 estimate = safeMul(receivedCardsOfAuctions[_auctionAddress] / (10 ** 10), bidsOfAuctions[_auctionAddress][_userId]) / (totalBidsOfAuctions[_auctionAddress] / (10 ** 10));
            return estimate > 0;
        }

        return false;
    }

    function delegateEstimateClaimTokens(uint32 _userId, address _auctionAddress)
        public
        view
        returns(uint256) {
        require(IOwned(_auctionAddress).owner() == owner);

        if ( bidsOfAuctions[_auctionAddress][_userId] > 0 ) {
            IFinancieAuction auction = IFinancieAuction(_auctionAddress);
            if ( auction.canClaimTokens(this) ) {
                uint256 totalEstimation = auction.estimateClaimTokens(this);
                return safeMul(totalEstimation / (10 ** 10), bidsOfAuctions[_auctionAddress][_userId]) / (totalBidsOfAuctions[_auctionAddress] / (10 ** 10));
            } else {
                return safeMul(receivedCardsOfAuctions[_auctionAddress] / (10 ** 10), bidsOfAuctions[_auctionAddress][_userId]) / (totalBidsOfAuctions[_auctionAddress] / (10 ** 10));
            }
        }

        return 0;
    }
}

pragma solidity ^0.4.18;
import '../token/interfaces/IERC20Token.sol';
import './IFinancieInternalWallet.sol';
import './IFinancieBancorConverter.sol';
import './IFinancieAuction.sol';
import '../utility/Owned.sol';
import '../utility/Utils.sol';

contract FinancieInternalWallet is IFinancieInternalWallet, Owned, Utils {

    address teamWallet;
    mapping (address => mapping (uint32 => bool)) public holderOfTokens;
    mapping (address => mapping (uint32 => uint256)) public balanceOfTokens;
    mapping (address => mapping (uint32 => uint256)) public bidsOfAuctions;
    mapping (address => uint256) public totalBidsOfAuctions;
    mapping (address => uint256) public receivedCardsOfAuctions;
    IERC20Token paymentCurrencyToken;

    event AddOwnedCardList(uint32 indexed _user_id, address indexed _address, uint _timestamp);

    event DepositTokens(uint32 indexed _user_id, uint256 _amount, address indexed _token_address, uint _timestamp);
    event WithdrawTokens(uint32 indexed _userId, uint256 _amount, address indexed _token_address, uint _timestamp);

    event BuyCards(uint32 indexed _user_id, uint256 _amount, uint256 _minReturn, address indexed _token_address, address indexed _bancor_address, uint _timestamp);
    event SellCards(uint32 indexed _user_id, uint256 _amount, uint256 _minReturn, address indexed _token_address, address indexed _bancor_address, uint _timestamp);
    event BidCards(uint32 indexed _user_id, uint256 _amount, address indexed _token_address, address indexed _auction_address, uint _timestamp);
    event ReceiveCards(uint32 indexed _user_id, address indexed _token_address, address indexed _auction_address, uint _timestamp);

    constructor(address _teamWallet, address _paymentCurrencyToken) public {
        teamWallet = _teamWallet;
        paymentCurrencyToken = IERC20Token(_paymentCurrencyToken);
    }

    modifier sameOwner {
        assert(msg.sender == owner || IOwned(msg.sender).owner() == owner);
        _;
    }

    function updateHolders(uint32 _userId, address _tokenAddress) internal {
        if ( !holderOfTokens[_tokenAddress][_userId] ) {
            holderOfTokens[_tokenAddress][_userId] = true;
            AddOwnedCardList(_userId, _tokenAddress, now);
        }
    }

    function depositTokens(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        sameOwner {
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transferFrom(msg.sender, this, _amount);
        balanceOfTokens[_tokenAddress][_userId] = safeAdd(balanceOfTokens[_tokenAddress][_userId], _amount);

        updateHolders(_userId, _tokenAddress);

        DepositTokens(_userId, _amount, _tokenAddress, now);
    }

    function withdrawTokens(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        sameOwner {
        require(balanceOfTokens[_tokenAddress][_userId] >= _amount);
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transfer(teamWallet, _amount);
        balanceOfTokens[_tokenAddress][_userId] = safeSub(balanceOfTokens[_tokenAddress][_userId], _amount);

        WithdrawTokens(_userId, _amount, _tokenAddress, now);
    }

    function delegateBuyCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        sameOwner {
        require(balanceOfTokens[address(paymentCurrencyToken)][_userId] >= _amount);
        require(IOwned(_bancorAddress).owner() == owner);
        require(_amount > 0);

        balanceOfTokens[address(paymentCurrencyToken)][_userId] = safeSub(balanceOfTokens[address(paymentCurrencyToken)][_userId], _amount);

        IERC20Token token = IERC20Token(_tokenAddress);
        uint256 tokenDiff = token.balanceOf(this);
        uint256 currencyDiff = paymentCurrencyToken.balanceOf(this);

        if ( paymentCurrencyToken.allowance(this, _bancorAddress) < _amount ) {
            assert(paymentCurrencyToken.approve(_bancorAddress, 0));
        }
        assert(paymentCurrencyToken.approve(_bancorAddress, _amount));

        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result;
        uint256 heroFee;
        uint256 teamFee;
        (result, heroFee, teamFee) = converter.buyCards(_amount, _minReturn);
        assert(result >= _minReturn);

        tokenDiff = safeSub(token.balanceOf(this), tokenDiff);
        // check received card tokens amount equals to converted amount
        assert(result == tokenDiff);

        currencyDiff = safeSub(safeAdd(currencyDiff, heroFee), paymentCurrencyToken.balanceOf(this));
        // check consumed currency tokens amount equals to specified amount
        assert(_amount == currencyDiff);

        balanceOfTokens[_tokenAddress][_userId] = safeAdd(balanceOfTokens[_tokenAddress][_userId], result);

        BuyCards(_userId, _amount, _minReturn, _tokenAddress, _bancorAddress, now);

        updateHolders(_userId, _tokenAddress);
    }

    function delegateSellCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        sameOwner {
        require(balanceOfTokens[_tokenAddress][_userId] >= _amount);
        require(IOwned(_bancorAddress).owner() == owner);
        require(_amount > 0);

        IERC20Token token = IERC20Token(_tokenAddress);
        uint256 tokenDiff = token.balanceOf(this);
        uint256 currencyDiff = paymentCurrencyToken.balanceOf(this);

        uint256 allowance = token.allowance(this, _bancorAddress);
        if ( allowance > 0 && allowance < _amount ) {
            assert(token.approve(_bancorAddress, 0));
        }
        assert(token.approve(_bancorAddress, _amount));

        balanceOfTokens[_tokenAddress][_userId] = safeSub(balanceOfTokens[_tokenAddress][_userId], _amount);

        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result;
        uint256 heroFee;
        uint256 teamFee;
        (result, heroFee, teamFee) = converter.sellCards(_amount, _minReturn);
        assert(result >= _minReturn);

        currencyDiff = safeSub(safeSub(paymentCurrencyToken.balanceOf(this), heroFee), currencyDiff);
        // check received currency tokens amount equals to converted amount
        assert(result == currencyDiff);

        tokenDiff = safeSub(tokenDiff, token.balanceOf(this));
        // check consumed card tokens amount equals to specified amount
        assert(_amount == tokenDiff);

        balanceOfTokens[address(paymentCurrencyToken)][_userId] = safeAdd(balanceOfTokens[address(paymentCurrencyToken)][_userId], result);

        SellCards(_userId, _amount, _minReturn, _tokenAddress, _bancorAddress, now);
    }

    function delegateBidCards(uint32 _userId, uint256 _amount, address _auctionAddress)
        public
        sameOwner {
        require(IOwned(_auctionAddress).owner() == owner);
        require(balanceOfTokens[address(paymentCurrencyToken)][_userId] >= _amount);
        require(_amount > 0);

        uint256 currencyBefore = paymentCurrencyToken.balanceOf(this);

        // receive tokens on this wallet if available
        IFinancieAuction auction = IFinancieAuction(_auctionAddress);
        uint256 allowance = paymentCurrencyToken.allowance(this, _auctionAddress);
        if ( allowance > 0 && allowance < _amount ) {
            paymentCurrencyToken.approve(_auctionAddress, 0);
        }
        paymentCurrencyToken.approve(_auctionAddress, _amount);
        auction.bidToken(_amount);

        uint256 currencyAfter = paymentCurrencyToken.balanceOf(this);

        uint256 result = safeSub(currencyBefore, currencyAfter);
        assert(result <= _amount);

        totalBidsOfAuctions[_auctionAddress] = safeAdd(totalBidsOfAuctions[_auctionAddress], result);
        bidsOfAuctions[_auctionAddress][_userId] = safeAdd(bidsOfAuctions[_auctionAddress][_userId], result);
        balanceOfTokens[address(paymentCurrencyToken)][_userId] = safeSub(balanceOfTokens[address(paymentCurrencyToken)][_userId], result);

        address tokenAddress = auction.targetToken();
        BidCards(_userId, _amount, tokenAddress, _auctionAddress, now);
    }

    function delegateReceiveCards(uint32 _userId, address _auctionAddress)
        public
        sameOwner {
        require(IOwned(_auctionAddress).owner() == owner);

        // receive tokens on this wallet if available
        IFinancieAuction auction = IFinancieAuction(_auctionAddress);

        address tokenAddress = auction.targetToken();
        IERC20Token token = IERC20Token(tokenAddress);

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

        ReceiveCards(_userId, tokenAddress, _auctionAddress, now);

        updateHolders(_userId, tokenAddress);
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

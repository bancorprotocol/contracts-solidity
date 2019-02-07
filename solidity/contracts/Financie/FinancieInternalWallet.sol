pragma solidity ^0.4.18;
import '../token/interfaces/IERC20Token.sol';
import './IFinancieInternalWallet.sol';
import './IFinancieBancorConverter.sol';
import './IFinancieInternalBank.sol';
import './IFinancieAuction.sol';
import '../utility/Owned.sol';
import '../utility/Utils.sol';

contract FinancieInternalWallet is IFinancieInternalWallet, Owned, Utils {

    address teamWallet;
    IFinancieInternalBank bank;
    IERC20Token paymentCurrencyToken;
    uint256 public transactionFee;

    event TransactionFee(uint32 indexed _user_id, uint256 _amount, uint _timestamp);

    event AddOwnedCardList(uint32 indexed _user_id, address indexed _address, uint _timestamp);

    event DepositTokens(uint32 indexed _user_id, uint256 _amount, address indexed _token_address, uint _timestamp);
    event WithdrawTokens(uint32 indexed _user_id, uint256 _amount, address indexed _token_address, uint _timestamp);

    event DepositConsumableCurrencyTokens(uint32 indexed _user_id, uint256 _amount, uint _timestamp);
    event DepositWithdrawableCurrencyTokens(uint32 indexed _user_id, uint256 _amount, uint _timestamp);
    event DepositPendingRevenueCurrencyTokens(uint32 indexed _user_id, uint256 _amount, uint _timestamp);
    event ConvertWithdrawableToCunsumableCurrencyTokens(uint32 indexed _user_id, uint256 _amount, uint _timestamp);
    event WithdrawCurrencyTokens(uint32 indexed _user_id, uint256 _amount, uint _timestamp);
    event WithdrawPendingRevenueCurrencyTokens(uint32 indexed _user_id, uint256 _amount, uint _timestamp);

    event BuyCards(uint32 indexed _user_id, uint256 _currency_amount, uint256 _card_amount, address indexed _token_address, address indexed _bancor_address, uint256 _trading_fee, uint256 _transaction_fee, uint _timestamp);
    event SellCards(uint32 indexed _user_id, uint256 _currency_amount, uint256 _card_amount, address indexed _token_address, address indexed _bancor_address, uint256 _trading_fee, uint256 _transaction_fee, uint _timestamp);
    event BidCards(uint32 indexed _user_id, uint256 _amount, address indexed _token_address, address indexed _auction_address, uint256 _trading_fee, uint256 _transaction_fee, uint _timestamp);
    event ReceiveCards(uint32 indexed _user_id, uint256 _amount, address indexed _token_address, address indexed _auction_address, uint _timestamp);

    constructor(address _teamWallet, address _paymentCurrencyToken) public {
        teamWallet = _teamWallet;
        paymentCurrencyToken = IERC20Token(_paymentCurrencyToken);
    }

    modifier sameOwner {
        assert(msg.sender == owner || IOwned(msg.sender).owner() == owner);
        _;
    }

    function setInternalBank(address _bank)
        public
        ownerOnly
    {
        bank = IFinancieInternalBank(_bank);
        bank.acceptOwnership();
    }

    function transferBnakOwnership(address _newOwner) public ownerOnly {
        bank.transferOwnership(_newOwner);
    }

    function setTransactionFee(uint256 _amount)
        public
        ownerOnly
    {
        transactionFee = _amount;
    }

    function updateHolders(uint32 _userId, address _tokenAddress) internal {
        if ( !bank.getHolderOfToken(_tokenAddress, _userId) ) {
            bank.setHolderOfToken(_tokenAddress, _userId, true);
            AddOwnedCardList(_userId, _tokenAddress, now);
        }
    }

    function getBalanceOfToken(address _tokenAddress, uint32 _userId)
        public
        view
        returns(uint256)
    {
        return bank.getBalanceOfToken(_tokenAddress, _userId);
    }

    function getBalanceOfConsumableCurrencyToken(uint32 _userId)
        public
        view
        returns(uint256)
    {
        return bank.getBalanceOfConsumableCurrencyToken(_userId);
    }

    function getBalanceOfWithdrawableCurrencyToken(uint32 _userId)
        public
        view
        returns(uint256)
    {
        return bank.getBalanceOfWithdrawableCurrencyToken(_userId);
    }

    function getBalanceOfPendingRevenueCurrencyToken(uint32 _userId)
        public
        view
        returns(uint256)
    {
        return bank.getBalanceOfPendingRevenueCurrencyToken(_userId);
    }

    function depositTokens(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        sameOwner
    {
        assert(_tokenAddress != address(paymentCurrencyToken));
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transferFrom(msg.sender, address(bank), _amount);

        addBalanceOfTokens(_userId, _amount, _tokenAddress);

        updateHolders(_userId, _tokenAddress);

        emit DepositTokens(_userId, _amount, _tokenAddress, now);
    }

    function depositConsumableCurrencyTokens(uint32 _userId, uint256 _amount)
        public
        sameOwner
    {
        uint256 totalAmount = safeAdd(_amount, transactionFee);
        require(paymentCurrencyToken.allowance(msg.sender, this) >= totalAmount);

        // send transaction fee
        paymentCurrencyToken.transferFrom(msg.sender, teamWallet, transactionFee);
        emit TransactionFee(_userId, transactionFee, now);

        // deposit to bank
        paymentCurrencyToken.transferFrom(msg.sender, address(bank), _amount);
        emit DepositConsumableCurrencyTokens(_userId, _amount, now);

        addBalanceOfConsumableCurrencyTokens(_userId, _amount);
    }

    function depositWithdrawableCurrencyTokens(uint32 _userId, uint256 _amount)
        public
        sameOwner
    {
        paymentCurrencyToken.transferFrom(msg.sender, address(bank), _amount);

        addBalanceOfWithdrawableCurrencyTokens(_userId, _amount);

        emit DepositWithdrawableCurrencyTokens(_userId, _amount, now);
    }

    function depositPendingRevenueCurrencyTokens(uint32 _userId, uint256 _amount)
        public
        sameOwner
    {
        paymentCurrencyToken.transferFrom(msg.sender, address(bank), _amount);

        addBalanceOfPendingRevenueCurrencyTokens(_userId, _amount);

        emit DepositPendingRevenueCurrencyTokens(_userId, _amount, now);
    }

    function withdrawTokens(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        sameOwner
    {
        require(bank.getBalanceOfToken(_tokenAddress, _userId) >= _amount);
        IERC20Token token = IERC20Token(_tokenAddress);

        bank.transferTokens(_tokenAddress, teamWallet, _amount);

        subBalanceOfTokens(_userId, _amount, _tokenAddress);

        emit WithdrawTokens(_userId, _amount, _tokenAddress, now);
    }

    function convertWithdrawableToConsumableCurrencyTokens(uint32 _userId, uint256 _amount)
        public
        sameOwner
    {
        uint256 totalAmount = safeAdd(_amount, transactionFee);
        require(bank.getBalanceOfWithdrawableCurrencyToken(_userId) >= totalAmount);

        // send transaction fee
        bank.transferCurrencyTokens(teamWallet, transactionFee);
        emit TransactionFee(_userId, transactionFee, now);

        // withdraw "withdrawable" currency
        subBalanceOfWithdrawableCurrencyTokens(_userId, totalAmount);

        // deposit as "consumable" currency
        addBalanceOfConsumableCurrencyTokens(_userId, _amount);

        emit ConvertWithdrawableToCunsumableCurrencyTokens(_userId, _amount, now);
    }

    function withdrawCurrencyTokens(uint32 _userId, uint256 _amount)
        public
        sameOwner
    {
        uint256 totalAmount = safeAdd(_amount, transactionFee);
        require(bank.getBalanceOfWithdrawableCurrencyToken(_userId) >= totalAmount);

        subBalanceOfWithdrawableCurrencyTokens(_userId, totalAmount);

        bank.transferCurrencyTokens(teamWallet, totalAmount);

        emit TransactionFee(_userId, transactionFee, now);
        emit WithdrawCurrencyTokens(_userId, _amount, now);
    }

    function withdrawPendingRevenueCurrencyTokens(uint32 _userId, uint256 _amount)
        public
        sameOwner
    {
        uint256 totalAmount = safeAdd(_amount, transactionFee);
        require(bank.getBalanceOfPendingRevenueCurrencyToken(_userId) >= totalAmount);

        subBalanceOfPendingRevenueCurrencyTokens(_userId, totalAmount);

        bank.transferCurrencyTokens(teamWallet, totalAmount);

        emit TransactionFee(_userId, transactionFee, now);
        emit WithdrawPendingRevenueCurrencyTokens(_userId, _amount, now);
    }

    function _buyCards(uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        private
        returns(uint256, uint256, uint256)
    {
        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result;
        uint256 heroFee;
        uint256 teamFee;
        (result, heroFee, teamFee) = converter.buyCards(_amount, _minReturn);
        assert(result >= _minReturn);

        return (result, heroFee, teamFee);
    }

    function delegateBuyCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        sameOwner
    {
        require(_amount > 0);
        uint256 totalAmount = safeAdd(_amount, transactionFee);
        require(bank.getBalanceOfConsumableCurrencyToken(_userId) >= totalAmount);

        subBalanceOfConsumableCurrencyTokens(_userId, totalAmount);

        IERC20Token token = IERC20Token(_tokenAddress);
        uint256 tokenDiff = token.balanceOf(bank);
        uint256 currencyDiff = paymentCurrencyToken.balanceOf(bank);

        // withdraw currency token to this internal wallet
        bank.transferCurrencyTokens(this, _amount);

        // send transaction fee
        bank.transferCurrencyTokens(teamWallet, transactionFee);
        emit TransactionFee(_userId, transactionFee, now);

        if ( paymentCurrencyToken.allowance(this, _bancorAddress) < _amount ) {
            assert(paymentCurrencyToken.approve(_bancorAddress, 0));
        }
        assert(paymentCurrencyToken.approve(_bancorAddress, _amount));
        /* approveBancor(_amount, address(paymentCurrencyToken), _bancorAddress); */

        uint256 result;
        uint256 heroFee;
        uint256 teamFee;
        (result, heroFee, teamFee) = _buyCards(_amount, _minReturn, _tokenAddress, _bancorAddress);

        token.transfer(bank, result);

        tokenDiff = safeSub(token.balanceOf(bank), tokenDiff);
        // check received card tokens amount equals to converted amount
        assert(result == tokenDiff);

        currencyDiff = safeSub(safeAdd(currencyDiff, heroFee), paymentCurrencyToken.balanceOf(bank));
        // check consumed currency tokens amount equals to specified amount
        assert(totalAmount == currencyDiff);

        addBalanceOfTokens(_userId, result, _tokenAddress);

        emit BuyCards(_userId, safeSub(_amount, safeAdd(heroFee, teamFee)), result, _tokenAddress, _bancorAddress, safeAdd(heroFee, teamFee), transactionFee, now);

        updateHolders(_userId, _tokenAddress);

    }

    function _sellCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        private
        returns(uint256, uint256, uint256)
    {
        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result;
        uint256 heroFee;
        uint256 teamFee;
        (result, heroFee, teamFee) = converter.sellCards(_amount, _minReturn);
        assert(result >= _minReturn);
        return (result, heroFee, teamFee);
    }

    function delegateSellCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        sameOwner
    {
        require(bank.getBalanceOfToken(_tokenAddress, _userId) >= _amount);
        require(_amount > 0);

        IERC20Token token = IERC20Token(_tokenAddress);
        uint256 tokenDiff = token.balanceOf(bank);
        uint256 currencyDiff = paymentCurrencyToken.balanceOf(bank);

        // withdraw card token to this internal wallet
        bank.transferTokens(_tokenAddress, this, _amount);

        if ( token.allowance(this, _bancorAddress) < _amount ) {
            assert(token.approve(_bancorAddress, 0));
        }
        assert(token.approve(_bancorAddress, _amount));

        subBalanceOfTokens(_userId, _amount, _tokenAddress);

        uint256 result;
        uint256 heroFee;
        uint256 teamFee;
        (result, heroFee, teamFee) = _sellCards(_userId, _amount, _minReturn, _tokenAddress, _bancorAddress);

        uint256 net = safeSub(result, transactionFee);
        paymentCurrencyToken.transfer(bank, net);
        emit SellCards(_userId, net, _amount, _tokenAddress, _bancorAddress, safeAdd(heroFee, teamFee), transactionFee, now);

        // send transaction fee
        paymentCurrencyToken.transfer(teamWallet, transactionFee);
        emit TransactionFee(_userId, transactionFee, now);

        currencyDiff = safeSub(safeSub(paymentCurrencyToken.balanceOf(bank), heroFee), currencyDiff);
        // check received currency tokens amount equals to converted amount
        assert(net == currencyDiff);

        tokenDiff = safeSub(tokenDiff, token.balanceOf(bank));
        // check consumed card tokens amount equals to specified amount
        assert(_amount == tokenDiff);

        addBalanceOfWithdrawableCurrencyTokens(_userId, net);
    }

    function delegateBidCards(uint32 _userId, uint256 _amount, address _auctionAddress)
        public
        sameOwner
    {
        require(_amount > 0);
        uint256 totalAmount;

        if ( bank.getBidsOfAuctions(_auctionAddress, _userId) == 0 ) {
            // fee = bid + receive
            totalAmount = safeAdd(_amount, transactionFee * 2);
            require(bank.getBalanceOfConsumableCurrencyToken(_userId) >= totalAmount);

            // send transaction fee
            bank.transferCurrencyTokens(teamWallet, transactionFee * 2);
            emit TransactionFee(_userId, transactionFee * 2, now);
            subBalanceOfConsumableCurrencyTokens(_userId, transactionFee * 2);
        } else {
            // fee = bid
            totalAmount = safeAdd(_amount, transactionFee);
            require(bank.getBalanceOfConsumableCurrencyToken(_userId) >= totalAmount);

            // send transaction fee
            bank.transferCurrencyTokens(teamWallet, transactionFee);
            emit TransactionFee(_userId, transactionFee, now);
            subBalanceOfConsumableCurrencyTokens(_userId, transactionFee);
        }

        uint256 currencyBefore = paymentCurrencyToken.balanceOf(bank);

        // withdraw currency token to this internal wallet
        bank.transferCurrencyTokens(this, _amount);

        // receive tokens on this wallet if available
        IFinancieAuction auction = IFinancieAuction(_auctionAddress);
        if ( paymentCurrencyToken.allowance(this, _auctionAddress) < _amount ) {
            paymentCurrencyToken.approve(_auctionAddress, 0);
        }
        paymentCurrencyToken.approve(_auctionAddress, _amount);

        uint256 amount;
        uint256 heroFee;
        uint256 teamFee;
        (amount, heroFee, teamFee) = auction.bidToken(bank, _amount);

        uint256 extra = safeSub(_amount, amount);
        if ( extra > 0 ) {
            paymentCurrencyToken.transfer(bank, extra);
        }

        uint256 currencyAfter = paymentCurrencyToken.balanceOf(bank);

        uint256 result = safeSub(currencyBefore, currencyAfter);
        assert(result == teamFee);

        addTotalBidsOfAuctions(amount, _auctionAddress);
        addBidsOfAuctions(_userId, amount, _auctionAddress);
        subBalanceOfConsumableCurrencyTokens(_userId, amount);

        address tokenAddress = auction.targetToken();
        emit BidCards(_userId, safeSub(amount, safeAdd(heroFee, teamFee)), tokenAddress, _auctionAddress, safeAdd(heroFee, teamFee), transactionFee * 2, now);
    }

    function delegateReceiveCards(uint32 _userId, address _auctionAddress)
        public
        sameOwner
    {
        // receive tokens on this wallet if available
        IFinancieAuction auction = IFinancieAuction(_auctionAddress);
        require(auction.auctionFinished());

        address tokenAddress = auction.targetToken();
        IERC20Token token = IERC20Token(tokenAddress);

        if ( auction.canClaimTokens(bank) ) {
            uint256 amount = auction.estimateClaimTokens(bank);
            assert(amount > 0);

            uint256 tokenBefore = token.balanceOf(bank);
            auction.proxyClaimTokens(bank);
            uint256 tokenAfter = token.balanceOf(bank);

            assert(safeSub(tokenAfter, tokenBefore) == amount);

            addReceivedCardsOfAuctions(amount, _auctionAddress);
        }

        // assign tokens amount as received * bids / total
        uint256 bidsauction_amount = bank.getBidsOfAuctions(_auctionAddress, _userId);
        if ( bidsauction_amount > 0 ) {
            uint256 result = safeMul(bank.getRecvCardsOfAuctions(_auctionAddress) / (10 ** 10), bidsauction_amount) / (bank.getTotalBidsOfAuctions(_auctionAddress) / (10 ** 10));
            addBalanceOfTokens(_userId, result, tokenAddress);
            bank.setBidsOfAuctions(_auctionAddress, _userId, 0);

            emit ReceiveCards(_userId, result, tokenAddress, _auctionAddress, now);
            updateHolders(_userId, tokenAddress);
        }
    }

    function delegateCanClaimTokens(uint32 _userId, address _auctionAddress)
        public
        view
        returns(bool)
    {
        require(IOwned(_auctionAddress).owner() == owner);

        IFinancieAuction auction = IFinancieAuction(_auctionAddress);
        if ( auction.auctionFinished() ) {
            uint256 bidsauction_amount = bank.getBidsOfAuctions(_auctionAddress, _userId);
            if ( bidsauction_amount > 0 ) {
                if ( auction.canClaimTokens(bank) ) {
                    return true;
                }

                uint256 estimate = safeMul(bank.getRecvCardsOfAuctions(_auctionAddress) / (10 ** 10), bidsauction_amount) / (bank.getTotalBidsOfAuctions(_auctionAddress) / (10 ** 10));
                return estimate > 0;
            }
        }

        return false;
    }

    function delegateEstimateClaimTokens(uint32 _userId, address _auctionAddress)
        public
        view
        returns(uint256)
    {
        uint256 bidsauction_amount = bank.getBidsOfAuctions(_auctionAddress, _userId);
        if ( bidsauction_amount > 0 ) {
            IFinancieAuction auction = IFinancieAuction(_auctionAddress);
            if ( auction.missingFundsToEndAuction() == 0 ) {
                if ( auction.bidsAmount(bank) > 0 ) {
                    // Bank had not received yet
                    uint256 totalEstimation = auction.estimateClaimTokens(bank);
                    return safeMul(totalEstimation / (10 ** 10), bidsauction_amount) / (bank.getTotalBidsOfAuctions(_auctionAddress) / (10 ** 10));
                } else {
                    // Bank had already received
                    return safeMul(bank.getRecvCardsOfAuctions(_auctionAddress) / (10 ** 10), bidsauction_amount) / (bank.getTotalBidsOfAuctions(_auctionAddress) / (10 ** 10));
                }
            } else {
                // Auction ongoing
                return safeMul(auction.tokenMultiplier(), bidsauction_amount) / auction.price();
            }
        }

        return 0;
    }

    function addBalanceOfConsumableCurrencyTokens(uint32 _userId, uint256 _amount) private {
        uint256 amount = bank.getBalanceOfConsumableCurrencyToken(_userId);
        amount = safeAdd(amount, _amount);
        bank.setBalanceOfConsumableCurrencyToken(_userId, amount);
    }

    function subBalanceOfConsumableCurrencyTokens(uint32 _userId, uint256 _amount) private {
        uint256 amount = bank.getBalanceOfConsumableCurrencyToken(_userId);
        amount = safeSub(amount, _amount);
        bank.setBalanceOfConsumableCurrencyToken(_userId, amount);
    }

    function addBalanceOfWithdrawableCurrencyTokens(uint32 _userId, uint256 _amount) private {
        uint256 amount = bank.getBalanceOfWithdrawableCurrencyToken(_userId);
        amount = safeAdd(amount, _amount);
        bank.setBalanceOfWithdrawableCurrencyToken(_userId, amount);
    }

    function subBalanceOfWithdrawableCurrencyTokens(uint32 _userId, uint256 _amount) private {
        uint256 amount = bank.getBalanceOfWithdrawableCurrencyToken(_userId);
        amount = safeSub(amount, _amount);
        bank.setBalanceOfWithdrawableCurrencyToken(_userId, amount);
    }

    function addBalanceOfPendingRevenueCurrencyTokens(uint32 _userId, uint256 _amount) private {
        uint256 amount = bank.getBalanceOfPendingRevenueCurrencyToken(_userId);
        amount = safeAdd(amount, _amount);
        bank.setBalanceOfPendingRevenueCurrencyToken(_userId, amount);
    }

    function subBalanceOfPendingRevenueCurrencyTokens(uint32 _userId, uint256 _amount) private {
        uint256 amount = bank.getBalanceOfPendingRevenueCurrencyToken(_userId);
        amount = safeSub(amount, _amount);
        bank.setBalanceOfPendingRevenueCurrencyToken(_userId, amount);
    }

    function addBalanceOfTokens(uint32 _userId, uint256 _amount, address _tokenAddress) private {
        uint256 amount = bank.getBalanceOfToken(_tokenAddress, _userId);
        amount = safeAdd(amount, _amount);
        bank.setBalanceOfToken(_tokenAddress, _userId, amount);
    }

    function subBalanceOfTokens(uint32 _userId, uint256 _amount, address _tokenAddress) private {
        uint256 amount = bank.getBalanceOfToken(_tokenAddress, _userId);
        amount = safeSub(amount, _amount);
        bank.setBalanceOfToken(_tokenAddress, _userId, amount);
    }

    function addTotalBidsOfAuctions(uint256 _amount, address _auctionAddress) private {
        uint256 amount = bank.getTotalBidsOfAuctions(_auctionAddress);
        amount = safeAdd(amount, _amount);
        bank.setTotalBidsOfAuctions(_auctionAddress, amount);
    }

    function addBidsOfAuctions(uint32 _userId, uint256 _amount, address _auctionAddress) private {
        uint256 amount = bank.getBidsOfAuctions(_auctionAddress, _userId);
        amount = safeAdd(amount, _amount);
        bank.setBidsOfAuctions(_auctionAddress, _userId, amount);
    }

    function addReceivedCardsOfAuctions(uint256 _amount, address _auctionAddress) private {
        uint256 amount = bank.getRecvCardsOfAuctions(_auctionAddress);
        amount = safeAdd(amount, _amount);
        bank.setRecvCardsOfAuctions(_auctionAddress, amount);
    }

}

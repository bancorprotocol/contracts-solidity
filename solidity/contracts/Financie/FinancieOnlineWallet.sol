pragma solidity ^0.4.18;
import '../token/interfaces/IERC20Token.sol';
import './IFinancieBancorConverter.sol';
import '../utility/Owned.sol';
import '../utility/Utils.sol';

contract FinancieOnlineWallet is Owned, Utils {

    address coldWallet;
    mapping (uint32 => uint256) public balanceOfEther;
    mapping (address => mapping (uint32 => uint256)) public balanceOfTokens;

    constructor(address _coldWallet) public {
        coldWallet = _coldWallet;
    }

    function() payable public {
    }  

    function depositEther(uint32 _userId)
        public
        payable
        ownerOnly {
        require(msg.value > 0);
        balanceOfEther[_userId] = safeAdd(balanceOfEther[_userId], msg.value);
    }

    function depositToken(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        payable
        ownerOnly {
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transferFrom(msg.sender, this, _amount);
        balanceOfTokens[_tokenAddress][_userId] = safeAdd(balanceOfTokens[_tokenAddress][_userId], _amount);
    }

    function withdrawEther(uint32 _userId, uint256 _amount)
        public
        ownerOnly {
        require(balanceOfEther[_userId] >= _amount);
        coldWallet.transfer(_amount);
        balanceOfEther[_userId] = safeSub(balanceOfEther[_userId], _amount);
    }

    function withdrawToken(uint32 _userId, uint256 _amount, address _tokenAddress)
        public
        ownerOnly {
        require(balanceOfTokens[_tokenAddress][_userId] >= _amount);
        IERC20Token token = IERC20Token(_tokenAddress);
        token.transfer(coldWallet, _amount);
        balanceOfTokens[_tokenAddress][_userId] = safeSub(balanceOfTokens[_tokenAddress][_userId], _amount);
    }

    function delegateBuy(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        ownerOnly {
        require(balanceOfEther[_userId] >= _amount);

        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result = converter.buyCards.value(_amount)(_amount, _minReturn);
        balanceOfEther[_userId] = safeSub(balanceOfEther[_userId], _amount);

        balanceOfTokens[_tokenAddress][_userId] = safeAdd(balanceOfTokens[_tokenAddress][_userId], result);
    }

    function delegateSell(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress)
        public
        ownerOnly {
        require(balanceOfTokens[_tokenAddress][_userId] >= _amount);

        IERC20Token token = IERC20Token(_tokenAddress);
        if ( token.allowance(this, _bancorAddress) != 0 )
            assert(token.approve(_bancorAddress, 0));

        assert(token.approve(_bancorAddress, _amount));

        IFinancieBancorConverter converter = IFinancieBancorConverter(_bancorAddress);
        uint256 result = converter.sellCards(_amount, _minReturn);
        balanceOfTokens[_tokenAddress][_userId] = safeSub(balanceOfTokens[_tokenAddress][_userId], _amount);

        balanceOfEther[_userId] = safeAdd(balanceOfEther[_userId], result);
    }

}

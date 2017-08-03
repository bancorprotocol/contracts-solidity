pragma solidity ^0.4.11;
import './Owned.sol';
import './TokenHolder.sol';
import './interfaces/ISmartToken.sol';
import './interfaces/IEtherToken.sol';
import './interfaces/ITokenChanger.sol';

/*
    Bancor Changer interface
*/
contract IBancorChanger is ITokenChanger {
    function token() public constant returns (ISmartToken _token) { _token; }
    function getReserveBalance(IERC20Token _reserveToken) public constant returns (uint256 balance);
}

/*
    BancorBuyer v0.2

    The bancor buyer contract is a simple bancor changer wrapper that allows buying smart tokens with ETH

    WARNING: the contract will make the purchase using the current price at transaction mining time
*/
contract BancorWallet is Owned, TokenHolder {
    string public version = '0.2';

    address public user;
    address public newUser = 0x0;

    IBancorChanger public tokenChanger; // bancor ETH <-> smart token changer
    IEtherToken public etherToken;      // ether token
    ISmartToken public bancorToken;

    event LogUpdateWalletOwnership(address _oldUser, address _newUser);

    /**
        @dev constructor

        @param _changer     bancor token changer that actually does the purchase
        @param _etherToken  ether token used as a reserve in the token changer
    */
    function BancorWallet(IBancorChanger _changer, IEtherToken _etherToken, address _user)
        validAddress(_changer)
        validAddress(_etherToken)
    {
        tokenChanger = _changer;
        etherToken = _etherToken;
        user = _user;
        bancorToken = tokenChanger.token();
    }

    modifier userOnly(){
        require(msg.sender == user);
        _;
    }

    modifier validAmount(uint256 _amount){
        require(_amount > 0);
        _;
    }

    modifier validAddress(address _address){
        require(_address != 0x0);
        _;
    }

/**
    @dev transfer wallet's ownership to other address

    @param _newUser new user
*/
    function transferWalletOwnership(address _newUser)
    public
    userOnly
    validAddress(_newUser){
        require(_newUser != user);
        newUser = _newUser;
    }

/**
    @dev accept wallet's ownership from other address

*/
    function acceptWalletOwnership()
    public {
        require(msg.sender == newUser);
        address oldUser = user;
        user = newUser;
        newUser = 0x0;
        LogUpdateWalletOwnership(oldUser, user);
    }

/**
    @dev deposit ETH to the wallet

*/
    function deposit()
    public
    payable
    validAmount(msg.value){}

/**
    @dev withdraw ETH from the wallet

*/
    function withdraw(uint256 _ethAmount)
    public
    userOnly
    validAmount(_ethAmount){
        msg.sender.transfer(_ethAmount);
    }

/**
    @dev transfer wallet's bancor tokens to other address

    @param _address receive address
    @param _bntAmount bancor token amount
*/
    function transferBancorToken(address _address, uint256 _bntAmount)
    public
    userOnly
    validAddress(_address)
    validAmount(_bntAmount){
        assert(bancorToken.transfer(_address, _bntAmount));
    }

/**
    @dev with wallet's bancor tokens to user's account

    @param _bntAmount bancor token amount
*/
    function withdrawBancorToken(uint256 _bntAmount)
    public
    userOnly
    validAmount(_bntAmount){
        transferBancorToken(msg.sender, _bntAmount);
    }

    /**
        @dev buys the smart token with ETH
        note that the purchase will use the price at the time of the purchase

        @return tokens issued in return
    */
    function buy()
    public
    payable
    userOnly
    returns (uint256 amount) {
        etherToken.deposit.value(msg.value)(); // deposit ETH in the reserve
        assert(etherToken.approve(tokenChanger, 0)); // need to reset the allowance to 0 before setting a new one
        assert(etherToken.approve(tokenChanger, msg.value)); // approve the changer to use the ETH amount for the purchase

        uint256 returnAmount = tokenChanger.change(etherToken, bancorToken, msg.value, 1); // do the actual change using the current price
        assert(bancorToken.transfer(msg.sender, returnAmount)); // transfer the tokens to the sender
        return returnAmount;
    }

    /**
        @dev buys the smart token with ETH if the return amount meets the minimum requested

        @param _minReturn  if the change results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return tokens issued in return
    */
    function buyMin(uint256 _minReturn)
    public
    payable
    userOnly
    returns (uint256 amount) {
        etherToken.deposit.value(msg.value)(); // deposit ETH in the reserve
        assert(etherToken.approve(tokenChanger, 0)); // need to reset the allowance to 0 before setting a new one
        assert(etherToken.approve(tokenChanger, msg.value)); // approve the changer to use the ETH amount for the purchase

        uint256 returnAmount = tokenChanger.change(etherToken, bancorToken, msg.value, _minReturn); // do the actual change
        assert(bancorToken.transfer(msg.sender, returnAmount)); // transfer the tokens to the sender
        return returnAmount;
    }

/**
       @dev sell the smart token to ETH
       note that the purchase will use the price at the time of the purchase

       @return tokens issued in return
   */
    function sell(uint256 _bntAmount)
    public
    payable
    userOnly
    returns (uint256 amount) {

        assert(bancorToken.approve(tokenChanger, 0)); // need to reset the allowance to 0 before setting a new one
        assert(bancorToken.approve(tokenChanger, _bntAmount)); // approve the changer to use the BNT amount for the purchase
        uint256 returnAmount = tokenChanger.change(bancorToken, etherToken, _bntAmount, 1); // do the actual change using the current price

        etherToken.withdraw(returnAmount); // withdraw ETH in the reserve
        msg.sender.transfer(returnAmount); // transfer the ETH to the sender
        return returnAmount;
    }

/**
    @dev sell the smart token to ETH if the return amount meets the minimum requested

    @param _minReturn  if the change results in an amount smaller than the minimum return - it is cancelled, must be nonzero

    @return tokens issued in return
*/
    function sellMin(uint256 _bntAmount, uint256 _minReturn)
    public
    payable
    userOnly
    returns (uint256 amount) {

        assert(bancorToken.approve(tokenChanger, 0)); // need to reset the allowance to 0 before setting a new one
        assert(bancorToken.approve(tokenChanger, _bntAmount)); // approve the changer to use the BNT amount for the purchase
        uint256 returnAmount = tokenChanger.change(bancorToken, etherToken, _bntAmount, _minReturn); // do the actual change using the _minReturn price

        etherToken.withdraw(returnAmount); // withdraw ETH in the reserve
        msg.sender.transfer(returnAmount); // transfer the ETH to the sender
        return returnAmount;
    }

    // fallback
    function() payable {
        deposit();
    }
}



contract BancorWalletFactory{
    IBancorChanger public tokenChanger; // bancor ETH <-> smart token changer
    IEtherToken public etherToken;      // ether token

    event LogNewWallet(address _user, address _wallet);

    function BancorWalletFactory(IBancorChanger _changer, IEtherToken _etherToken){
        tokenChanger = _changer;
        etherToken = _etherToken;

    // ensure that the ether token is used as one of the changer's reserves
        tokenChanger.getReserveBalance(etherToken);
    }

/**
@dev create a new Bancor wallet

@return success
*/
    function newBancorWallet() public {
        address wallet = new BancorWallet(tokenChanger, etherToken, msg.sender);
        LogNewWallet(msg.sender, wallet);
    }

}
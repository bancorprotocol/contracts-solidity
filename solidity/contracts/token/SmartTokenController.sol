pragma solidity 0.4.26;
import './interfaces/ISmartTokenController.sol';
import './interfaces/ISmartToken.sol';
import '../utility/TokenHolder.sol';

/**
  * @dev The smart token controller is an upgradable part of the smart token that allows
  * more functionality as well as fixes for bugs/exploits.
  * Once it accepts ownership of the token, it becomes the token's sole controller
  * that can execute any of its functions.
  * 
  * To upgrade the controller, ownership must be transferred to a new controller, along with
  * any relevant data.
  * 
  * The smart token must be set on construction and cannot be changed afterwards.
  * Wrappers are provided (as opposed to a single 'execute' function) for each of the token's functions, for easier access.
  * 
  * Note that the controller can transfer token ownership to a new controller that
  * doesn't allow executing any function on the token, for a trustless solution.
  * Doing that will also remove the owner's ability to upgrade the controller.
*/
contract SmartTokenController is ISmartTokenController, TokenHolder {
    ISmartToken public token;   // Smart Token contract
    address public bancorX;     // BancorX contract

    /**
      * @dev initializes a new SmartTokenController instance
      * 
      * @param  _token      smart token governed by the controller
    */
    constructor(ISmartToken _token)
        public
        validAddress(_token)
    {
        token = _token;
    }

    // ensures that the controller is the token's owner
    modifier active() {
        require(token.owner() == address(this));
        _;
    }

    // ensures that the controller is not the token's owner
    modifier inactive() {
        require(token.owner() != address(this));
        _;
    }

    /**
      * @dev allows transferring the token ownership
      * the new owner needs to accept the transfer
      * can only be called by the contract owner
      * 
      * @param _newOwner    new token owner
    */
    function transferTokenOwnership(address _newOwner) public ownerOnly {
        token.transferOwnership(_newOwner);
    }

    /**
      * @dev used by a new owner to accept a token ownership transfer
      * can only be called by the contract owner
    */
    function acceptTokenOwnership() public ownerOnly {
        token.acceptOwnership();
    }

    /**
      * @dev withdraws tokens held by the controller and sends them to an account
      * can only be called by the owner
      * 
      * @param _token   ERC20 token contract address
      * @param _to      account to receive the new amount
      * @param _amount  amount to withdraw
    */
    function withdrawFromToken(IERC20Token _token, address _to, uint256 _amount) public ownerOnly {
        ITokenHolder(token).withdrawTokens(_token, _to, _amount);
    }

    /**
      * @dev allows the associated BancorX contract to claim tokens from any address (so that users
      * dont have to first give allowance when calling BancorX)
      * 
      * @param _from      address to claim the tokens from
      * @param _amount    the amount of tokens to claim
     */
    function claimTokens(address _from, uint256 _amount) public {
        // only the associated BancorX contract may call this method
        require(msg.sender == bancorX);

        // destroy the tokens belonging to _from, and issue the same amount to bancorX
        token.destroy(_from, _amount);
        token.issue(msg.sender, _amount);
    }

    /**
      * @dev allows the owner to set the associated BancorX contract
      * @param _bancorX    BancorX contract
     */
    function setBancorX(address _bancorX) public ownerOnly {
        bancorX = _bancorX;
    }
}

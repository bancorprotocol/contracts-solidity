pragma solidity ^0.4.24;
import './interfaces/ISmartToken.sol';
import '../utility/TokenHolder.sol';

/*
    The smart token controller is an upgradable part of the smart token that allows
    more functionality as well as fixes for bugs/exploits.
    Once it accepts ownership of the token, it becomes the token's sole controller
    that can execute any of its functions.

    To upgrade the controller, ownership must be transferred to a new controller, along with
    any relevant data.

    The smart token must be set on construction and cannot be changed afterwards.
    Wrappers are provided (as opposed to a single 'execute' function) for each of the token's functions, for easier access.

    Note that the controller can transfer token ownership to a new controller that
    doesn't allow executing any function on the token, for a trustless solution.
    Doing that will also remove the owner's ability to upgrade the controller.
*/
contract SmartTokenController is TokenHolder {
    ISmartToken public token;   // smart token

    /**
        @dev constructor
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
        @dev allows transferring the token ownership
        the new owner needs to accept the transfer
        can only be called by the contract owner

        @param _newOwner    new token owner
    */
    function transferTokenOwnership(address _newOwner) public ownerOnly {
        token.transferOwnership(_newOwner);
    }

    /**
        @dev used by a new owner to accept a token ownership transfer
        can only be called by the contract owner
    */
    function acceptTokenOwnership() public ownerOnly {
        token.acceptOwnership();
    }

    /**
        @dev disables/enables token transfers
        can only be called by the contract owner

        @param _disable    true to disable transfers, false to enable them
    */
    function disableTokenTransfers(bool _disable) public ownerOnly {
        token.disableTransfers(_disable);
    }

    /**
        @dev withdraws tokens held by the controller and sends them to an account
        can only be called by the owner

        @param _token   ERC20 token contract address
        @param _to      account to receive the new amount
        @param _amount  amount to withdraw
    */
    function withdrawFromToken(IERC20Token _token, address _to, uint256 _amount) public ownerOnly {
        ITokenHolder(token).withdrawTokens(_token, _to, _amount);
    }
}

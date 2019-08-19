pragma solidity ^0.4.24;
import './interfaces/ISmartTokenController.sol';
import '../utility/interfaces/IContractRegistry.sol';
import '../utility/Managed.sol';
import '../ContractIds.sol';
import './interfaces/ISmartToken.sol';
import '../utility/TokenHolder.sol';

/**
    @dev The smart token controller is an upgradable part of the smart token that allows
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
contract SmartTokenController is ISmartTokenController, Managed, ContractIds, TokenHolder {
    ISmartToken public token;   // smart token
    bool public allowRegistryUpdate = true;             // allows the owner to prevent/allow the registry to be updated
    bool public claimTokensEnabled = false;             // allows a BancorX contract to claim tokens without allowance (to save the extra transaction)
    IContractRegistry public prevRegistry;              // address of previous registry as security mechanism
    IContractRegistry public registry;                  // contract registry contract
    address public bancorX;                             // a BancorX contract

    /**
        @dev initializes a new SmartTokenController instance

        @param  _token              smart token governed by the controller
        @param  _registry           address of a contract registry contract
    */
    constructor(ISmartToken _token, IContractRegistry _registry)
        public
        validAddress(_token)
        validAddress(_registry)
    {
        token = _token;
        registry = _registry;
        prevRegistry = _registry;
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

    // allows execution only when claim tokens is enabled
    modifier whenClaimTokensEnabled {
        require(claimTokensEnabled);
        _;
    }

    /**
        @dev sets the contract registry to whichever address the current registry is pointing to
     */
    function updateRegistry() public {
        // require that upgrading is allowed or that the caller is the owner
        require(allowRegistryUpdate || msg.sender == owner);

        // get the address of whichever registry the current registry is pointing to
        address newRegistry = registry.addressOf(ContractIds.CONTRACT_REGISTRY);

        // if the new registry hasn't changed or is the zero address, revert
        require(newRegistry != address(registry) && newRegistry != address(0));

        // set the previous registry as current registry and current registry as newRegistry
        prevRegistry = registry;
        registry = IContractRegistry(newRegistry);
    }

    /**
        @dev security mechanism allowing the controller owner to revert to the previous registry,
        to be used in emergency scenario
    */
    function restoreRegistry() public ownerOrManagerOnly {
        // set the registry as previous registry
        registry = prevRegistry;

        // after a previous registry is restored, only the owner can allow future updates
        allowRegistryUpdate = false;
    }

    /**
        @dev disables the registry update functionality
        this is a safety mechanism in case of a emergency
        can only be called by the manager or owner

        @param _disable    true to disable registry updates, false to re-enable them
    */
    function disableRegistryUpdate(bool _disable) public ownerOrManagerOnly {
        allowRegistryUpdate = !_disable;
    }

    /**
        @dev disables/enables the claim tokens functionality

        @param _enable    true to enable claiming of tokens, false to disable
     */
    function enableClaimTokens(bool _enable) public ownerOnly {
        claimTokensEnabled = _enable;
    }

    /**
        @dev allows the associated BancorX contract to claim tokens from any address (so that users
        dont have to first give allowance when calling BancorX)

        @param _from      address to claim the tokens from
        @param _amount    the amount to claim
     */
    function claimTokens(address _from, uint256 _amount) public whenClaimTokensEnabled {
        // only the associated bancorX contract may call this method
        require(msg.sender == bancorX);

        // destroy the tokens belonging to _from, and issue the same amount to bancorX contract
        token.destroy(_from, _amount);
        token.issue(msg.sender, _amount);
    }

    /**
        @dev allows the owner to set the BancorX to wherever the
        contract registry currently points to

        @param _bancorXId    BancorX ID
     */
    function setBancorX(bytes32 _bancorXId) public ownerOnly {
        bancorX = registry.addressOf(_bancorXId);
    }
}

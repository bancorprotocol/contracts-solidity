pragma solidity ^0.4.18;
import './IFinancieInternalWallet.sol';
import '../utility/Owned.sol';

contract FinancieDepositDelegate is Owned {

    uint32 targetUserId;
    IFinancieInternalWallet internalWallet;

    constructor(uint32 _targetUserId, address _internalWalletAddress) public {
        targetUserId = _targetUserId;
        internalWallet = IFinancieInternalWallet(_internalWalletAddress);
    }

    function() payable public {
        internalWallet.depositEther.value(msg.value)(targetUserId);
    }

}

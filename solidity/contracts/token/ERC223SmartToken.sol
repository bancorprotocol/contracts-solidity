pragma solidity ^0.4.23;

import "./SmartToken.sol";
import "./interfaces/IERC223ReceivingContract.sol";

contract ERC223SmartToken is SmartToken {

    function transfer(
        address _to,
        uint256 _amount,
        bytes _data)
    public
    returns (bool success)
    {
        require(transfer(_to, _amount));
        if (isContract(_to)) {
            IERC223ReceivingContract receiver = IERC223ReceivingContract(_to);
            receiver.tokenFallback(msg.sender, _amount, _data);
        }

        return true;

    }

}
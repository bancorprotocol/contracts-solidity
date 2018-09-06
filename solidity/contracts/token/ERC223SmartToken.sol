pragma solidity ^0.4.23;

import "./SmartToken.sol";
import "./interfaces/IERC223ReceivingContract.sol";

contract ERC223SmartToken is SmartToken {
    event ERC223Transfer(address indexed from, address indexed to, uint amount, bytes data);

    function transfer(
        address _to,
        uint256 _amount,
        bytes _data)
    public
    returns (bool success)
    {
        transferFrom(msg.sender, _to, _amount, _data);
    }

    function transferFrom(address _from, address _to, uint256 _amount, bytes _data) public returns (bool ok)
    {
        require(transferFrom(_from, _to, _amount));

        if (isContract(_to)) {
            IERC223ReceivingContract receiver = IERC223ReceivingContract(_to);
            receiver.tokenFallback(_from, _amount, _data);
        }

        emit ERC223Transfer(_from, _to, _amount, _data);

        return true;
    }

    /// @dev Internal function to determine if an address is a contract
    /// @param _addr The address being queried
    /// @return True if `_addr` is a contract
    function isContract(address _addr) constant internal returns(bool) {
        uint size;
        if (_addr == 0) return false;
        assembly {
            size := extcodesize(_addr)
        }
        return size>0;
    }

}
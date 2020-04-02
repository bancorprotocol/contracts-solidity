pragma solidity 0.4.26;

contract TokenHandler {
    bytes4 private constant APPROVE_FUNC_SELECTOR       = bytes4(uint256(keccak256("approve(address,uint256)")              >> (256 - 4 * 8)));
    bytes4 private constant TRANSFER_FUNC_SELECTOR      = bytes4(uint256(keccak256("transfer(address,uint256)")             >> (256 - 4 * 8)));
    bytes4 private constant TRANSFER_FROM_FUNC_SELECTOR = bytes4(uint256(keccak256("transferFrom(address,address,uint256)") >> (256 - 4 * 8)));

    function safeApprove(address _token, address _spender, uint256 _value) public {
       execute(_token, abi.encodeWithSelector(APPROVE_FUNC_SELECTOR, _spender, _value));
    }

    function safeTransfer(address _token, address _to, uint256 _value) public {
       execute(_token, abi.encodeWithSelector(TRANSFER_FUNC_SELECTOR, _to, _value));
    }

    function safeTransferFrom(address _token, address _from, address _to, uint256 _value) public {
       execute(_token, abi.encodeWithSelector(TRANSFER_FROM_FUNC_SELECTOR, _from, _to, _value));
    }

    function execute(address _token, bytes memory _data) internal {
        uint256[1] memory ret = [uint256(1)];

        assembly {
            let success := call(
                gas,            // gas remaining
                _token,         // destination address
                0,              // no ether
                add(_data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(_data),   // input length (loaded from the first 32 bytes in the `data` array)
                ret,            // output buffer
                32              // output length
            )
            if iszero(success) {
                revert(0, 0)
            }
        }

        require(ret[0] != 0);
    }
}

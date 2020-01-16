pragma solidity 0.4.26;
import './token/interfaces/IERC20Token.sol';

/*
    Bancor Network interface
*/
contract IBancorNetwork {
    function convert2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) public payable returns (uint256);

    function claimAndConvert2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) public returns (uint256);

    function convertFor2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) public payable returns (uint256);

    function claimAndConvertFor2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) public returns (uint256);

    // deprecated, backward compatibility
    function convert(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn
    ) public payable returns (uint256);

    // deprecated, backward compatibility
    function claimAndConvert(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn
    ) public returns (uint256);

    // deprecated, backward compatibility
    function convertFor(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for
    ) public payable returns (uint256);

    // deprecated, backward compatibility
    function claimAndConvertFor(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for
    ) public returns (uint256);

    // deprecated, backward compatibility
    function convertForPrioritized4(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256[] memory _signature,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) public payable returns (uint256);

    // deprecated, backward compatibility
    function convertForPrioritized3(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256 _customVal,
        uint256 _block,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) public payable returns (uint256);

    // deprecated, backward compatibility
    function convertForPrioritized2(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256 _block,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) public payable returns (uint256);

    // deprecated, backward compatibility
    function convertForPrioritized(
        IERC20Token[] _path,
        uint256 _amount,
        uint256 _minReturn,
        address _for,
        uint256 _block,
        uint256 _nonce,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) public payable returns (uint256);
}

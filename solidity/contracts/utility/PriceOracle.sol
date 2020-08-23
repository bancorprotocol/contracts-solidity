// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./Utils.sol";
import "./SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IChainlinkPriceOracle.sol";

/**
  * @dev Provides the off-chain rate between two tokens
  *
  * The price oracle uses chainlink oracles internally to get the rates of the two tokens
  * with respect to a common denominator, and then returns the rate between them, which
  * is equivalent to the rate of TokenA / TokenB
*/
contract PriceOracle is IPriceOracle, Utils {
    using SafeMath for uint256;

    address private constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint8 private constant ETH_DECIMALS = 18;

    IERC20Token public tokenA;  // token A the oracle supports
    IERC20Token public tokenB;  // token B the oracle supports
    mapping (IERC20Token => uint8) public tokenDecimals;    // token -> token decimals

    IChainlinkPriceOracle public override tokenAOracle;  // token A chainlink price oracle
    IChainlinkPriceOracle public override tokenBOracle;  // token B chainlink price oracle
    mapping (IERC20Token => IChainlinkPriceOracle) public tokensToOracles;  // token -> price oracle for easier access

    /**
      * @dev initializes a new PriceOracle instance
      * note that the oracles must have the same common denominator (USD, ETH etc.)
      *
      * @param  _tokenA         first token to support
      * @param  _tokenB         second token to support
      * @param  _tokenAOracle   first token price oracle
      * @param  _tokenBOracle   second token price oracle
    */
    constructor(IERC20Token _tokenA, IERC20Token _tokenB, IChainlinkPriceOracle _tokenAOracle, IChainlinkPriceOracle _tokenBOracle)
        public
        validUniqueAddresses(address(_tokenA), address(_tokenB))
        validUniqueAddresses(address(_tokenAOracle), address(_tokenBOracle))
    {
        tokenA = _tokenA;
        tokenB = _tokenB;
        tokenDecimals[_tokenA] = decimals(_tokenA);
        tokenDecimals[_tokenB] = decimals(_tokenB);

        tokenAOracle = _tokenAOracle;
        tokenBOracle = _tokenBOracle;
        tokensToOracles[_tokenA] = _tokenAOracle;
        tokensToOracles[_tokenB] = _tokenBOracle;
    }

    // ensures that the provided addresses are unique valid
    modifier validUniqueAddresses(address _address1, address _address2) {
        _validUniqueAddresses(_address1, _address2);
        _;
    }

    // error message binary size optimization
    function _validUniqueAddresses(address _address1, address _address2) internal pure {
        _validAddress(_address1);
        _validAddress(_address2);
        require(_address1 != _address2, "ERR_SAME_ADDRESS");
    }

    // ensures that the provides tokens are supported by the oracle
    modifier supportedTokens(IERC20Token _tokenA, IERC20Token _tokenB) {
        _supportedTokens(_tokenA, _tokenB);
        _;
    }

    // error message binary size optimization
    function _supportedTokens(IERC20Token _tokenA, IERC20Token _tokenB) internal view {
        _validUniqueAddresses(address(_tokenA), address(_tokenB));
        require(address(tokensToOracles[_tokenA]) != address(0) && address(tokensToOracles[_tokenB]) != address(0), "ERR_UNSUPPORTED_TOKEN");
    }

    /**
      * @dev returns the latest known rate between the two given tokens
      * for a given pair of tokens A and B, returns the rate of A / B
      * (the number of B units equivalent to a single A unit)
      * the rate is returned as a fraction (numerator / denominator) for accuracy
      *
      * @param  _tokenA token to get the rate of 1 unit of
      * @param  _tokenB token to get the rate of 1 `_tokenA` against
      *
      * @return numerator
      * @return denominator
    */
    function latestRate(IERC20Token _tokenA, IERC20Token _tokenB)
        public
        override
        view
        supportedTokens(_tokenA, _tokenB)
        returns (uint256, uint256)
    {
        uint256 rateTokenA = uint256(tokensToOracles[_tokenA].latestAnswer());
        uint256 rateTokenB = uint256(tokensToOracles[_tokenB].latestAnswer());
        uint8 decimalsTokenA = tokenDecimals[_tokenA];
        uint8 decimalsTokenB = tokenDecimals[_tokenB];

        // the normalization works as follows:
        //   - token A with decimals of dA and price of rateA per one token (e.g., for 10^dA weiA)
        //   - token B with decimals of dB < dA and price of rateB per one token (e.g., for 10^dB weiB)
        // then the normalized rate, representing the rate between 1 weiA and 1 weiB is rateA / (rateB * 10^(dA - dB)).
        //
        // for example:
        //   - token A with decimals of 5 and price of $10 per one token (e.g., for 100,000 weiA)
        //   - token B with decimals of 2 and price of $2 per one token (e.g., for 100 weiB)
        // then the normalized rate would be: 5 / (2 * 10^3) = 0.0025, which is the correct rate since
        // 1 weiA costs $0.00005, 1 weiB costs $0.02, and weiA / weiB is 0.0025.

        if (decimalsTokenA > decimalsTokenB) {
            rateTokenB = rateTokenB.mul(uint256(10) ** (decimalsTokenA - decimalsTokenB));
        }
        else if (decimalsTokenA < decimalsTokenB) {
            rateTokenA = rateTokenA.mul(uint256(10) ** (decimalsTokenB - decimalsTokenA));
        }

        return (rateTokenA, rateTokenB);
    }

    /**
      * @dev returns the timestamp of the last price update
      *
      * @return timestamp
    */
    function lastUpdateTime()
        public
        override
        view
        returns (uint256) {
        // returns the oldest timestamp between the two
        uint256 timestampA = tokenAOracle.latestTimestamp();
        uint256 timestampB = tokenBOracle.latestTimestamp();

        return  timestampA > timestampB ? timestampA : timestampB;
    }

    /**
      * @dev returns both the rate and the timestamp of the last update in a single call (gas optimization)
      *
      * @param  _tokenA token to get the rate of 1 unit of
      * @param  _tokenB token to get the rate of 1 `_tokenA` against
      *
      * @return numerator
      * @return denominator
      * @return timestamp of the last update
    */
    function latestRateAndUpdateTime(IERC20Token _tokenA, IERC20Token _tokenB)
        public
        override
        view
        returns (uint256, uint256, uint256)
    {
        (uint256 numerator, uint256 denominator) = latestRate(_tokenA, _tokenB);

        return (numerator, denominator, lastUpdateTime());
    }

    /** @dev returns the decimals of a given token */
    function decimals(IERC20Token _token) private view returns (uint8) {
        if (address(_token) == ETH_ADDRESS) {
            return ETH_DECIMALS;
        }

        return _token.decimals();
    }
}

pragma solidity 0.4.26;
import "./ConverterBase.sol";

/**
  * @dev Liquidity Pool Converter
  *
  * The liquidity pool converter is the parent contract for specific types of converters that
  * manage liquidity pools.
  *
  * Liquidity pools have 2 reserves or more and they allow converting between them.
*/
contract LiquidityPoolConverter is ConverterBase {
    /**
      * @dev triggered when the rate between a pool token and a reserve token changes
      *
      * @param  _poolToken      pool token address
      * @param  _reserveToken   reserve token address
      * @param  _rateN          rate of 1 unit of pool token in reserve tokens (numerator)
      * @param  _rateD          rate of 1 unit of pool token in reserve tokens (denominator)
    */
    event PoolTokenRateUpdate(
        address indexed _poolToken,
        address indexed _reserveToken,
        uint256 _rateN,
        uint256 _rateD
    );

    /**
      * @dev triggered after liquidity is added
      *
      * @param  _provider       liquidity provider
      * @param  _reserveToken   reserve token address
      * @param  _amount         reserve token amount
      * @param  _newBalance     reserve token new balance
      * @param  _newSupply      pool token new supply
    */
    event LiquidityAdded(
        address indexed _provider,
        address indexed _reserveToken,
        uint256 _amount,
        uint256 _newBalance,
        uint256 _newSupply
    );

    /**
      * @dev triggered after liquidity is removed
      *
      * @param  _provider       liquidity provider
      * @param  _reserveToken   reserve token address
      * @param  _amount         reserve token amount
      * @param  _newBalance     reserve token new balance
      * @param  _newSupply      pool token new supply
    */
    event LiquidityRemoved(
        address indexed _provider,
        address indexed _reserveToken,
        uint256 _amount,
        uint256 _newBalance,
        uint256 _newSupply
    );

    /**
      * @dev initializes a new LiquidityPoolConverter instance
      *
      * @param  _anchor             anchor governed by the converter
      * @param  _registry           address of a contract registry contract
      * @param  _maxConversionFee   maximum conversion fee, represented in ppm
    */
    constructor(
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
        ConverterBase(_anchor, _registry, _maxConversionFee)
        internal
    {
    }

    /**
      * @dev activates the converter
      * can only be called by the contract owner
    */
    function acceptTokenOwnership() public {
        // verify that the converter has at least 2 reserves
        require(reserveTokenCount() > 1, "ERR_INVALID_RESERVE_COUNT");
        super.acceptTokenOwnership();
    }
}

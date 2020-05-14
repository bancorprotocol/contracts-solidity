pragma solidity 0.4.26;
import './BancorConverter.sol';

/**
  * @dev Liquidity Pool Converter
  * 
  * The liquidity pool converter is the parent contract for specific types of converters that
  * manage liquidity pools.
  *
  * Liquidity pools have 2 reserves or more and they allow converting between them.
*/
contract LiquidityPoolConverter is BancorConverter {

    /**
      * @dev triggered after liquidity is added
      * 
      * @param  _provider   liquidity provider
      * @param  _reserve    reserve token address
      * @param  _amount     reserve token amount
      * @param  _newBalance reserve token new balance
      * @param  _newSupply  smart token new supply
    */
    event LiquidityAdded(
        address indexed _provider,
        address indexed _reserve,
        uint256 _amount,
        uint256 _newBalance,
        uint256 _newSupply
    );

    /**
      * @dev triggered after liquidity is removed
      * 
      * @param  _provider   liquidity provider
      * @param  _reserve    reserve token address
      * @param  _amount     reserve token amount
      * @param  _newBalance reserve token new balance
      * @param  _newSupply  smart token new supply
    */
    event LiquidityRemoved(
        address indexed _provider,
        address indexed _reserve,
        uint256 _amount,
        uint256 _newBalance,
        uint256 _newSupply
    );

    /**
      * @dev initializes a new LiquidityPoolConverter instance
      * 
      * @param  _token              pool token governed by the converter
      * @param  _registry           address of a contract registry contract
      * @param  _maxConversionFee   maximum conversion fee, represented in ppm
    */
    constructor(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
        BancorConverter(_token, _registry, _maxConversionFee)
        public
    {
    }

    /**
      * @dev activates the converter
      * can only be called by the contract owner
    */
    function acceptTokenOwnership() public {
        // verify that the converter has at least 2 reserves
        require(reserveTokenCount() > 1);
        super.acceptTokenOwnership();
    }
}

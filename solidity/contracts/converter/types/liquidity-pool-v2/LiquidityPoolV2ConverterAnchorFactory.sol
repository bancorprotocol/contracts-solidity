pragma solidity 0.4.26;
import "./PoolTokensContainer.sol";
import "../../interfaces/ITypedConverterAnchorFactory.sol";

/*
    LiquidityPoolV2ConverterAnchorFactory Factory
*/
contract LiquidityPoolV2ConverterAnchorFactory is ITypedConverterAnchorFactory {
    /**
      * @dev returns the converter type the factory is associated with
      *
      * @return converter type
    */
    function converterType() public pure returns (uint16) {
        return 2;
    }

    /**
      * @dev creates a new converter anchor with the given arguments and transfers
      * the ownership to the caller
      *
      * @param _name        pool name
      * @param _symbol      pool symbol
      * @param _decimals    pool decimals
      *
      * @return new anchor
    */
    function createAnchor(string _name, string _symbol, uint8 _decimals) public returns (IConverterAnchor) {
        IPoolTokensContainer container = new PoolTokensContainer(_name, _symbol, _decimals);
        container.createToken();
        container.createToken();
        container.transferOwnership(msg.sender);
        return container;
    }
}

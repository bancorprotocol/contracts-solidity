// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
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
    function converterType() external pure override returns (uint16) {
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
    function createAnchor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external override returns (IConverterAnchor) {
        IPoolTokensContainer container = new PoolTokensContainer(_name, _symbol, _decimals);
        container.transferOwnership(msg.sender);
        return container;
    }
}

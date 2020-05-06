pragma solidity 0.4.26;

/*
    Bancor Formula interface
*/
contract IBancorFormula {
    function purchaseRate(uint256 _supply, uint256 _reserveBalance, uint32 _reserveWeight, uint256 _depositAmount) public view returns (uint256);
    function saleRate(uint256 _supply, uint256 _reserveBalance, uint32 _reserveWeight, uint256 _sellAmount) public view returns (uint256);
    function crossReserveRate(uint256 _fromReserveBalance, uint32 _fromReserveWeight, uint256 _toReserveBalance, uint32 _toReserveWeight, uint256 _amount) public view returns (uint256);
    function calculateFundCost(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _amount) public view returns (uint256);
    function calculateLiquidateReturn(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _amount) public view returns (uint256);
    // deprecated, backward compatibility
    function calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount) public view returns (uint256);
}

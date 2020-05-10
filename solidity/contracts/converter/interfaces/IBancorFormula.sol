pragma solidity 0.4.26;

/*
    Bancor Formula interface
*/
contract IBancorFormula {
    function purchaseRate(uint256 _supply, uint256 _reserveBalance, uint32 _reserveWeight, uint256 _depositAmount) public view returns (uint256);
    function saleRate(uint256 _supply, uint256 _reserveBalance, uint32 _reserveWeight, uint256 _sellAmount) public view returns (uint256);
    function crossReserveRate(uint256 _fromReserveBalance, uint32 _fromReserveWeight, uint256 _toReserveBalance, uint32 _toReserveWeight, uint256 _amount) public view returns (uint256);
    function fundCost(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _amount) public view returns (uint256);
    function liquidateRate(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _amount) public view returns (uint256);
}

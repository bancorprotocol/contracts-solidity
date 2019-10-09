pragma solidity 0.4.26;

/*
    Bancor Gas Price Limit interface
*/
contract IBancorGasPriceLimit {
    function gasPrice() public view returns (uint256) {this;}
    function validateGasPrice(uint256) public view;
}

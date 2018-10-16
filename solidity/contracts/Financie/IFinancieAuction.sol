pragma solidity ^0.4.17;

contract IFinancieAuction {
    function bid() public payable;
    function estimateClaimTokens(address receiver_address) public view returns (uint256);
    function proxyClaimTokens(address receiver_address) public returns (bool);
    function canClaimTokens(address receiver_address) public view returns (bool);
    function targetToken() public view returns (address);
}

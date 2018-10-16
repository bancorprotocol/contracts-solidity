pragma solidity ^0.4.18;

/**
* Financie Internal Wallet interface
*/
contract IFinancieInternalWallet {

    function depositEther(uint32 _userId) payable;
    function depositToken(uint32 _userId, uint256 _amount, address _tokenAddress);
    function withdrawEther(uint32 _userId, uint256 _amount);
    function withdrawToken(uint32 _userId, uint256 _amount, address _tokenAddress);
    function delegateBuyCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress);
    function delegateSellCards(uint32 _userId, uint256 _amount, uint256 _minReturn, address _tokenAddress, address _bancorAddress);
    function delegateBuyTicket(uint32 _userId, uint256 _price, address _ticketAddress, address _tokenAddress, address _storeAddress);
    function delegateBidCards(uint32 _userId, uint256 _amount, address _auctionAddress);
    function delegateReceiveCards(uint32 _userId, address _auctionAddress);
    function delegateCanClaimTokens(uint32 _userId, address _auctionAddress) public view returns(bool);
    function delegateEstimateClaimTokens(uint32 _userId, address _auctionAddress) public view returns(uint256);
}

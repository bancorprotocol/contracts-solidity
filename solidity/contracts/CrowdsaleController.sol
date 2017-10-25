pragma solidity ^0.4.11;
import './SmartTokenController.sol';
import './Utils.sol';
import './interfaces/ISmartToken.sol';

/*
    Crowdsale v0.1

    The crowdsale version of the smart token controller, allows contributing ether in exchange for Bancor tokens
    The price remains fixed for the entire duration of the crowdsale
    Note that 20% of the contributions are the BNT token's ETH connector balance
*/
contract CrowdsaleController is SmartTokenController {
    uint256 public constant DURATION = 14 days;                 // crowdsale duration
    uint256 public constant TOKEN_PRICE_N = 1;                  // initial price in wei (numerator)
    uint256 public constant TOKEN_PRICE_D = 100;                // initial price in wei (denominator)
    uint256 public constant BTCS_ETHER_CAP = 50000 ether;       // maximum bitcoin suisse ether contribution
    uint256 public constant MAX_GAS_PRICE = 50000000000 wei;    // maximum gas price for contribution transactions

    string public version = '0.1';

    uint256 public startTime = 0;                   // crowdsale start time (in seconds)
    uint256 public endTime = 0;                     // crowdsale end time (in seconds)
    uint256 public totalEtherCap = 1000000 ether;   // current ether contribution cap, initialized with a temp value as a safety mechanism until the real cap is revealed
    uint256 public totalEtherContributed = 0;       // ether contributed so far
    bytes32 public realEtherCapHash;                // ensures that the real cap is predefined on deployment and cannot be changed later
    address public beneficiary = 0x0;               // address to receive all ether contributions
    address public btcs = 0x0;                      // bitcoin suisse address

    // triggered on each contribution
    event Contribution(address indexed _contributor, uint256 _amount, uint256 _return);

    /**
        @dev constructor

        @param _token          smart token the crowdsale is for
        @param _startTime      crowdsale start time
        @param _beneficiary    address to receive all ether contributions
        @param _btcs           bitcoin suisse address
    */
    function CrowdsaleController(ISmartToken _token, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash)
        SmartTokenController(_token)
        validAddress(_beneficiary)
        validAddress(_btcs)
        earlierThan(_startTime)
        greaterThanZero(uint256(_realEtherCapHash))
    {
        startTime = _startTime;
        endTime = startTime + DURATION;
        beneficiary = _beneficiary;
        btcs = _btcs;
        realEtherCapHash = _realEtherCapHash;
    }

    // verifies that the gas price is lower than 50 gwei
    modifier validGasPrice() {
        assert(tx.gasprice <= MAX_GAS_PRICE);
        _;
    }

    // verifies that the ether cap is valid based on the key provided
    modifier validEtherCap(uint256 _cap, uint256 _key) {
        require(computeRealCap(_cap, _key) == realEtherCapHash);
        _;
    }

    // ensures that it's earlier than the given time
    modifier earlierThan(uint256 _time) {
        assert(now < _time);
        _;
    }

    // ensures that the current time is between _startTime (inclusive) and _endTime (exclusive)
    modifier between(uint256 _startTime, uint256 _endTime) {
        assert(now >= _startTime && now < _endTime);
        _;
    }

    // ensures that the sender is bitcoin suisse
    modifier btcsOnly() {
        assert(msg.sender == btcs);
        _;
    }

    // ensures that we didn't reach the ether cap
    modifier etherCapNotReached(uint256 _contribution) {
        assert(safeAdd(totalEtherContributed, _contribution) <= totalEtherCap);
        _;
    }

    // ensures that we didn't reach the bitcoin suisse ether cap
    modifier btcsEtherCapNotReached(uint256 _ethContribution) {
        assert(safeAdd(totalEtherContributed, _ethContribution) <= BTCS_ETHER_CAP);
        _;
    }

    /**
        @dev computes the real cap based on the given cap & key

        @param _cap    cap
        @param _key    key used to compute the cap hash

        @return computed real cap hash
    */
    function computeRealCap(uint256 _cap, uint256 _key) public constant returns (bytes32) {
        return keccak256(_cap, _key);
    }

    /**
        @dev enables the real cap defined on deployment

        @param _cap    predefined cap
        @param _key    key used to compute the cap hash
    */
    function enableRealCap(uint256 _cap, uint256 _key)
        public
        ownerOnly
        active
        between(startTime, endTime)
        validEtherCap(_cap, _key)
    {
        require(_cap < totalEtherCap); // validate input
        totalEtherCap = _cap;
    }

    /**
        @dev computes the number of tokens that should be issued for a given contribution

        @param _contribution    contribution amount

        @return computed number of tokens
    */
    function computeReturn(uint256 _contribution) public constant returns (uint256) {
        return safeMul(_contribution, TOKEN_PRICE_D) / TOKEN_PRICE_N;
    }

    /**
        @dev ETH contribution
        can only be called during the crowdsale

        @return tokens issued in return
    */
    function contributeETH()
        public
        payable
        between(startTime, endTime)
        returns (uint256 amount)
    {
        return processContribution();
    }

    /**
        @dev Contribution through BTCs (Bitcoin Suisse only)
        can only be called before the crowdsale started

        @return tokens issued in return
    */
    function contributeBTCs()
        public
        payable
        btcsOnly
        btcsEtherCapNotReached(msg.value)
        earlierThan(startTime)
        returns (uint256 amount)
    {
        return processContribution();
    }

    /**
        @dev handles contribution logic
        note that the Contribution event is triggered using the sender as the contributor, regardless of the actual contributor

        @return tokens issued in return
    */
    function processContribution() private
        active
        etherCapNotReached(msg.value)
        validGasPrice
        returns (uint256 amount)
    {
        uint256 tokenAmount = computeReturn(msg.value);
        beneficiary.transfer(msg.value); // transfer the ether to the beneficiary account
        totalEtherContributed = safeAdd(totalEtherContributed, msg.value); // update the total contribution amount
        token.issue(msg.sender, tokenAmount); // issue new funds to the contributor in the smart token
        token.issue(beneficiary, tokenAmount); // issue tokens to the beneficiary

        Contribution(msg.sender, msg.value, tokenAmount);
        return tokenAmount;
    }

    // fallback
    function() payable {
        contributeETH();
    }
}

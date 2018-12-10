pragma solidity ^0.4.24;

import './interfaces/IBancorXUpgrader.sol';
import './interfaces/IBancorX.sol';
import '../ContractIds.sol';
import '../converter/interfaces/IBancorConverter.sol';
import '../utility/interfaces/IContractRegistry.sol';
import '../utility/Owned.sol';
import '../utility/SafeMath.sol';
import '../utility/TokenHolder.sol';
import '../token/interfaces/ISmartToken.sol';

/*
    The BancorX contract allows cross chain token transfers.

    There are two processes that take place in the contract -
    - Initiate a cross chain transfer to a target blockchain (locks tokens from the caller account on Ethereum)
    - Report a cross chain transfer initiated on a source blockchain (releases tokens to an account on Ethereum)

    Reporting cross chain transfers works similar to standard multisig contracts, meaning that multiple
    callers are required to report a transfer before tokens are released to the target account.
*/
contract BancorX is IBancorX, Owned, TokenHolder, ContractIds {
    using SafeMath for uint256;

    // represents a transaction on another blockchain where BNT was destroyed/locked
    struct Transaction {
        uint256 amount;
        bytes32 fromBlockchain;
        address to;
        uint8 numOfReports;
        bool completed;
    }

    uint16 public version = 2;

    uint256 public maxLockLimit;            // the maximum amount of BNT that can be locked in one transaction
    uint256 public maxReleaseLimit;         // the maximum amount of BNT that can be released in one transaction
    uint256 public minLimit;                // the minimum amount of BNT that can be transferred in one transaction
    uint256 public prevLockLimit;           // the lock limit *after* the last transaction
    uint256 public prevReleaseLimit;        // the release limit *after* the last transaction
    uint256 public limitIncPerBlock;        // how much the limit increases per block
    uint256 public prevLockBlockNumber;     // the block number of the last lock transaction
    uint256 public prevReleaseBlockNumber;  // the block number of the last release transaction
    uint256 public minRequiredReports;      // minimum number of required reports to release tokens
    
    IContractRegistry public registry;      // contract registry
    IContractRegistry public prevRegistry;  // address of previous registry as security mechanism
    IBancorConverter public bntConverter;   // BNT converter
    ISmartToken public bntToken;            // BNT token

    bool public xTransfersEnabled = true;   // true if x transfers are enabled, false if not
    bool public reportingEnabled = true;    // true if reporting is enabled, false if not
    bool public allowRegistryUpdate = true; // allows the owner to prevent/allow the registry to be updated

    // txId -> Transaction
    mapping (uint256 => Transaction) public transactions;

    // xTransferId -> txId
    mapping (uint256 => uint256) public transactionIds;

    // txId -> reporter -> true if reporter already reported txId
    mapping (uint256 => mapping (address => bool)) public reportedTxs;

    // address -> true if address is reporter
    mapping (address => bool) public reporters;

    // triggered when BNT is locked in smart contract
    event TokensLock(
        address indexed _from,
        uint256 _amount
    );

    // triggered when BNT is released by the smart contract
    event TokensRelease(
        address indexed _to,
        uint256 _amount
    );

    // triggered when xTransfer is successfully called
    event XTransfer(
        address indexed _from,
        bytes32 _toBlockchain,
        bytes32 indexed _to,
        uint256 _amount,
        uint256 _id
    );

    // triggered when report is successfully submitted
    event TxReport(
        address indexed _reporter,
        bytes32 _fromBlockchain,
        uint256 _txId,
        address _to,
        uint256 _amount,
        uint256 _xTransferId
    );

    /**
        @dev constructor

        @param _maxLockLimit          maximum amount of BNT that can be locked in one transaction
        @param _maxReleaseLimit       maximum amount of BNT that can be released in one transaction
        @param _minLimit              minimum amount of BNT that can be transferred in one transaction
        @param _limitIncPerBlock      how much the limit increases per block
        @param _minRequiredReports    minimum number of reporters to report transaction before tokens can be released
        @param _registry              address of contract registry
     */
    constructor(
        uint256 _maxLockLimit,
        uint256 _maxReleaseLimit,
        uint256 _minLimit,
        uint256 _limitIncPerBlock,
        uint256 _minRequiredReports,
        address _registry
    )
        public
    {
        // the maximum limits, minimum limit, and limit increase per block
        maxLockLimit = _maxLockLimit;
        maxReleaseLimit = _maxReleaseLimit;
        minLimit = _minLimit;
        limitIncPerBlock = _limitIncPerBlock;
        minRequiredReports = _minRequiredReports;

        // previous limit is _maxLimit, and previous block number is current block number
        prevLockLimit = _maxLockLimit;
        prevReleaseLimit = _maxReleaseLimit;
        prevLockBlockNumber = block.number;
        prevReleaseBlockNumber = block.number;

        registry = IContractRegistry(_registry);
        prevRegistry = IContractRegistry(_registry);
        bntToken = ISmartToken(registry.addressOf(ContractIds.BNT_TOKEN));
        bntConverter = IBancorConverter(registry.addressOf(ContractIds.BNT_CONVERTER));
    }

    // validates that the caller is a reporter
    modifier isReporter {
        require(reporters[msg.sender]);
        _;
    }

    // allows execution only when x transfers are enabled
    modifier whenXTransfersEnabled {
        require(xTransfersEnabled);
        _;
    }

    // allows execution only when reporting is enabled
    modifier whenReportingEnabled {
        require(reportingEnabled);
        _;
    }

    /**
        @dev setter

        @param _maxLockLimit    new maxLockLimit
     */
    function setMaxLockLimit(uint256 _maxLockLimit) public ownerOnly {
        maxLockLimit = _maxLockLimit;
    }
    
    /**
        @dev setter

        @param _maxReleaseLimit    new maxReleaseLimit
     */
    function setMaxReleaseLimit(uint256 _maxReleaseLimit) public ownerOnly {
        maxReleaseLimit = _maxReleaseLimit;
    }
    
    /**
        @dev setter

        @param _minLimit    new minLimit
     */
    function setMinLimit(uint256 _minLimit) public ownerOnly {
        minLimit = _minLimit;
    }

    /**
        @dev setter

        @param _limitIncPerBlock    new limitIncPerBlock
     */
    function setLimitIncPerBlock(uint256 _limitIncPerBlock) public ownerOnly {
        limitIncPerBlock = _limitIncPerBlock;
    }

    /**
        @dev setter

        @param _minRequiredReports    new minRequiredReports
     */
    function setMinRequiredReports(uint256 _minRequiredReports) public ownerOnly {
        minRequiredReports = _minRequiredReports;
    }

    /**
        @dev allows the owner to set/remove reporters

        @param _reporter    reporter whos status is to be set
        @param _active      true if the reporter is approved, false otherwise
     */
    function setReporter(address _reporter, bool _active) public ownerOnly {
        reporters[_reporter] = _active;
    }

    /**
        @dev allows the owner enable/disable the xTransfer method

        @param _enable     true to enable, false to disable
     */
    function enableXTransfers(bool _enable) public ownerOnly {
        xTransfersEnabled = _enable;
    }

    /**
        @dev allows the owner enable/disable the reportTransaction method

        @param _enable     true to enable, false to disable
     */
    function enableReporting(bool _enable) public ownerOnly {
        reportingEnabled = _enable;
    }

    /**
        @dev disables the registry update functionality
        this is a safety mechanism in case of a emergency
        can only be called by the manager or owner

        @param _disable    true to disable registry updates, false to re-enable them
    */
    function disableRegistryUpdate(bool _disable) public ownerOnly {
        allowRegistryUpdate = !_disable;
    }

    /**
        @dev allows the owner to set the BNT converters address to wherever the
        contract registry currently points to
     */
    function setBNTConverterAddress() public ownerOnly {
        bntConverter = IBancorConverter(registry.addressOf(ContractIds.BNT_CONVERTER));
    }

    /**
        @dev sets the contract registry to whichever address the current registry is pointing to
     */
    function updateRegistry() public {
        // require that upgrading is allowed or that the caller is the owner
        require(allowRegistryUpdate || msg.sender == owner);

        // get the address of whichever registry the current registry is pointing to
        address newRegistry = registry.addressOf(ContractIds.CONTRACT_REGISTRY);

        // if the new registry hasn't changed or is the zero address, revert
        require(newRegistry != address(registry) && newRegistry != address(0));

        // set the previous registry as current registry and current registry as newRegistry
        prevRegistry = registry;
        registry = IContractRegistry(newRegistry);
    }

    /**
        @dev security mechanism allowing the converter owner to revert to the previous registry,
        to be used in emergency scenario
    */
    function restoreRegistry() public ownerOnly {
        // set the registry as previous registry
        registry = prevRegistry;

        // after a previous registry is restored, only the owner can allow future updates
        allowRegistryUpdate = false;
    }

    /**
        @dev upgrades the contract to the latest version
        can only be called by the owner
        note that the owner needs to call acceptOwnership on the new contract after the upgrade

        @param _reporters    new list of reporters
    */
    function upgrade(address[] _reporters) public ownerOnly {
        IBancorXUpgrader bancorXUpgrader = IBancorXUpgrader(registry.addressOf(ContractIds.BANCOR_X_UPGRADER));

        transferOwnership(bancorXUpgrader);
        bancorXUpgrader.upgrade(version, _reporters);
        acceptOwnership();
    }

    /**
        @dev claims BNT from msg.sender to be converted to BNT on another blockchain

        @param _toBlockchain    blockchain BNT will be issued on
        @param _to              address to send the BNT to
        @param _amount          the amount to transfer
     */
    function xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount) public whenXTransfersEnabled {
        // get the current lock limit
        uint256 currentLockLimit = getCurrentLockLimit();

        // require that; minLimit <= _amount <= currentLockLimit
        require(_amount >= minLimit && _amount <= currentLockLimit);
        
        lockTokens(_amount);

        // set the previous lock limit and block number
        prevLockLimit = currentLockLimit.sub(_amount);
        prevLockBlockNumber = block.number;

        // emit XTransfer event with id of 0
        emit XTransfer(msg.sender, _toBlockchain, _to, _amount, 0);
    }

    /**
        @dev claims BNT from msg.sender to be converted to BNT on another blockchain

        @param _toBlockchain    blockchain BNT will be issued on
        @param _to              address to send the BNT to
        @param _amount          the amount to transfer
        @param _id              pre-determined unique (if non zero) id which refers to this transaction 
     */
    function xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id) public whenXTransfersEnabled {
        // get the current lock limit
        uint256 currentLockLimit = getCurrentLockLimit();

        // require that; minLimit <= _amount <= currentLockLimit
        require(_amount >= minLimit && _amount <= currentLockLimit);
        
        lockTokens(_amount);

        // set the previous lock limit and block number
        prevLockLimit = currentLockLimit.sub(_amount);
        prevLockBlockNumber = block.number;

        // emit XTransfer event
        emit XTransfer(msg.sender, _toBlockchain, _to, _amount, _id);
    }

    /**
        @dev allows reporter to report transaction which occured on another blockchain

        @param _fromBlockchain  blockchain BNT was destroyed in
        @param _txId            transactionId of transaction thats being reported
        @param _to              address to receive BNT
        @param _amount          amount of BNT destroyed on another blockchain
        @param _xTransferId     unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been broadcasted)
     */
    function reportTx(
        bytes32 _fromBlockchain,
        uint256 _txId,
        address _to,
        uint256 _amount,
        uint256 _xTransferId 
    )
        public
        isReporter
        whenReportingEnabled
    {
        // require that the transaction has not been reported yet by the reporter
        require(!reportedTxs[_txId][msg.sender]);

        // set reported as true
        reportedTxs[_txId][msg.sender] = true;

        Transaction storage txn = transactions[_txId];

        // If the caller is the first reporter, set the transaction details
        if (txn.numOfReports == 0) {
            txn.to = _to;
            txn.amount = _amount;
            txn.fromBlockchain = _fromBlockchain;

            if (_xTransferId != 0) {
                // verify uniqueness of xTransfer id to prevent overwriting
                require(transactionIds[_xTransferId] == 0);
                transactionIds[_xTransferId] = _txId;
            }
        } else {
            // otherwise, verify transaction details
            require(txn.to == _to && txn.amount == _amount && txn.fromBlockchain == _fromBlockchain);
            
            if (_xTransferId != 0) {
                require(transactionIds[_xTransferId] == _txId);
            }
        }
        
        // increment the number of reports
        txn.numOfReports++;

        emit TxReport(msg.sender, _fromBlockchain, _txId, _to, _amount, _xTransferId);

        // if theres enough reports, try to release tokens
        if (txn.numOfReports >= minRequiredReports) {
            require(!transactions[_txId].completed);

            // set the transaction as completed
            transactions[_txId].completed = true;

            releaseTokens(_to, _amount);
        }
    }

    /**
        @dev gets x transfer amount by xTransferId (not txId)

        @param _xTransferId    unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been broadcasted)

        @return amount that was sent in corresponding _xTransferId
    */
    function getXTransferAmount(uint256 _xTransferId) public view returns (uint256) {
        // xTransferId -> txId -> Transaction
        Transaction memory transaction = transactions[transactionIds[_xTransferId]];
        
        return transaction.amount;
    }

    /**
        @dev method for calculating current lock limit

        @return the current maximum limit of BNT that can be locked
     */
    function getCurrentLockLimit() public view returns (uint256) {
        // prevLockLimit + ((currBlockNumber - prevLockBlockNumber) * limitIncPerBlock)
        uint256 currentLockLimit = prevLockLimit.add(((block.number).sub(prevLockBlockNumber)).mul(limitIncPerBlock));
        if (currentLockLimit > maxLockLimit)
            return maxLockLimit;
        return currentLockLimit;
    }
 
    /**
        @dev method for calculating current release limit

        @return the current maximum limit of BNT that can be released
     */
    function getCurrentReleaseLimit() public view returns (uint256) {
        // prevReleaseLimit + ((currBlockNumber - prevReleaseBlockNumber) * limitIncPerBlock)
        uint256 currentReleaseLimit = prevReleaseLimit.add(((block.number).sub(prevReleaseBlockNumber)).mul(limitIncPerBlock));
        if (currentReleaseLimit > maxReleaseLimit)
            return maxReleaseLimit;
        return currentReleaseLimit;
    }

    /**
        @dev claims and locks BNT from msg.sender to be converted to BNT on another blockchain

        @param _amount  the amount to lock
     */
    function lockTokens(uint256 _amount) private {
        // lock the BNT from msg.sender in this contract
        bntConverter.claimTokens(msg.sender, _amount);

        emit TokensLock(msg.sender, _amount);
    }

    /**
        @dev private method to release BNT the contract holds

        @param _to      the address to release BNT to
        @param _amount  the amount to release
     */
    function releaseTokens(address _to, uint256 _amount) private {
        // get the current release limit
        uint256 currentReleaseLimit = getCurrentReleaseLimit();

        require(_amount >= minLimit && _amount <= currentReleaseLimit);
        
        // update the previous release limit and block number
        prevReleaseLimit = currentReleaseLimit.sub(_amount);
        prevReleaseBlockNumber = block.number;

        // no need to require, reverts on failure
        bntToken.transfer(_to, _amount);

        emit TokensRelease(_to, _amount);
    }
}

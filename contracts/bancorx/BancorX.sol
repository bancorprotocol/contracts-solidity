// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IBancorXUpgrader.sol";
import "./interfaces/IBancorX.sol";

import "../utility/ContractRegistryClient.sol";
import "../utility/TokenHolder.sol";

import "../token/SafeERC20Ex.sol";

/**
 * @dev This contract allows cross chain token transfers.
 *
 * There are two processes that take place in the contract -
 * - Initiate a cross chain transfer to a target blockchain (locks tokens from the caller account on Ethereum)
 * - Report a cross chain transfer initiated on a source blockchain (releases tokens to an account on Ethereum)
 *
 * Reporting cross chain transfers works similar to standard multisig contracts, meaning that multiple
 * callers are required to report a transfer before tokens are released to the target account.
 */
contract BancorX is IBancorX, TokenHolder, ContractRegistryClient {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // represents a transaction on another blockchain where tokens were destroyed/locked
    struct Transaction {
        uint256 amount;
        bytes32 fromBlockchain;
        address to;
        uint8 numOfReports;
        bool completed;
    }

    uint16 public constant VERSION = 4;

    uint256 private _maxLockLimit; // the maximum amount of tokens that can be locked in one transaction
    uint256 private _maxReleaseLimit; // the maximum amount of tokens that can be released in one transaction
    uint256 private _minLimit; // the minimum amount of tokens that can be transferred in one transaction
    uint256 private _prevLockLimit; // the lock limit *after* the last transaction
    uint256 private _prevReleaseLimit; // the release limit *after* the last transaction
    uint256 private _limitIncPerBlock; // how much the limit increases per block
    uint256 private _prevLockBlockNumber; // the block number of the last lock transaction
    uint256 private _prevReleaseBlockNumber; // the block number of the last release transaction
    uint8 private _minRequiredReports; // minimum number of required reports to release tokens

    IERC20 private _token; // erc20 token

    bool private _xTransfersEnabled = true; // true if xTransfers are enabled, false if not
    bool private _reportingEnabled = true; // true if reporting is enabled, false if not

    // txId -> Transaction
    mapping(uint256 => Transaction) private _transactions;

    // xTransferId -> txId
    mapping(uint256 => uint256) private _transactionIds;

    // txId -> reporter -> true if reporter already reported txId
    mapping(uint256 => mapping(address => bool)) private _reportedTxs;

    // address -> true if address is reporter
    mapping(address => bool) private _reporters;

    /**
     * @dev triggered when tokens are locked in smart contract
     *
     * @param source wallet address that the tokens are locked from
     * @param amount amount locked
     */
    event TokensLock(address indexed source, uint256 amount);

    /**
     * @dev triggered when tokens are released by the smart contract
     *
     * @param target wallet address that the tokens are released to
     * @param amount amount released
     */
    event TokensRelease(address indexed target, uint256 amount);

    /**
     * @dev triggered when xTransfer is successfully called
     *
     * @param from wallet address that initiated the xTransfer
     * @param toBlockchain target blockchain
     * @param to target wallet
     * @param amount transfer amount
     * @param id xTransfer id
     */
    event XTransfer(address indexed from, bytes32 toBlockchain, bytes32 indexed to, uint256 amount, uint256 id);

    /**
     * @dev triggered when report is successfully submitted
     *
     * @param reporter reporter wallet
     * @param fromBlockchain  source blockchain
     * @param txId tx id on the source blockchain
     * @param to target wallet
     * @param amount transfer amount
     * @param xTransferId xTransfer id
     */
    event TxReport(
        address indexed reporter,
        bytes32 fromBlockchain,
        uint256 txId,
        address to,
        uint256 amount,
        uint256 xTransferId
    );

    /**
     * @dev triggered when final report is successfully submitted
     *
     * @param to target wallet
     * @param id xTransfer id
     */
    event XTransferComplete(address to, uint256 id);

    /**
     * @dev initializes a new BancorX instance
     *
     * @param initialMaxLockLimit maximum amount of tokens that can be locked in one transaction
     * @param initialMaxReleaseLimit maximum amount of tokens that can be released in one transaction
     * @param initialMinLimit minimum amount of tokens that can be transferred in one transaction
     * @param initialLimitIncPerBlock how much the limit increases per block
     * @param initialMinRequiredReports minimum number of reporters to report transaction before tokens can be released
     * @param registry address of contract registry
     * @param initialToken erc20 token
     */
    constructor(
        uint256 initialMaxLockLimit,
        uint256 initialMaxReleaseLimit,
        uint256 initialMinLimit,
        uint256 initialLimitIncPerBlock,
        uint8 initialMinRequiredReports,
        IContractRegistry registry,
        IERC20 initialToken
    )
        public
        ContractRegistryClient(registry)
        greaterThanZero(initialMaxLockLimit)
        greaterThanZero(initialMaxReleaseLimit)
        greaterThanZero(initialMinLimit)
        greaterThanZero(initialLimitIncPerBlock)
        greaterThanZero(initialMinRequiredReports)
        validExternalAddress(address(initialToken))
    {
        // validate input
        require(
            initialMinLimit <= initialMaxLockLimit && initialMinLimit <= initialMaxReleaseLimit,
            "ERR_INVALID_MIN_LIMIT"
        );

        // the maximum limits, minimum limit, and limit increase per block
        _maxLockLimit = initialMaxLockLimit;
        _maxReleaseLimit = initialMaxReleaseLimit;
        _minLimit = initialMinLimit;
        _limitIncPerBlock = initialLimitIncPerBlock;
        _minRequiredReports = initialMinRequiredReports;

        // previous limit is _maxLimit, and previous block number is current block number
        _prevLockLimit = initialMaxLockLimit;
        _prevReleaseLimit = initialMaxReleaseLimit;
        _prevLockBlockNumber = block.number;
        _prevReleaseBlockNumber = block.number;

        _token = initialToken;
    }

    // validates that the caller is a reporter
    modifier reporterOnly {
        _reporterOnly();

        _;
    }

    // error message binary size optimization
    function _reporterOnly() internal view {
        require(_reporters[msg.sender], "ERR_ACCESS_DENIED");
    }

    // allows execution only when xTransfers are enabled
    modifier xTransfersAllowed {
        _xTransfersAllowed();

        _;
    }

    // error message binary size optimization
    function _xTransfersAllowed() internal view {
        require(_xTransfersEnabled, "ERR_DISABLED");
    }

    // allows execution only when reporting is enabled
    modifier reportingAllowed {
        _reportingAllowed();

        _;
    }

    // error message binary size optimization
    function _reportingAllowed() internal view {
        require(_reportingEnabled, "ERR_DISABLED");
    }

    /**
     * @dev sets the maximum amount of tokens that can be locked in one transaction
     *
     * @param newMaxLockLimit new maxLockLimit
     */
    function setMaxLockLimit(uint256 newMaxLockLimit) external ownerOnly greaterThanZero(newMaxLockLimit) {
        _maxLockLimit = newMaxLockLimit;
    }

    /**
     * @dev returns the maximum amount of tokens that can be locked in one transaction
     *
     * @return the maximum amount of tokens that can be locked in one transaction
     */
    function maxLockLimit() external view returns (uint256) {
        return _maxLockLimit;
    }

    /**
     * @dev sets the maximum amount of tokens that can be released in one transaction
     *
     * @param newMaxReleaseLimit new maxReleaseLimit
     */
    function setMaxReleaseLimit(uint256 newMaxReleaseLimit) external ownerOnly greaterThanZero(newMaxReleaseLimit) {
        _maxReleaseLimit = newMaxReleaseLimit;
    }

    /**
     * @dev returns the maximum amount of tokens that can be released in one transaction
     *
     * @return the maximum amount of tokens that can be released in one transaction
     */
    function maxReleaseLimit() external view returns (uint256) {
        return _maxReleaseLimit;
    }

    /**
     * @dev sets the minimum amount of tokens that can be transferred in one transaction
     *
     * @param newMinLimit new minLimit
     */
    function setMinLimit(uint256 newMinLimit) external ownerOnly greaterThanZero(newMinLimit) {
        require(newMinLimit <= _maxLockLimit && newMinLimit <= _maxReleaseLimit, "ERR_INVALID_MIN_LIMIT");

        _minLimit = newMinLimit;
    }

    /**
     * @dev returns the minimum amount of tokens that can be transferred in one transaction
     *
     * @return the minimum amount of tokens that can be transferred in one transaction
     */
    function minLimit() external view returns (uint256) {
        return _minLimit;
    }

    /**
     * @dev returns the lock limit *after* the last transaction
     *
     * @return the lock limit *after* the last transaction
     */
    function prevLockLimit() external view returns (uint256) {
        return _prevLockLimit;
    }

    /**
     * @dev returns the release limit *after* the last transaction
     *
     * @return the release limit *after* the last transaction
     */
    function prevReleaseLimit() external view returns (uint256) {
        return _prevReleaseLimit;
    }

    /**
     * @dev sets how much the limit increases per block
     *
     * @param newLimitIncPerBlock new limitIncPerBlock
     */
    function setLimitIncPerBlock(uint256 newLimitIncPerBlock) external ownerOnly greaterThanZero(newLimitIncPerBlock) {
        _limitIncPerBlock = newLimitIncPerBlock;
    }

    /**
     * @dev returns how much the limit increases per block
     *
     * @return how much the limit increases per block
     */
    function limitIncPerBlock() external view returns (uint256) {
        return _limitIncPerBlock;
    }

    /**
     * @dev returns the block number of the last lock transaction
     *
     * @return the block number of the last lock transaction
     */
    function prevLockBlockNumber() external view returns (uint256) {
        return _prevLockBlockNumber;
    }

    /**
     * @dev returns the block number of the last release transaction
     *
     * @return the block number of the last release transaction
     */
    function prevReleaseBlockNumber() external view returns (uint256) {
        return _prevReleaseBlockNumber;
    }

    /**
     * @dev sets the minimum number of required reports to release tokens
     *
     * @param newMinRequiredReports new minRequiredReports
     */
    function setMinRequiredReports(uint8 newMinRequiredReports)
        external
        ownerOnly
        greaterThanZero(newMinRequiredReports)
    {
        _minRequiredReports = newMinRequiredReports;
    }

    /**
     * @dev returns the minimum number of required reports to release tokens
     *
     * @return the minimum number of required reports to release tokens
     */
    function minRequiredReports() external view returns (uint256) {
        return _minRequiredReports;
    }

    /**
     * @dev returns the BancorX token
     *
     * @return the returns the BancorX token
     */
    function token() external view override returns (IERC20) {
        return _token;
    }

    /**
     * @dev allows the owner to set/remove reporters
     *
     * @param reporter reporter whose status is to be set
     * @param active true if the reporter is approved, false otherwise
     */
    function setReporter(address reporter, bool active) external ownerOnly {
        _reporters[reporter] = active;
    }

    /**
     * @dev returns whether the provided address is reporter
     *
     * @param reporter the address to check
     *
     * @return whether the provided address is reporter
     */
    function reporters(address reporter) external view returns (bool) {
        return _reporters[reporter];
    }

    /**
     * @dev allows the owner enable/disable the xTransfer method
     *
     * @param enable true to enable, false to disable
     */
    function enableXTransfers(bool enable) external ownerOnly {
        _xTransfersEnabled = enable;
    }

    /**
     * @dev returns whether xTransfers are enabled
     *
     * @return whether xTransfers are enabled
     */
    function xTransfersEnabled() external view returns (bool) {
        return _xTransfersEnabled;
    }

    /**
     * @dev allows the owner enable/disable the reportTransaction method
     *
     * @param enable true to enable, false to disable
     */
    function enableReporting(bool enable) external ownerOnly {
        _reportingEnabled = enable;
    }

    /**
     * @dev returns whether reporting is enabled
     *
     * @return whether reporting is enabled
     */
    function reportingEnabled() external view returns (bool) {
        return _reportingEnabled;
    }

    /**
     * @dev returns a transaction corresponding to provided txId
     *
     * @param txId transaction ID
     *
     * @return a transaction corresponding to provided txId
     */
    function transactions(uint256 txId)
        external
        view
        returns (
            uint256,
            bytes32,
            address,
            uint8,
            bool
        )
    {
        Transaction memory transaction = _transactions[txId];

        return (
            transaction.amount,
            transaction.fromBlockchain,
            transaction.to,
            transaction.numOfReports,
            transaction.completed
        );
    }

    /**
     * @dev returns the transaction ID corresponding to provided xTransfer ID
     *
     * @param xTransferID xTransfer ID
     *
     * @return the transaction ID corresponding to provided xTransfer ID
     */
    function transactionIds(uint256 xTransferID) external view returns (uint256) {
        return _transactionIds[xTransferID];
    }

    /**
     * @dev returns whether a provided reported has already reported a txId
     *
     * @param txId the transaction ID to check
     * @param reporter the report to check
     *
     * @return whether a provided reported has already reported a txId
     */
    function transactionIds(uint256 txId, address reporter) external view returns (bool) {
        return _reportedTxs[txId][reporter];
    }

    /**
     * @dev upgrades the contract to the latest version
     * can only be called by the owner
     * note that the owner needs to call acceptOwnership on the new contract after the upgrade
     *
     * @param newReporters new list of reporters
     */
    function upgrade(address[] memory newReporters) external ownerOnly {
        IBancorXUpgrader bancorXUpgrader = IBancorXUpgrader(addressOf(BANCOR_X_UPGRADER));

        transferOwnership(address(bancorXUpgrader));

        bancorXUpgrader.upgrade(VERSION, newReporters);

        acceptOwnership();
    }

    /**
     * @dev claims tokens from msg.sender to be converted to tokens on another blockchain
     *
     * @param toBlockchain blockchain on which tokens will be issued
     * @param to address to send the tokens to
     * @param amount the amount of tokens to transfer
     */
    function xTransfer(
        bytes32 toBlockchain,
        bytes32 to,
        uint256 amount
    ) external xTransfersAllowed {
        // get the current lock limit
        uint256 currentLockLimit = getCurrentLockLimit();

        // verify lock limit
        require(_minLimit <= amount && amount <= currentLockLimit, "ERR_AMOUNT_TOO_HIGH");

        lockTokens(amount);

        // set the previous lock limit and block number
        _prevLockLimit = currentLockLimit.sub(amount);
        _prevLockBlockNumber = block.number;

        // emit XTransfer event with id of 0
        emit XTransfer(msg.sender, toBlockchain, to, amount, 0);
    }

    /**
     * @dev claims tokens from msg.sender to be converted to tokens on another blockchain
     *
     * @param toBlockchain blockchain on which tokens will be issued
     * @param to address to send the tokens to
     * @param amount the amount of tokens to transfer
     * @param id pre-determined unique (if non zero) id which refers to this transaction
     */
    function xTransfer(
        bytes32 toBlockchain,
        bytes32 to,
        uint256 amount,
        uint256 id
    ) external override xTransfersAllowed {
        // get the current lock limit
        uint256 currentLockLimit = getCurrentLockLimit();

        // require that; minLimit <= amount <= currentLockLimit
        require(amount >= _minLimit && amount <= currentLockLimit, "ERR_AMOUNT_TOO_HIGH");

        lockTokens(amount);

        // set the previous lock limit and block number
        _prevLockLimit = currentLockLimit.sub(amount);
        _prevLockBlockNumber = block.number;

        // emit XTransfer event
        emit XTransfer(msg.sender, toBlockchain, to, amount, id);
    }

    /**
     * @dev allows reporter to report transaction which occurred on another blockchain
     *
     * @param fromBlockchain  blockchain in which tokens were destroyed
     * @param txId transactionId of transaction thats being reported
     * @param to address to receive tokens
     * @param amount amount of tokens destroyed on another blockchain
     * @param xTransferId unique (if non zero) pre-determined id (unlike txId which is determined after the transactions been mined)
     */
    function reportTx(
        bytes32 fromBlockchain,
        uint256 txId,
        address to,
        uint256 amount,
        uint256 xTransferId
    ) external reporterOnly reportingAllowed validAddress(to) greaterThanZero(amount) {
        // require that the transaction has not been reported yet by the reporter
        require(!_reportedTxs[txId][msg.sender], "ERR_ALREADY_REPORTED");

        // set reported as true
        _reportedTxs[txId][msg.sender] = true;

        Transaction storage txn = _transactions[txId];

        // If the caller is the first reporter, set the transaction details
        if (txn.numOfReports == 0) {
            txn.to = to;
            txn.amount = amount;
            txn.fromBlockchain = fromBlockchain;

            if (xTransferId != 0) {
                // verify uniqueness of xTransfer id to prevent overwriting
                require(_transactionIds[xTransferId] == 0, "ERR_TX_ALREADY_EXISTS");
                _transactionIds[xTransferId] = txId;
            }
        } else {
            // otherwise, verify transaction details
            require(txn.to == to && txn.amount == amount && txn.fromBlockchain == fromBlockchain, "ERR_TX_MISMATCH");

            if (xTransferId != 0) {
                require(_transactionIds[xTransferId] == txId, "ERR_TX_ALREADY_EXISTS");
            }
        }

        // increment the number of reports
        txn.numOfReports++;

        emit TxReport(msg.sender, fromBlockchain, txId, to, amount, xTransferId);

        // if theres enough reports, try to release tokens
        if (txn.numOfReports >= _minRequiredReports) {
            require(!_transactions[txId].completed, "ERR_TX_ALREADY_COMPLETED");

            // set the transaction as completed
            _transactions[txId].completed = true;

            emit XTransferComplete(to, xTransferId);

            releaseTokens(to, amount);
        }
    }

    /**
     * @dev gets x transfer amount by xTransferId (not txId)
     *
     * @param xTransferId unique (if non zero) pre-determined id (unlike txId which is determined after the transactions been broadcasted)
     * @param receiver address corresponding to xTransferId
     *
     * @return amount that was sent in xTransfer corresponding to xTransferId
     */
    function getXTransferAmount(uint256 xTransferId, address receiver) public view override returns (uint256) {
        // xTransferId -> txId -> Transaction
        Transaction memory transaction = _transactions[_transactionIds[xTransferId]];

        // verify that the xTransferId is for receiver
        require(transaction.to == receiver, "ERR_TX_MISMATCH");

        return transaction.amount;
    }

    /**
     * @dev method for calculating current lock limit
     *
     * @return the current maximum limit of tokens that can be locked
     */
    function getCurrentLockLimit() public view returns (uint256) {
        // prevLockLimit + ((currBlockNumber - prevLockBlockNumber) * limitIncPerBlock)
        uint256 currentLockLimit =
            _prevLockLimit.add(((block.number).sub(_prevLockBlockNumber)).mul(_limitIncPerBlock));
        if (currentLockLimit > _maxLockLimit) {
            return _maxLockLimit;
        }

        return currentLockLimit;
    }

    /**
     * @dev method for calculating current release limit
     *
     * @return the current maximum limit of tokens that can be released
     */
    function getCurrentReleaseLimit() public view returns (uint256) {
        // prevReleaseLimit + ((currBlockNumber - prevReleaseBlockNumber) * limitIncPerBlock)
        uint256 currentReleaseLimit =
            _prevReleaseLimit.add(((block.number).sub(_prevReleaseBlockNumber)).mul(_limitIncPerBlock));
        if (currentReleaseLimit > _maxReleaseLimit) {
            return _maxReleaseLimit;
        }

        return currentReleaseLimit;
    }

    /**
     * @dev claims and locks tokens from msg.sender to be converted to tokens on another blockchain
     *
     * @param amount the amount of tokens to lock
     */
    function lockTokens(uint256 amount) private {
        _token.safeTransferFrom(msg.sender, address(this), amount);

        emit TokensLock(msg.sender, amount);
    }

    /**
     * @dev private method to release tokens held by the contract
     *
     * @param to the address to release tokens to
     * @param amount the amount of tokens to release
     */
    function releaseTokens(address to, uint256 amount) private {
        // get the current release limit
        uint256 currentReleaseLimit = getCurrentReleaseLimit();

        require(amount >= _minLimit && amount <= currentReleaseLimit, "ERR_AMOUNT_TOO_HIGH");

        // update the previous release limit and block number
        _prevReleaseLimit = currentReleaseLimit.sub(amount);
        _prevReleaseBlockNumber = block.number;

        // no need to require, reverts on failure
        _token.safeTransfer(to, amount);

        emit TokensRelease(to, amount);
    }
}

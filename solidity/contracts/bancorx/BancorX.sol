// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/drafts/ERC20Permit.sol";
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

    uint16 public constant version = 4;

    uint256 public maxLockLimit; // the maximum amount of tokens that can be locked in one transaction
    uint256 public maxReleaseLimit; // the maximum amount of tokens that can be released in one transaction
    uint256 public minLimit; // the minimum amount of tokens that can be transferred in one transaction
    uint256 public prevLockLimit; // the lock limit *after* the last transaction
    uint256 public prevReleaseLimit; // the release limit *after* the last transaction
    uint256 public limitIncPerBlock; // how much the limit increases per block
    uint256 public prevLockBlockNumber; // the block number of the last lock transaction
    uint256 public prevReleaseBlockNumber; // the block number of the last release transaction
    uint8 public minRequiredReports; // minimum number of required reports to release tokens

    IERC20 public override token; // erc20 token

    bool public xTransfersEnabled = true; // true if x transfers are enabled, false if not
    bool public reportingEnabled = true; // true if reporting is enabled, false if not

    // txId -> Transaction
    mapping(uint256 => Transaction) public transactions;

    // xTransferId -> txId
    mapping(uint256 => uint256) public transactionIds;

    // txId -> reporter -> true if reporter already reported txId
    mapping(uint256 => mapping(address => bool)) public reportedTxs;

    // address -> true if address is reporter
    mapping(address => bool) public reporters;

    /**
     * @dev triggered when tokens are locked in smart contract
     *
     * @param _from    wallet address that the tokens are locked from
     * @param _amount  amount locked
     */
    event TokensLock(address indexed _from, uint256 _amount);

    /**
     * @dev triggered when tokens are released by the smart contract
     *
     * @param _to      wallet address that the tokens are released to
     * @param _amount  amount released
     */
    event TokensRelease(address indexed _to, uint256 _amount);

    /**
     * @dev triggered when xTransfer is successfully called
     *
     * @param _from            wallet address that initiated the xtransfer
     * @param _toBlockchain    target blockchain
     * @param _to              target wallet
     * @param _amount          transfer amount
     * @param _id              xtransfer id
     */
    event XTransfer(address indexed _from, bytes32 _toBlockchain, bytes32 indexed _to, uint256 _amount, uint256 _id);

    /**
     * @dev triggered when report is successfully submitted
     *
     * @param _reporter        reporter wallet
     * @param _fromBlockchain  source blockchain
     * @param _txId            tx id on the source blockchain
     * @param _to              target wallet
     * @param _amount          transfer amount
     * @param _xTransferId     xtransfer id
     */
    event TxReport(
        address indexed _reporter,
        bytes32 _fromBlockchain,
        uint256 _txId,
        address _to,
        uint256 _amount,
        uint256 _xTransferId
    );

    /**
     * @dev triggered when final report is successfully submitted
     *
     * @param _to  target wallet
     * @param _id  xtransfer id
     */
    event XTransferComplete(address _to, uint256 _id);

    /**
     * @dev initializes a new BancorX instance
     *
     * @param _maxLockLimit          maximum amount of tokens that can be locked in one transaction
     * @param _maxReleaseLimit       maximum amount of tokens that can be released in one transaction
     * @param _minLimit              minimum amount of tokens that can be transferred in one transaction
     * @param _limitIncPerBlock      how much the limit increases per block
     * @param _minRequiredReports    minimum number of reporters to report transaction before tokens can be released
     * @param _registry              address of contract registry
     * @param _token                 erc20 token
     */
    constructor(
        uint256 _maxLockLimit,
        uint256 _maxReleaseLimit,
        uint256 _minLimit,
        uint256 _limitIncPerBlock,
        uint8 _minRequiredReports,
        IContractRegistry _registry,
        IERC20 _token
    )
        public
        ContractRegistryClient(_registry)
        greaterThanZero(_maxLockLimit)
        greaterThanZero(_maxReleaseLimit)
        greaterThanZero(_minLimit)
        greaterThanZero(_limitIncPerBlock)
        greaterThanZero(_minRequiredReports)
        validExternalAddress(address(_token))
    {
        // validate input
        require(_minLimit <= _maxLockLimit && _minLimit <= _maxReleaseLimit, "ERR_INVALID_MIN_LIMIT");

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

        token = _token;
    }

    // validates that the caller is a reporter
    modifier reporterOnly {
        _reporterOnly();
        _;
    }

    // error message binary size optimization
    function _reporterOnly() internal view {
        require(reporters[msg.sender], "ERR_ACCESS_DENIED");
    }

    // allows execution only when x transfers are enabled
    modifier xTransfersAllowed {
        _xTransfersAllowed();
        _;
    }

    // error message binary size optimization
    function _xTransfersAllowed() internal view {
        require(xTransfersEnabled, "ERR_DISABLED");
    }

    // allows execution only when reporting is enabled
    modifier reportingAllowed {
        _reportingAllowed();
        _;
    }

    // error message binary size optimization
    function _reportingAllowed() internal view {
        require(reportingEnabled, "ERR_DISABLED");
    }

    /**
     * @dev setter
     *
     * @param _maxLockLimit    new maxLockLimit
     */
    function setMaxLockLimit(uint256 _maxLockLimit) public ownerOnly greaterThanZero(_maxLockLimit) {
        maxLockLimit = _maxLockLimit;
    }

    /**
     * @dev setter
     *
     * @param _maxReleaseLimit    new maxReleaseLimit
     */
    function setMaxReleaseLimit(uint256 _maxReleaseLimit) public ownerOnly greaterThanZero(_maxReleaseLimit) {
        maxReleaseLimit = _maxReleaseLimit;
    }

    /**
     * @dev setter
     *
     * @param _minLimit    new minLimit
     */
    function setMinLimit(uint256 _minLimit) public ownerOnly greaterThanZero(_minLimit) {
        // validate input
        require(_minLimit <= maxLockLimit && _minLimit <= maxReleaseLimit, "ERR_INVALID_MIN_LIMIT");

        minLimit = _minLimit;
    }

    /**
     * @dev setter
     *
     * @param _limitIncPerBlock    new limitIncPerBlock
     */
    function setLimitIncPerBlock(uint256 _limitIncPerBlock) public ownerOnly greaterThanZero(_limitIncPerBlock) {
        limitIncPerBlock = _limitIncPerBlock;
    }

    /**
     * @dev setter
     *
     * @param _minRequiredReports    new minRequiredReports
     */
    function setMinRequiredReports(uint8 _minRequiredReports) public ownerOnly greaterThanZero(_minRequiredReports) {
        minRequiredReports = _minRequiredReports;
    }

    /**
     * @dev allows the owner to set/remove reporters
     *
     * @param _reporter    reporter whos status is to be set
     * @param _active      true if the reporter is approved, false otherwise
     */
    function setReporter(address _reporter, bool _active) public ownerOnly {
        reporters[_reporter] = _active;
    }

    /**
     * @dev allows the owner enable/disable the xTransfer method
     *
     * @param _enable     true to enable, false to disable
     */
    function enableXTransfers(bool _enable) public ownerOnly {
        xTransfersEnabled = _enable;
    }

    /**
     * @dev allows the owner enable/disable the reportTransaction method
     *
     * @param _enable     true to enable, false to disable
     */
    function enableReporting(bool _enable) public ownerOnly {
        reportingEnabled = _enable;
    }

    /**
     * @dev upgrades the contract to the latest version
     * can only be called by the owner
     * note that the owner needs to call acceptOwnership on the new contract after the upgrade
     *
     * @param _reporters    new list of reporters
     */
    function upgrade(address[] memory _reporters) public ownerOnly {
        IBancorXUpgrader bancorXUpgrader = IBancorXUpgrader(addressOf(BANCOR_X_UPGRADER));

        transferOwnership(address(bancorXUpgrader));
        bancorXUpgrader.upgrade(version, _reporters);
        acceptOwnership();
    }

    /**
     * @dev claims tokens from msg.sender to be converted to tokens on another blockchain
     *
     * @param _toBlockchain    blockchain on which tokens will be issued
     * @param _to              address to send the tokens to
     * @param _amount          the amount of tokens to transfer
     */
    function xTransfer(
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _amount
    ) public xTransfersAllowed {
        // get the current lock limit
        uint256 currentLockLimit = getCurrentLockLimit();

        // verify lock limit
        require(_amount >= minLimit && _amount <= currentLockLimit, "ERR_AMOUNT_TOO_HIGH");

        lockTokens(msg.sender, _amount);

        // set the previous lock limit and block number
        prevLockLimit = currentLockLimit.sub(_amount);
        prevLockBlockNumber = block.number;

        // emit XTransfer event with id of 0
        emit XTransfer(msg.sender, _toBlockchain, _to, _amount, 0);
    }

    /**
     * @dev claims tokens from msg.sender to be converted to tokens on another blockchain
     *
     * @param _toBlockchain    blockchain on which tokens will be issued
     * @param _to              address to send the tokens to
     * @param _amount          the amount of tokens to transfer
     * @param _id              pre-determined unique (if non zero) id which refers to this transaction
     */
    function xTransfer(
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _amount,
        uint256 _id
    ) public override xTransfersAllowed {
        // get the current lock limit
        uint256 currentLockLimit = getCurrentLockLimit();

        // require that; minLimit <= _amount <= currentLockLimit
        require(_amount >= minLimit && _amount <= currentLockLimit, "ERR_AMOUNT_TOO_HIGH");

        lockTokens(msg.sender, _amount);

        // set the previous lock limit and block number
        prevLockLimit = currentLockLimit.sub(_amount);
        prevLockBlockNumber = block.number;

        // emit XTransfer event
        emit XTransfer(msg.sender, _toBlockchain, _to, _amount, _id);
    }

    /**
     * @dev claims tokens from a signer (calculated from provided signature) to be converted to tokens on another blockchain
     *
     * @param _toBlockchain    blockchain on which tokens will be issued
     * @param _to              address to send the tokens to
     * @param _amount          the amount of tokens to transfer
     * @param _deadline        permit deadline
     * @param _signer          address to claim tokens from
     * @param _v               ECDSA signature recovery identifier
     * @param _r               ECDSA signature number
     * @param _s               ECDSA signature number
     * @param _id              pre-determined unique (if non zero) id which refers to this transaction
     */
    function xTransfer(
        bytes32 _toBlockchain,
        bytes32 _to,
        uint256 _amount,
        uint256 _deadline,
        address _signer,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        uint256 _id
    ) public xTransfersAllowed {
        // get the current lock limit
        uint256 currentLockLimit = getCurrentLockLimit();

        // require that; minLimit <= _amount <= currentLockLimit
        require(_amount >= minLimit && _amount <= currentLockLimit, "ERR_AMOUNT_NOT_IN_RANGE");

        // Permit function enables to give allowance to a spender, without a payment of the signer, due to the fact
        // that any account can call permit, provided that it has the signature (_v, _r, _s parameters).
        // Example: https://deweb-io.github.io/token/permit_demo.html
        ERC20Permit(address(token)).permit(_signer, address(this), _amount, _deadline, _v, _r, _s);

        lockTokens(_signer, _amount);

        // set the previous lock limit and block number
        prevLockLimit = currentLockLimit.sub(_amount);
        prevLockBlockNumber = block.number;

        // emit XTransfer event
        emit XTransfer(_signer, _toBlockchain, _to, _amount, _id);
    }

    /**
     * @dev allows reporter to report transaction which occured on another blockchain
     *
     * @param _fromBlockchain  blockchain in which tokens were destroyed
     * @param _txId            transactionId of transaction thats being reported
     * @param _to              address to receive tokens
     * @param _amount          amount of tokens destroyed on another blockchain
     * @param _xTransferId     unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been mined)
     */
    function reportTx(
        bytes32 _fromBlockchain,
        uint256 _txId,
        address _to,
        uint256 _amount,
        uint256 _xTransferId
    ) public reporterOnly reportingAllowed validAddress(_to) greaterThanZero(_amount) {
        // require that the transaction has not been reported yet by the reporter
        require(!reportedTxs[_txId][msg.sender], "ERR_ALREADY_REPORTED");

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
                require(transactionIds[_xTransferId] == 0, "ERR_TX_ALREADY_EXISTS");
                transactionIds[_xTransferId] = _txId;
            }
        } else {
            // otherwise, verify transaction details
            require(txn.to == _to && txn.amount == _amount && txn.fromBlockchain == _fromBlockchain, "ERR_TX_MISMATCH");

            if (_xTransferId != 0) {
                require(transactionIds[_xTransferId] == _txId, "ERR_TX_ALREADY_EXISTS");
            }
        }

        // increment the number of reports
        txn.numOfReports++;

        emit TxReport(msg.sender, _fromBlockchain, _txId, _to, _amount, _xTransferId);

        // if theres enough reports, try to release tokens
        if (txn.numOfReports >= minRequiredReports) {
            require(!transactions[_txId].completed, "ERR_TX_ALREADY_COMPLETED");

            // set the transaction as completed
            transactions[_txId].completed = true;

            emit XTransferComplete(_to, _xTransferId);

            releaseTokens(_to, _amount);
        }
    }

    /**
     * @dev gets x transfer amount by xTransferId (not txId)
     *
     * @param _xTransferId    unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been broadcasted)
     * @param _for            address corresponding to xTransferId
     *
     * @return amount that was sent in xTransfer corresponding to _xTransferId
     */
    function getXTransferAmount(uint256 _xTransferId, address _for) public view override returns (uint256) {
        // xTransferId -> txId -> Transaction
        Transaction memory transaction = transactions[transactionIds[_xTransferId]];

        // verify that the xTransferId is for _for
        require(transaction.to == _for, "ERR_TX_MISMATCH");

        return transaction.amount;
    }

    /**
     * @dev method for calculating current lock limit
     *
     * @return the current maximum limit of tokens that can be locked
     */
    function getCurrentLockLimit() public view returns (uint256) {
        // prevLockLimit + ((currBlockNumber - prevLockBlockNumber) * limitIncPerBlock)
        uint256 currentLockLimit = prevLockLimit.add(((block.number).sub(prevLockBlockNumber)).mul(limitIncPerBlock));
        if (currentLockLimit > maxLockLimit) {
            return maxLockLimit;
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
            prevReleaseLimit.add(((block.number).sub(prevReleaseBlockNumber)).mul(limitIncPerBlock));
        if (currentReleaseLimit > maxReleaseLimit) {
            return maxReleaseLimit;
        }

        return currentReleaseLimit;
    }

    /**
     * @dev claims and locks tokens from msg.sender to be converted to tokens on another blockchain
     *
     * @param _amount  the amount of tokens to lock
     */
    function lockTokens(address _sender, uint256 _amount) private {
        token.safeTransferFrom(_sender, address(this), _amount);

        emit TokensLock(_sender, _amount);
    }

    /**
     * @dev private method to release tokens held by the contract
     *
     * @param _to      the address to release tokens to
     * @param _amount  the amount of tokens to release
     */
    function releaseTokens(address _to, uint256 _amount) private {
        // get the current release limit
        uint256 currentReleaseLimit = getCurrentReleaseLimit();

        require(_amount >= minLimit && _amount <= currentReleaseLimit, "ERR_AMOUNT_TOO_HIGH");

        // update the previous release limit and block number
        prevReleaseLimit = currentReleaseLimit.sub(_amount);
        prevReleaseBlockNumber = block.number;

        // no need to require, reverts on failure
        token.safeTransfer(_to, _amount);

        emit TokensRelease(_to, _amount);
    }
}

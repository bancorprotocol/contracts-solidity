// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/ITokenTimeWeightedAverage.sol";

import "../utility/Types.sol";
import "../utility/SafeMath.sol";
import "../utility/Math.sol";
import "../utility/Utils.sol";
import "../utility/Time.sol";

/**
 * @dev Token Time-Weighted Average contract
 */
contract TokenTimeWeightedAverage is ITokenTimeWeightedAverage, AccessControl, Utils, Time {
    using SafeMath for uint256;

    struct TokenData {
        uint256 firstSampleTime;
        uint256 lastSampleTime;
        uint256 prevAccumulatorUpdateTime;
        Fraction prevAccumulator;
        mapping(uint256 => Fraction) accumulators;
        mapping(uint256 => bool) timestamps;
    }

    uint256 private constant INITIAL_SAMPLE_N = 0;
    uint256 private constant INITIAL_SAMPLE_D = 1;
    uint256 private constant MAX_UINT128 = 2**128 - 1;

    mapping(IERC20Token => TokenData) private data;

    // the owner role is used to add values to the accumulator, but it can't update them
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    // the seeder roles is used to seed the accumulator with past values
    bytes32 public constant ROLE_SEEDER = keccak256("ROLE_SEEDER");

    /**
     * @dev triggered when an accumulator for a specific token is being initialized
     *
     * @param _token the token the data is accumulated for=
     * @param _startTime the accumulation starting time
     */
    event Initialized(IERC20Token indexed _token, uint256 _startTime);

    /**
     * @dev triggered when a new sample is being added
     *
     * @param _token the token the data is accumulated for
     * @param _n ratio numerator
     * @param _d ratio denominator
     * @param _time the sampling timestamp
     */
    event SampleAdded(IERC20Token indexed _token, uint256 _n, uint256 _d, uint256 _time);

    constructor() public {
        // set up administrative roles.
        _setRoleAdmin(ROLE_OWNER, ROLE_OWNER);
        _setRoleAdmin(ROLE_SEEDER, ROLE_OWNER);

        // allow the deployer to initially govern the contract.
        _setupRole(ROLE_OWNER, msg.sender);
    }

    modifier initialized(IERC20Token _token) {
        _initialized(_token);
        _;
    }

    // error message binary size optimization
    function _initialized(IERC20Token _token) internal view {
        require(isInitialized(_token), "ERR_NOT_INITIALIZED");
    }

    /**
     * @dev initializes the accumulator for a specific token
     * can only be called by an owner or a seeder
     *
     * @param _token the token the data is accumulated for
     * @param _startTime the accumulation starting time
     */
    function initialize(IERC20Token _token, uint256 _startTime) external override validAddress(address(_token)) {
        require(hasRole(ROLE_OWNER, msg.sender) || hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");
        require(_startTime <= time(), "ERR_INVALID_TIME");

        // make sure that we're not attempting to initialize the accumulator twice
        require(!isInitialized(_token), "ERR_ALREADY_INITIALIZED");

        addSample(_token, Fraction({ n: INITIAL_SAMPLE_N, d: INITIAL_SAMPLE_D }), _startTime);

        emit Initialized(_token, _startTime);
    }

    /**
     * @dev adds a new sample to the accumulator
     * can only be called by an owner
     *
     * @param _token the token the data is accumulated for
     * @param _n ratio numerator
     * @param _d ratio denominator
     */
    function addSample(
        IERC20Token _token,
        uint256 _n,
        uint256 _d
    ) external override validAddress(address(_token)) greaterThanZero(_d) initialized(_token) {
        require(hasRole(ROLE_OWNER, msg.sender), "ERR_ACCESS_DENIED");

        addSample(_token, Fraction({ n: _n, d: _d }), time());
    }

    /**
     * @dev adds a past sample to the accumulator
     * can only be called by a seeder to add past samples
     *
     * @param _token the token the data is accumulated for
     * @param _n ratio numerator
     * @param _d ratio denominator
     * @param _time the sampling timestamp
     */
    function addPastSample(
        IERC20Token _token,
        uint256 _n,
        uint256 _d,
        uint256 _time
    ) external override validAddress(address(_token)) greaterThanZero(_d) initialized(_token) {
        require(hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");
        require(_time < time(), "ERR_INVALID_TIME");

        addSample(_token, Fraction({ n: _n, d: _d }), _time);
    }

    /**
     * @dev adds past sample to the accumulator
     * can only be called by a seeder to add past samples
     *
     * @param _token the token the data is accumulated for
     * @param _ns ratio numerators
     * @param _ds ratio denominators
     * @param _times sampling timestamps
     */
    function addPastSamples(
        IERC20Token _token,
        uint256[] calldata _ns,
        uint256[] calldata _ds,
        uint256[] calldata _times
    ) external override validAddress(address(_token)) initialized(_token) {
        require(hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");

        uint256 length = _ns.length;
        require(length == _ds.length && length == _times.length, "ERR_INVALID_LENGTH");

        for (uint256 i = 0; i < length; ++i) {
            uint256 n = _ns[i];
            uint256 d = _ds[i];
            uint256 t = _times[i];

            _greaterThanZero(d);
            require(t < time(), "ERR_INVALID_TIME");

            addSample(_token, Fraction({ n: n, d: d }), t);
        }
    }

    /**
     * @dev calculated the TWA from a specific sample time
     *
     * @param _token the token the data is accumulated for
     * @param _startTime the sampling starting time
     *
     * @return TWA's numerator and denominator
     */
    function timeWeightedAverage(IERC20Token _token, uint256 _startTime)
        external
        view
        override
        validAddress(address(_token))
        returns (uint256, uint256)
    {
        TokenData storage tokenData = data[_token];
        require(tokenData.timestamps[_startTime], "ERR_NO_DATA");

        return timeWeightedAverage(tokenData, _startTime, tokenData.lastSampleTime);
    }

    /**
     * @dev calculated the TWA between to specific sample times
     *
     * @param _token the token the data is accumulated for
     * @param _startTime the sampling starting time
     * @param _endTime the sampling ending time
     *
     * @return TWA's numerator and denominator
     */
    function timeWeightedAverage(
        IERC20Token _token,
        uint256 _startTime,
        uint256 _endTime
    ) external view override validAddress(address(_token)) returns (uint256, uint256) {
        require(_startTime < _endTime, "ERR_INVALID_TIME");

        TokenData storage tokenData = data[_token];
        require(tokenData.timestamps[_startTime] && tokenData.timestamps[_endTime], "ERR_NO_DATA");

        return timeWeightedAverage(tokenData, _startTime, _endTime);
    }

    /**
     * @dev calculated the TWA between to specific sample times
     *
     * @param _tokenData the token accumulation data
     * @param _startTime the sampling starting time
     * @param _endTime the sampling ending time
     *
     * @return TWA's numerator and denominator
     */
    function timeWeightedAverage(
        TokenData storage _tokenData,
        uint256 _startTime,
        uint256 _endTime
    ) private view returns (uint256, uint256) {
        Fraction memory endAccumulator = _tokenData.accumulators[_endTime];

        // if we have received only a single sample - just return it
        if (_tokenData.firstSampleTime == _endTime) {
            return (endAccumulator.n, endAccumulator.d);
        }

        Fraction memory startAccumulator = _tokenData.accumulators[_startTime];

        // TWA = (endAccumulator - startAccumulator) / (_endTime - _startTime)
        uint256 n = (startAccumulator.d.mul(endAccumulator.n).sub(endAccumulator.d.mul(startAccumulator.n))).div(
            _endTime.sub(_startTime)
        );
        uint256 d = endAccumulator.d.mul(startAccumulator.d);
        (n, d) = Math.reducedRatio(n, d, MAX_UINT128);

        return (n, d);
    }

    /**
     * @dev returns an accumulator for a specific token
     *
     * @param _token the token the data is accumulated for
     * @param _time the sampling time
     *
     * @return sample's numerator and denominator
     */
    function accumulator(IERC20Token _token, uint256 _time)
        external
        view
        override
        validAddress(address(_token))
        returns (uint256, uint256)
    {
        TokenData storage tokenData = data[_token];
        require(tokenData.timestamps[_time], "ERR_NO_DATA");

        Fraction memory s = tokenData.accumulators[_time];
        return (s.n, s.d);
    }

    /**
     * @dev returns whether a specific sample exists
     *
     * @param _token the token the data is accumulated for
     * @param _time the sampling time
     *
     * @return whether the sample exists
     */
    function sampleExists(IERC20Token _token, uint256 _time)
        external
        view
        override
        validAddress(address(_token))
        returns (bool)
    {
        TokenData storage tokenData = data[_token];

        return tokenData.timestamps[_time];
    }

    /**
     * @dev returns the first and the last sample times
     *
     * @param _token the token the data is accumulated for
     *
     * @return the first and the last sample times
     */
    function sampleRange(IERC20Token _token) external view override returns (uint256, uint256) {
        TokenData memory tokenData = data[_token];

        return (tokenData.firstSampleTime, tokenData.lastSampleTime);
    }

    /**
     * @dev adds a new sample to the accumulator
     * can only be called by a seeder
     *
     * @param _token the token the data is accumulated for
     * @param _sample the sample to add
     * @param _time the sampling timestamp
     */
    function addSample(
        IERC20Token _token,
        Fraction memory _sample,
        uint256 _time
    ) private {
        TokenData storage tokenData = data[_token];
        uint256 lastSampleTime = tokenData.lastSampleTime;

        // make sure that the samples are added in the correct order
        require(_time >= lastSampleTime, "ERR_WRONG_ORDER");

        // if this is the initialization sample for this contract, set it as the first sample and return
        if (tokenData.firstSampleTime == 0) {
            tokenData.firstSampleTime = _time;
            tokenData.lastSampleTime = _time;

            tokenData.accumulators[_time] = _sample;
            tokenData.timestamps[_time] = true;

            emit SampleAdded(_token, _sample.n, _sample.d, _time);

            return;
        }

        Fraction memory lastAccumulator = tokenData.accumulators[lastSampleTime];

        // update the previous accumulator value once per-block. we would need it in order to accumulate
        // same-block changes
        if (_time > tokenData.prevAccumulatorUpdateTime) {
            tokenData.prevAccumulatorUpdateTime = _time;
            tokenData.prevAccumulator = lastAccumulator;
        }

        // if we already have a sample for this timestamp - use the backup of the previous accumulator and use it in
        // combination with the new sample
        if (_time == lastSampleTime) {
            lastAccumulator = tokenData.prevAccumulator;
        }

        // accumulate the current value in combination with the last accumulator using the TWA formuls:
        //  ACC[time] = ACC[time - timeDiff] + value * timeDiff
        uint256 n = _sample.d.mul(lastAccumulator.n).add(
            _sample.n.mul(lastAccumulator.d).mul(_time.sub(lastSampleTime))
        );
        uint256 d = _sample.d.mul(lastAccumulator.d);
        (n, d) = Math.reducedRatio(n, d, MAX_UINT128);

        tokenData.accumulators[_time] = Fraction({ n: n, d: d });
        tokenData.timestamps[_time] = true;
        tokenData.lastSampleTime = _time;

        emit SampleAdded(_token, _sample.n, _sample.d, _time);
    }

    /**
     * @dev checks whether the accumulator is initialized for a specific token
     *
     * @param _token the token the data is accumulated for
     *
     * @return whether the accumulator is initialized for a specific token
     */
    function isInitialized(IERC20Token _token) private view returns (bool) {
        TokenData storage tokenData = data[_token];
        uint256 firstSampleTime = tokenData.firstSampleTime;

        Fraction memory firstAccumulator = tokenData.accumulators[firstSampleTime];
        return firstSampleTime > 0 && firstAccumulator.n == INITIAL_SAMPLE_N && firstAccumulator.d == INITIAL_SAMPLE_D;
    }
}

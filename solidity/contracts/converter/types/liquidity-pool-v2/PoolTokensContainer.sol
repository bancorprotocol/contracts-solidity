pragma solidity 0.4.26;
import "./interfaces/IPoolTokensContainer.sol";
import "../../../utility/Owned.sol";
import "../../../utility/TokenHolder.sol";
import "../../../token/SmartToken.sol";

/**
  * @dev The PoolTokensContainer contract serves as a container for multiple pool tokens.
  * It is used by specific liquidity pool types that require more than a single pool token,
  * while still maintaining the single converter / anchor relationship.
  *
  * It maintains and provides a list of the underlying pool tokens.
 */
contract PoolTokensContainer is IPoolTokensContainer, Owned, TokenHolder {
    uint8 internal constant MAX_POOL_TOKENS = 5;    // maximum pool tokens in the container

    string public name;                 // pool name
    string public symbol;               // pool symbol
    uint8 public decimals;              // underlying pool tokens decimals
    ISmartToken[] private _poolTokens;  // underlying pool tokens

    /**
      * @dev initializes a new PoolTokensContainer instance
      *
      * @param  _name       pool name, also used as a prefix for the underlying pool token names
      * @param  _symbol     pool symbol, also used as a prefix for the underlying pool token symbols
      * @param  _decimals   used for the underlying pool token decimals
    */
    constructor(string _name, string _symbol, uint8 _decimals) public {
         // validate input
        require(bytes(_name).length > 0, "ERR_INVALID_NAME");
        require(bytes(_symbol).length > 0, "ERR_INVALID_SYMBOL");

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    /**
      * @dev returns the list of pool tokens
      *
      * @return list of pool tokens
    */
    function poolTokens() public view returns (ISmartToken[] memory) {
        return _poolTokens;
    }

    /**
      * @dev creates a new pool token and adds it to the list
      *
      * @return new pool token address
    */
    function createToken() public ownerOnly returns (ISmartToken) {
        // verify that the max limit wasn't reached
        require(_poolTokens.length < MAX_POOL_TOKENS, "ERR_MAX_LIMIT_REACHED");

        string memory poolName = concatStrDigit(name, uint8(_poolTokens.length + 1));
        string memory poolSymbol = concatStrDigit(symbol, uint8(_poolTokens.length + 1));

        SmartToken token = new SmartToken(poolName, poolSymbol, decimals);
        _poolTokens.push(token);
        return token;
    }

    /**
      * @dev increases the pool token supply and sends the new tokens to the given account
      * can only be called by the contract owner
      *
      * @param _token   pool token address
      * @param _to      account to receive the newly minted tokens
      * @param _amount  amount to mint
    */
    function mint(ISmartToken _token, address _to, uint256 _amount) public ownerOnly {
        _token.issue(_to, _amount);
    }

    /**
      * @dev removes tokens from the given account and decreases the pool token supply
      * can only be called by the contract owner
      *
      * @param _token   pool token address
      * @param _from    account to remove the tokens from
      * @param _amount  amount to burn
    */
    function burn(ISmartToken _token, address _from, uint256 _amount) public ownerOnly {
        _token.destroy(_from, _amount);
    }

    /**
      * @dev concatenates a string and a digit (single only) and returns the result string
      *
      * @param _str     string
      * @param _digit   digit
      * @return concatenated string
    */
    function concatStrDigit(string _str, uint8 _digit) private pure returns (string) {
        return string(abi.encodePacked(_str, uint8(bytes1('0')) + _digit));
    }
}

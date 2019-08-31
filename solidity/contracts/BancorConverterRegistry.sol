pragma solidity ^0.4.24;
import './utility/Owned.sol';
import './utility/Utils.sol';

/**
  * @dev Bancor Converter Registry
  * 
  * The Bancor Converter Registry keeps converter addresses by token addresses and vice versa. The owner can update converter addresses so that the token address always points to the updated list of converters for each token. 
  * 
  * The contract is also able to iterate through all the tokens in the network. 
  * 
  * Note that converter addresses for each token are returned in ascending order (from oldest to newest).
  * 
*/
contract BancorConverterRegistry is Owned, Utils {
    mapping (address => bool) private tokensRegistered;         // token address -> registered or not
    mapping (address => address[]) private tokensToConverters;  // token address -> converter addresses
    mapping (address => address) private convertersToTokens;    // converter address -> token address
    address[] public tokens;                                    // list of all token addresses

    /**
      * @dev triggered when a converter is added to the registry
      * 
      * @param _token   token
      * @param _address converter
    */
    event ConverterAddition(address indexed _token, address _address);

    /**
      * @dev triggered when a converter is removed from the registry
      * 
      * @param _token   token
      * @param _address converter
    */
    event ConverterRemoval(address indexed _token, address _address);

    /**
      * @dev initializes a new BancorConverterRegistry instance
    */
    constructor() public {
    }

    /**
      * @dev returns the number of tokens in the registry
      * 
      * @return number of tokens
    */
    function tokenCount() public view returns (uint256) {
        return tokens.length;
    }

    /**
      * @dev returns the number of converters associated with the given token
      * or 0 if the token isn't registered
      * 
      * @param _token   token address
      * 
      * @return number of converters
    */
    function converterCount(address _token) public view returns (uint256) {
        return tokensToConverters[_token].length;
    }

    /**
      * @dev returns the converter address associated with the given token
      * or zero address if no such converter exists
      * 
      * @param _token   token address
      * @param _index   converter index
      * 
      * @return converter address
    */
    function converterAddress(address _token, uint32 _index) public view returns (address) {
        if (_index >= tokensToConverters[_token].length)
            return address(0);

        return tokensToConverters[_token][_index];
    }

    /**
      * @dev returns the token address associated with the given converter
      * or zero address if no such converter exists
      * 
      * @param _converter   converter address
      * 
      * @return token address
    */
    function tokenAddress(address _converter) public view returns (address) {
        return convertersToTokens[_converter];
    }

    /**
      * @dev adds a new converter address for a given token to the registry
      * throws if the converter is already registered
      * 
      * @param _token       token address
      * @param _converter   converter address
    */
    function registerConverter(address _token, address _converter)
        public
        ownerOnly
        validAddress(_token)
        validAddress(_converter)
    {
        require(convertersToTokens[_converter] == address(0));

        // add the token to the list of tokens
        if (!tokensRegistered[_token]) {
            tokens.push(_token);
            tokensRegistered[_token] = true;
        }

        tokensToConverters[_token].push(_converter);
        convertersToTokens[_converter] = _token;

        // dispatch the converter addition event
        emit ConverterAddition(_token, _converter);
    }

    /**
      * @dev removes an existing converter from the registry
      * note that the function doesn't scale and might be needed to be called
      * multiple times when removing an older converter from a large converter list
      * 
      * @param _token   token address
      * @param _index   converter index
    */
    function unregisterConverter(address _token, uint32 _index)
        public
        ownerOnly
        validAddress(_token)
    {
        require(_index < tokensToConverters[_token].length);

        address converter = tokensToConverters[_token][_index];

        // move all newer converters 1 position lower
        for (uint32 i = _index + 1; i < tokensToConverters[_token].length; i++) {
            tokensToConverters[_token][i - 1] = tokensToConverters[_token][i];
        }

        // decrease the number of converters defined for the token by 1
        tokensToConverters[_token].length--;
        
        // removes the converter from the converters -> tokens list
        delete convertersToTokens[converter];

        // dispatch the converter removal event
        emit ConverterRemoval(_token, converter);
    }
}

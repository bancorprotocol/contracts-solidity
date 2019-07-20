pragma solidity ^0.4.24;

/**
    @dev Id definitions for bancor contracts

    Can be used in conjunction with the contract registry to get contract addresses
*/
contract ContractIds {
    // generic
    bytes32 public constant CONTRACT_FEATURES = "ContractFeatures";
    bytes32 public constant CONTRACT_REGISTRY = "ContractRegistry";
    bytes32 public constant NON_STANDARD_TOKEN_REGISTRY = "NonStandardTokenRegistry";

    // bancor logic
    bytes32 public constant BANCOR_NETWORK = "BancorNetwork";
    bytes32 public constant BANCOR_FORMULA = "BancorFormula";
    bytes32 public constant BANCOR_GAS_PRICE_LIMIT = "BancorGasPriceLimit";
    bytes32 public constant BANCOR_CONVERTER_UPGRADER = "BancorConverterUpgrader";
    bytes32 public constant BANCOR_CONVERTER_FACTORY = "BancorConverterFactory";

    // BNT core
    bytes32 public constant BNT_TOKEN = "BNTToken";
    bytes32 public constant BNT_CONVERTER = "BNTConverter";

    // BancorX
    bytes32 public constant BANCOR_X = "BancorX";
    bytes32 public constant BANCOR_X_UPGRADER = "BancorXUpgrader";
}

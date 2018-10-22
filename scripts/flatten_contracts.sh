#!/bin/bash
mkdir -p ~/workspace/flat-contracts
PROJECT_PATH=~/workspace/contracts/solidity
FLAT_CONTRACTS_PATH=~/workspace/flat-contracts

cd $PROJECT_PATH

truffle-flattener contracts/converter/BancorConverter.sol > $FLAT_CONTRACTS_PATH/BancorConverter.sol
truffle-flattener contracts/converter/BancorConverterUpgrader.sol > $FLAT_CONTRACTS_PATH/BancorConverterUpgrader.sol
truffle-flattener contracts/converter/BancorConverterFactory.sol > $FLAT_CONTRACTS_PATH/BancorConverterFactory.sol
truffle-flattener contracts/token/SmartToken.sol > $FLAT_CONTRACTS_PATH/SmartToken.sol


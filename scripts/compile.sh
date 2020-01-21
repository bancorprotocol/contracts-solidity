#!/bin/bash
solc="docker run -v $HOME/git/contracts/solidity:/solidity ethereum/solc:0.4.26"
CONTRACTS_PATH=../solidity/contracts
OUTPUT_PATH=../solidity/build
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/BancorNetwork.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/BancorNetworkPathFinder.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/bancorx/BancorX.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/bancorx/XTransferRerouter.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/converter/BancorConverter.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/converter/BancorConverterFactory.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/converter/BancorConverterRegistry.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/converter/BancorConverterRegistryData.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/converter/BancorConverterUpgrader.sol
$solc --optimize --optimize-runs 20000 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/converter/BancorFormula.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/legacy/BancorPriceFloor.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/crowdsale/CrowdsaleController.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/token/EtherToken.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/token/SmartToken.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/utility/ContractRegistry.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/utility/ContractFeatures.sol
$solc --optimize --optimize-runs 200 --abi --bin --allow-paths $CONTRACTS_PATH, -o $OUTPUT_PATH --overwrite $CONTRACTS_PATH/utility/Whitelist.sol

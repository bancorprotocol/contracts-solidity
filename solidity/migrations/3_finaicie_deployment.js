/* global artifacts */
/* eslint-disable prefer-reflect */

const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');

const EtherToken = artifacts.require('EtherToken.sol');

const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorNetwork = artifacts.require('BancorNetwork.sol');

const gasPrice = 22000000000;

module.exports = function(deployer, _network, _accounts) {
    let managedContracts;
    let contractRegistry;
    let contractIds;
    let bancorNetwork;
    return deployer
        .then(() => {
            if ( process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(EtherToken);
            }
        })
        .then(() => {
            if ( process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(FinanciePlatformToken, 'PF Token', 'ERC PF', 10000000000 * (10 ** 18));
            }
        })
        .then(() => {
            if ( process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(FinancieManagedContracts);
            }
        })
        .then((instance) => {
            managedContracts = instance;
            return managedContracts.activateTargetContract(process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS, true);
        })
        .then(() => {
            managedContracts.activateTargetContract(process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS, true);
        })
        .then(() => {
            if ( process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(FinancieNotifier,
                    process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ? FinancieManagedContracts.address : process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS,
                    process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS,
                    process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS
                );
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(ContractRegistry);
            }
        })
        .then((instance) => {
            contractRegistry = instance;
            return deployer.deploy(ContractIds);
        })
        .then((instance) => {
            contractIds = instance;
            return deployer.deploy(ContractFeatures);
        })
        .then(() => {
            return deployer.deploy(BancorGasPriceLimit, gasPrice);
        })
        .then(() => {
            return deployer.deploy(BancorFormula);
        })
        .then(() => {
            return deployer.deploy(BancorNetwork, ContractRegistry.address);
        })
        .then((instance) => {
            bancorNetwork = instance;
            return bancorNetwork.setSignerAddress(web3.eth.coinbase);
        })
        .then((instance) => {
            return bancorNetwork.registerEtherToken(process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS, true);
        })
        .then((instance) => {
            return contractIds.CONTRACT_FEATURES.call();
        })
        .then((contractFeaturesId) => {
            return contractRegistry.registerAddress(contractFeaturesId, ContractFeatures.address);
        })
        .then(() => {
            return contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        })
        .then((gasPriceLimitId) => {
            return contractRegistry.registerAddress(gasPriceLimitId, BancorGasPriceLimit.address);
        })
        .then(() => {
            return contractIds.BANCOR_FORMULA.call();
        })
        .then((formulaId) => {
            return contractRegistry.registerAddress(formulaId, BancorFormula.address);
        })
        .then(() => {
            return contractIds.BANCOR_NETWORK.call();
        })
        .then((bancorNetworkId) => {
            return contractRegistry.registerAddress(bancorNetworkId, BancorNetwork.address);
        })
        .then(() => {
            if ( process.env.FINANCIE_TICKET_STORE_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(FinancieTicketStore,
                    process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS === undefined ? FinancieNotifier.address : process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS,
                    process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ? FinancieManagedContracts.address : process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS,
                    process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS,
                    process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS
                );
            }
        })
};

/* global artifacts */
/* eslint-disable prefer-reflect */

const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const FinancieBancorConverterFactory = artifacts.require('FinancieBancorConverterFactory.sol');

const SmartToken = artifacts.require('SmartToken.sol');

const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const BancorConverterUpgrade = artifacts.require('BancorConverterUpgrader.sol');

const gasPrice = 22000000000;

module.exports = function(deployer, _network, _accounts) {
    let managedContracts;
    let contractRegistry;
    let contractIds;
    let bancorNetwork;
    return deployer
        .then(() => {
            if ( process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(SmartToken, "Fiat Token(JPY)", "JPYT", 18)
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
            if ( process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ) {
                managedContracts = instance;
                return managedContracts.activateTargetContract(process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS, true);
            }
        })
        .then(() => {
            if ( process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(FinancieNotifier,
                    process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ? FinancieManagedContracts.address : process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS,
                    process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS,
                    process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS === undefined ? SmartToken.address : process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS
                );
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(ContractRegistry);
            }
        })
        .then((instance) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                contractRegistry = instance;
                return deployer.deploy(ContractIds);
            }
        })
        .then((instance) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                contractIds = instance;
                return deployer.deploy(ContractFeatures);
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(BancorGasPriceLimit, gasPrice);
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(BancorFormula);
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(BancorNetwork, ContractRegistry.address);
            }
        })
        .then((instance) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                bancorNetwork = instance;
                return bancorNetwork.setSignerAddress(_accounts[0]);
            }
        })
        .then((instance) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return bancorNetwork.registerEtherToken(process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS === undefined ? SmartToken.address : process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS, true);
            }
        })
        .then((instance) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractIds.CONTRACT_FEATURES.call();
            }
        })
        .then((contractFeaturesId) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractRegistry.registerAddress(contractFeaturesId, ContractFeatures.address);
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractIds.BANCOR_GAS_PRICE_LIMIT.call();
            }
        })
        .then((gasPriceLimitId) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractRegistry.registerAddress(gasPriceLimitId, BancorGasPriceLimit.address);
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractIds.BANCOR_FORMULA.call();
            }
        })
        .then((formulaId) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractRegistry.registerAddress(formulaId, BancorFormula.address);
            }
        })
        .then(() => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractIds.BANCOR_NETWORK.call();
            }
        })
        .then((bancorNetworkId) => {
            if ( process.env.CONTRACT_REGISTRY_CONTRACT_ADDRESS === undefined ) {
                return contractRegistry.registerAddress(bancorNetworkId, BancorNetwork.address);
            }
        })
        .then(() => {
            if ( process.env.FINANCIE_TICKET_STORE_CONTRACT_ADDRESS === undefined ) {
                return deployer.deploy(FinancieTicketStore,
                    process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS === undefined ? FinancieNotifier.address : process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS,
                    process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ? FinancieManagedContracts.address : process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS,
                    process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS,
                    process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS === undefined ? SmartToken.address : process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS
                );
            }
        })
};

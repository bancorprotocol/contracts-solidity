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

module.exports = async(deployer) => {
    if ( process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ) {
        await deployer.deploy(FinanciePlatformToken, 'PF Token', 'ERC PF', 10000000000 * (10 ** 18));
    }

    if ( process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ) {
        await deployer.deploy(EtherToken);
    }

    if ( process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ) {
        let managedContracts = await deployer.deploy(FinancieManagedContracts);
        managedContracts.activateTargetContract(process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS, true);
        managedContracts.activateTargetContract(process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS, true);
    }

    if ( process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS === undefined ) {
        await deployer.deploy(FinancieNotifier,
            process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ? FinancieManagedContracts.address : process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS,
            process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS,
            process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS
        );
    }

    if ( process.env.FINANCIE_TICKET_STORE_CONTRACT_ADDRESS === undefined ) {
        deployer.deploy(FinancieTicketStore,
            process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS === undefined ? FinancieNotifier.address : process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS,
            process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ? FinancieManagedContracts.address : process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS,
            process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS,
            process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS
        );
    }

    if ( process.env.BANCOR_EXTENSIONS_CONTRACT_ADDRESS === undefined ) {
        let contractRegistry = await deployer.deploy(ContractRegistry);
        let contractIds = await deployer.deploy(ContractIds);

        contractFeatures = await deployer.deploy(ContractFeatures);
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let gasPriceLimit = await deployer.deploy(BancorGasPriceLimit, gasPrice);
        let gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        let formula = await deployer.deploy(BancorFormula);
        let formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        let bancorNetwork = await deployer.deploy(BancorNetwork, contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(web3.eth.coinbase);
        await bancorNetwork.registerEtherToken(process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS, true);
    }
};

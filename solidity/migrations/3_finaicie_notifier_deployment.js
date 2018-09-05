const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');

const EtherToken = artifacts.require('EtherToken.sol');

module.exports = (deployer, _network, _accounts) => {
    if ( process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS === undefined ) {
        return deployer
            .then(() => {
                return deployer.deploy(FinancieNotifier,
                    process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined ? FinancieManagedContracts.address : process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS,
                    process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ? FinanciePlatformToken.address : process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS,
                    process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS
                );
            });
    }
};

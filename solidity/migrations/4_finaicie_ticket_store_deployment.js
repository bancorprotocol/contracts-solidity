const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');

const EtherToken = artifacts.require('EtherToken.sol');

module.exports = (deployer, _network, _accounts) => {
    return deployer
        .then(() => {
            return deployer.deploy(FinancieTicketStore,
                FinancieNotifier.address,
                FinancieManagedContracts.address,
                FinanciePlatformToken.address,
                EtherToken.address
            );
        })
};

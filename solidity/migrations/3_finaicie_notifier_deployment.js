const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');

const EtherToken = artifacts.require('EtherToken.sol');

module.exports = (deployer, _network, _accounts) => {
    let managedContracts;
    return deployer
        .then(() => {
            return deployer.deploy(FinancieNotifier,
                FinancieManagedContracts.address,
                FinanciePlatformToken.address,
                EtherToken.address
            );
        })

        // notifier migration
        /*const prevFinancieNotifier = FinancieNotifier.address;
        if ( prevFinancieNotifier != null ) {
          await prevFinancieNotifier.setLatestNotifier(financieNotifier.address);
          console.log('[Financie Notifier]Old notifier address:' + prevFinancieNotifier.address));

          let latestNotifier = await financieNotifier.latestNotifier.call();
          console.log('[Financie Notifier]New notifier address:' + latestNotifier));
        }*/
};

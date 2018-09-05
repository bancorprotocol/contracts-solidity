const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');

const EtherToken = artifacts.require('EtherToken.sol');

const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');

const gasPrice = 22000000000;

module.exports = (deployer, _network, _accounts) => {
    let managedContracts;
    return deployer
        .then(() => {
            return deployer.deploy(FinanciePlatformToken, 'PF Token', 'ERC PF', 10000000000 * (10 ** 18));
        })
        .then(() => {
            return deployer.deploy(EtherToken);
        })
        .then(() => {
            return deployer.deploy(FinancieManagedContracts);
        })
        .then((instance) => {
            managedContracts = instance;
            return managedContracts.activateTargetContract(FinanciePlatformToken.address, true);
        })
        .then(() => {
            return managedContracts.activateTargetContract(EtherToken.address, true);
        })
        .then(() => {
            return deployer.deploy(FinancieNotifier,
                FinancieManagedContracts.address,
                FinanciePlatformToken.address,
                EtherToken.address
            );
        })
        .then(() => {
            return deployer.deploy(FinancieTicketStore,
                FinancieNotifier.address,
                FinancieManagedContracts.address,
                FinanciePlatformToken.address,
                EtherToken.address
            );
        })
        .then(() => {
            return deployer.deploy(BancorFormula);
        })
        .then(() => {
            return deployer.deploy(BancorGasPriceLimit, gasPrice);
        })
        .then(() => {
            return deployer.deploy(BancorQuickConverter);
        })
        .then((instance) => {
            return instance.registerEtherToken(EtherToken.address, true);
        })
        .then((instance) => {
            return deployer.deploy(BancorConverterExtensions,
                BancorFormula.address,
                BancorGasPriceLimit.address,
                BancorQuickConverter.address
            );
        });
        
        // notifier migration
        /*const prevFinancieNotifier = FinancieNotifier.address;
        if ( prevFinancieNotifier != null ) {
          await prevFinancieNotifier.setLatestNotifier(financieNotifier.address);
          console.log('[Financie Notifier]Old notifier address:' + prevFinancieNotifier.address));

          let latestNotifier = await financieNotifier.latestNotifier.call();
          console.log('[Financie Notifier]New notifier address:' + latestNotifier));
        }*/
};

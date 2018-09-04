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

module.exports = async (deployer, _network, _accounts) => {
    await deployer.deploy(FinanciePlatformToken, 'PF Token', 'ERC PF', 10000000000 * (10 ** 18));
    await deployer.deploy(EtherToken);
    await deployer.deploy(FinancieManagedContracts);
    FinancieManagedContracts.deployed().then((instance) => {
        instance.activateTargetContract(FinanciePlatformToken.address, true);
        instance.activateTargetContract(EtherToken.address, true);
    })

    await deployer.deploy(FinancieNotifier,
        FinancieManagedContracts.address,
        FinanciePlatformToken.address,
        EtherToken.address
    );

    deployer.deploy(FinancieTicketStore,
        FinancieNotifier.address,
        FinancieManagedContracts.address,
        FinanciePlatformToken.address,
        EtherToken.address
    );

    await deployer.deploy(BancorFormula);
    await deployer.deploy(BancorGasPriceLimit, gasPrice);
    await deployer.deploy(BancorQuickConverter);
    BancorQuickConverter.deployed().then((instance) => {
        instance.registerEtherToken(EtherToken.address, true);
    });

    deployer.deploy(BancorConverterExtensions,
        BancorFormula.address,
        BancorGasPriceLimit.address,
        BancorQuickConverter.address
    );

    // notifier migration
    /*const prevFinancieNotifier = FinancieNotifier.address;
    if ( prevFinancieNotifier != null ) {
      await prevFinancieNotifier.setLatestNotifier(financieNotifier.address);
      console.log('[Financie Notifier]Old notifier address:' + prevFinancieNotifier.address));

      let latestNotifier = await financieNotifier.latestNotifier.call();
      console.log('[Financie Notifier]New notifier address:' + latestNotifier));
    }*/
};

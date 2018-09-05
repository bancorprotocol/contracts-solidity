const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const EtherToken = artifacts.require('EtherToken.sol');

module.exports = (deployer, _network, _accounts) => {
    // Deploy only when there are undeployed components
    if ( process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS === undefined ||
      process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ||
      process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS === undefined
    ) {
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
    }
};

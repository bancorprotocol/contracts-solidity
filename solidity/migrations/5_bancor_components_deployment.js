const EtherToken = artifacts.require('EtherToken.sol');

const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');

const gasPrice = 22000000000;

module.exports = (deployer, _network, _accounts) => {
    if ( process.env.BANCOR_EXTENSIONS_CONTRACT_ADDRESS === undefined ) {
        return deployer
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
                return instance.registerEtherToken(process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS === undefined ? EtherToken.address : process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS, true);
            })
            .then((instance) => {
                return deployer.deploy(BancorConverterExtensions,
                    BancorFormula.address,
                    BancorGasPriceLimit.address,
                    BancorQuickConverter.address
                );
            });
    }
};

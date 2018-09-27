const RING = artifacts.require('StandardERC223');
const BancorConverter = artifacts.require('BancorConverter');
const BancorFormula = artifacts.require('BancorFormula');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit');
const EtherToken = artifacts.require('EtherToken');
const ContractFeatures = artifacts.require('ContractFeatures');
const ContractRegistry = artifacts.require('ContractRegistry');
const WhiteList = artifacts.require('Whitelist');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorExchange = artifacts.require('BancorExchange');
const ContractIds = artifacts.require('ContractIds');
const FeatureIds = artifacts.require('FeatureIds');

COIN = 10**18;

const CONF = {
     gasPrice: 30000000000000,
    weight10Percent: 100000,
    // remember to change this.
    from: '0x4cc4c344eba849dc09ac9af4bff1977e44fc1d7e'
}


module.exports = function(deployer) {

    // below will cause error when deploying contracts onto kovan
    // but ok on private chain like ganache

    // deployer.deploy([
    //     ContractRegistry,
    //     ContractIds,
    //     ContractFeatures,
    //     BancorFormula,
    //     FeatureIds,
    //     WhiteList,
    //     EtherToken,
    // ]).then(...)

    deployer.deploy(ContractRegistry);
    deployer.deploy(ContractIds);
    deployer.deploy(ContractFeatures);
    deployer.deploy(BancorFormula);
    deployer.deploy(WhiteList);
    deployer.deploy(BancorGasPriceLimit, CONF.gasPrice);
    deployer.deploy(EtherToken);
    deployer.deploy(RING, 'RING').then( async() => {
        await deployer.deploy(BancorNetwork, ContractRegistry.address);
        await deployer.deploy(BancorConverter, RING.address, ContractRegistry.address, 0, EtherToken.address, CONF.weight10Percent);
        await deployer.deploy(BancorExchange, RING.address, BancorNetwork.address, BancorConverter.address);

        let contractFeaturesId;
        let gasPriceLimitId;
        let formulaId;
        let bancorNetworkId;
        let contractRegistry = await ContractRegistry.deployed();
        let contractIds = await ContractIds.deployed();
        let contractFeatures = await ContractFeatures.deployed();
        let bancorFormula = await BancorFormula.deployed();

        let whiteList = await WhiteList.deployed();
        let etherToken = await EtherToken.deployed();
        let bancorNetwork = await BancorNetwork.deployed();
        let bancorGasPriceLimit = await BancorGasPriceLimit.deployed();
        let bancorExchange = await BancorExchange.deployed();
        let bancorConverter = await BancorConverter.deployed();
        let ring = await RING.deployed();

        contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);
        formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, bancorFormula.address);
        gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, bancorGasPriceLimit.address);
        bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, BancorNetwork.address);

         //do this to make SmartToken.totalSupply > 0
        await ring.issue(CONF.from, 1000000 * COIN);
        await ring.setOwner(BancorConverter.address);

        await etherToken.deposit({value: 1 * COIN});
        await etherToken.transfer(BancorConverter.address, 1 * COIN);

        await whiteList.addAddress(BancorExchange.address);
        await bancorConverter.setConversionWhitelist(WhiteList.address);

        await bancorNetwork.registerEtherToken(EtherToken.address, true);

        await bancorExchange.setQuickBuyPath([etherToken.address, ring.address, ring.address]);
        await bancorExchange.setQuickSellPath([ring.address, ring.address, etherToken.address]);

        console.log('SUCCESS!')
    })
}
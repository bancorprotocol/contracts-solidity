const RING = artifacts.require('StandardERC223');
const BancorConverter = artifacts.require('BancorConverter');
const BancorFormula = artifacts.require('BancorFormula');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit');
const EtherToken = artifacts.require('EtherToken');
const ContractFeatures = artifacts.require('ContractFeatures');
const SettingsRegistry = artifacts.require('SettingsRegistry');
const WhiteList = artifacts.require('Whitelist');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorExchange = artifacts.require('BancorExchange');
const ContractIds = artifacts.require('ContractIds');
const FeatureIds = artifacts.require('FeatureIds');
const DeployAndTest = artifacts.require('DeployAndTest');

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
    deployer.deploy(DeployAndTest);
    deployer.deploy(SettingsRegistry);
    deployer.deploy(ContractIds);
    deployer.deploy(ContractFeatures);
    deployer.deploy(BancorFormula);
    deployer.deploy(WhiteList);
    deployer.deploy(BancorGasPriceLimit, CONF.gasPrice);
    deployer.deploy(EtherToken);
    deployer.deploy(RING, 'RING').then( async() => {
        await deployer.deploy(BancorNetwork, SettingsRegistry.address);

        let contractIds = await ContractIds.deployed();
        let contractFeatures = await ContractFeatures.deployed();
        let settingsRegistry = await SettingsRegistry.deployed();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await settingsRegistry.setAddressProperty(contractFeaturesId, contractFeatures.address);

        await deployer.deploy(BancorConverter, RING.address, settingsRegistry.address, 0, EtherToken.address, CONF.weight10Percent, {gas: 8000000});
        console.log("LOGGING: address of bancorConverter: ", BancorConverter.address);
        await deployer.deploy(BancorExchange, RING.address, BancorNetwork.address, BancorConverter.address);


        let gasPriceLimitId;
        let formulaId;
        let bancorNetworkId;



        let bancorFormula = await BancorFormula.deployed();

        let whiteList = await WhiteList.deployed();
        let etherToken = await EtherToken.deployed();
        let bancorNetwork = await BancorNetwork.deployed();
        let bancorGasPriceLimit = await BancorGasPriceLimit.deployed();
        let bancorExchange = await BancorExchange.deployed();
        let bancorConverter = await BancorConverter.deployed();
        let ring = await RING.deployed();


        formulaId = await contractIds.BANCOR_FORMULA.call();
        await settingsRegistry.setAddressProperty(formulaId, bancorFormula.address);
        gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await settingsRegistry.setAddressProperty(gasPriceLimitId, bancorGasPriceLimit.address);
        bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await settingsRegistry.setAddressProperty(bancorNetworkId, BancorNetwork.address);

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
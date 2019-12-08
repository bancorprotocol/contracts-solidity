const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const EtherToken = artifacts.require('EtherToken');
const SmartToken = artifacts.require('SmartToken');
const BancorConverter = artifacts.require('BancorConverter');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorConverterRegistryData = artifacts.require('BancorConverterRegistryData');
const BancorConverterRegistryLogic = artifacts.require('BancorConverterRegistryLogic');

contract('BancorConverterRegistryLogic', function(accounts) {
    let converter1;
    let converter2;
    let converter3;
    let converter4;
    let converter5;
    let converter6;
    let converter7;
    let etherToken;
    let smartToken1;
    let smartToken2;
    let smartToken3;
    let smartToken4;
    let smartToken5;
    let smartToken6;
    let smartToken7;
    let smartToken8;
    let smartToken9;
    let smartTokenA;
    let smartTokenB;
    let smartTokenC;
    let smartTokenD;
    let smartTokenE;
    let smartTokenF;
    let contractRegistry
    let converterRegistryData;
    let converterRegistryLogic;

    before(async function() {
        etherToken  = await EtherToken.new();
        smartToken1 = await SmartToken.new('Token1', 'TKN1', 18);
        smartToken2 = await SmartToken.new('Token2', 'TKN2', 18);
        smartToken3 = await SmartToken.new('Token3', 'TKN3', 18);
        smartToken4 = await SmartToken.new('Token4', 'TKN4', 18);
        smartToken5 = await SmartToken.new('Token5', 'TKN5', 18);
        smartToken6 = await SmartToken.new('Token6', 'TKN6', 18);
        smartToken7 = await SmartToken.new('Token7', 'TKN7', 18);
        smartToken8 = await SmartToken.new('Token8', 'TKN8', 18);
        smartToken9 = await SmartToken.new('Token9', 'TKN9', 18);
        smartTokenA = await SmartToken.new('TokenA', 'TKNA', 18);
        smartTokenB = await SmartToken.new('TokenB', 'TKNB', 18);
        smartTokenC = await SmartToken.new('TokenC', 'TKNC', 18);
        smartTokenD = await SmartToken.new('TokenD', 'TKND', 18);
        smartTokenE = await SmartToken.new('TokenE', 'TKNE', 18);
        smartTokenF = await SmartToken.new('TokenF', 'TKNF', 18);

        contractRegistry = await ContractRegistry.new();

        converterRegistryData  = await BancorConverterRegistryData .new(contractRegistry.address);
        converterRegistryLogic = await BancorConverterRegistryLogic.new(contractRegistry.address);

        converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, etherToken .address, 500000);
        converter2 = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, smartToken4.address, 500000);
        converter3 = await BancorConverter.new(smartToken3.address, contractRegistry.address, 0, smartToken6.address, 500000);
        converter4 = await BancorConverter.new(smartToken4.address, contractRegistry.address, 0, smartToken8.address, 500000);
        converter5 = await BancorConverter.new(smartToken5.address, contractRegistry.address, 0, smartTokenA.address, 500000);
        converter6 = await BancorConverter.new(smartToken6.address, contractRegistry.address, 0, smartTokenC.address, 500000);
        converter7 = await BancorConverter.new(smartToken7.address, contractRegistry.address, 0, smartTokenE.address, 500000);

        await converter2.addReserve(smartToken1.address, 500000);
        await converter3.addReserve(smartToken1.address, 500000);
        await converter4.addReserve(smartToken1.address, 500000);
        await converter5.addReserve(smartToken1.address, 500000);
        await converter6.addReserve(smartToken1.address, 500000);
        await converter7.addReserve(smartToken2.address, 500000);

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY_DATA , converterRegistryData.address );
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY_LOGIC, converterRegistryLogic.address);

        await etherToken.deposit({value: 1000000});
        await smartToken1.issue(accounts[0], 1000000);
        await smartToken2.issue(accounts[0], 1000000);
        await smartToken3.issue(accounts[0], 1000000);
        await smartToken4.issue(accounts[0], 1000000);
        await smartToken5.issue(accounts[0], 1000000);
        await smartToken6.issue(accounts[0], 1000000);
        await smartToken7.issue(accounts[0], 1000000);
        await smartToken1.transferOwnership(converter1.address);
        await smartToken2.transferOwnership(converter2.address);
        await smartToken3.transferOwnership(converter3.address);
        await smartToken4.transferOwnership(converter4.address);
        await smartToken5.transferOwnership(converter5.address);
        await smartToken6.transferOwnership(converter6.address);
        await smartToken7.transferOwnership(converter7.address);
        await converter1.acceptTokenOwnership();
        await converter2.acceptTokenOwnership();
        await converter3.acceptTokenOwnership();
        await converter4.acceptTokenOwnership();
        await converter5.acceptTokenOwnership();
        await converter6.acceptTokenOwnership();
        await converter7.acceptTokenOwnership();
    });

    it('function addBancorConverter', async function() {
        await converterRegistryLogic.addBancorConverter(converter1.address);
        await converterRegistryLogic.addBancorConverter(converter2.address);
        await converterRegistryLogic.addBancorConverter(converter3.address);
        await converterRegistryLogic.addBancorConverter(converter4.address);
        await converterRegistryLogic.addBancorConverter(converter5.address);
        await converterRegistryLogic.addBancorConverter(converter6.address);
        await converterRegistryLogic.addBancorConverter(converter7.address);
    });
});

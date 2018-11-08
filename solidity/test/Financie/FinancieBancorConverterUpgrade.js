// Bancor components
// const fs = require('fs');
// const path = require('path');
const SmartToken = artifacts.require('SmartToken.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader.sol');

// Financie components
const FinancieBancorConverter = artifacts.require('FinancieBancorConverter.sol');
const FinancieBancorConverterFactory = artifacts.require('FinancieBancorConverterFactory.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieCardToken = artifacts.require('FinancieCardToken.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const IFinancieNotifier = artifacts.require('IFinancieNotifier.sol');
const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

let token;
let contractRegistry;
let contractFeatures;
let converterUpgrader;

// const contractsPath1 = path.resolve(__dirname, '../../build/contracts');
// const contractsPath2 = path.resolve(__dirname, '../../contracts/build');
// let abi;
// abi = fs.readFileSync(path.resolve(contractsPath1, 'FinancieBancorConverter.json'), 'utf-8');
// let converterAbi = JSON.parse(abi).abi;
// abi = fs.readFileSync(path.resolve(contractsPath2, 'SmartToken.abi'), 'utf-8');
// let SmartTokenAbi = JSON.parse(abi);

async function upgradeConverter(converter) {
    let newConverter

    await converter.upgrade();
    newConverter = await getNewConverter();

    return newConverter;
}

async function getNewConverter() {
    let converterUpgrade = converterUpgrader.ConverterUpgrade({fromBlock: 'latest', toBlock: 'latest'});
    newConverterAddress = await new Promise((resolve, reject) => {
        converterUpgrade.get((error, logs) => {
            assert(logs.length == 1);
            resolve(logs[0].args._newConverter);
        });
    });

    let converter = await FinancieBancorConverter.at(newConverterAddress);
    return converter;
}

contract('FinancieBancorConverterUpgrade', (accounts) => {
  let managedContracts;
  let platformToken;
  let etherToken;
  let financieNotifier;
  let cardToken;
  let smartToken;
  let bancor;
  let helo_wallet = '0x4C9FfD41285B7721bb45213094B84Ba87026A6e0'; //gana 9
  let team_wallet = '0xc71aB5dC024cF4F14fA069F14b20D0c36Da2EbD6'; //gana 7
  let user_wallet = '0x59b140a1e2Ee088d510c8684d1d8DdF15753C4C0'; //gana 8
  let newConverterAddress;

  before(async () => {
      console.log('[FinancieBancorConverter]initialize');

      contracts = await FinancieManagedContracts.new();
      platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
      etherToken = await EtherToken.new();
      financieNotifier = await FinancieNotifier.new(contracts.address, platformToken.address, etherToken.address);

      cardToken = await FinancieCardToken.new(
          'Financie Card Token',
          'FNCD',
          user_wallet,
          financieNotifier.address);

      smartToken = await SmartToken.new('Token1', 'TKN', 0);

      let contractRegistry = await ContractRegistry.new();
      let contractIds = await ContractIds.new();

      contractFeatures = await ContractFeatures.new();
      let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
      await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

      let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
      let gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
      await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

      let formula = await BancorFormula.new();
      let formulaId = await contractIds.BANCOR_FORMULA.call();
      await contractRegistry.registerAddress(formulaId, formula.address);

      let bancorNetwork = await BancorNetwork.new(contractRegistry.address);
      let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
      await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
      await bancorNetwork.setSignerAddress(accounts[0]);
      await bancorNetwork.registerEtherToken(etherToken.address, true);

      console.log('[FinancieBancorConverter]new');

      bancor = await FinancieBancorConverter.new(
          smartToken.address,
          etherToken.address,
          cardToken.address,
          helo_wallet,
          team_wallet,
          contractRegistry.address,
          financieNotifier.address,
          15000,
          15000,
          10000);

      console.log('[FinancieBancorConverter]begin setup');

      etherToken.sendTransaction({from: accounts[0], value:2 * (10 ** 5)});

      bancor.addConnector(etherToken.address, 10000, false);

      etherToken.transfer(bancor.address, 2 * (10 ** 5));

      await smartToken.issue(bancor.address, 1000000 * (10 ** 5));

      let balanceOfEtherToken = await etherToken.balanceOf(bancor.address);
      assert.equal(200000, balanceOfEtherToken);

      cardToken.transfer(bancor.address, 20000 * (10 ** 5));

      smartToken.transferOwnership(bancor.address);

      await bancor.acceptTokenOwnership();
      await bancor.startTrading();
      console.log('converterTokenOwner['+await smartToken.owner.call()+']');

      let connectorTokenCount = await bancor.connectorTokenCount();
      assert.equal(2, connectorTokenCount);

      console.log('[FinancieBancorConverterFactory]new');

      let converterFactory = await FinancieBancorConverterFactory.new(
        helo_wallet,
        team_wallet,
        15000,
        15000,
        financieNotifier.address,
        etherToken.address);

      let converterFactoryId = await contractIds.BANCOR_CONVERTER_FACTORY.call();
      await contractRegistry.registerAddress(converterFactoryId, converterFactory.address);

      converterUpgrader = await BancorConverterUpgrader.new(contractRegistry.address);
      let bancorConverterUpgraderId = await contractIds.BANCOR_CONVERTER_UPGRADER.call();
      await contractRegistry.registerAddress(bancorConverterUpgraderId, converterUpgrader.address);

      console.log('[FinancieBancorConverter]end setup');
  });

  it('verifies that the ownership of the given converter returned to the given address', async () => {
      let initialOwner = await bancor.owner.call();
      await bancor.transferOwnership(converterUpgrader.address);
      console.log('bancor.address['+bancor.address+']');
      console.log('initialOwner['+initialOwner+']');
      console.log('converterUpgrader['+converterUpgrader.address+']');
      console.log('converterNewOwner['+await bancor.newOwner.call()+']');

      let upgradeRes = await converterUpgrader.upgradeOld(bancor.address, web3.fromUtf8("0.7"));
      // console.log(upgradeRes.logs);
      await bancor.acceptOwnership();
      let currentOwner = await bancor.owner.call();

      console.log('currentOwner['+currentOwner+']');
      newConverterAddress = upgradeRes.logs[4].args._newConverter;
      let newConverter = FinancieBancorConverter.at(newConverterAddress);
      await newConverter.acceptOwnership();
      await newConverter.startTrading();
      console.log('newConverter.address['+newConverter.address+']');
      let newOwner = await newConverter.owner.call();
      console.log('newOwner['+newOwner+']');

      let connectorTokenCount = await newConverter.connectorTokenCount();
      assert.equal(2, connectorTokenCount);
      assert.equal(initialOwner, newOwner);
  });

  it('verifies that the quick buy path of the new converter is equal to the path in the given converter', async () => {
      let initialPathLength = await bancor.getQuickBuyPathLength();
      if (newConverterAddress == null) {
        await bancor.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgradeOld(bancor.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
      }
      let newConverter = FinancieBancorConverter.at(newConverterAddress);
      newConverter.copyQuickBuyPath(bancor.address);
      for (let i = 0; i < initialPathLength; i++) {
          let initialToken = await bancor.quickBuyPath.call(i);
          let currentToken = await newConverter.quickBuyPath.call(i);
          assert.equal(initialToken, currentToken);
      }
  });

  it('verifies that the new upgrade', async () => {
    let newconverter;
    let initialOwner = await bancor.owner.call();
    newconverter = await upgradeConverter(bancor);
    await newconverter.acceptOwnership();
    await newconverter.startTrading();
    let connectorTokenCount = await newconverter.connectorTokenCount();
    let newOwner = await newconverter.owner.call();
    assert.equal(2, connectorTokenCount);
    assert.equal(initialOwner, newOwner);
  });


});

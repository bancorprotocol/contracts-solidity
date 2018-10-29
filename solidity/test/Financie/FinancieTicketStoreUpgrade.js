const SmartToken = artifacts.require('SmartToken.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader.sol');
//
// // Financie components
const FinancieBancorConverter = artifacts.require('FinancieBancorConverter.sol');
const FinancieBancorConverterFactory = artifacts.require('FinancieBancorConverterFactory.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieCardToken = artifacts.require('FinancieCardToken.sol');
const FinancieTicketToken = artifacts.require('FinancieTicketToken.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const IFinancieNotifier = artifacts.require('IFinancieNotifier.sol');
const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinancieTicketStoreUpgrade = artifacts.require('FinancieTicketStoreUpgrade.sol');
const FinancieTicketStoreFactory = artifacts.require('FinancieTicketStoreFactory.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

let token;
let contractRegistry;
let contractFeatures;

contract('FinancieTicketStoreUpgrade', (accounts) => {
  let managedContracts;
  let platformToken;
  let etherToken;
  let financieNotifier;
  let cardToken;
  let ticketToken;
  let ticketstore;
  let newticketstore;
  let ticketstoreupgrede;
  let ticketstorefactory;
  let smartToken;
  let bancor;
  let helo_wallet = '0x4C9FfD41285B7721bb45213094B84Ba87026A6e0'; //gana 9
  let team_wallet = '0xc71aB5dC024cF4F14fA069F14b20D0c36Da2EbD6'; //gana 7
  let user_wallet = '0x59b140a1e2Ee088d510c8684d1d8DdF15753C4C0'; //gana 8
  let issure_num  = 100;
  let card_must_num = 10;
  let start_date = new Date('2018/12/01 00:00:00');
  let end_date = new Date('2019/01/01 00:00:00');

  before(async () => {
    contracts = await FinancieManagedContracts.new();
    // console.log('[FinancieManagedContracts]deploy='+contracts.address);

    platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
    // console.log('[FinanciePlatformToken]deploy='+platformToken.address);
    etherToken = await EtherToken.new();
    // console.log('[EtherToken]deploy='+etherToken.address);
    financieNotifier = await FinancieNotifier.new(contracts.address, platformToken.address, etherToken.address);
    // console.log('[FinancieNotifier]deploy='+financieNotifier.address);

    cardToken = await FinancieCardToken.new(
        'Financie Card Token',
        'FNCD',
        user_wallet,
        financieNotifier.address);
    // console.log('[FinancieCardToken]deploy='+cardToken.address);

    // console.log('[FinancieTicketStore]initialize');
    ticketstore = await FinancieTicketStore.new(
      financieNotifier.address,
      contracts.address,
      platformToken.address,
      etherToken.address
    );
    // console.log('--[FinancieTicketStore]deploy='+ticketstore.address);

    ticketToken = await FinancieTicketToken.new(
      'Financie Ticket Token',
      'FNTK',
      user_wallet,
      issure_num,
      financieNotifier.address
    );
    // console.log('--[FinancieTicketToken]deploy='+ticketToken.address);

    contracts.activateTargetContract(cardToken.address, true);
    contracts.activateTargetContract(ticketToken.address, true);
    // console.log('--[FinancieManagedContracts]activateTargetContract()');

    await ticketToken.approve(ticketstore.address, issure_num);
    // console.log('--[FinancieTicketToken]approve()');

    await ticketstore.depositTickets(
      ticketToken.address,
      cardToken.address,
      issure_num,
      card_must_num * (10 ** 18),
      start_date.getTime(),
      end_date.getTime()
    )
    // console.log('--[FinancieTicketStore]depositTickets()');

    ticketstorefactory = await FinancieTicketStoreFactory.new();
    // console.log('--[FinancieTicketStoreFactory]deploy='+ticketstorefactory.address);

    ticketstoreupgrede = await FinancieTicketStoreUpgrade.new(ticketstorefactory.address);
    // console.log('--[FinancieTicketStoreUpgrade]deploy='+ticketstoreupgrede.address);
    //
    // console.log('[FinancieTicketStore]initialize-end');
    // console.log('accounts[0]='+ await ticketToken.balanceOf(ticketstore.address));
  });

  it('verfy ticket store upgrade' , async () => {
    // console.log('[FinancieTicketStore]start');

    let old_num = await ticketToken.balanceOf(ticketstore.address);
    let old_owner = await ticketstore.owner();

    ticketstore.transferOwnership(ticketstoreupgrede.address);
    let upgradeRes = await ticketstoreupgrede.upgrade(ticketstore.address);
    await ticketstore.acceptOwnership();

    // console.log(upgradeRes.logs[3]);

    newticketstore = FinancieTicketStore.at(upgradeRes.logs[3].args._newStore);
    newticketstore.acceptOwnership();

    let new_num = await ticketToken.balanceOf(newticketstore.address);
    let new_owner = await newticketstore.owner();

    assert.equal(old_num.toFixed(),new_num.toFixed());
    assert.equal(old_owner,new_owner);
    // console.log('[FinancieTicketStore]end');
  });

  it('verfy ticket store upgrade(check TicketSale price)' , async () => {
    let old_data = await ticketstore.getTicketPrice(ticketToken.address);
    let new_data = await newticketstore.getTicketPrice(ticketToken.address);
    assert.equal(new_data.toFixed(),old_data.toFixed());
  });

  it('verfy ticket store upgrade(check TicketSale card)' , async () => {
    let old_data = await ticketstore.getTicketCurrency(ticketToken.address);
    let new_data = await newticketstore.getTicketCurrency(ticketToken.address);
    assert.equal(new_data,old_data);
  });

  it('verfy ticket store upgrade(check TicketSale start_at)' , async () => {
    let old_data = await ticketstore.getTicketStartAt(ticketToken.address);
    let new_data = await newticketstore.getTicketStartAt(ticketToken.address);
    assert.equal(new_data.toFixed(),old_data.toFixed());
  });

  it('verfy ticket store upgrade(check TicketSale end_at)' , async () => {
    let old_data = await ticketstore.getTicketEndAt(ticketToken.address);
    let new_data = await newticketstore.getTicketEndAt(ticketToken.address);
    assert.equal(new_data.toFixed(),old_data.toFixed());
  });

});

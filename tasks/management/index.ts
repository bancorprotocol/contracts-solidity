import { task, types } from 'hardhat/config';
import { lazyAction } from './../../helpers/lazyAction';

task('whitelist', 'Whitelist a pool')
    .addFlag('ledger', 'Signing from a ledger')
    .addParam('configPath', 'System Configuration file path', 'exemple.system.json', types.inputFile)
    .addParam('ledgerPath', 'Ledger path', "m/44'/60'/0'/0", types.string)
    .addParam('poolAddress', 'Address of the pool to whitelist', '', types.string)
    //
    .setAction(lazyAction('tasks/management/whitelist.ts'));

task('upgrade', 'Upgrade a contract')
    .addFlag('ledger', 'Signing from a ledger')
    .addParam('configPath', 'System Configuration file path', 'exemple.system.json', types.inputFile)
    .addParam('ledgerPath', 'Ledger path', "m/44'/60'/0'/0", types.string)
    .addParam('contractName', 'Name of the contract to update', '', types.string)
    .addParam('contractNameRegistry', 'Name of the contract to update', '', types.string)
    //
    .setAction(lazyAction('tasks/management/upgrade.ts'));

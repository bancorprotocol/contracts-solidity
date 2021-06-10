import { task, types } from 'hardhat/config';
import { lazyAction } from './../../helpers/lazyAction';

task('whitelist', 'Whitelist a pool')
    .addFlag('ledger', 'Signing from a ledger')
    .addParam('systemPath', 'System Configuration file path', 'exemple.system.json', types.inputFile)
    .addParam('ledgerPath', 'Ledger path', "m/44'/60'/0'/0", types.string)
    //
    .setAction(lazyAction('tasks/management/task.ts'));

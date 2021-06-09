import { task, types } from 'hardhat/config';
import { lazyAction } from './../../helpers/lazyAction';

task('deploy', 'Deploy')
    .addFlag('ledger', 'Signing from a ledger')
    .addParam('configPath', 'Deployment Configuration file path', 'exemple.deployment.json', types.inputFile)
    .addParam('ledgerPath', 'Ledger path', "m/44'/60'/0'/0", types.string)
    //
    .setAction(lazyAction('tasks/deployment/task.ts'));

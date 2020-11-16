const memdown = require('memdown');

module.exports = {
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle run coverage',
    compileCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle compile',
    skipFiles: ['contracts/helpers'],
    providerOptions: {
        db: memdown(),
        default_balance_ether: 10000000000000000000
    }
};

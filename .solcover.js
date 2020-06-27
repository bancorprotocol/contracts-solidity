module.exports = {
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle run coverage',
    compileCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle compile',
    norpc: true,
    skipFiles: [
        'helpers/Migrations.sol'
    ],
    providerOptions: {
        default_balance_ether: 10000000000000000000
    }
};

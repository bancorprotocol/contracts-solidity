module.exports = {
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle run coverage',
    compileCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle compile',
    skipFiles: [
        'contracts/helpers'
    ],
    providerOptions: {
        default_balance_ether: 10000000000000000000
    }
};

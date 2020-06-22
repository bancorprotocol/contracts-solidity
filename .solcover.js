module.exports = {
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle run coverage',
    compileCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle compile',
    norpc: true,
    skipFiles: [
        'helpers/Migrations.sol'
    ],
    providerOptions: {
        defaultEtherBalance: 1000
    }
};

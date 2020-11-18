module.exports = {
    accounts: {
        amount: 10,
        ether: 10000000000000000000
    },

    contracts: {
        type: 'truffle',
        defaultGas: 9500000,
        defaultGasPrice: 20000000000,
        artifactsDir: 'solidity/build/contracts'
    },

    node: {
        gasLimit: 9500000,
        gasPrice: 20000000000
    }
};

module.exports.commands = [
    { operation: 'newPool', elapsed: 0, pTokenId: 'TKN', sTokenId: 'BNT', numOfUsers: 3 },
    { operation: 'setFees', elapsed: 0, conversionFee: '0.1%', oracleDeviationFee: '1%' },
    { operation: 'setRates', elapsed: 10, pTokenRate: '200', sTokenRate: '300' },
    {
        operation: 'addLiquidity',
        elapsed: 10,
        tokenId: 'TKN',
        userId: 1,
        inputAmount: '1000000',
        outputAmount: '1000000'
    },
    {
        operation: 'addLiquidity',
        elapsed: 10,
        tokenId: 'BNT',
        userId: 1,
        inputAmount: '1000000',
        outputAmount: '1000000'
    },
    {
        operation: 'addLiquidity',
        elapsed: 10,
        tokenId: 'TKN',
        userId: 2,
        inputAmount: '100000',
        outputAmount: '100000'
    },
    {
        operation: 'addLiquidity',
        elapsed: 10,
        tokenId: 'BNT',
        userId: 2,
        inputAmount: '100000',
        outputAmount: '100000'
    },
    {
        operation: 'convert',
        elapsed: 10,
        sourceTokenId: 'TKN',
        targetTokenId: 'BNT',
        userId: 3,
        inputAmount: '10000',
        outputAmount: '6592'
    },
    {
        operation: 'convert',
        elapsed: 10,
        sourceTokenId: 'TKN',
        targetTokenId: 'BNT',
        userId: 3,
        inputAmount: '10000',
        outputAmount: '6587'
    },
    {
        operation: 'convert',
        elapsed: 10,
        sourceTokenId: 'TKN',
        targetTokenId: 'BNT',
        userId: 3,
        inputAmount: '10000',
        outputAmount: '6582'
    },
    {
        operation: 'convert',
        elapsed: 10,
        sourceTokenId: 'TKN',
        targetTokenId: 'BNT',
        userId: 3,
        inputAmount: '10000',
        outputAmount: '6577'
    },
    { operation: 'remLiquidity', elapsed: 10, tokenId: 'TKN', userId: 2, inputAmount: 'all', outputAmount: '99818' },
    { operation: 'remLiquidity', elapsed: 10, tokenId: 'BNT', userId: 2, inputAmount: 'all', outputAmount: '99802' }
];

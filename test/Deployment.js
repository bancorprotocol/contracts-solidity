const Contracts = require('./helpers/Contracts');
const runDeployment = require('./helpers/runDeployment');

const config = {
    reserves: [
        {
            symbol: 'XXX',
            decimals: 18,
            supply: '1829101'
        },
        {
            symbol: 'YYY',
            decimals: 18,
            supply: '3603801'
        },
        {
            symbol: 'BNT',
            decimals: 18,
            supply: '6914855'
        },
        {
            symbol: 'vBNT',
            decimals: 18,
            supply: '0'
        }
    ],
    converters: [
        {
            type: 3,
            symbol: 'ETHBNT',
            decimals: 18,
            fee: '0.1%',
            reserves: [
                {
                    symbol: 'ETH',
                    balance: '21'
                },
                {
                    symbol: 'BNT',
                    balance: '3092'
                }
            ]
        },
        {
            type: 3,
            symbol: 'XXXBNT',
            decimals: 18,
            fee: '0.1%',
            reserves: [
                {
                    symbol: 'XXX',
                    balance: '582'
                },
                {
                    symbol: 'BNT',
                    balance: '2817'
                }
            ]
        },
        {
            type: 3,
            symbol: 'YYYBNT',
            decimals: 18,
            fee: '0.2%',
            reserves: [
                {
                    symbol: 'YYY',
                    balance: '312'
                },
                {
                    symbol: 'BNT',
                    balance: '270'
                }
            ]
        }
    ],
    liquidityProtectionParams: {
        minNetworkTokenLiquidityForMinting: '100',
        defaultNetworkTokenMintingLimit: '750',
        minProtectionDelay: 600,
        maxProtectionDelay: 3600,
        lockDuration: 60,
        converters: ['ETHBNT', 'XXXBNT']
    }
};

describe('Deployment', () => {
    it('run', async () => {
        await runDeployment(
            (await ethers.getSigners())[0],
            (...args) => Contracts[args[1]].deploy(...args.slice(2)),
            (...args) => Contracts[args[0]].attach(args[1]),
            (...args) => args[0],
            () => config,
            ethers.utils.id,
            ethers.utils.formatBytes32String,
            ethers.provider.getTransactionCount
        );
    });
});

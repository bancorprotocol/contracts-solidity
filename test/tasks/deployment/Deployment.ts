import { ethers } from 'hardhat';

import { deploySystem } from 'tasks/deployment/deployment';
import { DeploymentConfig } from 'types';

const testDeploymentConfig: DeploymentConfig = {
    networkToken: {
        symbol: 'BNT',
        decimals: 18,
        supply: 1_000_000
    },
    networkGovToken: {
        symbol: 'vBNT',
        decimals: 18,
        supply: 1_000_000
    },
    chainToken: {
        symbol: 'ETH',
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        decimals: 18
    },
    //
    reserves: [
        {
            __typename: 'toDeploy',
            symbol: 'XXX',
            decimals: 18,
            supply: 1_829_101
        },
        {
            __typename: 'toDeploy',
            symbol: 'YYY',
            decimals: 18,
            supply: 3_603_801
        }
    ],
    converters: [
        {
            symbol: 'BNTETH',
            decimals: 18,
            fee: '0.1%',
            protected: true,
            reserves: [
                {
                    symbol: 'BNT',
                    balance: 3092
                },
                {
                    symbol: 'ETH',
                    balance: 21
                }
            ]
        },
        {
            symbol: 'BNTXXX',
            decimals: 18,
            fee: '0.1%',
            protected: true,
            reserves: [
                {
                    symbol: 'BNT',
                    balance: 3092
                },
                {
                    symbol: 'XXX',
                    balance: 21
                }
            ]
        },
        {
            symbol: 'BNTYYY',
            decimals: 18,
            fee: '0.1%',
            protected: true,
            reserves: [
                {
                    symbol: 'BNT',
                    balance: 3092
                },
                {
                    symbol: 'YYY',
                    balance: 21
                }
            ]
        }
    ],
    liquidityProtectionParams: {
        minNetworkTokenLiquidityForMinting: 100,
        defaultNetworkTokenMintingLimit: 750,
        minProtectionDelay: 600,
        maxProtectionDelay: 3600,
        lockDuration: 60
    }
};

describe('Deployment', () => {
    it('should properly deploy initial network', async () => {
        await deploySystem((await ethers.getSigners())[0], testDeploymentConfig);
    });
});

type token = {
    symbol: string;
    decimals: number;
};

type networkToken = token & {
    supply: number;
};

type chainToken = token & {
    address: string;
};

export type deployedTokenReserve = token & {
    __typename: 'deployed';
    address: string;
};

export type toDeployTokenReserve = token & {
    __typename: 'toDeploy';
    supply: number;
};

export type DeploymentConfig = {
    networkToken: networkToken;
    networkGovToken: networkToken;
    chainToken: chainToken;
    reserves: (toDeployTokenReserve | deployedTokenReserve)[];
    converters: {
        symbol: string;
        decimals: number;
        fee: string;
        protected: boolean;
        reserves: {
            symbol: string;
            balance: number;
        }[];
    }[];
    liquidityProtectionParams: {
        minNetworkTokenLiquidityForMinting: number;
        defaultNetworkTokenMintingLimit: number;
        minProtectionDelay: number;
        maxProtectionDelay: number;
        lockDuration: number;
    };
};

export type BancorSystem = {};

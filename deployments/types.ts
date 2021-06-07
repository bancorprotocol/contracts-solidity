type networkToken = {
    address?: string;
    supply: number;

    symbol: string;
    decimals: number;

    protected?: boolean;
};

type chainToken = {
    address: string;
    symbol: string;
    decimals: number;
};

export type deployedTokenReserve = {
    __typename: 'deployed';

    symbol: string;
    address: string;
    decimals: number;
};

export type toDeployTokenReserve = {
    __typename: 'toDeploy';

    supply: number;
    symbol: string;
    decimals: number;
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

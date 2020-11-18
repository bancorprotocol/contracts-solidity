const { accounts, contract } = require('@openzeppelin/test-environment');
const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { governance } = require('./helpers/Constants');
const Decimal = require('decimal.js');

const DSToken = contract.fromArtifact('DSToken');
const LiquidityProtection = contract.fromArtifact('TestLiquidityProtection');
const TokenGovernance = contract.fromArtifact('TestTokenGovernance');

const FACTOR_LISTS = [
    [9, 12, 15].map((x) => new BN(10).pow(new BN(x))),
    [18, 24, 30].map((x) => new BN(10).pow(new BN(x))),
    [23, 47, 95].map((x) => new BN(x).pow(new BN(10))),
    [7, 9, 11, 13].map((x) => new BN(x).pow(new BN(10)))
];

function impLossTest(initialRateN, initialRateD, currentRateN, currentRateD) {
    const ratioN = currentRateN.mul(initialRateD);
    const ratioD = currentRateD.mul(initialRateN);
    const ratio = Decimal(ratioN.toString()).div(ratioD.toString());
    return ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();
}

function assertAlmostEqual(actual, expected) {
    if (!actual.eq(expected)) {
        const error = actual.div(expected).sub(1).abs();
        expect(error.lte('0.00000000000000000001')).to.be.true(`error = ${error.toFixed(30)}`);
    }
}

describe('LiquidityProtectionStateless', () => {
    before(async () => {
        const governor = accounts[1];

        const networkToken = await DSToken.new('BNT', 'BNT', 18);
        const networkTokenGovernance = await TokenGovernance.new(networkToken.address);
        await networkTokenGovernance.grantRole(governance.ROLE_GOVERNOR, governor);
        await networkToken.transferOwnership(networkTokenGovernance.address);
        await networkTokenGovernance.acceptTokenOwnership();

        const govToken = await DSToken.new('vBNT', 'vBNT', 18);
        const govTokenGovernance = await TokenGovernance.new(govToken.address);
        await govTokenGovernance.grantRole(governance.ROLE_GOVERNOR, governor);
        await govToken.transferOwnership(govTokenGovernance.address);
        await govTokenGovernance.acceptTokenOwnership();

        liquidityProtection = await LiquidityProtection.new(
            accounts[0],
            networkTokenGovernance.address,
            govTokenGovernance.address,
            accounts[0]
        );

        await networkTokenGovernance.grantRole(governance.ROLE_MINTER, liquidityProtection.address, { from: governor });
        await govTokenGovernance.grantRole(governance.ROLE_MINTER, liquidityProtection.address, { from: governor });
    });

    for (const factorList of FACTOR_LISTS) {
        for (const initialRateN of factorList) {
            for (const initialRateD of factorList) {
                for (const currentRateN of factorList) {
                    for (const currentRateD of factorList) {
                        it(`impLoss(${initialRateN}/${initialRateD}, ${currentRateN}/${currentRateD})`, async () => {
                            const expected = impLossTest(initialRateN, initialRateD, currentRateN, currentRateD);
                            const actual = await liquidityProtection.impLossTest(
                                initialRateN,
                                initialRateD,
                                currentRateN,
                                currentRateD
                            );
                            assertAlmostEqual(Decimal(actual[0].toString()).div(actual[1].toString()), expected);
                        });
                    }
                }
            }
        }
    }
});

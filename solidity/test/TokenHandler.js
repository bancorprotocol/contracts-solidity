const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectRevert } = require('@openzeppelin/test-helpers');

const TestTokenHandler = contract.fromArtifact('TestTokenHandler');
const TestStandardToken = contract.fromArtifact('TestStandardToken');
const TestNonStandardToken = contract.fromArtifact('TestNonStandardToken');

describe('TokenHandler', async () => {
    let tokenHandler;
    const sender = accounts[0];

    beforeEach(async () => {
        tokenHandler = await TestTokenHandler.new();
    });

    const test = async (state, transaction) => {
        return state ? transaction : expectRevert.unspecified(transaction);
    };

    describe('standard token tests', async () => {
        let standardToken;

        for (const ok of [false, true]) {
            for (const ret of [false, true]) {
                context(`ok: ${ok}, ret: ${ret}`, async () => {
                    beforeEach(async () => {
                        standardToken = await TestStandardToken.new('name', 'symbol', 0, 0);
                        await standardToken.set(ok, ret);
                    });

                    it(`approve should ${ok && ret ? 'not ' : ''}revert`, async () => {
                        await test(ok && ret, tokenHandler.testSafeApprove(standardToken.address, sender, 0));
                    });

                    it(`transfer should ${ok && ret ? 'not ' : ''}revert`, async () => {
                        await test(ok && ret, tokenHandler.testSafeTransfer(standardToken.address, sender, 0));
                    });

                    it(`transferFrom should ${ok && ret ? 'not ' : ''}revert`, async () => {
                        await test(
                            ok && ret,
                            tokenHandler.testSafeTransferFrom(standardToken.address, sender, sender, 0)
                        );
                    });
                });
            }
        }
    });

    describe('non-standard token tests', async () => {
        let nonStandardToken;

        for (const ok of [false, true]) {
            context(`ok: ${ok}`, async () => {
                beforeEach(async () => {
                    nonStandardToken = await TestNonStandardToken.new('name', 'symbol', 0, 0);
                    await nonStandardToken.set(ok);
                });

                it(`approve should ${ok ? 'not ' : ''}revert`, async () => {
                    await test(ok, tokenHandler.testSafeApprove(nonStandardToken.address, sender, 0));
                });

                it(`transfer should ${ok ? 'not ' : ''}revert`, async () => {
                    await test(ok, tokenHandler.testSafeTransfer(nonStandardToken.address, sender, 0));
                });

                it(`transferFrom should ${ok ? 'not ' : ''}revert`, async () => {
                    await test(ok, tokenHandler.testSafeTransferFrom(nonStandardToken.address, sender, sender, 0));
                });
            });
        }
    });
});

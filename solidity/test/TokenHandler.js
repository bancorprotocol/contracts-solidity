const utils = require('./helpers/Utils');

const TokenHandler = artifacts.require('TestTokenHandler');
const TestStandardToken = artifacts.require('TestStandardToken');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');

contract('TokenHandler', async accounts => {
    let tokenHandler;
    let standardToken;
    let nonStandardToken;

    before(async () => {
        tokenHandler = await TokenHandler.new();
        standardToken = await TestStandardToken.new('name', 'symbol', 0, 0);
        nonStandardToken = await TestNonStandardToken.new('name', 'symbol', 0, 0);
    });

    for (const ok of [false, true]) {
        for (const ret of [false, true]) {
            describe('standard token test of function', () => {
                before(async () => {
                    await standardToken.set(ok, ret);
                });
                it(`approve with ok = ${ok} and ret = ${ret} should ${ok && ret ? 'not ' : ''}revert`, async () => {
                    await test(ok && ret, tokenHandler.testSafeApprove(standardToken.address, accounts[0], 0));
                });
                it(`transfer with ok = ${ok} and ret = ${ret} should ${ok && ret ? 'not ' : ''}revert`, async () => {
                    await test(ok && ret, tokenHandler.testSafeTransfer(standardToken.address, accounts[0], 0));
                });
                it(`transferFrom with ok = ${ok} and ret = ${ret} should ${ok && ret ? 'not ' : ''}revert`, async () => {
                    await test(ok && ret, tokenHandler.testSafeTransferFrom(standardToken.address, accounts[0], accounts[0], 0));
                });
            });
        }
    }

    for (const ok of [false, true]) {
            describe('non-standard token test where', () => {
            before(async () => {
                await nonStandardToken.set(ok);
            });
                it(`approve with ok = ${ok} should ${ok ? 'not ' : ''}revert`, async () => {
                await test(ok, tokenHandler.testSafeApprove(nonStandardToken.address, accounts[0], 0));
            });
                it(`transfer with ok = ${ok} should ${ok ? 'not ' : ''}revert`, async () => {
                await test(ok, tokenHandler.testSafeTransfer(nonStandardToken.address, accounts[0], 0));
            });
                it(`transferFrom with ok = ${ok} should ${ok ? 'not ' : ''}revert`, async () => {
                await test(ok, tokenHandler.testSafeTransferFrom(nonStandardToken.address, accounts[0], accounts[0], 0));
            });
        });
    }

    async function test(state, transaction) {
        await (state ? transaction : utils.catchRevert(transaction));
    }
});

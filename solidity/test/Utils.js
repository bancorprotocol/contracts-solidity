/* global assert */

function isException(error) {
    let strError = error.toString();
    return strError.includes('invalid opcode') || strError.includes('invalid JUMP');
}

function ensureException(error) {
    assert(isException(error), error.toString());
}

module.exports = {
    isException: isException,
    ensureException: ensureException
};

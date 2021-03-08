const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { argv } = yargs(hideBin(process.argv));

module.exports = {
    spec: argv.spec || 'solidity/test',
    exit: true,
    recursive: true,
    before_timeout: 600000,
    timeout: 600000,
    useColors: true,
    reporter: 'list'
};

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { argv } = yargs(hideBin(process.argv));

module.exports = {
    spec: argv._[0] || 'solidity/test',
    exit: true,
    recursive: true,
    before_timeout: 600000,
    timeout: 600000,
    useColors: true,
    reporter: 'list'
};

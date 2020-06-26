const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.resolve(__dirname, '../solidity/build');
const CONTRACTS_DIR = path.join(BUILD_DIR, 'contracts');
const JSON_EXT = '.json';
const ABI_EXT = '.abi';
const BIN_EXT = '.bin';

const fileList = fs.readdirSync(CONTRACTS_DIR);

fileList.forEach((filename) => {
    if (filename.endsWith(JSON_EXT)) {
        const basename = path.basename(filename, JSON_EXT);
        const data = fs.readFileSync(path.join(CONTRACTS_DIR, filename));
        const jsonData = JSON.parse(data);
        const { abi, bytecode } = jsonData;
        if (abi) {
            fs.writeFileSync(path.format({
                dir: BUILD_DIR, name: basename, ext: ABI_EXT
            }), JSON.stringify(abi));
        }

        if (bytecode) {
            fs.writeFileSync(path.format({
                dir: BUILD_DIR, name: basename, ext: BIN_EXT
            }), bytecode.substring(2));
        }
    }
});

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
    ADD_PROTECTED_LIQUIDITIES   ,
    ADD_LOCKED_BALANCES         ,
    ADD_SYSTEM_BALANCES         ,
    UPDATE_PROTECTED_LIQUIDITIES,
    REMOVE_PROTECTED_LIQUIDITIES,
    NEXT_PROTECTED_LIQUIDITY_ID ,
} = require("./file_names.js");

const DST_FOLDER  = process.argv[2];
const SRC_FOLDER1 = process.argv[3];
const SRC_FOLDER2 = process.argv[4];

if (!fs.existsSync(DST_FOLDER)) {
    fs.mkdirSync(DST_FOLDER);
}

function printRow(filePath, fileData) {
    const row = fileData + os.EOL;
    fs.appendFileSync(filePath, row, {encoding: "utf8"});
    process.stdout.write(row);
}

function createAddFile(fileName) {
    const srcFile1Lines = fs.readFileSync(path.join(SRC_FOLDER1, fileName), {encoding: "utf8"}).split(os.EOL);
    const srcFile2Lines = fs.readFileSync(path.join(SRC_FOLDER2, fileName), {encoding: "utf8"}).split(os.EOL);

    const dstFilePath = path.join(DST_FOLDER, fileName);
    fs.writeFileSync(dstFilePath, "", {encoding: "utf8"});

    printRow(dstFilePath, srcFile2Lines[0]);
    for (const line of srcFile2Lines.slice(srcFile1Lines.length - 1, srcFile2Lines.length - 1)) {
        printRow(dstFilePath, line);
    }
}

function run() {
    createAddFile(ADD_PROTECTED_LIQUIDITIES);
    createAddFile(ADD_LOCKED_BALANCES      );
    createAddFile(ADD_SYSTEM_BALANCES      );

    const srcFilePath = path.join(SRC_FOLDER2, NEXT_PROTECTED_LIQUIDITY_ID);
    const dstFilePath = path.join(DST_FOLDER , NEXT_PROTECTED_LIQUIDITY_ID);
    fs.writeFileSync(dstFilePath, fs.readFileSync(srcFilePath, {encoding: "utf8"}), {encoding: "utf8"});
}

run();
const fs = require("fs");

try {
    fs.closeSync(fs.openSync("./node_modules/run-once", "wx"));
}
catch (error) {
    console.error("This script should not run more than once");
    process.exit();
}

function fix(fileName, tokens) {
    console.log("Fixing " + fileName);
    try {
        let data = fs.readFileSync(fileName, {encoding: "utf8"});
        for (const token of tokens)
            data = data.split(token.prev).join(token.next);
        fs.writeFileSync(fileName, data, {encoding: "utf8"});    
    }
    catch (error) {
        console.log(error.message);
    }
}

fix("./node_modules/truffle/build/cli.bundled.js", [
    {prev: "request = new XHR2", next: "request = new XMLHttpRequest"},
    {prev: "error = errors.InvalidResponse", next: "error = payload.method === 'evm_revert' || payload.method === 'evm_snapshot' ? null : errors.InvalidResponse"},
    {prev: "display_path = \".\" + path.sep + path.relative(options.working_directory, import_path);", next: "if (options.fix_paths) {display_path = \".\" + path.sep + path.relative(options.working_directory, import_path); result[display_path] = result[import_path]; delete result[import_path];}"}]
);

fix("./node_modules/solidity-coverage/lib/app.js", [
    {prev: "events.push", next: "coverage.processEvent"}]
);

fix("./node_modules/solidity-coverage/lib/coverageMap.js", [
    {prev: "  generate(events, pathPrefix) {", next: "  processEvent(line) {"},
    {prev: "    for (let idx = 0; idx < events.length; idx++) {", next: ""},
    {prev: "      const event = JSON.parse(events[idx]);", next: "      const event = JSON.parse(line);"},
    {prev: "    // Finally, interpret the assert pre/post events", next: "  generate(events, pathPrefix) {"}]
);

fix("./node_modules/solidity-docgen/dist/gather/solidity/compile.js", [
    {prev: "_solc.default.compile", next: "_solc.default.compileStandard"}]
);

fix("./node_modules/solidity-docgen/dist/gather/solidity/extract.js", [
    {prev: "? name : kind", next: "? name : name"}]
);

fix("./node_modules/solidity-docgen/dist/gather/index.js", [
    {prev: "return 'index';", next: "return 'main';"}]
);

fix("./node_modules/solidity-docgen/dist/render/index.js", [
    {prev: "'<div class=\"contracts\">', sections.map(renderSection), '</div>'", next: "sections.map(renderSection)"}]
);

function copyDir(src, dest) {
    try {
        fs.mkdirSync(dest);
        for (const file of fs.readdirSync(src)) {
            if (fs.lstatSync(src + "/" + file).isDirectory()) {
                copyDir(src + "/" + file, dest + "/" + file);
            }
            else {
                fs.copyFileSync(src + "/" + file, dest + "/" + file);
            }
        }
    }
    catch (error) {
        console.log(error.message);
    }
};

copyDir("./node_modules/truffle/node_modules/solc", "./node_modules/solidity-docgen/node_modules/solc");

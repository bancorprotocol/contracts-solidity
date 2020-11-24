const fs = require("fs");

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

fix("./node_modules/@openzeppelin/test-environment/node_modules/ganache-core/node_modules/deferred-leveldown/deferred-leveldown.js",
    [{prev: "function DeferredLevelDOWN (db) {", next: "function DeferredLevelDOWN(db) {db.db = require('memdown')();"}]
);

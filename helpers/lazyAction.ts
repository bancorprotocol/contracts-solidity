import path from 'path';

// This is meant to go away as soon as hardhat implement this https://github.com/nomiclabs/hardhat/issues/1518

export function importCsjOrEsModule(filePath: string): any {
    const imported = require(filePath);
    return imported.default !== undefined ? imported.default : imported;
}

export function lazyAction(pathToAction: string) {
    return (taskArgs: any, hre: any, runSuper: any) => {
        const actualPath = path.isAbsolute(pathToAction)
            ? pathToAction
            : path.join(hre.config.paths.root, pathToAction);
        const action = importCsjOrEsModule(actualPath);

        return action(taskArgs, hre, runSuper);
    };
}

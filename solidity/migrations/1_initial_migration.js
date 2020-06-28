module.exports = (deployer, network, accounts) => {
    if (network === 'production') {
        deployer.deploy(artifacts.require('Migrations'));
    }
};

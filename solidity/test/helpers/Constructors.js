const { contract } = require('@openzeppelin/test-environment');

const bancorNetworkContract = contract.fromArtifact('BancorNetworkUpgradeable');

module.exports.constructorBancorNetwork = async (contractRegistryAddress) => {
    const bancorNetwork = await bancorNetworkContract.new();
    await bancorNetwork.initialize(contractRegistryAddress);
    return bancorNetwork;
};

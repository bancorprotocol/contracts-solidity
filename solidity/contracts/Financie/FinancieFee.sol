pragma solidity ^0.4.18;
import '../Utils.sol';

contract FinancieFee is Utils {

    uint32 private constant MAX_FINANCIE_FEE = 1000000;

    uint32 heroFee;
    uint32 teamFee;
    address hero_wallet;
    address team_wallet;

    function FinancieFee(uint32 _heroFee, uint32 _teamFee, address _hero_wallet, address _team_wallet) public {
        heroFee = _heroFee;
        teamFee = _teamFee;
        hero_wallet = _hero_wallet;
        team_wallet = _team_wallet;
    }

    function distributeFees(uint256 _amount) internal returns (uint256) {
        uint256 _heroFee = getHeroFee(_amount);
        uint256 _teamFee = getTeamFee(_amount);
        hero_wallet.transfer(_heroFee);
        team_wallet.transfer(_teamFee);

        return safeAdd(_heroFee, _teamFee);
    }

    function getHeroFee(uint256 _amount) private view returns (uint256) {
        return safeMul(_amount, heroFee) / MAX_FINANCIE_FEE;
    }

    function getTeamFee(uint256 _amount) private view returns (uint256) {
        return safeMul(_amount, teamFee) / MAX_FINANCIE_FEE;
    }

    function getFinancieFee(uint256 _amount) internal view returns (uint256) {
        return safeAdd(getHeroFee(_amount), getTeamFee(_amount));
    }

}

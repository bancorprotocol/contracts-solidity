pragma solidity ^0.4.18;
import '../utility/Utils.sol';

/**
    **FROZEN**
    Financie fee management contract
*/
contract FinancieFee is Utils {

    // Max fee percentage in ppm(=100%)
    uint32 private constant MAX_FINANCIE_FEE = 1000000;

    // Fee percentage in ppm for hero
    uint32 public heroFee;
    // Fee percentage in ppm for team
    uint32 public teamFee;
    // Receiver wallet address for hero fee
    address public hero_wallet;
    // Receiver wallet address for team fee
    address public team_wallet;

    /**
    *   @dev Constructor
    *   @param _heroFee       Fee percentage in ppm for hero
    *   @param _teamFee       Fee percentage in ppm for team
    *   @param _hero_wallet   Receiver wallet address for hero fee
    *   @param _team_wallet   Receiver wallet address for team fee
    */
    constructor(uint32 _heroFee, uint32 _teamFee, address _hero_wallet, address _team_wallet) public {
        heroFee = _heroFee;
        teamFee = _teamFee;
        hero_wallet = _hero_wallet;
        team_wallet = _team_wallet;
    }

    /**
    *   @dev Distribute fee in ether
    *   @param _amount        Fee target amount in wei
    *   @return               Distributed fee amount in wei
    */
    function distributeFees(uint256 _amount) internal returns (uint256) {
        uint256 _heroFee = getHeroFee(_amount);
        uint256 _teamFee = getTeamFee(_amount);
        hero_wallet.transfer(_heroFee);
        team_wallet.transfer(_teamFee);

        return safeAdd(_heroFee, _teamFee);
    }

    /**
    *   @dev Calculate fee for hero
    *   @param _amount        Fee target amount in wei
    *   @return               Fee amount for hero in wei
    */
    function getHeroFee(uint256 _amount) internal view returns (uint256) {
        return safeMul(_amount, heroFee) / MAX_FINANCIE_FEE;
    }

    /**
    *   @dev Calculate fee for team
    *   @param _amount        Fee target amount in wei
    *   @return               Fee amount for team in wei
    */
    function getTeamFee(uint256 _amount) internal view returns (uint256) {
        return safeMul(_amount, teamFee) / MAX_FINANCIE_FEE;
    }

    /**
    *   @dev Calculate total fee
    *   @param _amount        Fee target amount in wei
    *   @return               Total fee amount in wei
    */
    function getFinancieFee(uint256 _amount) internal view returns (uint256) {
        return safeAdd(getHeroFee(_amount), getTeamFee(_amount));
    }

}

pragma solidity ^0.4.18;
import '../utility/Utils.sol';
import '../token/interfaces/IERC20Token.sol';
import './IFinancieInternalWallet.sol';

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
    // Receiver wallet id for hero fee
    uint32 public hero_id;
    // Receiver wallet address for team fee
    address public team_wallet;

    bool public pendingRevenue;

    // Currency token for payment
    IERC20Token payment_currenty_token;

    IFinancieInternalWallet internalWallet;

    /**
    *   @dev setFee
    *   @param _heroFee       Fee percentage in ppm for hero
    *   @param _teamFee       Fee percentage in ppm for team
    *   @param _hero_id       Receiver id for hero fee
    *   @param _team_wallet   Receiver wallet address for team fee
    *   @param _payment_currency_token Currency token for payment
    */
    function setFee(
        uint32 _heroFee,
        uint32 _teamFee,
        uint32 _hero_id,
        address _team_wallet,
        address _payment_currency_token,
        address _internalWallet,
        bool    _pendingRevenue
    ) internal {
        heroFee = _heroFee;
        teamFee = _teamFee;
        hero_id = _hero_id;
        team_wallet = _team_wallet;
        payment_currenty_token = IERC20Token(_payment_currency_token);
        internalWallet = IFinancieInternalWallet(_internalWallet);
        pendingRevenue = _pendingRevenue;
    }

    /**
    *   @dev Distribute fee in ether
    *   @param _amount        Fee target amount in wei
    *   @return               Distributed fee amount in wei
    */
    function distributeFees(uint256 _amount) internal returns (uint256) {
        uint256 _heroFee = getHeroFee(_amount);
        uint256 _teamFee = getTeamFee(_amount);
        if ( _heroFee > 0 ) {
            require(hero_id != 0);
            if ( payment_currenty_token.allowance(this, address(internalWallet)) < _heroFee ) {
                payment_currenty_token.approve(address(internalWallet), 0);
            }
            payment_currenty_token.approve(address(internalWallet), _heroFee);
            if ( pendingRevenue ) {
                internalWallet.depositPendingRevenueCurrencyTokens(hero_id, _heroFee);
            } else {
                internalWallet.depositWithdrawableCurrencyTokens(hero_id, _heroFee);
            }
        }
        assert(payment_currenty_token.transfer(team_wallet, _teamFee));

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

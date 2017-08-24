pragma solidity ^0.4.11;
import './Owned.sol';
import './Utils.sol';
import './interfaces/IBancorFormula.sol';

/**
    @dev the BancorFormulaProxy is an owned contract that serves as a single point of access
    to the BancorFormula contract from all BancorChanger contract instances.
    it allows upgrading the BancorFormula contract without the need to update each and every
    BancorChanger contract instance individually.
*/
contract BancorFormulaProxy is IBancorFormula, Owned, Utils {
    IBancorFormula public formula;  // bancor calculation formula contract

    /**
        @dev constructor

        @param _formula address of a bancor formula contract
    */
    function BancorFormulaProxy(IBancorFormula _formula)
        validAddress(_formula)
    {
        formula = _formula;
    }

    /*
        @dev allows the owner to update the formula contract address

        @param _formula    address of a bancor formula contract
    */
    function setFormula(IBancorFormula _formula)
        public
        ownerOnly
        validAddress(_formula)
        notThis(_formula)
    {
        formula = _formula;
    }

    /**
        @dev proxy for the bancor formula purchase return calculation

        @param _supply             token total supply
        @param _reserveBalance     total reserve
        @param _reserveRatio       constant reserve ratio, 1-1000000
        @param _depositAmount      deposit amount, in reserve token

        @return purchase return amount
    */
    function calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _depositAmount) public constant returns (uint256) {
        return formula.calculatePurchaseReturn(_supply, _reserveBalance, _reserveRatio, _depositAmount);
     }

    /**
        @dev proxy for the bancor formula sale return calculation

        @param _supply             token total supply
        @param _reserveBalance     total reserve
        @param _reserveRatio       constant reserve ratio, 1-1000000
        @param _sellAmount         sell amount, in the token itself

        @return sale return amount
    */
    function calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _sellAmount) public constant returns (uint256) {
        return formula.calculateSaleReturn(_supply, _reserveBalance, _reserveRatio, _sellAmount);
    }
}

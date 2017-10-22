pragma solidity ^0.4.11;
import './TokenHolder.sol';
import './interfaces/IBancorConverterExtensions.sol';

/**
    @dev the BancorConverterExtensions contract is an owned contract that serves as a single point of access
    to the BancorFormula, BancorGasPriceLimit and BancorQuickConverter contracts from all BancorConverter contract instances.
    it allows upgrading these contracts without the need to update each and every
    BancorConverter contract instance individually.
*/
contract BancorConverterExtensions is IBancorConverterExtensions, TokenHolder {
    IBancorFormula public formula;  // bancor calculation formula contract
    IBancorGasPriceLimit public gasPriceLimit; // bancor universal gas price limit contract
    IBancorQuickConverter public quickConverter; // bancor quick converter contract

    /**
        @dev constructor

        @param _formula         address of a bancor formula contract
        @param _gasPriceLimit   address of a bancor gas price limit contract
        @param _quickConverter  address of a bancor quick converter contract
    */
    function BancorConverterExtensions(IBancorFormula _formula, IBancorGasPriceLimit _gasPriceLimit, IBancorQuickConverter _quickConverter)
        validAddress(_formula)
        validAddress(_gasPriceLimit)
        validAddress(_quickConverter)
    {
        formula = _formula;
        gasPriceLimit = _gasPriceLimit;
        quickConverter = _quickConverter;
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

    /*
        @dev allows the owner to update the gas price limit contract address

        @param _gasPriceLimit   address of a bancor gas price limit contract
    */
    function setGasPriceLimit(IBancorGasPriceLimit _gasPriceLimit)
        public
        ownerOnly
        validAddress(_gasPriceLimit)
        notThis(_gasPriceLimit)
    {
        gasPriceLimit = _gasPriceLimit;
    }

    /*
        @dev allows the owner to update the quick converter contract address

        @param _quickConverter  address of a bancor quick converter contract
    */
    function setQuickConverter(IBancorQuickConverter _quickConverter)
        public
        ownerOnly
        validAddress(_quickConverter)
        notThis(_quickConverter)
    {
        quickConverter = _quickConverter;
    }
}

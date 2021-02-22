// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IEtherToken.sol";
import "../utility/Utils.sol";

/**
 * @dev Ether tokenization contract
 */
contract EtherToken is IEtherToken, ERC20, Utils {
    using SafeMath for uint256;

    /**
     * @dev triggered when the total supply is increased
     *
     * @param _amount  amount that gets added to the supply
     */
    event Issuance(uint256 _amount);

    /**
     * @dev triggered when the total supply is decreased
     *
     * @param _amount  amount that gets removed from the supply
     */
    event Destruction(uint256 _amount);

    /**
     * @dev initializes a new EtherToken instance
     *
     * @param _name        token name
     * @param _symbol      token symbol
     */
    constructor(string memory _name, string memory _symbol) public ERC20(_name, _symbol) {}

    /**
     * @dev deposit ether on behalf of the sender
     */
    function deposit() public payable override {
        depositTo(_msgSender());
    }

    /**
     * @dev withdraw ether to the sender's account
     *
     * @param _amount  amount of ether to withdraw
     */
    function withdraw(uint256 _amount) public override {
        withdrawTo(_msgSender(), _amount);
    }

    /**
     * @dev deposit ether to be entitled for a given account
     *
     * @param _to      account to be entitled for the ether
     */
    function depositTo(address _to) public payable override notThis(_to) {
        _mint(_to, msg.value);

        emit Issuance(msg.value);
    }

    /**
     * @dev withdraw ether entitled by the sender to a given account
     *
     * @param _to      account to receive the ether
     * @param _amount  amount of ether to withdraw
     */
    function withdrawTo(address payable _to, uint256 _amount) public override notThis(_to) {
        _burn(_msgSender(), _amount);

        _to.transfer(_amount); // send the amount to the target account

        emit Destruction(_amount);
    }

    // ERC20 standard method overrides with some extra protection

    /**
     * @dev send coins
     * throws on any error rather then return a false flag to minimize user errors
     *
     * @param _to      target address
     * @param _value   transfer amount
     *
     * @return true if the transfer was successful, false if it wasn't
     */
    function transfer(address _to, uint256 _value) public override(IERC20, ERC20) notThis(_to) returns (bool) {
        return super.transfer(_to, _value);
    }

    /**
     * @dev an account/contract attempts to get the coins
     * throws on any error rather then return a false flag to minimize user errors
     *
     * @param _from    source address
     * @param _to      target address
     * @param _value   transfer amount
     *
     * @return true if the transfer was successful, false if it wasn't
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public override(IERC20, ERC20) notThis(_to) returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    /**
     * @dev deposit ether in the account
     */
    receive() external payable {
        deposit();
    }
}

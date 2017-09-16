# Enjin Token And Crowdfund Contract

## Testing
Tests are included and can be run using truffle.

### Prerequisites
* Node.js v7.6.0+
* truffle v3.2.2+
* testrpc v3.0.5+

To run the test, execute the following commands from the project's root folder -

Please run `yarn` first

Then run these commands:

* `npm run testrpc`
* `truffle test solidity/test/ENJToken.js`

As the dates of the crowdfund are hardcoded in the contract and we are increasing 
the blockchain time artificially, you will need to reset testrpc before running 
the second round of tests:

* `npm run testrpc`
* `truffle test solidity/test/ENJCrowdfund.js`



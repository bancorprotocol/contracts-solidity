var big = require("bignumber");
var BancorFormula = artifacts.require("./BancorFormula.sol");

function expectedThrow(error){
	if(error.toString().indexOf("invalid JUMP") != -1) {
		console.log("\tExpected throw. Test succeeded.");
	} else {
		assert(false, error.toString());
	}
}

/*function powerJS( _baseN,  _baseD,  _expN,  _expD){
    return (fixedExp(ln(_baseN, _baseD) * _expN / _expD), uint256(1) << PRECISION);
}
function calculatePurchaseReturnJS(_supply, _reserveBalance, _reserveRatio,_depositAmount){
	_depositAmount.plus(_reserveBalance)
	return _supply.times() resN / resD) - _supply;

}
*/


contract('BancorFormula', function(accounts){

	it("Throws exceptions at large input", function(){
		return BancorFormula.deployed().then(function(instance){
				var large = new big.BigInteger('0xFFFFF100000000000000000000000000000010');
				return instance.calculatePurchaseReturn.call(large,large,large,large);
	    }).then(function(retval) { 
	    	assert(false, "testThrow was supposed to throw but didn't.");
		}).catch(expectedThrow);
	});


	it("Should calculate purchase return correctly", function(){
		return BancorFormula.deployed().then(
			function(instance)
			{
				return instance.calculatePurchaseReturn.call(10,10,10,10);
			}).then(function(retval){
				assert.equal(retval.valueOf(),0,"Purchase return should be 0");
		    });
	});
});
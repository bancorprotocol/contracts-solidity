var big = require("bignumber");
var BancorFormula = artifacts.require("./BancorFormula.sol");

function expectedThrow(error){
	if(error.toString().indexOf("invalid JUMP") != -1) {
		console.log("\tExpected throw. Test succeeded.");
	} else {
		assert(false, error.toString());
	}
}


contract('BancorFormula', function(accounts){

	it("Throws exceptions at large input", function(){
		return BancorFormula.deployed().then(function(instance){
				var large = new big.BigInteger('0xFFFFF100000000000000000000000000000010');
				return instance.calculatePurchaseReturn.call(large,large,large,large);
	    }).then(function(retval) { 
	    	assert(false, "testThrow was supposed to throw but didn't.");
		}).catch(expectedThrow);
	});


	it("Should not be possible to purchase more than you're paying for", function(){

		var S = 300000//
		var R = 63000 // 63000 #
		var F = 21    //# 21% CRR 
		var E = 2
		return BancorFormula.deployed().then(
			function(instance)
			{
				return instance.calculatePurchaseReturn.call(S,R,F,E);
			}).then(function(retval){
				// 'Real' value is 1.999975 tokens, should be rounded down to 1
				assert.equal(retval.valueOf(),1,"Purchase return should be 1");
		    });
	});

	it("Should get enough tokens" , function(){

		var S = 300000//
		var R = 63000 // 63000 #
		var F = 21    //# 21% CRR 
		var E = 600 // Purchase for 600 Ether
		return BancorFormula.deployed().then(
			function(instance)
			{
				return instance.calculatePurchaseReturn.call(S,R,F,E);
			}).then(function(retval){
				// 'Real' value is 1.999975 tokens, should be rounded down to 1
				assert.equal(retval.valueOf(),597,"600 ether should give 597 (597.755599) tokens");
		    });
	});

	it("Should not be possible to get more on sale than you're selling", function(){

		var S = 299998// 299998
		var R = 62998 // 62998  #
		var F = 21    //# 21% CRR 
		var T = 2
		return BancorFormula.deployed().then(
			function(instance)
			{
				return instance.calculateSaleReturn.call(S,R,F,T);
			}).then(function(retval){
				// Real value is 1.999975 ether, which should be rounded down to 1
				assert.equal(retval.valueOf(),1,"Purchase return should be 1");
		    });
	});

});
var big = require("bignumber");
var testdata = require("./testdata.js")
var BancorFormula = artifacts.require("./BancorFormula.sol");
function isThrow(error){
  return error.toString().indexOf("invalid JUMP") != -1;
}

function expectedThrow(error){
  if(isThrow(error)) {
    console.log("\tExpected throw. Test succeeded.");
  } else {
    assert(false, error.toString());
  }
}
function _hex(hexstr){
  if(hexstr.startsWith("0x")){ 
    hexstr = hexstr.substr(2);
  }
  return new big.BigInteger(hexstr,16);
}

contract('BancorFormula', function(accounts){


  it("handles legal input ranges (fixedExp)", function(){
    return BancorFormula.deployed().then(function(instance){
        var ok = _hex('0x386bfdba29');
        return instance.fixedExp.call(ok);
      }).then(function(retval) { 
        var expected= _hex('0x59ce8876bf3a3b1bfe894fc4f5');
        assert.equal(expected.toString(16),retval.toString(16),"Wrong result for fixedExp at limit");
    });
  });

  it("throws outside input range (fixedExp) ", function(){
    return BancorFormula.deployed().then(function(instance){
        var ok = _hex('0x386bfdba2a');
        return instance.fixedExp.call(ok);
      }).then(function(retval) { 
        assert(false, "testThrow was supposed to throw but didn't.");
    }).catch(expectedThrow);
  });


  it("Throws exceptions at large input", function(){
    return BancorFormula.deployed().then(function(instance){
        var large = _hex('0xFFFFF100000000000000000000000000000010');
        return instance.calculatePurchaseReturn.call(large,large,30,large);
      }).then(function(retval) { 
        assert(false, "testThrow was supposed to throw but didn't: "+retval.toString(16));
    }).catch(expectedThrow);
  });

  var purchaseTest = function(k){
      var [S,R,F,E,expect,exact] = k
      it("Should get correct amount of tokens when purchasing", function(){
        return BancorFormula.deployed().then(
          function(f)
          {
            return f.calculatePurchaseReturn.call(S,R,F,E);
          }).then(function(retval){
            assert(retval.valueOf() <= expect,"Purchase return "+retval+" should be <="+expect+" ( "+exact+"). [S,R,F,E] "+[S,R,F,E]);
            }).catch(function(error){
              if(isThrow(error)){
                assert(false, "Purchase return generated throw");
              }else{
                assert(false, error.toString());
              }
            });
      });
    }
  var saleTest = function(k){
      var [S,R,F,T,expect,exact] = k
      it("Should get correct amount of Ether when selling", function(){
        return BancorFormula.deployed().then(
          function(f)
          {
            return f.calculateSaleReturn.call(S,R,F,T);
          }).then(function(retval){
            assert(retval.valueOf() <= expect,"Sale return "+retval+" should be <="+expect+" ( "+exact+"). [S,R,F,T] "+[S,R,F,T]);

            }).catch(function(error){
              if(isThrow(error)){
                assert(false, "Sale return generated throw");
              }else{
                assert(false, error.toString());
              }
            });;
      });
    }

  testdata.purchaseReturnsErrors.forEach(purchaseTest);
  testdata.purchaseReturns.forEach(purchaseTest);
  testdata.randomPurchaseReturns.forEach(purchaseTest);
  testdata.randomPurchaseReturns2.forEach(purchaseTest);
  testdata.saleReturns.forEach(saleTest);
  testdata.randomSaleReturns.forEach(saleTest);
  testdata.randomSaleReturns2.forEach(saleTest);
  
});
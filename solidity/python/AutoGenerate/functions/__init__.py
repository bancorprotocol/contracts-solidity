def optimalLog(x,hiTerms,loTerms,fixedOne):
    res = 0
    for term in hiTerms[+1:]:
        if x >= term.exp:
            res = add(res,term.val)
            x = mul(x,fixedOne)//term.exp
    z = y = sub(x,fixedOne)
    w = mul(y,y)//fixedOne
    for term in loTerms[:-1]:
        res = add(res,mul(z,sub(term.num,y))//term.den)
        z = mul(z,w)//fixedOne
    res = add(res,mul(z,sub(loTerms[-1].num,y))//loTerms[-1].den)
    return res


def optimalExp(x,hiTerms,loTerms,fixedOne):
    res = 0
    z = y = x % hiTerms[0].bit
    for term in loTerms[+1:]:
        z = mul(z,y)//fixedOne
        res = add(res,mul(z,term.val))
    res = add(add(res//loTerms[0].val,y),fixedOne)
    for term in hiTerms[:-1]:
        if x & term.bit:
            res = mul(res,term.num)//term.den
    return res


def add(x,y):
    assert (x + y) < (1 << 256)
    return (x + y)


def sub(x,y):
    assert (x - y) >= 0
    return (x - y)


def mul(x,y):
    assert (x * y) < (1 << 256)
    return (x * y)


def shl(x,y):
    assert (x << y) < (1 << 256)
    return (x << y)

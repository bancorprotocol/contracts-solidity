from web3 import Web3
from web3 import HTTPProvider
from os.path import dirname
from json import loads


eth = Web3(HTTPProvider("http://127.0.0.1:8545")).eth


class Contract():
    def __init__(self,moduleName,ownerAddress='',args=[]):
        path = dirname(dirname(dirname(__file__)))+'/build/'
        abi = open(path+moduleName+'.abi').read()
        bin = open(path+moduleName+'.bin').read()
        self.contract = eth.contract(abi=loads(abi),bytecode=bin)
        self.transact = {'from':ownerAddress if ownerAddress else eth.accounts[0]}
        self.address  = eth.getTransactionReceipt(self.contract.deploy(transaction=self.transact,args=args))['contractAddress']
    def owner(self):
        return self.transact['from']
    def getter(self):
        return self.contract(self.address).call(self.transact)
    def setter(self):
        return self.contract(self.address).transact(self.transact)
    def tester(self):
        return self.contract(self.address).estimateGas(self.transact)
    def decode(hash,index,params):
        event = {}
        index1 = 1
        index2 = 2
        log = eth.getTransactionReceipt(hash)['logs'][index]
        for param in params:
            if param['indexed']:
                event[param['name']] = int(log['topics'][index1],16)
                index1 += 1
            else:
                size = param['size']//4
                event[param['name']] = int(log['data'][index2:index2+size],16)
                index2 += size
        return event

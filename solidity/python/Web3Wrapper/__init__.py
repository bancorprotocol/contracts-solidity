from web3 import Web3
from web3 import RPCProvider
from os.path import dirname
from json import loads


eth = Web3(RPCProvider()).eth


class Contract():
    def __init__(self,moduleName,ownerAddress='',args=[]):
        path = dirname(dirname(dirname(__file__)))+'/contracts/build/'
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
    def decode(hash,logIndex,eventParams):
        event = {}
        index = 2
        data = eth.getTransactionReceipt(hash)['logs'][logIndex]['data']
        for eventParam in eventParams:
            if not eventParam['indexed']:
                name = eventParam['name']
                size = eventParam['size']//4
                event[name] = int(data[index:index+size],16)
                index += size
        return event

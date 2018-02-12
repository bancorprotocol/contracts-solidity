from web3 import Web3
from web3 import RPCProvider
from json import loads


class Contract():
    ethereum = Web3(RPCProvider()).eth
    def __init__(self,moduleName,ownerAddress='',args=[]):
        path = '../../solidity/contracts/build/'
        abi = open(path+moduleName+'.abi').read()
        bin = open(path+moduleName+'.bin').read()
        self.contract = Contract.ethereum.contract(abi=loads(abi),bytecode=bin)
        self.transact = {'from':ownerAddress if ownerAddress else Contract.ethereum.accounts[0]}
        self.address  = Contract.ethereum.getTransactionReceipt(self.contract.deploy(transaction=self.transact,args=args))['contractAddress']
    def owner(self):
        return self.transact['from']
    def getter(self):
        return self.contract(self.address).call(self.transact)
    def setter(self):
        return self.contract(self.address).transact(self.transact)
    def tester(self):
        return self.contract(self.address).estimateGas(self.transact)
    def retval(self,hash):
        return int(Contract.ethereum.getTransactionReceipt(hash)['logs'][-1]['data'],0)

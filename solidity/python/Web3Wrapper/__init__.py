from web3 import Web3
from web3 import HTTPProvider
from os.path import dirname
from json import loads


web3 = Web3(HTTPProvider('http://127.0.0.1:7545',request_kwargs={'timeout':60}))


transaction = {
    'from'    :web3.eth.accounts[0],
    'gasPrice':web3.eth.gasPrice,
    'gas'     :web3.eth.getBlock('latest').gasLimit
}


class Contract():
    def __init__(self,moduleName,args=[]):
        path = dirname(dirname(dirname(__file__)))+'/build/'
        abi = open(path+moduleName+'.abi').read()
        bin = open(path+moduleName+'.bin').read()
        self.contract = web3.eth.contract(abi=loads(abi),bytecode=bin)
        self.address  = web3.eth.getTransactionReceipt(self.contract.deploy(transaction,args))['contractAddress']
    def balance(self):
        return web3.eth.getBalance(self.address)
    def getter(self,extension={}):
        return self.contract(self.address).call({**transaction,**extension})
    def setter(self,extension={}):
        return self.contract(self.address).transact({**transaction,**extension})
    def tester(self,extension={}):
        return self.contract(self.address).estimateGas({**transaction,**extension})
    def decode(hash,index,params):
        event = {}
        index1 = 1
        index2 = 2
        log = web3.eth.getTransactionReceipt(hash)['logs'][index]
        for param in params:
            if param['indexed']:
                event[param['name']] = int(log['topics'][index1].hex(),16)
                index1 += 1
            else:
                event[param['name']] = int(log['data'][index2:index2+param['size']//4],16)
                index2 += param['size']//4
        return event
    def jump(seconds):
        web3.providers[0].make_request('evm_increaseTime',[seconds])

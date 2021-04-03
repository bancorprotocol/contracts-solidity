from sys import path
from subprocess import run

port     = 7545
gasPrice = 1
gasLimit = 2**53-1
privKey  = 1
balance  = 2**256-1

run([
    'node',
    '{}/../../node_modules/ganache-cli/cli.js'.format(path[0]),
    '--port={}'.format(port),
    '--gasPrice={}'.format(gasPrice),
    '--gasLimit={}'.format(gasLimit),
    '--account={0:#0{1}x},{2}'.format(privKey,65,balance)
])
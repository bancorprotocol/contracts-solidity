import sys
import math
import pymongo
import FormulaSolidityPort
import FormulaNativePython


USERNAME      = ''
PASSWORD      = ''
SERVER_NAME   = '127.0.0.1:27017'
DATABASE_NAME = 'test'


MINIMUM_VALUE_SUPPLY  = 100
MAXIMUM_VALUE_SUPPLY  = 10**34
GROWTH_FACTOR_SUPPLY  = 1.5


MINIMUM_VALUE_RESERVE = 100
MAXIMUM_VALUE_RESERVE = 10**34
GROWTH_FACTOR_RESERVE = 1.5


MINIMUM_VALUE_RATIO   = 10
MAXIMUM_VALUE_RATIO   = 90
GROWTH_FACTOR_RATIO   = 1.25


MINIMUM_VALUE_AMOUNT  = 1
MAXIMUM_VALUE_AMOUNT  = 10**34
GROWTH_FACTOR_AMOUNT  = 1.5


TRANSACTION_SUCCESS  = 0
TRANSACTION_FAILURE  = 1
TRANSACTION_INVALID  = 2
IMPLEMENTATION_ERROR = 3


def Main():
    username      = USERNAME     
    password      = PASSWORD     
    server_name   = SERVER_NAME  
    database_name = DATABASE_NAME
    for arg in sys.argv[1:]:
        username      = arg[len('username='     ):] if arg.startswith('username='     ) else username     
        password      = arg[len('password='     ):] if arg.startswith('password='     ) else password     
        server_name   = arg[len('server_name='  ):] if arg.startswith('server_name='  ) else server_name  
        database_name = arg[len('database_name='):] if arg.startswith('database_name=') else database_name
    if username and password:
        uri = 'mongodb://{}:{}@{}/{}'.format(username,password,server_name,database_name)
    else:
        uri = 'mongodb://{}/{}'.format(server_name,database_name)
    TestAll(pymongo.MongoClient(uri)[database_name]['purchase'])


def TestAll(collection):
    range_supply  = GenerateRange(MINIMUM_VALUE_SUPPLY ,MAXIMUM_VALUE_SUPPLY ,GROWTH_FACTOR_SUPPLY )
    range_reserve = GenerateRange(MINIMUM_VALUE_RESERVE,MAXIMUM_VALUE_RESERVE,GROWTH_FACTOR_RESERVE)
    range_ratio   = GenerateRange(MINIMUM_VALUE_RATIO  ,MAXIMUM_VALUE_RATIO  ,GROWTH_FACTOR_RATIO  )
    range_amount  = GenerateRange(MINIMUM_VALUE_AMOUNT ,MAXIMUM_VALUE_AMOUNT ,GROWTH_FACTOR_AMOUNT )
    for             supply  in range_supply :
        for         reserve in range_reserve:
            for     ratio   in range_ratio  :
                for amount  in range_amount :
                    if True:
                        resultSolidityPort = Run(FormulaSolidityPort,supply,reserve,ratio,amount)
                        resultNativePython = Run(FormulaNativePython,supply,reserve,ratio,amount)
                        if resultNativePython < 0:
                            status = TRANSACTION_INVALID
                            loss = {'absolute':0,'relative':0}
                        elif resultSolidityPort < 0:
                            status = TRANSACTION_FAILURE
                            loss = {'absolute':0,'relative':0}
                        elif resultNativePython < resultSolidityPort:
                            status = IMPLEMENTATION_ERROR
                            loss = {'absolute':0,'relative':0}
                        else: # 0 <= resultSolidityPort <= resultNativePython
                            status = TRANSACTION_SUCCESS
                            loss = {'absolute':float(resultNativePython-resultSolidityPort),'relative':1-float(resultSolidityPort/resultNativePython)}
                        entry = {
                            'supply' :'{}'.format(supply ),
                            'reserve':'{}'.format(reserve),
                            'ratio'  :'{}'.format(ratio  ),
                            'amount' :'{}'.format(amount ),
                            'resultSolidityPort':'{}'    .format(resultSolidityPort),
                            'resultNativePython':'{:.2f}'.format(resultNativePython),
                            'status':status,
                            'loss'  :loss  ,
                        }
                        id = collection.insert(entry)
                        print ', '.join('{}: {}'.format(key,entry[key]) for key in ['supply','reserve','ratio','amount','resultSolidityPort','resultNativePython','status','loss'])


def Run(module,supply,reserve,ratio,amount):
    try:
        return module.calculatePurchaseReturn(supply,reserve,ratio,amount)
    except Exception:
        return -1


def GenerateRange(minimumValue,maximumValue,growthFactor):
    return [int(minimumValue*growthFactor**n) for n in range(int(math.log(float(maximumValue)/float(minimumValue),growthFactor))+1)]


Main()

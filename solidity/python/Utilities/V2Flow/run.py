from sys    import argv
from json   import loads
from engine import newPool
from csv    import DictWriter

def main():
    fileName = argv[1] if len(argv) > 1 else 'example_commands.json'
    fileDesc = open(fileName)
    fileData = fileDesc.read()
    fileDesc.close()
    state = execute(loads(fileData))
    fileName = argv[2] if len(argv) > 2 else 'example_report.csv'
    fileDesc = open(fileName, 'w', newline = '')
    saveReport(fileDesc, state)
    fileDesc.close()

def execute(commands):
    state = []
    for command in commands:
        print(command)
        if command['operation'] == 'newPool':
            pool = newPool(command['amp'], command['mainToken'], command['sideToken'], command['numOfUsers'], command['initialAmount'])
        elif command['operation'] == 'setFees':
            pool.setFees(command['cFee'], command['dFee'])
        elif command['operation'] == 'setRates':
            pool.setRates(command['mainRate'], command['sideRate'])
        elif command['operation'] == 'addLiquidity':
            pool.addLiquidity(command['token'], command['user'], command['amount'])
        elif command['operation'] == 'remLiquidity':
            pool.remLiquidity(command['token'], command['user'], command['amount'])
        elif command['operation'] == 'convert':
            pool.convert(command['updateWeights'], command['sourceToken'], command['targetToken'], command['user'], command['amount'])
        elif command['operation'] == 'closeArbitrage':
            pool.closeArbitrage(command['user'])
        else:
            raise Exception('Undefined operation')
        state.append(flatten(pool.serialize()))
    return state

def flatten(deepObject, prefixes = []):
    flatObject = {}
    for key, val in deepObject.items():
        if type(val) is dict:
            flatObject.update(flatten(val, prefixes + [key]))
        else:
            flatObject['.'.join(prefixes + [key])] = val
    return flatObject

def saveReport(fileDesc, state):
    dictWriter = DictWriter(fileDesc, state[0].keys())
    dictWriter.writeheader()
    dictWriter.writerows(state)

main()
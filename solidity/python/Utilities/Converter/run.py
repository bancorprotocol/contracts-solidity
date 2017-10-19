from sys    import argv
from json   import loads
from json   import dumps
from engine import Engine


def main():
    fileName = argv[1] if len(argv) > 1 else 'example_commands.json'
    fileDesc = open(fileName)
    fileData = fileDesc.read()
    fileDesc.close()
    store    = {}
    engine   = Engine({})
    commands = loads(fileData)
    for command in commands:
        if command['operation'] == 'print':
            print command['info']
        elif command['operation'] == 'load':
            fileName = command['file']
            fileDesc = open(fileName,'r')
            fileData = fileDesc.read()
            fileDesc.close()
            engine = Engine(loads(fileData))
            print 'Load',fileName
        elif command['operation'] == 'save':
            fileName = command['file']
            fileData = dumps(engine.model,indent=4,sort_keys=True)
            fileDesc = open(fileName,'w')
            fileDesc.write(fileData)
            fileDesc.close()
            print 'Save',fileName
        elif command['operation'] == 'convert':
            args = command['line'].split()
            case = [all(c == '?' for c in args[n]) for n in [0,3]]
            if case == [False,False]: print 'Cannot convert specified amount to specified amount'
            if case == [False,True ]: print 'Explicit:',convert(engine,+1,args[1],args[4],args[0],command['result'],command['update'],store)
            if case == [True ,False]: print 'Implicit:',convert(engine,-1,args[1],args[4],args[3],command['result'],command['update'],store)
            if case == [True ,True ]: print 'Cannot convert unspecified amount to unspecified amount'
        else:
            print 'Undefined operation'


def convert(engine,sign,source,target,input,output,update,store):
    path,amounts = engine.convert(sign,source,target,store[input] if input in store else input,update)
    if output:
        store[output] = amounts[-(sign+1)/2]
    return ' = '.join(['{} {}'.format(amount,currency) for amount,currency in zip(amounts,path)])


main()
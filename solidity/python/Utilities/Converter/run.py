from sys    import argv
from json   import loads
from json   import dumps
from engine import Engine


def main():
    fileName = argv[1] if len(argv) > 1 else 'example_commands.json'
    fileDesc = open(fileName)
    fileData = fileDesc.read()
    fileDesc.close()
    variables = {}
    engine    = Engine({})
    commands  = loads(fileData)
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
            convertArgs  = command['line'].split()
            sourceAmount = variables[convertArgs[0]] if convertArgs[0] in variables else convertArgs[0]
            targetAmount = variables[convertArgs[3]] if convertArgs[3] in variables else convertArgs[3]
            convertType  = [sourceAmount.isdigit(),targetAmount.isdigit()]
            if convertType == [True ,True ]: print 'Cannot convert specified amount to specified amount'
            if convertType == [True ,False]: print 'Explicit:',convert(engine,+1,convertArgs[1],convertArgs[4],sourceAmount,command['update'],targetAmount,variables)
            if convertType == [False,True ]: print 'Implicit:',convert(engine,-1,convertArgs[1],convertArgs[4],targetAmount,command['update'],sourceAmount,variables)
            if convertType == [False,False]: print 'Cannot convert unspecified amount to unspecified amount'
        else:
            print 'Undefined operation'


def convert(engine,sign,source,target,amount,update,variable,variables):
    path,amounts = engine.convert(sign,source,target,int(amount),update)
    if '?' not in variable:
        variables[variable] = str(amounts[-(sign+1)/2])
    return ' = '.join(['{} {}'.format(amount,currency) for amount,currency in zip(amounts,path)])


main()
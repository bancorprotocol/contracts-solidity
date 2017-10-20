from sys    import argv
from json   import loads
from json   import dumps
from engine import Engine


store  = {}
report = []
engine = Engine()


def main():
    fileName = argv[1] if len(argv) > 1 else 'example_commands.json'
    fileDesc = open(fileName)
    fileData = fileDesc.read()
    fileDesc.close()
    execute(loads(fileData))
    fileName = argv[2] if len(argv) > 2 else 'example_report.csv'
    fileDesc = open(fileName,'w')
    fileDesc.write(report2csv())
    fileDesc.close()


def execute(commands):
    for command in commands:
        if command['operation'] == 'print':
            print command['info']
        elif command['operation'] == 'load':
            fileName = command['file']
            fileDesc = open(fileName,'r')
            fileData = fileDesc.read()
            fileDesc.close()
            engine.set(loads(fileData))
            print 'Load',fileName
        elif command['operation'] == 'save':
            fileName = command['file']
            fileData = dumps(engine.get(),indent=4,sort_keys=True)
            fileDesc = open(fileName,'w')
            fileDesc.write(fileData)
            fileDesc.close()
            print 'Save',fileName
        elif command['operation'] == 'convert':
            args = command['line'].split()
            case = [all(c == '?' for c in args[n]) for n in [0,3]]
            if case == [False,False]: print 'Cannot convert specified amount to specified amount'
            if case == [False,True ]: print 'Explicit:',convert(+1,args[1],args[4],args[0],command['result'],command['update'])
            if case == [True ,False]: print 'Implicit:',convert(-1,args[1],args[4],args[3],command['result'],command['update'])
            if case == [True ,True ]: print 'Cannot convert unspecified amount to unspecified amount'
        else:
            print 'Undefined operation'


def convert(sign,source,target,input,output,update):
    entries = engine.convert(sign,source,target,store[input] if input in store else input,update)
    report.append(entries)
    if output:
        store[output] = entries[-(sign+1)/2]['amount']
    return ' = '.join(['{:.2f} {}'.format(entry['amount'],entry['currency']) for entry in entries])


def report2csv():
    rows = ['Source Amount,Source Token,Target Amount,Target Token,Rate,Supply Before,Balance Before,Supply After,Balance After']
    for entries in report:
        for first,second in [(entries[0],entries[-1])]:
            rows += ['{:.2f},{},{:.2f},{},{:.2f},,,,'.format(first['amount'],first['currency'],second['amount'],second['currency'],first['amount']/second['amount'])]
        for first,second in zip(entries,entries[1:]):
            rows += ['{:.2f},{},{:.2f},{},,{:.2f},{:.2f},{:.2f},{:.2f}'.format(first['amount'],first['currency'],second['amount'],second['currency'],first['supply'],first['balance'],second['supply'],second['balance'])]
    maxLens = [len(col) for col in rows[0].split(',')]
    for row in rows[1:]:
        maxLens = [max(first,second) for first,second in zip(maxLens,[len(col) for col in row.split(',')])]
    formatStrings = ['{}{}{}'.format('{:',maxLen,'s}') for maxLen in maxLens]
    return '\n'.join([' , '.join([first.format(second) for first,second in zip(formatStrings,row.split(','))]) for row in rows])+'\n'


main()
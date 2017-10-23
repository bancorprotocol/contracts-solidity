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
    report.append([sign,entries])
    if output:
        store[output] = entries[-(sign+1)/2]['amount']
    return ' = '.join(['{:.2f} {}'.format(entry['amount'],entry['currency']) for entry in entries])


def report2csv():
    rows = ['Source Amount,Source Token,Target Amount,Target Token,Output Amount,Output Token,Rate,Supply Before,Balance Before,Supply After,Balance After']
    for sign,entries in report:
        rows += [tuple2csv(sign,entries[0],entries[-1],True)]
        if len(entries) > 2:
            rows += [tuple2csv(sign,first,second,False) for first,second in zip(entries,entries[1:])]
    allLens = [[len(col) for col in row.split(',')] for row in rows]
    maxLens = [max([row[n] for row in allLens]) for n in range(len(allLens[0]))]
    fmtStrs = ['{}{}{}'.format('{:',maxLen,'s}') for maxLen in maxLens]
    return '\n'.join([' , '.join([first.format(second) for first,second in zip(fmtStrs,row.split(','))]) for row in rows])+'\n'


def tuple2csv(sign,first,second,title):
    return ','.join(col for col in
    [
        '{:.2f}'.format(first['amount']),
        '{}'    .format(first['currency']),
        '{:.2f}'.format(second['amount']),
        '{}'    .format(second['currency']),
        '{:.2f}'.format([first,second][(sign+1)/2]['amount']),
        '{}'    .format([first,second][(sign+1)/2]['currency']),
        '{:.2f}'.format(first['amount']/second['amount']) if title else '',
        '{:.2f}'.format(first['supply']),
        '{:.2f}'.format(first['balance']),
        '{:.2f}'.format(second['supply']),
        '{:.2f}'.format(second['balance'])
    ])


main()
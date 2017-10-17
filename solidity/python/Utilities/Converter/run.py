from sys    import argv
from engine import Engine


Engine.run(argv[1],argv[2]) if len(argv) > 2 else Engine.run('example_database.json','example_commands.json')
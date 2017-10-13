from sys    import argv
from engine import Engine


Engine().run(argv[1] if len(argv) > 1 else 'commands.json')
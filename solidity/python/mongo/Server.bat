set DBPATH=Storage
if not exist "%DBPATH%" mkdir "%DBPATH%"
"%PROGRAMFILES%\MongoDB\Server\3.4\bin\mongod" --dbpath "%DBPATH%"
pause

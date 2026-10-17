$ErrorActionPreference = "Stop"
. "D:\synclyrc\worker\scripts\env.ps1"
& "D:\synclyrc\worker\.venv\Scripts\python.exe" -m pytest "D:\synclyrc\worker\tests" -v

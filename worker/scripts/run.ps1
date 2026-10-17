$ErrorActionPreference = "Stop"
. "D:\synclyrc\worker\scripts\env.ps1"
& "D:\synclyrc\worker\.venv\Scripts\python.exe" -m uvicorn synclrc_worker.main:app --host 127.0.0.1 --port 8765

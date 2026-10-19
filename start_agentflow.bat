@echo off
title AgentFlow - Autonomous Private AI Assistant
echo ============================================================
echo   AgentFlow: Autonomous Private AI Work Assistant
echo   Running locally on http://127.0.0.1:8000
echo ============================================================
echo.

cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    echo [OK] Using virtual environment (.venv)
    set "PY_CMD=.venv\Scripts\python.exe"
) else (
    echo [!] Virtual environment not found. Falling back to system python.
    set "PY_CMD=python"
)

echo.
echo Opening browser at http://127.0.0.1:8000 ...
start "" "http://127.0.0.1:8000"

echo Starting FastAPI Backend + React UI Server...
%PY_CMD% -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
pause

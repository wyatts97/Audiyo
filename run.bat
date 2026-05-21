@echo off
echo ========================================
echo Starting Synchrio Application
echo ========================================
echo.

REM Check if node_modules exist in backend
if not exist "app\backend\node_modules" (
    echo Installing backend dependencies...
    cd app\backend
    call npm install
    cd ..\..
    echo.
)

REM Check if node_modules exist in frontend
if not exist "app\frontend\node_modules" (
    echo Installing frontend dependencies...
    cd app\frontend
    call npm install
    cd ..\..
    echo.
)

echo Starting backend server...
start "Synchrio Backend" cmd /k "cd app\backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting frontend server...
start "Synchrio Frontend" cmd /k "cd app\frontend && npm run dev"

echo.
echo ========================================
echo Synchrio is starting!
echo ========================================
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press any key to stop all servers...
pause >nul

echo.
echo Stopping servers...
taskkill /FI "WindowTitle eq Synchrio Backend*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq Synchrio Frontend*" /T /F >nul 2>&1
echo Servers stopped.

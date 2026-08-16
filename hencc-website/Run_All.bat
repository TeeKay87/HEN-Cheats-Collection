@echo off
setlocal
cd /d "%~dp0"

title HENCC Website v2 - Build and Run

echo.
echo ==========================================
echo   HENCC Website v2
echo   Install - Build - Development Server
echo ==========================================
echo.

echo [1/3] Installing dependencies...
echo.
call npm install

if errorlevel 1 goto :error

echo.
echo ==========================================
echo [2/3] Building website...
echo ==========================================
echo.
call npm run build

if errorlevel 1 goto :error

echo.
echo ==========================================
echo [3/3] Starting development server...
echo ==========================================
echo.
echo The development server will keep running
echo until you stop it with Ctrl+C.
echo.

call npm run dev

echo.
echo ==========================================
echo   Development server stopped
echo ==========================================
echo.
pause
exit /b 0


:error
echo.
echo ==========================================
echo   ERROR
echo ==========================================
echo.
echo One of the commands failed.
echo Check the output above for details.
echo.
pause
exit /b 1
@echo off
cd /d "%~dp0"
set PORT=8080
echo.
echo  ========================================
echo   Maher Academy - local site server
echo  ========================================
echo.
echo  Open in browser:
echo    http://localhost:%PORT%/login.html
echo    http://localhost:%PORT%/index.html
echo.
echo  Press Ctrl+C to stop.
echo.

where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 -m http.server %PORT%
    goto :eof
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
    python -m http.server %PORT%
    goto :eof
)

where npx >nul 2>nul
if %ERRORLEVEL%==0 (
    npx --yes serve -l %PORT%
    goto :eof
)

echo ERROR: Install Python 3 or Node.js, then run this file again.
pause

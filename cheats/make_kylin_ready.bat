@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "DEST=%ROOT%kylin\cheats"

set /a MOVED=0
set /a FAILED=0
set /a MISSING_FOLDERS=0

echo Creating output folder:
echo "%DEST%"
echo.

if not exist "%DEST%" (
    mkdir "%DEST%"
)

echo Moving files from:
echo "%ROOT%json"
echo "%ROOT%mc4"
echo "%ROOT%shn"
echo.
echo Existing files with the same name will be overwritten.
echo.

call :MoveFiles "%ROOT%json" "*.json"
call :MoveFiles "%ROOT%mc4" "*.mc4"
call :MoveFiles "%ROOT%shn" "*.shn"

echo.
echo Done.
echo Moved:           %MOVED%
echo Failed:          %FAILED%
echo Missing folders: %MISSING_FOLDERS%
echo.
pause
exit /b


:MoveFiles
set "SOURCE_FOLDER=%~1"
set "PATTERN=%~2"

if not exist "%SOURCE_FOLDER%" (
    echo Missing folder: "%SOURCE_FOLDER%"
    set /a MISSING_FOLDERS+=1
    exit /b
)

for %%F in ("%SOURCE_FOLDER%\%PATTERN%") do (
    if exist "%%~fF" (
        call :MoveOne "%%~fF"
    )
)

exit /b


:MoveOne
set "SRC=%~1"
set "NAME=%~nx1"
set "TARGET=%DEST%\%NAME%"

move /Y "%SRC%" "%TARGET%" >nul

if errorlevel 1 (
    echo FAILED: "%SRC%"
    set /a FAILED+=1
) else (
    echo Moved: "%SRC%" ^> "%TARGET%"
    set /a MOVED+=1
)

exit /b
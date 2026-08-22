@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "ROOT=%~dp0"
set "DEST=%ROOT%data\kylin\cheats"

set /a COPIED=0
set /a RENAMED=0
set /a COLLISIONS=0
set /a FAILED=0
set /a MISSING_FOLDERS=0

echo Creating output folder:
echo "%DEST%"
echo.

if not exist "%DEST%\" (
    mkdir "%DEST%"
)

echo Copying files only from:
echo "%ROOT%json"
echo "%ROOT%mc4"
echo "%ROOT%shn"
echo.
echo The data folder is ignored as a source.
echo Hash suffixes _xxxxxxxx are removed while copying.
echo On name conflicts, only the largest file is kept.
echo.

call :CopyFiles "%ROOT%json" "*.json"
call :CopyFiles "%ROOT%mc4" "*.mc4"
call :CopyFiles "%ROOT%shn" "*.shn"

echo.
echo Done.
echo Copied:          %COPIED%
echo Hash renamed:    %RENAMED%
echo Name conflicts:  %COLLISIONS%
echo Failed:          %FAILED%
echo Missing folders: %MISSING_FOLDERS%
echo.
pause
exit /b

:CopyFiles
set "SOURCE_FOLDER=%~1"
set "PATTERN=%~2"

if not exist "%SOURCE_FOLDER%\" (
    echo Missing folder: "%SOURCE_FOLDER%"
    set /a MISSING_FOLDERS+=1
    exit /b
)

for %%F in ("%SOURCE_FOLDER%\%PATTERN%") do (
    if exist "%%~fF" (
        call :CopyOne "%%~fF"
    )
)

exit /b

:CopyOne
set "SRC=%~1"
set "ORIGINAL_NAME=%~nx1"

call :MakeCleanName "%SRC%"

if /I not "%ORIGINAL_NAME%"=="%CLEAN_STEM%%EXT%" (
    set /a RENAMED+=1
)

call :BuildUniqueTarget "%DEST%" "%CLEAN_STEM%" "%EXT%"
if "%SHOULD_COPY%"=="0" exit /b

copy /Y "%SRC%" "%TARGET%" >nul

if errorlevel 1 (
    echo FAILED: "%SRC%"
    set /a FAILED+=1
) else (
    echo Copied: "%SRC%" ^> "%TARGET%"
    set /a COPIED+=1
)

exit /b

:MakeCleanName

set "STEM=%~n1"
set "EXT=%~x1"
set "CLEAN_STEM=%STEM%"

set "SEP=%STEM:~-9,1%"
if not "%SEP%"=="_" exit /b

set "TAIL=%STEM:~-8%"
set "NONHEX="

for /f "delims=0123456789abcdefABCDEF" %%H in ("%TAIL%") do set "NONHEX=%%H"

if defined NONHEX exit /b

set "CLEAN_STEM=%STEM:~0,-9%"
exit /b

:BuildUniqueTarget

set "TARGET_FOLDER=%~1"
set "TARGET_STEM=%~2"
set "TARGET_EXT=%~3"

set "TARGET=%TARGET_FOLDER%\%TARGET_STEM%%TARGET_EXT%"
set "SHOULD_COPY=1"
if not exist "%TARGET%" exit /b

set /a COLLISIONS+=1

for %%S in ("%SRC%") do set "SRC_SIZE=%%~zS"
for %%T in ("%TARGET%") do set "TARGET_SIZE=%%~zT"

call :ChooseLargest
exit /b

:ChooseLargest
if %SRC_SIZE% GTR %TARGET_SIZE% exit /b
set "SHOULD_COPY=0"
exit /b

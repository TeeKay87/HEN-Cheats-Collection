@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "ROOT=%~dp0"
set "DEST=%ROOT%data\PHU\cheats"
set "DEST_PS4=%DEST%\PS4"
set "DEST_PS5=%DEST%\PS5"

set /a COPIED_PS4=0
set /a COPIED_PS5=0
set /a RENAMED=0
set /a COLLISIONS=0
set /a FAILED=0
set /a MISSING_FOLDERS=0

call :CreateFolder "%DEST_PS4%"
call :CreateFolder "%DEST_PS5%"

echo.
echo Copying files only from these root folders:
echo "%ROOT%json"
echo "%ROOT%mc4"
echo "%ROOT%shn"
echo.
echo The data folder is ignored as a source.
echo Subfolders are ignored.
echo All file extensions are included.
echo Files beginning with PPSA go to PS5; all others go to PS4.
echo Hash suffixes _xxxxxxxx are removed while copying.
echo On name conflicts, only the largest file is kept.
echo.

call :ProcessFolder "%ROOT%json"
call :ProcessFolder "%ROOT%mc4"
call :ProcessFolder "%ROOT%shn"

echo.
echo Done.
echo Copied to PS4:   %COPIED_PS4%
echo Copied to PS5:   %COPIED_PS5%
echo Hash renamed:    %RENAMED%
echo Name conflicts:  %COLLISIONS%
echo Failed:          %FAILED%
echo Missing folders: %MISSING_FOLDERS%
echo.
pause
exit /b

:CreateFolder
if not exist "%~1\" (
    mkdir "%~1"
)
exit /b

:ProcessFolder
set "SOURCE_FOLDER=%~1"

if not exist "%SOURCE_FOLDER%\" (
    echo Missing folder: "%SOURCE_FOLDER%"
    set /a MISSING_FOLDERS+=1
    exit /b
)

for /f "eol=| delims=" %%F in ('dir /b /a-d "%SOURCE_FOLDER%\*" 2^>nul') do (
    call :CopyOne "%SOURCE_FOLDER%\%%F"
)

exit /b

:CopyOne
set "SRC=%~1"
set "ORIGINAL_NAME=%~nx1"

if /I "%ORIGINAL_NAME:~0,4%"=="PPSA" (
    set "TARGET_FOLDER=%DEST_PS5%"
    set "GROUP=PS5"
) else (
    set "TARGET_FOLDER=%DEST_PS4%"
    set "GROUP=PS4"
)

call :MakeCleanName "%SRC%"

if /I not "%ORIGINAL_NAME%"=="%CLEAN_STEM%%EXT%" (
    set /a RENAMED+=1
)

call :BuildUniqueTarget "%TARGET_FOLDER%" "%CLEAN_STEM%" "%EXT%"
if "%SHOULD_COPY%"=="0" exit /b

copy /Y "%SRC%" "%TARGET%" >nul

if errorlevel 1 (
    echo FAILED: "%SRC%"
    set /a FAILED+=1
) else (
    echo Copied to %GROUP%: "%SRC%" ^> "%TARGET%"
    if "%GROUP%"=="PS5" (
        set /a COPIED_PS5+=1
    ) else (
        set /a COPIED_PS4+=1
    )
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

@echo off
setlocal EnableExtensions

rem ============================================================
rem Kopierar ENDAST filer fran rotmapparna json, mc4 och shn.
rem Mappen data och allt innehall i den anvands aldrig som kalla.
rem Sokningen ar inte rekursiv: undermappar ignoreras.
rem
rem Destinationer:
rem   .json -> data\cheatrunner\cheats\json
rem   .mc4  -> data\cheatrunner\cheats\mc4
rem   .shn  -> data\cheatrunner\cheats\shn
rem ============================================================

set "ROOT=%~dp0"
set "DEST=%ROOT%data\cheatrunner\cheats"

set /a COPIED=0
set /a FAILED=0
set /a MISSING_FOLDERS=0

call :CreateFolder "%DEST%\json"
call :CreateFolder "%DEST%\mc4"
call :CreateFolder "%DEST%\shn"

echo.
echo Copying files only from these root folders:
echo "%ROOT%json"
echo "%ROOT%mc4"
echo "%ROOT%shn"
echo.
echo The data folder is ignored as a source.
echo Subfolders are ignored.
echo Existing destination files with the same name will be overwritten.
echo.

call :CopyFiles "%ROOT%json" "*.json" "%DEST%\json"
call :CopyFiles "%ROOT%mc4" "*.mc4" "%DEST%\mc4"
call :CopyFiles "%ROOT%shn" "*.shn" "%DEST%\shn"

echo.
echo Done.
echo Copied:          %COPIED%
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


:CopyFiles
set "SOURCE_FOLDER=%~1"
set "PATTERN=%~2"
set "TARGET_FOLDER=%~3"

if not exist "%SOURCE_FOLDER%\" (
    echo Missing folder: "%SOURCE_FOLDER%"
    set /a MISSING_FOLDERS+=1
    exit /b
)

rem Ingen /S eller /R anvands, sa endast filer direkt i kallmappen behandlas.
for %%F in ("%SOURCE_FOLDER%\%PATTERN%") do (
    if exist "%%~fF" (
        call :CopyOne "%%~fF" "%TARGET_FOLDER%"
    )
)

exit /b


:CopyOne
set "SRC=%~1"
set "TARGET_FOLDER=%~2"
set "NAME=%~nx1"
set "TARGET=%TARGET_FOLDER%\%NAME%"

copy /Y "%SRC%" "%TARGET%" >nul

if errorlevel 1 (
    echo FAILED: "%SRC%"
    set /a FAILED+=1
) else (
    echo Copied: "%SRC%" ^> "%TARGET%"
    set /a COPIED+=1
)

exit /b

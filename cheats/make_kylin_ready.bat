@echo off
setlocal EnableExtensions

rem ============================================================
rem Kopierar ENDAST filer fran mapparna json, mc4 och shn.
rem Mappen data och allt innehall i den anvands aldrig som kalla.
rem Sokningen ar inte rekursiv: undermappar i kallmapparna ignoreras.
rem ============================================================

set "ROOT=%~dp0"
set "DEST=%ROOT%data\kylin\cheats"

set /a COPIED=0
set /a FAILED=0
set /a MISSING_FOLDERS=0

echo Creating output folder:
echo "%DEST%"
echo.

if not exist "%DEST%" (
    mkdir "%DEST%"
)

echo Copying files only from:
echo "%ROOT%json"
echo "%ROOT%mc4"
echo "%ROOT%shn"
echo.
echo The data folder is ignored as a source.
echo Existing destination files with the same name will be overwritten.
echo.

call :CopyFiles "%ROOT%json" "*.json"
call :CopyFiles "%ROOT%mc4" "*.mc4"
call :CopyFiles "%ROOT%shn" "*.shn"

echo.
echo Done.
echo Copied:          %COPIED%
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

rem /D anvands inte, sa bara filer i den angivna mappen behandlas.
for %%F in ("%SOURCE_FOLDER%\%PATTERN%") do (
    if exist "%%~fF" (
        call :CopyOne "%%~fF"
    )
)

exit /b


:CopyOne
set "SRC=%~1"
set "NAME=%~nx1"
set "TARGET=%DEST%\%NAME%"

copy /Y "%SRC%" "%TARGET%" >nul

if errorlevel 1 (
    echo FAILED: "%SRC%"
    set /a FAILED+=1
) else (
    echo Copied: "%SRC%" ^> "%TARGET%"
    set /a COPIED+=1
)

exit /b

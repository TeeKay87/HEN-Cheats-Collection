@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem ============================================================
rem Kopierar ENDAST filer direkt fran rotmapparna:
rem   json
rem   mc4
rem   shn
rem
rem Mappen data och allt innehall i den anvands aldrig som kalla.
rem Sokningen ar inte rekursiv: undermappar ignoreras.
rem Alla filandelser tillats.
rem
rem Destinationer:
rem   Filnamn som borjar med PPSA -> data\PHU\cheats\PS5
rem   Alla andra filer           -> data\PHU\cheats\PS4
rem ============================================================

set "ROOT=%~dp0"
set "DEST=%ROOT%data\PHU\cheats"
set "DEST_PS4=%DEST%\PS4"
set "DEST_PS5=%DEST%\PS5"

set /a COPIED_PS4=0
set /a COPIED_PS5=0
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
echo Existing destination files with the same name will be overwritten.
echo.

call :ProcessFolder "%ROOT%json"
call :ProcessFolder "%ROOT%mc4"
call :ProcessFolder "%ROOT%shn"

echo.
echo Done.
echo Copied to PS4:   %COPIED_PS4%
echo Copied to PS5:   %COPIED_PS5%
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

rem DIR /B /A-D listar endast filer direkt i mappen, utan rekursion.
for /f "eol=| delims=" %%F in ('dir /b /a-d "%SOURCE_FOLDER%\*" 2^>nul') do (
    call :CopyOne "%SOURCE_FOLDER%\%%F"
)

exit /b


:CopyOne
set "SRC=%~1"
set "NAME=%~nx1"

if /I "%NAME:~0,4%"=="PPSA" (
    set "TARGET_FOLDER=%DEST_PS5%"
    set "GROUP=PS5"
) else (
    set "TARGET_FOLDER=%DEST_PS4%"
    set "GROUP=PS4"
)

copy /Y "%SRC%" "%TARGET_FOLDER%\%NAME%" >nul

if errorlevel 1 (
    echo FAILED: "%SRC%"
    set /a FAILED+=1
) else (
    echo Copied to %GROUP%: "%SRC%"
    if "%GROUP%"=="PS5" (
        set /a COPIED_PS5+=1
    ) else (
        set /a COPIED_PS4+=1
    )
)

exit /b

@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "ROOT=%~dp0"
set "DEST=%ROOT%data\etaHEN\cheats"
set "DEST_JSON=%DEST%\json"
set "DEST_MC4=%DEST%\mc4"
set "DEST_SHN=%DEST%\shn"

set /a COPIED=0
set /a RENAMED=0
set /a COLLISIONS=0
set /a FAILED=0
set /a MISSING_FOLDERS=0
set /a MISSING_FILES=0

echo etaHEN builder - TXT normalization fix v3
echo.
echo Creating output folders:
echo "%DEST_JSON%"
echo "%DEST_MC4%"
echo "%DEST_SHN%"
echo.

call :CreateFolder "%DEST%"
call :CreateFolder "%DEST_JSON%"
call :CreateFolder "%DEST_MC4%"
call :CreateFolder "%DEST_SHN%"

echo Copying files only from:
echo "%ROOT%json"
echo "%ROOT%mc4"
echo "%ROOT%shn"
echo.
echo JSON files go to: "%DEST_JSON%"
echo MC4 files go to:  "%DEST_MC4%"
echo SHN files go to:  "%DEST_SHN%"
echo.
echo Also copying directly to "%DEST%":
echo "%ROOT%json.txt"
echo "%ROOT%mc4.txt"
echo "%ROOT%shn.txt"
echo.
echo The data folder is ignored as a source.
echo Hash suffixes _xxxxxxxx are removed while copying.
echo On name conflicts, only the largest file is kept.
echo.

call :CopyFiles "%ROOT%json" "*.json" "%DEST_JSON%"
call :CopyFiles "%ROOT%mc4" "*.mc4" "%DEST_MC4%"
call :CopyFiles "%ROOT%shn" "*.shn" "%DEST_SHN%"

call :CopyRootFile "%ROOT%json.txt"
call :CopyRootFile "%ROOT%mc4.txt"
call :CopyRootFile "%ROOT%shn.txt"

echo.
echo Normalizing copied list files...
call :NormalizeListFile "%DEST%\json.txt"
call :NormalizeListFile "%DEST%\mc4.txt"
call :NormalizeListFile "%DEST%\shn.txt"

echo.
echo Done.
echo Copied:          %COPIED%
echo Hash renamed:    %RENAMED%
echo Name conflicts:  %COLLISIONS%
echo Failed:          %FAILED%
echo Missing folders: %MISSING_FOLDERS%
echo Missing files:   %MISSING_FILES%
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

for %%F in ("%SOURCE_FOLDER%\%PATTERN%") do (
    if exist "%%~fF" (
        call :CopyOne "%%~fF" "%TARGET_FOLDER%"
    )
)

exit /b

:CopyOne
set "SRC=%~1"
set "TARGET_FOLDER=%~2"
set "ORIGINAL_NAME=%~nx1"

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
    echo Copied: "%SRC%" ^> "%TARGET%"
    set /a COPIED+=1
)

exit /b

:CopyRootFile
set "SRC=%~1"

if not exist "%SRC%" (
    echo Missing file: "%SRC%"
    set /a MISSING_FILES+=1
    exit /b
)

set "TARGET=%DEST%\%~nx1"

copy /Y "%SRC%" "%TARGET%" >nul

if errorlevel 1 (
    echo FAILED: "%SRC%"
    set /a FAILED+=1
) else (
    echo Copied: "%SRC%" ^> "%TARGET%"
    set /a COPIED+=1
)

exit /b

:NormalizeListFile
set "NORMALIZE_FILE=%~1"

if not exist "%NORMALIZE_FILE%" (
    echo ERROR: Missing copied list: "%NORMALIZE_FILE%"
    set /a FAILED+=1
    exit /b 1
)

set "NORMALIZER_PS1=%TEMP%\etahen_normalize_%RANDOM%_%RANDOM%.ps1"

>"%NORMALIZER_PS1%" echo param([string]$Path)
>>"%NORMALIZER_PS1%" echo $lines = [System.IO.File]::ReadAllLines($Path)
>>"%NORMALIZER_PS1%" echo $seen = New-Object 'System.Collections.Generic.HashSet[string]'
>>"%NORMALIZER_PS1%" echo $output = New-Object 'System.Collections.Generic.List[string]'
>>"%NORMALIZER_PS1%" echo foreach ($line in $lines) {
>>"%NORMALIZER_PS1%" echo     $clean = [regex]::Replace($line, '_[0-9A-Fa-f]{8}(?=\.json=)', '')
>>"%NORMALIZER_PS1%" echo     $clean = [regex]::Replace($clean, '_[0-9A-Fa-f]{8}(?=\.mc4=)', '')
>>"%NORMALIZER_PS1%" echo     $clean = [regex]::Replace($clean, '_[0-9A-Fa-f]{8}(?=\.shn=)', '')
>>"%NORMALIZER_PS1%" echo     if ($seen.Add($clean)) {
>>"%NORMALIZER_PS1%" echo         [void]$output.Add($clean)
>>"%NORMALIZER_PS1%" echo     }
>>"%NORMALIZER_PS1%" echo }
>>"%NORMALIZER_PS1%" echo [System.IO.File]::WriteAllLines($Path, [string[]]$output, (New-Object System.Text.UTF8Encoding($false)))
>>"%NORMALIZER_PS1%" echo $remaining = 0
>>"%NORMALIZER_PS1%" echo foreach ($testLine in [System.IO.File]::ReadAllLines($Path)) {
>>"%NORMALIZER_PS1%" echo     if ([regex]::IsMatch($testLine, '_[0-9A-Fa-f]{8}(?=\.json=)') -or [regex]::IsMatch($testLine, '_[0-9A-Fa-f]{8}(?=\.mc4=)') -or [regex]::IsMatch($testLine, '_[0-9A-Fa-f]{8}(?=\.shn=)')) {
>>"%NORMALIZER_PS1%" echo         $remaining++
>>"%NORMALIZER_PS1%" echo     }
>>"%NORMALIZER_PS1%" echo }
>>"%NORMALIZER_PS1%" echo if ($remaining -gt 0) {
>>"%NORMALIZER_PS1%" echo     Write-Error ('Hash suffixes still remain in ' + $Path + ': ' + $remaining)
>>"%NORMALIZER_PS1%" echo     exit 2
>>"%NORMALIZER_PS1%" echo }
>>"%NORMALIZER_PS1%" echo Write-Host ('Normalized list: ' + $Path + ' : ' + $lines.Count + ' to ' + $output.Count + ' lines; suffixes remaining: 0')
>>"%NORMALIZER_PS1%" echo exit 0

if not exist "%NORMALIZER_PS1%" (
    echo ERROR: Could not create temporary normalizer: "%NORMALIZER_PS1%"
    set /a FAILED+=1
    exit /b 1
)

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%NORMALIZER_PS1%" "%NORMALIZE_FILE%"
set "NORMALIZE_RC=%ERRORLEVEL%"

del /Q "%NORMALIZER_PS1%" >nul 2>&1

if not "%NORMALIZE_RC%"=="0" (
    echo ERROR: Failed to normalize: "%NORMALIZE_FILE%" ^(PowerShell exit %NORMALIZE_RC%^)
    set /a FAILED+=1
    exit /b 1
)

exit /b 0

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

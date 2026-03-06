@echo off
setlocal

echo Killing existing Chrome processes...
taskkill /f /im chrome.exe 2>nul
timeout /t 1 /nobreak >nul

set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if defined CHROME_PATH set "CHROME=%CHROME_PATH%"
set "USER_DATA_DIR=%~dp0.chrome-profile"

set "EXT_DIR="
if exist "%~dp0\.output\chrome-mv3" (
    set "EXT_DIR=%~dp0\.output\chrome-mv3"
)

if "%1"=="--clear" (
    echo Clearing profile...
    if exist "%USER_DATA_DIR%" rd /s /q "%USER_DATA_DIR%"
)

echo Launching Chrome...
echo Path: %CHROME%
echo Profile: %USER_DATA_DIR%

if defined EXT_DIR (
    echo Loading extension from: %EXT_DIR%
    start "" "%CHROME%" --user-data-dir="%USER_DATA_DIR%" --load-extension="%EXT_DIR%" --enable-unsafe-extension-compat
) else (
    echo WARNING: Extension build not found.
    start "" "%CHROME%" --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check
)

endlocal

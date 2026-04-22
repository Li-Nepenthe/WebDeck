@echo off
if "%~1"=="hidden" goto :runtask

echo Set WshShell = CreateObject("WScript.Shell") > "%temp%\WebDeck_Silent.vbs"
echo WshShell.Run """%~0"" hidden", 0, False >> "%temp%\WebDeck_Silent.vbs"
cscript //nologo "%temp%\WebDeck_Silent.vbs"
del "%temp%\WebDeck_Silent.vbs"
exit

:runtask
cd /d "%~dp0"
npm run dev -- --open

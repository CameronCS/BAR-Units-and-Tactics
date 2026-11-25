@echo off
REM Mirrors site\ into docs\ (for GitHub Pages hosting).
setlocal
cd /d "%~dp0"

if not exist site\index.html (
    echo site\index.html not found - run this from the repo root.
    exit /b 1
)

if not exist docs mkdir docs

REM /MIR mirrors (deletes files in docs that no longer exist in site); /XF keeps .nojekyll
robocopy site docs /MIR /XF .nojekyll /NFL /NDL /NJH /NJS /NP
REM robocopy exit codes 0-7 are success
if %ERRORLEVEL% GEQ 8 (
    echo Copy failed.
    exit /b %ERRORLEVEL%
)

if not exist docs\.nojekyll type nul > docs\.nojekyll

echo docs\ updated from site\.
endlocal

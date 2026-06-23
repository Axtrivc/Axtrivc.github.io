@echo off
setlocal

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set URL=http://localhost:4321/
set OUT=screenshots-v6

if not exist %OUT% mkdir %OUT%

REM Test points: raw = 0, 0.20, 0.40, 0.60, 0.80, 1.00
set POINTS[0]=0.00
set POINTS[1]=0.20
set POINTS[2]=0.35
set POINTS[3]=0.40
set POINTS[4]=0.55
set POINTS[5]=0.75
set POINTS[6]=1.00

set NAMES[0]=0-initial
set NAMES[1]=1-charging-20
set NAMES[2]=2-charging-35
set NAMES[3]=3-threshold-40
set NAMES[4]=4-release-55
set NAMES[5]=5-release-75
set NAMES[6]=6-end-100

echo === Capturing v6 screenshots ===
for /L %%i in 0,1,6 do (
    call echo Test point %%i: raw=%%POINTS[%%i]%% name=%%NAMES[%%i]%%
    "%CHROME%" --headless --disable-gpu --no-sandbox --hide-scrollbars ^
        --window-size=1440,900 ^
        --virtual-time-budget=3500 ^
        --screenshot=%OUT%\%%NAMES[%%i]%%.png ^
        "%URL%" 2>nul
)

echo === Done ===
dir %OUT%\*.png
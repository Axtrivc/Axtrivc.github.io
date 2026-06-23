@echo off
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set URL=http://localhost:4321/?raw=0.6
set OUT=C:\Users\leecl\blog\screenshots-v6\debug-60.png

%CHROME% --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,900 --virtual-time-budget=5000 --dump-dom %URL% 2>nul > C:\Users\leecl\blog\screenshots-v6\debug-60.html

findstr /C:"hero-visual" C:\Users\leecl\blog\screenshots-v6\debug-60.html | head -3
echo ---
findstr /C:"layout\".*content-inner\|content-inner" C:\Users\leecl\blog\screenshots-v6\debug-60.html | head -3
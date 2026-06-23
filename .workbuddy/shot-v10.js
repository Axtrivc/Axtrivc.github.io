const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 720, deviceScaleFactor: 1});
  const frames = [
    {raw: 0, name: 'v10-00'},
    {raw: 0.3, name: 'v10-30'},
    {raw: 0.5, name: 'v10-50'},
    {raw: 0.7, name: 'v10-70'},
    {raw: 1.0, name: 'v10-100'}
  ];
  for (const f of frames) {
    await page.goto(`http://localhost:4321/?raw=${f.raw}`, {waitUntil: 'networkidle2'});
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({path: `D:/WorkBuddy-Outputs/_archive/${f.name}.png`});
    console.log('shot', f.name);
  }
  await browser.close();
})();

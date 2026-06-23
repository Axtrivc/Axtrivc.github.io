// Hero v5 滚动效果截图
const puppeteer = require('C:/Users/leecl/.workbuddy/binaries/node/workspace/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto('https://axtrivc.github.io/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000)); // 等 hero 动画稳定

  const shots = [
    { name: 'v5-00pct', y: 0 },
    { name: 'v5-20pct', y: 160 },  // 20% of 800
    { name: 'v5-40pct', y: 320 },
    { name: 'v5-60pct', y: 480 },
    { name: 'v5-80pct', y: 640 },
    { name: 'v5-100pct', y: 800 },
  ];

  for (const s of shots) {
    await page.evaluate((y) => window.scrollTo(0, y), s.y);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({
      path: `C:/Users/leecl/Desktop/${s.name}.png`,
      fullPage: false
    });
    console.log(`captured ${s.name} at scrollY=${s.y}`);
  }

  await browser.close();
})();
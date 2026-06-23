// Screenshot capture for v6 「蓄力释放」
// Usage: node capture.js <port>
const puppeteer = require('puppeteer');

(async () => {
  const port = process.argv[2] || 4321;
  const url = `http://localhost:${port}/`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  // Wait extra for WebGL canvas + typewriter
  await new Promise(r => setTimeout(r, 2500));

  // Disable scroll-snap if any
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });

  // Test points: raw = 0, 0.20, 0.40, 0.60, 0.80, 1.00
  const testPoints = [
    { name: '0-initial',    raw: 0.00 },
    { name: '1-charging-20', raw: 0.20 },
    { name: '2-charging-35', raw: 0.35 },
    { name: '3-threshold-40', raw: 0.40 },
    { name: '4-release-55', raw: 0.55 },
    { name: '5-release-75', raw: 0.75 },
    { name: '6-end-100',   raw: 1.00 },
  ];

  for (const tp of testPoints) {
    await page.evaluate((raw) => {
      const heroH = window.innerHeight;
      window.scrollTo(0, raw * heroH);
    }, tp.raw);

    // Wait for animation frame + paint
    await new Promise(r => setTimeout(r, 250));

    const path = `screenshots-v6/${tp.name}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`✓ ${tp.name} (raw=${tp.raw}) → ${path}`);

    // Also read the current --hero-visual value
    const vars = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        raw: s.getPropertyValue('--hero-raw').trim(),
        visual: s.getPropertyValue('--hero-visual').trim(),
        pin: s.getPropertyValue('--hero-pin').trim(),
        easeout: s.getPropertyValue('--hero-easeout').trim(),
      };
    });
    console.log(`  vars: ${JSON.stringify(vars)}`);
  }

  // Check whether sidebar/playlist are hidden
  const cleanup = await page.evaluate(() => {
    const get = id => {
      const el = document.getElementById(id);
      if (!el) return 'NOT_FOUND';
      const cs = getComputedStyle(el);
      return cs.display;
    };
    return {
      musicBar: get('music-bar'),
      musicPanel: get('music-panel'),
      rightside: get('rightside'),
      goUp: get('go-up'),
      aside: get('aside'),
      sidebar: get('sidebar'),
    };
  });
  console.log('Cleanup check:', JSON.stringify(cleanup));

  await browser.close();
  console.log('Done.');
})();
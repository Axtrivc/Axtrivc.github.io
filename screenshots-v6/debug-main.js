// Debug main element position via Chrome DevTools Protocol via curl
const http = require('http');
const { execSync, spawn } = require('child_process');

(async () => {
  // Launch Chrome with remote debugging
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9223',
    '--window-size=1440,900',
    'http://localhost:4321/?raw=0.6'
  ]);

  // Wait for chrome to start
  await new Promise(r => setTimeout(r, 4000));

  // Get debug URL
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://localhost:9223/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  console.log('Tabs:', tabs.length);
  const tab = tabs[0];
  console.log('Tab:', tab.url);

  // Connect via WebSocket
  const WebSocket = require('ws');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  await new Promise(r => ws.on('open', r));

  let msgId = 1;
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const msg = JSON.stringify({ id, method, params });
      ws.on('message', function listener(data) {
        const parsed = JSON.parse(data);
        if (parsed.id === id) {
          ws.removeListener('message', listener);
          resolve(parsed.result);
        }
      });
      ws.send(msg);
    });
  }

  // Wait for navigation
  await new Promise(r => setTimeout(r, 2000));

  // Evaluate main element position
  const result = await send('Runtime.evaluate', {
    expression: `
      const main = document.querySelector('main#content-inner');
      const hero = document.querySelector('.hero-shell');
      const heroCs = getComputedStyle(hero);
      const mainCs = getComputedStyle(main);
      const htmlCs = getComputedStyle(document.documentElement);
      JSON.stringify({
        visual: htmlCs.getPropertyValue('--hero-visual').trim(),
        raw: htmlCs.getPropertyValue('--hero-raw').trim(),
        hero_transform: heroCs.transform,
        hero_opacity: heroCs.opacity,
        hero_zIndex: heroCs.zIndex,
        main_transform: mainCs.transform,
        main_opacity: mainCs.opacity,
        main_zIndex: mainCs.zIndex,
        main_position: mainCs.position,
        main_marginTop: mainCs.marginTop,
        main_top: main.getBoundingClientRect().top,
        main_height: main.getBoundingClientRect().height,
        hero_top: hero.getBoundingClientRect().top,
        hero_height: hero.getBoundingClientRect().height,
        viewport_height: window.innerHeight,
      }, null, 2)
    `,
    returnByValue: true
  });

  console.log('=== Main element state at raw=0.6 ===');
  console.log(result.result.value);

  ws.close();
  chrome.kill();
})();
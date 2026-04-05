const https = require('https');
const http = require('http');

function fetchJSON(url, headers = {}) {
  return new Promise((res, rej) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', ...headers }
    }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        fetchJSON(r.headers.location, headers).then(res).catch(rej);
        return;
      }
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { res(JSON.parse(d.replace(/^\uFEFF/g, ''))); }
        catch (e) { rej(new Error('Parse error: ' + url.substring(0, 80) + ': ' + d.substring(0, 300))); }
      });
    }).on('error', rej);
  });
}

async function main() {
  // Try different API patterns for standings
  const urls = [
    'https://api.dongqiudi.com/v2/league/3/ranking?type=total',
    'https://api.dongqiudi.com/v2/league/5/ranking?type=total',
    'https://api.dongqiudi.com/v2/league/7/ranking?type=total',
    'https://mobileapi.dongqiudi.com/v2/league/3/ranking?type=total',
    'https://sport-data.dongqiudi.com/soccer/data/ranking?competition_id=3&type=total',
    'https://sport-data.dongqiudi.com/soccer/data/ranking?competition_id=5&type=total',
    'https://sport-data.dongqiudi.com/soccer/biz/data/ranking?competition_id=3&type=total',
    'https://sport-data.dongqiudi.com/soccer/biz/data/ranking?competition_id=5&type=total',
    'https://sport-data.dongqiudi.com/soccer/biz/data/ranking?competition_id=7&type=total',
  ];

  for (const url of urls) {
    try {
      const t = await fetchJSON(url);
      const keys = Object.keys(t);
      console.log(`\nOK: ${url}`);
      console.log(`  Keys: ${keys.join(', ')}`);
      if (t.data) {
        console.log(`  data type: ${typeof t.data}, isArray: ${Array.isArray(t.data)}`);
        if (Array.isArray(t.data)) {
          console.log(`  data length: ${t.data.length}`);
          if (t.data.length > 0) console.log(`  first: ${JSON.stringify(t.data[0]).substring(0, 200)}`);
        }
      }
    } catch (e) {
      // skip silently
    }
  }

  // Also try searching CSDN blog for working API
  console.log('\n=== Direct API test ===');
  const urls2 = [
    'https://sport-data.dongqiudi.com/soccer/biz/data/standing?season_id=5700&app=dqd&platform=web&version=0&lang=zh-cn',
    'https://sport-data.dongqiudi.com/soccer/biz/data/standing?season_id=5701&app=dqd&platform=web&version=0&lang=zh-cn',
  ];
  for (const url of urls2) {
    try {
      const t = await fetchJSON(url);
      if (t.content?.rounds) {
        const league = t.content.rounds.find(r => r.content?.data?.length > 15);
        if (league) {
          console.log(`  ${url.split('season_id=')[1]}: ${league.content.data.length} teams - ${league.content.name}`);
        }
      }
    } catch (e) { /* skip */ }
  }
}

main().catch(console.error);

// usage: node preview.js [v] t1 t2 ... -> shots/p_<t>.png
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  let args = process.argv.slice(2); const vert = args[0] === 'v'; if (vert) args = args.slice(1);
  const srv = await require('./serve')(8123 + (vert ? 1 : 0));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: vert ? 1080 : 1920, height: vert ? 1920 : 1080 } });
  p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(`http://localhost:${8123 + (vert ? 1 : 0)}/film.html${vert ? '?v=1' : ''}`);
  await p.evaluate(() => FILM.init());
  const info = await p.evaluate(() => ({ d: FILM.DURATION, T: FILM.T, n: FILM.CUES.length }));
  console.log(JSON.stringify(info));
  const OD = process.env.SHOTS || 'shots'; fs.mkdirSync(OD, { recursive: true });
  for (const a of args) {
    const url = await p.evaluate(t => FILM.png(t), +a);
    fs.writeFileSync(`${OD}/${vert ? 'v' : 'p'}_${(+a).toFixed(1).padStart(6, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); srv.close();
})();

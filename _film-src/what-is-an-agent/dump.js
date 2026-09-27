const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const srv = await require('./serve')(8130);
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8130/film.html');
  const d = await p.evaluate(() => ({ T: FILM.T, D: FILM.DURATION, CUES: FILM.CUES, LOOPN: FILM.LOOPN, P: { wait: FILM.PARAMS.wait, p37: FILM.PARAMS.p37, music: FILM.PARAMS.music, split: FILM.PARAMS.split, splitFocus: FILM.PARAMS.splitFocus, logK: FILM.PARAMS.logK, keyGlow: FILM.PARAMS.keyGlow, endcard: FILM.PARAMS.endcard, cake: FILM.PARAMS.cake, others: FILM.PARAMS.others, tubes: FILM.PARAMS.tubes, board: FILM.PARAMS.board, cabinet: FILM.PARAMS.cabinet, lock: FILM.PARAMS.lock, counter: FILM.PARAMS.counter, city: FILM.PARAMS.city } }));
  fs.writeFileSync('cues.json', JSON.stringify(d, null, 1));
  console.log(d.D, d.CUES.length, [...new Set(d.CUES.map(c => c.type))].join(' '));
  await b.close(); srv.close();
})();

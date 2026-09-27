// node render.js [v] -> out_h.mp4 / out_v.mp4 (video only, segments rendered in parallel)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const FF = '/usr/local/bin/ffmpeg';
(async () => {
  const vert = process.argv[2] === 'v', tag = vert ? 'v' : 'h', WORKERS = 4;
  const port = 8140 + (vert ? 1 : 0);
  const srv = await require('./serve')(port);
  const b = await chromium.launch();
  const mk = async () => { const p = await b.newPage({ viewport: { width: vert ? 1080 : 1920, height: vert ? 1920 : 1080 } }); p.on('pageerror', e => console.log('PAGEERR', e.message)); await p.goto(`http://localhost:${port}/film.html${vert ? '?v=1' : ''}`); await p.evaluate(() => FILM.init()); return p; };
  const p0 = await mk();
  const loops = process.env.LOOPS ? +process.env.LOOPS : null;
  const D = await p0.evaluate(() => FILM.DURATION);
  const total = Math.ceil(D * 30);
  const per = Math.ceil(total / WORKERS);
  const t0 = Date.now(); let done = 0;
  const ONLY = process.env.ONLY ? +process.env.ONLY : -1;
  await Promise.all([...Array(WORKERS)].map(async (_, w) => {
    if (ONLY >= 0 && w !== ONLY) return;
    const p = w === 0 ? p0 : await mk();
    if (loops) await p.evaluate(n => FILM.setLoops(n), loops);
    const a = w * per, z = Math.min(total, a + per);
    const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', '30', `seg_${tag}_${w}.mp4`]);
    for (let i = a; i < z; i++) {
      const url = await p.evaluate(i => FILM.frame(i, .93), i);
      const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 300 === 0) console.log(tag, done, '/', total, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }));
  fs.writeFileSync(`segs_${tag}.txt`, [...Array(WORKERS)].map((_, w) => `file 'seg_${tag}_${w}.mp4'`).join('\n'));
  await b.close(); srv.close();
  console.log('done', tag, total, 'frames', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();

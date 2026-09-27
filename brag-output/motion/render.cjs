// usage: node render.cjs stills 1.5,4.2,...   |   node render.cjs video [workers]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const URL = 'http://127.0.0.1:8765/brag-output/motion/trailer.html';
const FPS = 30, N = Math.round(64.41 * FPS);
async function page(b) {
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('pageerror', e => console.error('PAGEERROR', e.message));
  await pg.goto(URL); await pg.evaluate(() => window.ready); return pg;
}
(async () => {
  const mode = process.argv[2], b = await chromium.launch({ args: ['--disable-gpu-vsync'] });
  if (mode === 'stills') {
    const pg = await page(b); fs.mkdirSync('stills', { recursive: true });
    for (const t of process.argv[3].split(',').map(Number)) {
      const d = await pg.evaluate(i => window.renderFrame(i), Math.round(t * FPS));
      fs.writeFileSync(`stills/t${t.toFixed(2).padStart(5, '0')}.png`, Buffer.from(d.split(',')[1], 'base64'));
    }
  } else {
    const K = Number(process.argv[3] || 4), per = Math.ceil(N / K), t0 = Date.now();
    const only = process.argv[4] != null ? [Number(process.argv[4])] : [...Array(K).keys()];
    await Promise.all(only.map(async k => {
      const pg = await page(b), a = k * per, z = Math.min(N, a + per);
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '13', '-pix_fmt', 'yuv420p', `seg${k}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let i = a; i < z; i++) {
        const d = await pg.evaluate(i => window.renderFrame(i), i);
        if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
        if (k === only[0] && (i - a) % 60 === 0) console.log(`worker0 ${i - a}/${z - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      ff.stdin.end(); await new Promise(r => ff.on('close', r));
    }));
    fs.writeFileSync('segs.txt', [...Array(K).keys()].map(k => `file 'seg${k}.mp4'`).join('\n'));
    console.log('frames done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
  await b.close();
})();

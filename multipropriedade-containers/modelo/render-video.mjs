// Renderiza apresentacao-3d.html quadro a quadro (Playwright + Chromium) e codifica com ffmpeg.
// Uso (npm i three@0.160.0 playwright ao lado do script; HTML e THREE_DIR opcionais):
//   node render-video.mjs <saida.mp4> [fps] [inicio] [fim] [workers]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const threeDir = process.env.THREE_DIR || path.join(here, 'node_modules', 'three');
const [out = 'apresentacao.mp4', fpsA = '30', t0A = '0', t1A = '60', wA = '4'] = process.argv.slice(2);
const fps = +fpsA, t0 = +t0A, t1 = +t1A, workers = +wA;
const frames = Math.round((t1 - t0) * fps);

async function renderChunk(idx, f0, f1, file) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
    const rel = route.request().url().replace(/^.*three@[^/]+\//, '');
    route.fulfill({ path: path.join(threeDir, rel), contentType: 'application/javascript' });
  });
  await page.goto(pathToFileURL(process.env.HTML || path.join(here, 'apresentacao-3d.html')).href + '?render');
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg',
    '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.renderAt(t), t0 + f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`worker ${idx}: quadro ${f}/${f1}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
}

const per = Math.ceil(frames / workers);
const parts = [];
await Promise.all(Array.from({ length: workers }, (_, i) => {
  const f0 = i * per, f1 = Math.min(frames, f0 + per);
  const file = `${out}.part${i}.mp4`; parts.push(file);
  return f0 < f1 ? renderChunk(i, f0, f1, file) : null;
}));
const list = `${out}.txt`;
fs.writeFileSync(list, parts.filter(fs.existsSync).map(p => `file '${path.resolve(p)}'`).join('\n'));
await new Promise(r => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy',
  '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', r));
parts.forEach(p => fs.existsSync(p) && fs.unlinkSync(p)); fs.unlinkSync(list);
console.log('ok', out);

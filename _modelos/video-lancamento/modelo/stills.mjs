// Gera quadros de previa do video para revisar enquadramento antes do render completo.
// Uso: node stills.mjs 2 15 30 45   (tempos em segundos; saida em ../previas/)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const threeDir = process.env.THREE_DIR || path.join(here, 'node_modules', 'three');
const html = process.env.HTML || path.join(here, 'apresentacao-3d.html');
const outDir = path.join(here, '..', 'previas');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('pageerror', e.message));
await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
  const rel = route.request().url().replace(/^.*three@[^/]+\//, '');
  route.fulfill({ path: path.join(threeDir, rel), contentType: 'application/javascript' });
});
await page.goto(pathToFileURL(html).href + '?render');
await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 60000 });
for (const t of process.argv.slice(2).map(Number)) {
  await page.evaluate(t => window.renderAt(t), t);
  await page.screenshot({ path: path.join(outDir, `t${t}.jpg`), type: 'jpeg', quality: 85 });
  console.log('previa', t);
}
await browser.close();

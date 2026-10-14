import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';

// Real local Chrome + production SSG files. No remote browser, account or service.
const chromePath = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome');
if (!fs.existsSync(chromePath)) throw new Error('Set CHROME_PATH to an installed local Chrome executable.');
const root = path.resolve('.output/public');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Run yarn generate first.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-image-browser-'));
const downloads = path.join(temp, 'downloads'); fs.mkdirSync(downloads);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };
const headers = {};
const source = fs.readFileSync(path.join(root, '_headers'), 'utf8');
for (const line of source.split('\n').slice(1)) {
  if (!line.trim()) break;
  const match = line.match(/^\s+([\w-]+):\s*(.+)$/);
  if (match) headers[match[1]] = match[2];
}
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let filename = path.resolve(root, '.' + pathname);
  if (!filename.startsWith(root + path.sep) && filename !== root) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404, headers); res.end('Not found'); return; }
  res.writeHead(200, { ...headers, 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' });
  fs.createReadStream(filename).pipe(res);
});
let browser, ws;
const checks = [], traffic = [], exceptions = [], logErrors = [];
const report = (name, detail = {}) => { checks.push({ name, ...detail }); console.log(`PASS ${name}`); };
const pause = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { const value = await fn(); if (value) return value; await pause(50); }
  throw new Error('Timed out waiting for browser state');
}
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${temp}/profile`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErrors = ''; browser.stderr.on('data', b => { chromeErrors += b; });
  const portFile = path.join(temp, 'profile', 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile), 15000).catch(error => { throw new Error(`${error.message}: ${chromeErrors.slice(-1500)}`); });
  const debugPort = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const seq = ++id;
    const timer = setTimeout(() => { pending.delete(seq); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(seq, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id: seq, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  ws.addEventListener('message', async ({ data }) => {
    const msg = JSON.parse(String(data));
    if (msg.id) { const p = pending.get(msg.id); if (!p) return; pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); return; }
    if (msg.method === 'Target.attachedToTarget') {
      try { await send('Network.enable', {}, msg.params.sessionId); await send('Runtime.enable', {}, msg.params.sessionId); await send('Runtime.runIfWaitingForDebugger', {}, msg.params.sessionId); } catch (error) { logErrors.push(error.message); }
    }
    if (msg.method === 'Network.requestWillBeSent') traffic.push({ url: msg.params.request.url, method: msg.params.request.method, postData: Boolean(msg.params.request.postData), session: msg.sessionId });
    if (msg.method === 'Network.responseReceived' && msg.params.response.url.endsWith('.wasm')) { const r = msg.params.response; traffic.push({ wasm: r.url, status: r.status, mime: r.mimeType }); }
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || ''));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') logErrors.push(msg.params.entry.text);
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  const clickText = async (text, selector = 'button') => {
    assert(await evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.focus(); b.click(); return true; })()`), `Button unavailable: ${text}`);
  };
  const states = () => evaluate(`Array.from(document.querySelectorAll('[data-testid="task"]')).map(e => e.dataset.status)`);
  const completed = async count => { await waitFor(async () => { const value = await states(); return value.length === count && value.every(x => ['success', 'skipped', 'failed', 'cancelled'].includes(x)); }); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  await send('Page.navigate', { url: origin + '/' });
  await waitFor(() => evaluate(`Boolean(document.querySelector('input[type="file"]'))`)); await pause(250);
  assert(!traffic.some(r => r.url?.endsWith('.wasm') || r.wasm)); report('No WASM loaded on idle first page');
  await evaluate(`window.makeImages = async (types, bad = false) => {
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(255,0,0,0.3)'; ctx.fillRect(0,0,48,64); ctx.fillStyle = '#0080ff'; ctx.fillRect(48,0,48,64);
    const transfer = new DataTransfer();
    for (const type of types) { const blob = await new Promise(r => canvas.toBlob(r, type, .9)); transfer.items.add(new File([blob], 'fixture.' + type.split('/')[1], { type })); }
    if (bad) transfer.items.add(new File(['broken'], 'bad.jpg', { type: 'image/jpeg' }));
    const input = document.querySelector('input[type="file"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  };`);
  await evaluate(`makeImages(['image/png','image/jpeg','image/webp'], true)`); await completed(4);
  assert.deepEqual(await states(), ['success', 'success', 'success', 'failed']); report('Real Worker compresses PNG/JPEG/WebP; bad input is isolated');
  const wasmResponses = traffic.filter(r => r.wasm);
  assert(wasmResponses.length >= 5 && wasmResponses.every(r => r.status === 200 && r.mime === 'application/wasm')); report('WASM requests use valid URLs, HTTP 200 and MIME', { count: wasmResponses.length });
  await clickText('打包下载全部 (ZIP)');
  const zipName = await waitFor(() => fs.readdirSync(downloads).find(n => n.endsWith('.zip')));
  const entries = unzipSync(fs.readFileSync(path.join(downloads, zipName))); assert.equal(Object.keys(entries).length, 3); report('Downloaded ZIP has three successful images');
  for (const [name, bytes] of Object.entries(entries)) {
    const decoded = await evaluate(`(async () => { const binary = atob(${JSON.stringify(Buffer.from(bytes).toString('base64'))}); const data = Uint8Array.from(binary, c => c.charCodeAt(0)); const bitmap = await createImageBitmap(new Blob([data])); const dimensions = [bitmap.width, bitmap.height]; bitmap.close(); return dimensions; })()`);
    assert.deepEqual(decoded, [96, 64], `Downloaded result is decodable: ${name}`);
  }
  report('All downloaded JPEG/PNG/WebP results decode at original dimensions');
  // Switch language with actual client navigation, preserving the queue.
  await clickText('EN', 'a'); await waitFor(() => evaluate(`document.documentElement.lang === 'en'`));
  assert.equal((await states()).length, 4);
  assert(!await evaluate(`document.querySelector('[data-status="failed"]').textContent.includes('暂不支持')`)); report('English route preserves queue and translates errors');
  await clickText('日本語', 'a'); await waitFor(() => evaluate(`document.documentElement.lang === 'ja'`)); assert.equal((await states()).length, 4); report('Japanese route preserves queue');
  await clickText('中文', 'a'); await waitFor(() => evaluate(`document.documentElement.lang === 'zh-CN'`));
  await clickText('清空全部'); assert.equal((await states()).length, 0);
  // PNG -> JPEG verifies alpha flattening via actual decoded output in comparison.
  await evaluate(`document.querySelector('[data-output="jpeg"]').click(); makeImages(['image/png'])`); await completed(1);
  await clickText('对比');
  await waitFor(() => evaluate(`Boolean(document.querySelector('[role="dialog"] img'))`));
  assert(await evaluate(`document.querySelector('[role="dialog"]').contains(document.activeElement)`));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
  assert(await evaluate(`document.activeElement.getAttribute('role') === 'slider'`));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert(await evaluate(`document.querySelector('[role="dialog"] button') === document.activeElement`));
  report('Comparison dialog traps keyboard focus and exposes an accessible slider');
  const decoded = await evaluate(`(async () => { const img = document.querySelector('[role="dialog"] img'); await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img,0,0); return { size: [c.width,c.height], pixel: Array.from(x.getImageData(10,10,1,1).data) }; })()`);
  assert.equal(decoded.pixel[3], 255); assert(decoded.pixel[0] > 240 && decoded.pixel[1] > 150 && decoded.pixel[2] > 150); report('PNG -> JPEG alpha composites onto white', decoded);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(() => evaluate(`!document.querySelector('[role="dialog"]')`));
  await clickText('下载原图'); await waitFor(() => fs.readdirSync(downloads).some(n => n.endsWith('.png'))); report('Original image can be downloaded');
  await clickText('清空全部'); await evaluate(`document.querySelector('[data-output="png"]').click(); makeImages(['image/webp'])`); await completed(1);
  assert.deepEqual(await states(), ['success']); report('WebP -> explicit quantized PNG works');
  await clickText('对比');
  const alpha = await evaluate(`(async () => { const img = document.querySelector('[role="dialog"] img'); await img.decode(); const c = document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; const x=c.getContext('2d'); x.drawImage(img,0,0); return x.getImageData(10,10,1,1).data[3]; })()`);
  assert(alpha > 50 && alpha < 100); report('PNG output preserves partial transparency', { alpha });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(() => evaluate(`!document.querySelector('[role="dialog"]')`));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await pause(100);
  assert(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`)); report('390px mobile page has no horizontal overflow');
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(temp, 'mobile.png'), Buffer.from(image.data, 'base64'));
  // Clear during validation repeatedly; cancelled work must not resurrect.
  await clickText('清空全部');
  await evaluate(`document.querySelector('[data-output="keep"]').click(); makeImages(Array(21).fill('image/png'))`); await completed(20);
  assert(await evaluate(`document.querySelector('[role="alert"]')?.textContent.includes('20')`)); report('Batch upload enforces 20 images with a visible message');
  await clickText('清空全部'); assert.deepEqual(await states(), []); report('Clear removes all result and preview entries');
  await evaluate(`(async () => {
    document.querySelector('[data-output="png"]').click();
    const c = document.createElement('canvas'); c.width=1600; c.height=1000;
    const x = c.getContext('2d'); const pixels=x.createImageData(c.width,c.height);
    for(let i=0;i<pixels.data.length;i+=4) { pixels.data[i]=(i*13)%256; pixels.data[i+1]=(i>>8)%256; pixels.data[i+2]=(i>>16)%256; pixels.data[i+3]=255; }
    x.putImageData(pixels,0,0); const blob=await new Promise(r=>c.toBlob(r));
    const dt=new DataTransfer(); dt.items.add(new File([blob],'cancel-and-retry.png',{type:'image/png'}));
    const input=document.querySelector('input[type="file"]'); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await waitFor(async () => (await states()).includes('processing'));
  await clickText('取消');
  await completed(1); assert.deepEqual(await states(), ['cancelled']); report('Cancel interrupts a real in-progress Worker task');
  await clickText('重试'); await completed(1); assert.deepEqual(await states(), ['success']); report('Cancelled task retries with a fresh Worker');
  await clickText('清空全部');
  for (const pathname of ['/','/en/','/ja/','/privacy/','/en/privacy/','/ja/privacy/','/third-party-licenses.txt']) assert.equal((await fetch(origin + pathname)).status, 200);
  assert(!fs.existsSync(path.join(root, 'dev', 'codec-spike', 'index.html'))); report('Six public pages and license notices exist; dev Spike is excluded');
  const external = traffic.filter(r => r.url && !r.url.startsWith(origin) && !/^(blob:|data:|about:)/.test(r.url)); assert.deepEqual(external, []);
  assert(!traffic.some(r => r.postData || (r.method && r.method !== 'GET'))); report('Page and Workers make no external or upload requests');
  assert.deepEqual(exceptions, []); assert.deepEqual(logErrors, []); report('No runtime exceptions or CSP errors');
  const result = { browser: 'Local Chrome via CDP', checks, exceptions, logErrors, wasm: traffic.filter(r => r.wasm), screenshot: path.join(temp, 'mobile.png'), downloads };
  fs.mkdirSync('docs/verification', { recursive: true }); fs.writeFileSync('docs/verification/2026-10-14-browser-check.json', JSON.stringify(result, null, 2) + '\n');
  console.log(`Browser evidence: ${temp}`);
} finally {
  ws?.close(); browser?.kill('SIGTERM'); server.close();
}

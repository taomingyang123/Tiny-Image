import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCompressionQueue } from '../../composables/useCompressionQueue.client';
import { WorkerClient } from '../../lib/image/workerClient';
import { deduplicateFilenames } from '../../lib/image/policy';
import { packZip } from '../../lib/image/download';
import { unzipSync } from 'fflate';
import { detectImageFormat } from '../../lib/image/magic';
import { optimisePng, decodePng } from '../../lib/image/codec/png';
import { processImage } from '../../lib/image/codec';
import { quantizeImageData } from '../../lib/image/codec/quantize';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const file = () => new File([png], 'sample.png', { type: 'image/png' });
const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const turn = () => new Promise(resolve => setTimeout(resolve, 15));
class ControlledWorker {
  listeners = new Map<string, Set<Function>>();
  request: any;
  terminated = false;
  addEventListener(type: string, fn: Function) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(fn); }
  removeEventListener(type: string, fn: Function) { this.listeners.get(type)?.delete(fn); }
  postMessage(req: any) { this.request = req; }
  terminate() { this.terminated = true; }
  success() { for (const fn of this.listeners.get('message') ?? []) fn({ data: { type: 'SUCCESS', taskId: this.request.taskId, result: { id: this.request.taskId, originalName: 'sample.png', originalBytes: png.length, resultBytes: 100, mime: 'image/png', extension: 'png', width: 1, height: 1, elapsedMs: 1, mode: 'lossless', unchanged: false, data: new ArrayBuffer(100) } } }); }
}
let queue: ReturnType<typeof createCompressionQueue> | undefined;
beforeEach(() => { vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {}); });
afterEach(() => { queue?.destroy(); queue = undefined; vi.restoreAllMocks(); });
beforeAll(() => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: any, init: any) => {
    const url = input instanceof URL ? input.href : String(input);
    return url.startsWith('file:') ? new Response(fs.readFileSync(fileURLToPath(url)), { headers: { 'Content-Type': 'application/wasm' } }) : original(input, init);
  }) as typeof fetch;
});

describe('T04-10 confirmed regression cases', () => {
  it('ZIP preserves entries that already have numbered suffixes', async () => {
    const names = deduplicateFilenames(['photo.png', 'photo.png', 'photo-2.png', 'photo.png']);
    expect(new Set(names).size).toBe(4);
    const packed = await packZip(['photo.png', 'photo.png', 'photo-2.png'].map((name, i) => ({ name, data: new Uint8Array([i]) })));
    expect(Object.values(unzipSync(packed)).map(x => x[0]).sort()).toEqual([0, 1, 2]);
  });
  it('cancel during File read never dispatches the cancelled image', async () => {
    const worker = new ControlledWorker();
    queue = createCompressionQueue({ workerClient: new WorkerClient({ workerFactory: () => worker as unknown as Worker }) });
    const image = file(); const read = deferred<ArrayBuffer>();
    let reads = 0;
    image.arrayBuffer = () => ++reads === 1 ? Promise.resolve(png.buffer.slice(png.byteOffset, png.byteOffset + png.length)) : read.promise;
    await queue.addFiles([image]);
    queue.cancelTask(queue.tasks.value[0].id);
    read.resolve(new ArrayBuffer(png.length)); await turn();
    expect(worker.request).toBeUndefined();
    expect(queue.tasks.value[0].status).toBe('cancelled');
  });
  it('clear while validating does not repopulate the list or allocate URLs', async () => {
    queue = createCompressionQueue();
    const image = file(); const read = deferred<ArrayBuffer>();
    image.slice = () => ({ arrayBuffer: () => read.promise } as Blob);
    const adding = queue.addFiles([image]); queue.clearAll();
    read.resolve(png.buffer.slice(png.byteOffset, png.byteOffset + png.length));
    await adding; await turn();
    expect(queue.tasks.value).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('recompression ignores stale rejection and worker messages', async () => {
    const workers: ControlledWorker[] = [];
    const client = new WorkerClient({ workerFactory: () => { const worker = new ControlledWorker(); workers.push(worker); return worker as unknown as Worker; } });
    queue = createCompressionQueue({ workerClient: client });
    await queue.addFiles([file()]); await turn();
    queue.globalOptions.value.quality = 50; queue.recompressAll(); await turn();
    expect(workers).toHaveLength(2);
    workers[0].success();
    expect(client.isBusy()).toBe(true);
    expect(queue.tasks.value[0].status).toBe('processing');
    workers[1].success(); await turn();
    expect(queue.tasks.value[0].status).toBe('success');
    expect(queue.tasks.value[0].optionsSnapshot.quality).toBe(50);
  });
  it('bounds repeated and concurrent uploads to 20 tasks', async () => {
    queue = createCompressionQueue();
    await Promise.all([queue.addFiles(Array.from({ length: 15 }, () => new File([], 'empty.png'))), queue.addFiles(Array.from({ length: 15 }, () => new File([], 'empty.png')))]);
    expect(queue.tasks.value).toHaveLength(20);
  });
  it('does not mistake ANIM bytes inside a static WebP payload for a chunk', () => {
    const bytes = new Uint8Array(32); bytes.set(new TextEncoder().encode('RIFF'), 0); bytes[4] = 24; bytes.set(new TextEncoder().encode('WEBPVP8 '), 8); bytes[16] = 12; bytes.set(new TextEncoder().encode('ANIM'), 24);
    expect(detectImageFormat(bytes)?.isAnimated).toBe(false);
  });
  it('keep PNG plus resizing preserves colors instead of silently quantizing', async () => {
    const raw = { width: 4, height: 4, data: new Uint8ClampedArray(64) } as ImageData;
    for (let i = 0; i < 16; i++) raw.data.set([i * 15, 40 + i, 80 + i, 255], i * 4);
    const input = await optimisePng(raw);
    const result = await processImage({ id: 'resized', originalName: 'colors.png', inputBuffer: input, inputMime: 'image/png', options: { output: 'keep', quality: 1, maxLongEdge: 2, jpegBackground: '#ffffff' } });
    const decoded = await decodePng(result.data);
    expect(result.mode).toBe("lossless");
    expect([...decoded.data]).toEqual([0, 40, 80, 255, 45, 43, 83, 255, 180, 52, 92, 255, 225, 55, 95, 255]);
  });
  it('quantization keeps faint colored shadows instead of turning them black', () => {
    for (const dither of [false, true]) {
      const result = quantizeImageData({ width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 10]) } as ImageData, { dither });
      expect([...result.data]).toEqual([255, 0, 0, 10]);
    }
  });
  it('aggregate savings remains negative when output grows', () => {
    queue = createCompressionQueue();
    queue.tasks.value.push({ id: 'grown', file: file(), originalName: 'sample.png', originalBytes: 50, status: 'success', optionsSnapshot: queue.globalOptions.value, result: { id: 'grown', originalName: 'sample.png', originalBytes: 50, resultBytes: 100, mime: 'image/png', extension: 'png', width: 1, height: 1, elapsedMs: 1, mode: 'lossless', unchanged: false, data: new ArrayBuffer(100) } });
    expect(queue.stats.value.overallSavingsPercent).toBe(-100);
  });
  it('APNG control chunks beyond 64 KiB are rejected before preview or decode', async () => {
    queue = createCompressionQueue();
    const bytes = new Uint8Array(33 + 70012 + 20);
    bytes.set(png.subarray(0, 33));
    new DataView(bytes.buffer).setUint32(33, 70000);
    bytes.set(new TextEncoder().encode('tEXt'), 37);
    const offset = 33 + 70012;
    new DataView(bytes.buffer).setUint32(offset, 8);
    bytes.set(new TextEncoder().encode('acTL'), offset + 4);
    await queue.addFiles([new File([bytes], 'late-animation.png')]);
    expect(queue.tasks.value[0].errorCode).toBe('ANIMATED_UNSUPPORTED');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('WASM load failure discards the failed module context so retry can reload', async () => {
    const workers: ControlledWorker[] = [];
    const client = new WorkerClient({ workerFactory: () => { const w = new ControlledWorker(); workers.push(w); return w as unknown as Worker; } });
    queue = createCompressionQueue({ workerClient: client });
    await queue.addFiles([file()]); await turn();
    for (const fn of workers[0].listeners.get('message') ?? []) fn({ data: { type: 'ERROR', taskId: workers[0].request.taskId, code: 'WASM_LOAD_FAILED', message: 'fetch failed' } });
    await turn(); expect(queue.tasks.value[0].status).toBe('failed');
    queue.retryTask(queue.tasks.value[0].id); await turn();
    expect(workers).toHaveLength(2); expect(workers[0].terminated).toBe(true);
    workers[1].success(); await turn(); expect(queue.tasks.value[0].status).toBe('success');
  });

});

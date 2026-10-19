// Local diagnostic of currently confirmed bugs. This is not a passing CI regression suite.
// Run from the project: node docs/verification/2026-10-19-reproduce.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {zip, unzipSync} from 'fflate';
import {encode, decode} from '@jsquash/jpeg';
const root = fileURLToPath(new URL('../../', import.meta.url));
const transpile = source => ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const dataUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const load = name => import(dataUrl(transpile(fs.readFileSync(path.join(root, name),'utf8'))));
const findings = [];
const {resizeImageData} = await load('lib/image/codec/resize.ts');
const resized = resizeImageData({width:4,height:1,data:new Uint8ClampedArray([255,0,0,255,255,0,0,255,0,0,0,0,0,0,0,0])},3,1);
const middle = [...resized.data.slice(4,8)];
assert.deepEqual(middle,[128,0,0,128]);
findings.push({task:'T04-14',case:'transparent-resize-edge',actual:middle,expectedPremultipliedAlpha:[255,0,0,128],effect:'RGB interpolation includes invisible black, darkening partially transparent edges.'});
const single = resizeImageData({width:2,height:1,data:new Uint8ClampedArray([255,0,0,255,0,0,255,255])},1,1);
assert.deepEqual([...single.data],[255,0,0,255]);
findings.push({task:'T04-14',case:'resize-to-one-pixel',actual:[...single.data],expectedCenterSample:[128,0,128,255],effect:'One-pixel target samples only the first source pixel.'});
let encodedJpeg;
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async input => {
    if (!String(input).startsWith('file:')) throw new Error('This diagnostic allows only local WASM file reads.');
    return new Response(fs.readFileSync(fileURLToPath(input)),{headers:{'Content-Type':'application/wasm'}});
  };
  const {probeDimensions} = await load('lib/image/dimensions.ts');
  const jpeg = await encode({width:2,height:1,data:new Uint8ClampedArray([255,0,0,255,0,0,255,255])},{quality:80});
  encodedJpeg=new Uint8Array(jpeg);
  const padded = new Uint8Array(jpeg.byteLength+1);
  padded.set(new Uint8Array(jpeg).subarray(0,2)); padded[2]=0xff; padded.set(new Uint8Array(jpeg).subarray(2),3);
  const decoded = await decode(padded.buffer);
  const dimensions = probeDimensions(padded);
  assert.equal(dimensions,null); assert.equal(decoded.width,2); assert.equal(decoded.height,1);
  findings.push({task:'T04-15',case:'valid-jpeg-marker-fill',originalDimensions:probeDimensions(jpeg),wasmDecodedDimensions:{width:decoded.width,height:decoded.height},probeDimensions:dimensions,effect:'The queue rejects a JPEG which the actual codec decodes successfully.'});
} finally { globalThis.fetch=originalFetch; }
// Keep production ZIP generation intact; intercept only the final browser-download boundary.
// Mutating the second task here models recompressAll clearing its result while ZIP is reading the first.
globalThis.__tiny_audit_fflate={zip}; globalThis.__tiny_audit_downloads=[];
let code = transpile(fs.readFileSync(path.join(root,'lib/image/download.ts'),'utf8'))
  .replace(/import\s*\{\s*zip\s*\}\s*from\s*["']fflate["'];/, 'const {zip}=globalThis.__tiny_audit_fflate;')
  .replace(/from ["']\.\/policy["']/, 'from '+JSON.stringify(dataUrl(transpile(fs.readFileSync(path.join(root,'lib/image/policy.ts'),'utf8')))));
const start=code.indexOf('export function downloadBlob('), end=code.indexOf('export function downloadTask(',start);
assert(start>=0 && end>start);
code=code.slice(0,start)+'export function downloadBlob(blob,filename){globalThis.__tiny_audit_downloads.push({blob,filename});}\n'+code.slice(end);
const {downloadTasksAsZip}=await import(dataUrl(code));
const jpegBytes=encodedJpeg;
const task=name=>({id:name,status:'success',originalName:name+'.jpg',file:new File([jpegBytes],name+'.jpg',{type:'image/jpeg'}),resultBlob:new Blob([jpegBytes],{type:'image/jpeg'}),result:{extension:'jpg',resultBytes:jpegBytes.length}});
const tasks=[task('one'),task('two')];
let release;
tasks[0].resultBlob.arrayBuffer=()=>new Promise(resolve=>release=resolve);
const packing=downloadTasksAsZip(tasks,'audit.zip');
tasks[1].resultBlob=undefined; tasks[1].result=undefined; tasks[1].status='queued';
release(jpegBytes.buffer); await packing;
const entries=unzipSync(new Uint8Array(await globalThis.__tiny_audit_downloads[0].blob.arrayBuffer()));
assert(entries['two.png']); assert.equal(entries['two.png'][0],0xff); assert.equal(entries['two.png'][1],0xd8);
findings.push({task:'T04-16',case:'recompress-during-zip',entries:Object.entries(entries).map(([name,bytes])=>({name,magic:[...bytes.slice(0,3)]})),effect:'A JPEG original can be archived with a PNG extension after its task result is cleared.'});
delete globalThis.__tiny_audit_fflate; delete globalThis.__tiny_audit_downloads;
const evidence={date:'2026-10-19',kind:'confirmed-current-bugs-not-fixed',findings};
fs.writeFileSync(path.join(root,'docs/verification/2026-10-19-confirmed-bugs.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));

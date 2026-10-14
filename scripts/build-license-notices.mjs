import fs from 'node:fs';
import path from 'node:path';

// Local inventory only. Preserve the exact notices shipped in installed packages.
const packages = new Map();
const visited = new Set();
function visit(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('@')) { visit(full); continue; }
    const manifest = path.join(full, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const real = fs.realpathSync(full);
    if (visited.has(real)) continue;
    visited.add(real);
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const notices = [];
    const scan = current => {
      for (const item of fs.readdirSync(current, { withFileTypes: true })) {
        const filename = path.join(current, item.name);
        if (item.isFile() && /^(license|copying|notice|thirdpartynotice)/i.test(item.name)) {
          notices.push({ path: path.relative(full, filename), text: fs.readFileSync(filename, 'utf8') });
        }
      }
    };
    scan(full);
    // Some older packages embed the only license text in their README.
    for (const entry of fs.readdirSync(full).filter(name => /^readme/i.test(name))) {
      const readme = fs.readFileSync(path.join(full, entry), 'utf8');
      const match = readme.match(/^##? License[^\n]*\n([\s\S]*)/im);
      if (!notices.length && match) notices.push({ path: `${entry} (License section)`, text: match[1] });
    }
    if (fs.existsSync(path.join(full, 'codec'))) scan(path.join(full, 'codec'));
    packages.set(`${pkg.name}@${pkg.version}`, { name: pkg.name, version: pkg.version, license: pkg.license ?? 'NOT DECLARED', notices });
    visit(path.join(full, 'node_modules'));
  }
}
visit('node_modules');
if (packages.size === 0) throw new Error('Install dependencies before generating notices.');
const inventory = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
let text = 'Tiny Image — Third-party dependency notices\n\n';
text += 'This software is based in part on the work of the Independent JPEG Group.\n';
text += 'Includes installed runtime and build/test packages; not every listed package is shipped to browsers.\n';
text += 'Exact license and codec notices below are copied from local installed packages.\n';
text += 'Metadata alone does not establish that bundled WASM contains no additional upstream code.\n\n';
for (const pkg of inventory) {
  text += `\n${'='.repeat(72)}\n${pkg.name}@${pkg.version} — ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license)}\n`;
  for (const notice of pkg.notices) text += `\n--- ${notice.path} ---\n${notice.text}\n`;
  if (pkg.notices.length === 0) text += '\nNo separate notice file included in this installed package.\n';
}
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/third-party-licenses.txt', text);
fs.mkdirSync('docs/verification', { recursive: true });
fs.writeFileSync('docs/verification/dependency-licenses.json', JSON.stringify(inventory.map(({ notices, ...pkg }) => ({ ...pkg, noticeFiles: notices.map(n => n.path) })), null, 2) + '\n');
console.log(`Generated local notices for ${inventory.length} package versions.`);
console.log(JSON.stringify(inventory.filter(p => /GPL|AGPL|SSPL|BUSL|UNLICENSED|NOT DECLARED/.test(String(p.license))).map(({ notices, ...pkg }) => pkg)));

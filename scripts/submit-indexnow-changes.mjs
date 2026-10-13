import { SITE_URL } from "../config/indexableRoutes.js";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [previousPath, currentPath, ...rest] = process.argv.slice(2);
const dryRun = rest.includes("--dry-run");
if (!previousPath || !currentPath || rest.some((argument) => argument !== "--dry-run")) {
    console.error("Usage: node scripts/submit-indexnow-changes.mjs <previous.json> <current.json> [--dry-run]");
    process.exit(1);
}
const readManifest = (filePath) => {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) throw new Error(`Manifest not found: ${resolvedPath}`);
    const manifest = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    if (manifest.schemaVersion !== 2 || manifest.fingerprintVersion !== "rendered-content-v1" || manifest.siteUrl !== SITE_URL || !Array.isArray(manifest.urls)) {
        throw new Error("Content fingerprints are required. Rebuild both manifests from the corresponding release artifacts; lastmod-only manifests cannot prove content changes.");
    }
    const urls = new Map();
    for (const entry of manifest.urls) {
        const url = new URL(entry.url);
        if (url.origin !== manifest.siteUrl || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/") || url.toString() !== entry.url || !/^[a-f0-9]{64}$/.test(entry.contentHash || "") || urls.has(entry.url)) {
            throw new Error(`Invalid or duplicate canonical URL/content fingerprint: ${entry.url}`);
        }
        urls.set(entry.url, entry.contentHash);
    }
    return urls;
};
const previous = readManifest(previousPath);
const current = readManifest(currentPath);
const changed = [];
for (const [url, hash] of current) {
    if (!previous.has(url) || previous.get(url) !== hash) changed.push(url);
}
// Deleted URLs must also be notified so Bing can refresh its old record.
for (const url of previous.keys()) {
    if (!current.has(url)) changed.push(url);
}
const uniqueUrls = [...new Set(changed)].sort();
if (uniqueUrls.length === 0) {
    console.log("No added, content-changed, or deleted URLs detected (lastmod-only changes ignored).");
    process.exit(0);
}
const childArgs = ["scripts/submit-indexnow.mjs", ...(dryRun ? ["--dry-run"] : []), ...uniqueUrls];
const child = spawn(process.execPath, childArgs, { stdio: "inherit", env: process.env });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => process.exit(code ?? 1));

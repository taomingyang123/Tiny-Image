import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SITEMAP_URLS, SITE_URL } from "../config/indexableRoutes.js";

const args = process.argv.slice(2);
const outputPath = args[0]?.startsWith("--") ? undefined : args.shift();
const options = args;
if (options.length && (options.length !== 2 || options[0] !== "--public-dir")) {
    throw new Error("Usage: build-url-manifest.mjs [output.json] [--public-dir build/public]");
}
const publicDir = path.resolve(options[1] || ".output/public");
const fingerprintVersion = "rendered-content-v1";
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => [match[1].toLowerCase(), match[2] ?? match[3]]));
const ordered = (value) => {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
    return value;
};
const contentHash = (html, url) => {
    const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attributes(match[0]))
        .find((entry) => entry.rel === "canonical")?.href;
    if (canonical !== url) throw new Error(`Build canonical mismatch: ${url}`);
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    if (body === undefined || !title) throw new Error(`Missing rendered body/title: ${url}`);
    const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]))
        .filter((entry) => entry.name || entry.property).map(ordered);
    if (meta.some((entry) => entry.name?.toLowerCase() === "robots" && /noindex/i.test(entry.content || ""))) {
        throw new Error(`Indexable build has noindex: ${url}`);
    }
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attributes(match[0]))
        .filter((entry) => entry.rel === "canonical" || (entry.rel === "alternate" && entry.hreflang)).map(ordered);
    const structured = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter((match) => attributes(match[1]).type === "application/ld+json")
        .map((match) => ordered(JSON.parse(match[2])));
    // Rendered text, semantic tags and content-bearing attributes; omit hydration,
    // asset hashes, generated IDs/classes, style and comments. Preserve text/code whitespace.
    const visible = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<([a-z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, (tag, name) => {
            const fields = attributes(tag);
            const relevant = ["href", "alt", "title", "aria-label", "placeholder", "value", "type", "name", "role"]
                .filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]);
            return `<${name.toLowerCase()} ${JSON.stringify(relevant)}>`;
        });
    return crypto.createHash("sha256").update(JSON.stringify({ title, meta, links, structured, visible })).digest("hex");
};
const manifest = {
    schemaVersion: 2,
    fingerprintVersion,
    siteUrl: SITE_URL,
    generatedAt: new Date().toISOString(),
    urls: SITEMAP_URLS.map(({ loc, lastmod }) => {
        const url = `${SITE_URL}${loc}`;
        const file = path.join(publicDir, loc, "index.html");
        if (!fs.existsSync(file)) throw new Error(`Missing build HTML: ${loc}; run yarn build first.`);
        return { url, lastmod, contentHash: contentHash(fs.readFileSync(file, "utf8"), url) };
    }).sort((left, right) => left.url.localeCompare(right.url)),
};
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (outputPath) {
    const resolvedPath = path.resolve(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, serialized, "utf8");
    console.log(`Wrote ${manifest.urls.length} URL(s) with rendered content hashes to ${resolvedPath}`);
} else {
    process.stdout.write(serialized);
}

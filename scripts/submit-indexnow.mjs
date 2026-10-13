import { SITE_URL } from "../config/indexableRoutes.js";

const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";
const HOST = new URL(SITE_URL).hostname;
const KEY = process.env.INDEXNOW_KEY;
const KEY_LOCATION = `${SITE_URL}/${KEY || "indexnow-key"}.txt`;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const urls = args
    .filter((argument) => argument !== "--dry-run")
    .map((value) => new URL(value));

const validateUrl = (url) => {
    if (url.protocol !== "https:" || url.origin !== SITE_URL || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) {
        throw new Error(`Only canonical https://${HOST}/ URLs without query/hash are allowed: ${url}`);
    }
};

urls.forEach(validateUrl);
const urlList = [...new Set(urls.map((url) => url.toString()))];

if (urlList.length === 0) {
    console.log("No URLs to submit.");
    process.exit(0);
}

if (urlList.length > 10000) {
    throw new Error("IndexNow accepts at most 10,000 URLs per request.");
}

if (dryRun) {
    console.log(JSON.stringify({ endpoint: INDEXNOW_ENDPOINT, host: HOST, urlList }, null, 2));
    process.exit(0);
}

if (!KEY || !/^[a-zA-Z0-9-]{8,128}$/.test(KEY)) {
    throw new Error("Missing or invalid INDEXNOW_KEY (8-128 letters, digits or hyphens). Use --dry-run to inspect a submission without sending it.");
}

const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
});

const body = await response.text();
if (!response.ok) {
    throw new Error(`IndexNow request failed: ${response.status} ${body}`);
}

console.log(JSON.stringify({
    submittedAt: new Date().toISOString(),
    status: response.status,
    result: response.status === 202 ? "received_key_validation_pending" : "submitted",
    count: urlList.length,
    urlList,
}, null, 2));

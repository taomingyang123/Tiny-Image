import fs from "node:fs";
import path from "node:path";
import { SITE_URL, INDEXABLE_ROUTES } from "../config/indexableRoutes.js";
import { siteConfig } from "../config/site.js";

const output = path.resolve(".output/public");
if (!fs.existsSync(output)) throw new Error("Run a Nuxt build first.");
const write = (name, content) => fs.writeFileSync(path.join(output, name), content, "utf8");
const redirects = INDEXABLE_ROUTES.filter(route => route !== "/")
  .map(route => `${route.slice(0, -1)} ${route} 301`);
write("_redirects", `# Generated from config/indexableRoutes.js\n${redirects.join("\n")}\n`);
write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

if (siteConfig.adsenseClient) {
  write("ads.txt", `google.com, ${siteConfig.adsenseClient.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);
}
if (siteConfig.bingVerification) {
  const key = siteConfig.bingVerification.replace(/[<>&"']/g, char => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[char]);
  write("BingSiteAuth.xml", `<?xml version="1.0"?>\n<users><user>${key}</user></users>\n`);
}
if (process.env.INDEXNOW_KEY) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(process.env.INDEXNOW_KEY)) {
    throw new Error("INDEXNOW_KEY must contain 8-128 ASCII letters, digits or hyphens.");
  }
  write(`${process.env.INDEXNOW_KEY}.txt`, process.env.INDEXNOW_KEY);
}
console.log("Generated canonical redirects, robots and configured verification/advertising files.");

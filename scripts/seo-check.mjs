import fs from "node:fs";
import path from "node:path";
import { INDEXABLE_ROUTES, SITE_URL } from "../config/indexableRoutes.js";
import { checkPage, checkSitemap } from "./lib/seo-assertions.mjs";

const publicDir = path.resolve(".output/public");
const errors = [];
const titles = new Set();
for (const route of INDEXABLE_ROUTES) {
  const file = path.join(publicDir, route, "index.html");
  if (!fs.existsSync(file)) { errors.push(`${route}: missing prerendered HTML; run yarn build`); continue; }
  const result = checkPage(fs.readFileSync(file, "utf8"), route);
  errors.push(...result.errors);
  if (titles.has(result.title)) errors.push(`${route}: duplicate title`);
  titles.add(result.title);
}
const sitemap = path.join(publicDir, "sitemap.xml");
if (!fs.existsSync(sitemap)) errors.push("Missing sitemap.xml");
else errors.push(...checkSitemap(fs.readFileSync(sitemap, "utf8")));
const robots = path.join(publicDir, "robots.txt");
if (!fs.existsSync(robots) || !fs.readFileSync(robots, "utf8").includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
  errors.push("robots.txt Sitemap origin mismatch");
}
const redirects = path.join(publicDir, "_redirects");
const rules = fs.existsSync(redirects) ? fs.readFileSync(redirects, "utf8").split("\n")
  .map(line => line.trim()).filter(line => line && !line.startsWith("#")) : [];
const expectedRules = INDEXABLE_ROUTES.filter(route => route !== "/").map(route => `${route.slice(0, -1)} ${route} 301`);
if (rules.length !== expectedRules.length || expectedRules.some(rule => !rules.includes(rule))) errors.push("Canonical asset redirects mismatch");
if (errors.length) {
  errors.forEach(error => console.error(error));
  process.exitCode = 1;
} else console.log(`SEO checks passed: ${INDEXABLE_ROUTES.length} pages, metadata, hreflang, JSON-LD, sitemap, robots and redirects.`);

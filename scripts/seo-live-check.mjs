import { INDEXABLE_ROUTES, SITE_URL } from "../config/indexableRoutes.js";
import { checkPage, checkSitemap } from "./lib/seo-assertions.mjs";

const base = process.argv[2] || SITE_URL;
const errors = [];
const get = path => fetch(new URL(path, base), {
  redirect: "manual", headers: { Accept: "text/html" }, signal: AbortSignal.timeout(20000),
});

for (const route of INDEXABLE_ROUTES) {
  try {
    const response = await get(route);
    if (response.status !== 200) errors.push(`${route}: expected direct 200, got ${response.status}`);
    if (/noindex/i.test(response.headers.get("x-robots-tag") || "")) errors.push(`${route}: unexpected noindex header`);
    errors.push(...checkPage(await response.text(), route).errors);
    if (route !== "/") {
      const redirect = await get(`${route.slice(0, -1)}?seo_probe=1`);
      const location = new URL(redirect.headers.get("location") || "/", base);
      if (![301, 308].includes(redirect.status) || location.pathname !== route || location.search !== "?seo_probe=1") {
        errors.push(`${route}: missing permanent canonical redirect or lost query`);
      }
      await redirect.body?.cancel();
    }
  } catch (error) { errors.push(`${route}: ${error.message}`); }
}
try {
  const sitemap = await get("/sitemap.xml");
  if (sitemap.status !== 200) errors.push(`Sitemap status ${sitemap.status}`);
  errors.push(...checkSitemap(await sitemap.text()));
  const robots = await get("/robots.txt");
  if (robots.status !== 200 || !(await robots.text()).includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) errors.push("robots.txt mismatch");
  const missing = await get("/__seo_missing_page__/");
  const missingHtml = await missing.text();
  if (missing.status !== 404 || !/noindex/i.test(missingHtml)) errors.push("Missing page must return 404 and noindex");
} catch (error) { errors.push(error.message); }
if (errors.length) { errors.forEach(error => console.error(error)); process.exitCode = 1; }
else console.log(`Live SEO checks passed: ${INDEXABLE_ROUTES.length} pages, metadata, sitemap, canonical redirects and 404.`);

import { SITE_URL, SITEMAP_URLS } from "../../config/indexableRoutes.js";

export const decode = value => (value || "").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
export const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
  .map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3])]));
export const getMeta = html => Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/gi)]
  .map(match => attributes(match[0])).map(tag => [tag.name || tag.property, tag.content]));

export const checkPage = (html, route) => {
  const errors = [];
  const expected = `${SITE_URL}${route}`;
  const title = decode(html.match(/<title\b[^>]*>([^<]+)<\/title>/i)?.[1]);
  const meta = getMeta(html);
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0]));
  const entry = SITEMAP_URLS.find(entry => entry.loc === route);
  const language = route === "/en/" || route.startsWith("/en/")
    ? "en"
    : route === "/ja/" || route.startsWith("/ja/")
      ? "ja"
      : "zh-CN";
  if (!title.trim()) errors.push("missing title");
  if ((html.match(/<h1\b/gi) || []).length !== 1) errors.push("expected exactly one H1");
  if (!meta.description?.trim()) errors.push("missing description");
  if (!meta.robots || /noindex/i.test(meta.robots)) errors.push("indexable page has invalid robots");
  if (attributes(html.match(/<html\b[^>]*>/i)?.[0] || "").lang !== language) errors.push("incorrect HTML language");
  if (links.filter(link => link.rel === "canonical").length !== 1
    || links.find(link => link.rel === "canonical")?.href !== expected) errors.push("canonical mismatch");
  for (const alternate of entry.alternatives) {
    if (!links.some(link => link.rel === "alternate" && link.hreflang === alternate.hreflang && link.href === alternate.href)) {
      errors.push(`missing hreflang ${alternate.hreflang}`);
    }
  }
  for (const field of ["og:title", "og:description", "og:site_name", "og:locale", "twitter:title", "twitter:description", "twitter:card"]) {
    if (!meta[field]) errors.push(`missing ${field}`);
  }
  if (meta["og:url"] !== expected) errors.push("Open Graph URL mismatch");
  const schemas = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => attributes(match[1]).type === "application/ld+json");
  if (!schemas.length) errors.push("missing JSON-LD");
  for (const schema of schemas) {
    try {
      const value = JSON.parse(schema[2]);
      if (!value["@type"] || value["@context"] !== "https://schema.org") errors.push("invalid JSON-LD schema");
    } catch { errors.push("invalid JSON-LD JSON"); }
  }
  return { title, errors: errors.map(error => `${route}: ${error}`) };
};

export const checkSitemap = xml => {
  const errors = [];
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(match => match[1]);
  if (entries.length !== SITEMAP_URLS.length) errors.push("Sitemap URL count mismatch");
  for (const expected of SITEMAP_URLS) {
    const entry = entries.find(entry => decode(entry.match(/<loc>([^<]+)<\/loc>/)?.[1]) === SITE_URL + expected.loc);
    if (!entry) { errors.push(`Sitemap missing ${expected.loc}`); continue; }
    const date = entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (date !== expected.lastmod || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")
      || Number.isNaN(Date.parse(date))) errors.push(`Sitemap lastmod mismatch: ${expected.loc}`);
    const alternatives = [...entry.matchAll(/<xhtml:link\b[^>]*>/g)].map(match => attributes(match[0]));
    for (const alternate of expected.alternatives) {
      if (!alternatives.some(link => link.hreflang === alternate.hreflang && link.href === alternate.href)) {
        errors.push(`Sitemap missing ${alternate.hreflang}: ${expected.loc}`);
      }
    }
  }
  return errors;
};

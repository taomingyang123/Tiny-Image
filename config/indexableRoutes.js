import { siteConfig } from "./site.js";
import { canonicalPagePath } from "./seoPolicy.js";

export const SITE_URL = siteConfig.url;

// Add new public page paths and their real content update dates here.
// These drive prerender, sitemap, redirects, robots headers and SEO checks.
export const PAGE_ROUTES = [
  { path: "/", lastmod: "2026-10-14" },
  { path: "/privacy", lastmod: "2026-10-14" },
];
export const BASE_INDEXABLE_ROUTES = PAGE_ROUTES.map(page => page.path);

export const localizedRoute = (path, locale) => {
  const cleanPath = path === "/" ? "" : path.replace(/\/+$/, "");
  if (locale === "zh") {
    return canonicalPagePath(cleanPath || "/");
  }
  return canonicalPagePath(`/${locale}${cleanPath}`);
};

export const INDEXABLE_ROUTES = PAGE_ROUTES.flatMap(page => [
  localizedRoute(page.path, "zh"),
  localizedRoute(page.path, "en"),
  localizedRoute(page.path, "ja"),
]);

export const SITEMAP_URLS = PAGE_ROUTES.flatMap(page => {
  const alternatives = [
    { hreflang: "zh-CN", href: `${SITE_URL}${localizedRoute(page.path, "zh")}` },
    { hreflang: "en", href: `${SITE_URL}${localizedRoute(page.path, "en")}` },
    { hreflang: "ja", href: `${SITE_URL}${localizedRoute(page.path, "ja")}` },
    { hreflang: "x-default", href: `${SITE_URL}${localizedRoute(page.path, "zh")}` },
  ];
  return ["zh", "en", "ja"].map(locale => ({
    loc: localizedRoute(page.path, locale),
    lastmod: page.lastmod,
    alternatives,
  }));
});

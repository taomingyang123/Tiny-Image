import { canonicalPagePath } from "~/config/seoPolicy.js";

export default defineEventHandler(event => {
  const pathname = getRequestURL(event).pathname;
  if (/^\/(?:api|_nuxt)(?:\/|$)/.test(pathname) || /\/[^/]+\.[^/]+$/.test(pathname)) return;
  if (!useRuntimeConfig(event).public.indexableRoutes.includes(canonicalPagePath(pathname))) {
    setResponseHeader(event, "X-Robots-Tag", "noindex, follow");
  }
});

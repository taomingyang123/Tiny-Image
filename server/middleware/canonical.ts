// Nitro routeRules normalizes trailing slashes. Use the actual request path
// here to avoid redirecting the canonical path back to itself during SSR.
export default defineEventHandler((event) => {
    if (!["GET", "HEAD"].includes(event.method)) return;
    const url = getRequestURL(event);
    const canonicalPages = useRuntimeConfig(event).public.indexableRoutes;
    if (!url.pathname.endsWith("/") && canonicalPages.includes(`${url.pathname}/`)) {
        return sendRedirect(event, `${url.pathname}/${url.search}`, 301);
    }
});

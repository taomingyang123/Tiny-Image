import { fileURLToPath } from "node:url";
import { siteConfig } from "./config/site.js";
import head from "./config/nuxtHead";
import gtag from "./config/nuxtGtag.js";
import cssModule from "./config/nuxtCss.js";
import i18nConfig from "./config/nuxtLanguage.js";
import { INDEXABLE_ROUTES, SITEMAP_URLS } from "./config/indexableRoutes.js";

export default defineNuxtConfig({
  compatibilityDate: "2024-09-19",
  ssr: true,
  telemetry: false,
  devtools: { enabled: true },
  experimental: { defaults: { nuxtLink: { trailingSlash: "append" } } },
  modules: ["@nuxtjs/tailwindcss", "@nuxtjs/i18n", "@nuxtjs/sitemap", "nuxt-gtag", "@vueuse/nuxt"],
  typescript: { strict: true, shim: false },
  runtimeConfig: {
    public: {
      siteUrl: siteConfig.url,
      siteName: siteConfig.name,
      siteImage: siteConfig.image,
      adsenseClient: siteConfig.adsenseClient,
      indexableRoutes: INDEXABLE_ROUTES,
    },
  },
  app: { head },
  css: cssModule.global,
  vite: {
    worker: {
      format: "es",
    },
    optimizeDeps: {
      exclude: [
        "@jsquash/oxipng",
        "@jsquash/png",
        "@jsquash/jpeg",
        "@jsquash/webp",
      ],
    },
    css: { preprocessorOptions: { scss: { additionalData: cssModule.resources } } },
  },
  // Retain the original site's fix for Nuxt's client-only app-manifest stub.
  hooks: {
    "vite:extendConfig": (config, { isClient }) => {
      if (!isClient) return;
      const replacement = fileURLToPath(import.meta.resolve("mocked-exports/empty"));
      if (!config.resolve) return;
      const alias = config.resolve.alias;
      config.resolve.alias = Array.isArray(alias)
        ? [{ find: "#app-manifest", replacement }, ...alias.filter(entry => entry.find !== "#app-manifest")]
        : { ...alias, "#app-manifest": replacement };
    },
  },
  gtag,
  i18n: i18nConfig,
  site: { url: siteConfig.url, name: siteConfig.name, trailingSlash: true },
  sitemap: {
    autoI18n: false,
    includeAppSources: false,
    excludeAppSources: true,
    urls: SITEMAP_URLS,
    zeroRuntime: true,
  },
  nitro: {
    compatibilityDate: "2024-09-19",
    preset: process.env.NITRO_PRESET || "cloudflare-module",
    minify: false,
    prerender: { ignore: [/^\/(?:en\/|ja\/)?dev(?:\/|$)/], crawlLinks: false, routes: [...INDEXABLE_ROUTES, "/sitemap.xml", "/robots.txt"] },
    cloudflare: { nodeCompat: true, wrangler: { name: "tinystool-image-tools" } },
  },
});

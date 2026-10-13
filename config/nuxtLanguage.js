import { supportLocales } from "./index.js";
import { siteConfig } from "./site.js";

/** @type {Partial<import('@nuxtjs/i18n').ModuleOptions>} */
const i18nConfig = {
  locales: supportLocales,
  restructureDir: "i18n",
  langDir: "locales",
  defaultLocale: "zh",
  strategy: "prefix_except_default",
  baseUrl: siteConfig.url,
  detectBrowserLanguage: false,
};

export default i18nConfig;

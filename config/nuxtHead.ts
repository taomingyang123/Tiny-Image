import { siteConfig } from "./site.js";

export default {
  title: siteConfig.name,
  link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  meta: [
    { charset: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1.0" },
    { name: "theme-color", content: "#05080f" },
    ...(siteConfig.googleVerification
      ? [{ name: "google-site-verification", content: siteConfig.googleVerification }] : []),
    ...(siteConfig.bingVerification
      ? [{ name: "msvalidate.01", content: siteConfig.bingVerification }] : []),
  ],
  script: siteConfig.adsenseClient ? [{
    async: true,
    src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${siteConfig.adsenseClient}`,
    crossorigin: "anonymous" as const,
  }] : [],
};

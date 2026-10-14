import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Also load .env for standalone build, SEO and IndexNow scripts.
// Shell environment variables take precedence.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const url = new URL(process.env.NUXT_PUBLIC_SITE_URL || "https://image.tinystool.org");
if (!["https:", "http:"].includes(url.protocol) || url.username || url.password
  || url.pathname !== "/" || url.search || url.hash) {
  throw new Error("NUXT_PUBLIC_SITE_URL must be a site origin, such as https://image.tinystool.org.");
}

export const siteConfig = {
  url: url.origin,
  name: process.env.NUXT_PUBLIC_SITE_NAME || "Tiny Image",
  image: process.env.NUXT_PUBLIC_SITE_IMAGE || "",
  gtagId: "",
  adsenseClient: "",
  googleVerification: process.env.GOOGLE_SITE_VERIFICATION || "",
  bingVerification: process.env.BING_SITE_VERIFICATION || "",
};

if (siteConfig.gtagId && !/^G-[A-Z0-9]+$/.test(siteConfig.gtagId)) {
  throw new Error("NUXT_PUBLIC_GTAG_ID must be a GA4 measurement ID (G-...).");
}
if (siteConfig.adsenseClient && !/^ca-pub-\d+$/.test(siteConfig.adsenseClient)) {
  throw new Error("NUXT_PUBLIC_ADSENSE_CLIENT must use ca-pub- followed by the publisher ID.");
}

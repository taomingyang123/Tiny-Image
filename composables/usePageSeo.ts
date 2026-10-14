import { computed } from "vue";
import { canonicalPagePath } from "~/config/seoPolicy.js";

type SeoSchemaType = "WebApplication" | "WebPage" | "WebSite" | "TechArticle";

type UseSeoOptions = {
    titleKey?: string;
    descriptionKey?: string;
    keywordsKey?: string;
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    schemaType?: SeoSchemaType;
    applicationCategory?: string;
    noIndex?: boolean;
    datePublished?: string;
    dateModified?: string;
    author?: { name: string; url?: string };
};

const normalizeUrl = (siteUrl: string, path: string) => {
    if (path.startsWith("https://") || path.startsWith("http://")) return path;
    return new URL(path.startsWith("/") ? path : `/${path}`, `${siteUrl}/`).toString();
};

export const usePageSeo = (options: UseSeoOptions) => {
    const { t, locale } = useI18n();
    const route = useRoute();
    const switchLocalePath = useSwitchLocalePath();
    const runtimeConfig = useRuntimeConfig();
    const siteUrl = String(runtimeConfig.public.siteUrl).replace(/\/+$/, "");
    const siteName = String(runtimeConfig.public.siteName);
    const defaultImage = String(runtimeConfig.public.siteImage || "");
    const withBrandSuffix = (value: string) => value === siteName || value.endsWith(` | ${siteName}`) ? value : `${value} | ${siteName}`;

    const title = computed(() => withBrandSuffix(options.title || (options.titleKey ? t(options.titleKey) : siteName)));
    const description = computed(() => options.description || (options.descriptionKey ? t(options.descriptionKey) : ""));
    const keywords = computed(() => options.keywords || (options.keywordsKey ? t(options.keywordsKey) : ""));
    const noIndex = computed(() => Boolean(options.noIndex || !runtimeConfig.public.indexableRoutes.includes(canonicalPagePath(route.path))));
    const canonical = computed(() => {
        const cleanPath = route.fullPath.split("?")[0].split("#")[0] || "/";
        return normalizeUrl(siteUrl, canonicalPagePath(cleanPath));
    });
    const image = computed(() => (options.image || defaultImage) ? normalizeUrl(siteUrl, options.image || defaultImage) : "");
    const lang = computed(() => {
        if (locale.value === "zh") return "zh-CN";
        if (locale.value === "ja") return "ja";
        return "en";
    });
    const ogLocale = computed(() => {
        if (locale.value === "zh") return "zh_CN";
        if (locale.value === "ja") return "ja_JP";
        return "en_US";
    });

    const alternateLinks = computed(() => {
        const list = [
            { code: "zh", hreflang: "zh-CN" },
            { code: "en", hreflang: "en" },
            { code: "ja", hreflang: "ja" },
        ] as const;
        const links: { rel: string; hreflang: string; href: string; key: string }[] = list.map(item => ({
            rel: "alternate",
            hreflang: item.hreflang as string,
            href: normalizeUrl(siteUrl, canonicalPagePath(switchLocalePath(item.code) || "/")),
            key: `alt-${item.hreflang}`,
        }));
        links.push({
            rel: "alternate",
            hreflang: "x-default",
            href: normalizeUrl(siteUrl, canonicalPagePath(switchLocalePath("zh") || "/")),
            key: "alt-default",
        });
        return links;
    });

    const schema = computed(() => {
        const schemaType: SeoSchemaType = options.schemaType || "WebPage";
        const baseSchema: Record<string, unknown> = {
            "@context": "https://schema.org",
            "@type": schemaType,
            name: title.value,
            url: canonical.value,
            ...(image.value ? { image: image.value } : {}),
            description: description.value,
            inLanguage: lang.value,
        };

        if (schemaType === "WebApplication") {
            baseSchema.applicationCategory = options.applicationCategory || "DeveloperApplication";
            baseSchema.operatingSystem = "All";
            baseSchema.offers = {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
            };
        }

        if (schemaType === "WebSite") {
            baseSchema.name = siteName;
            baseSchema.url = `${siteUrl}/`;
        }

        if (schemaType === "TechArticle") {
            baseSchema.headline = title.value;
            baseSchema.datePublished = options.datePublished;
            baseSchema.dateModified = options.dateModified || options.datePublished;
            baseSchema.author = options.author
                ? { "@type": "Organization", name: options.author.name, url: options.author.url }
                : { "@type": "Organization", name: siteName, url: `${siteUrl}/` };
            baseSchema.publisher = { "@type": "Organization", name: siteName, url: `${siteUrl}/` };
            baseSchema.isAccessibleForFree = true;
        }

        return baseSchema;
    });

    useHead(() => ({
        title: title.value,
        meta: [
            { name: "description", content: description.value, key: "description" },
            { name: "keywords", content: keywords.value, key: "keywords" },
            {
                name: "robots",
                content: noIndex.value ? "noindex, follow" : "index, follow, max-image-preview:large",
                key: "robots",
            },
            { property: "og:title", content: title.value, key: "og:title" },
            { property: "og:description", content: description.value, key: "og:description" },
            { property: "og:type", content: "website", key: "og:type" },
            { property: "og:url", content: canonical.value, key: "og:url" },
            { property: "og:site_name", content: siteName, key: "og:site_name" },
            { property: "og:image", content: image.value, key: "og:image" },
            { property: "og:locale", content: ogLocale.value, key: "og:locale" },
            {
                property: "og:locale:alternate",
                content: ogLocale.value === "zh_CN" ? "en_US" : "zh_CN",
                key: "og:locale:alternate",
            },
            { name: "twitter:card", content: "summary_large_image", key: "twitter:card" },
            { name: "twitter:title", content: title.value, key: "twitter:title" },
            { name: "twitter:description", content: description.value, key: "twitter:description" },
            { name: "twitter:image", content: image.value, key: "twitter:image" },
        ].filter((tag) => Boolean(tag.content)),
        link: [
            { rel: "canonical", href: canonical.value, key: "canonical" },
            ...(noIndex.value ? [] : alternateLinks.value),
        ],
        script: [
            {
                type: "application/ld+json",
                key: "ld-json",
                children: JSON.stringify(schema.value).replace(/</g, "\\u003c"),
            },
        ],
    }));
};

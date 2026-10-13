import { supportLocales, language } from "~/config/index";
import { useI18n } from "vue-i18n";
export default defineNuxtPlugin((nuxtApp) => {
    const findLanguageCode = (locale: string) => {
        const matched = supportLocales.find((item) => item.code === locale || item.iso === locale);
        if (matched) return matched.code;
        if (language.open.includes(locale)) return locale;
        return language.open[0];
    };
    const locales = () => findLanguageCode(useI18n().locale.value);
    const localesClass = (className = language.className) => `${locales()}${className}`;
    if (nuxtApp.vueApp) {
        nuxtApp.vueApp.config.globalProperties.$locales = locales;
        nuxtApp.vueApp.config.globalProperties.$localesClass = localesClass;
    }
    return {
        provide: {
            locales,
            localesClass,
        },
    };
});

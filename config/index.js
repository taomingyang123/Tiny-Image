export const supportLocales = [
  { code: "zh", language: "zh-CN", iso: "zh-CN", name: "简体中文", file: "zh-CN/index.js" },
  { code: "en", language: "en-US", iso: "en-US", name: "English", file: "en-US/index.js" },
  { code: "ja", language: "ja-JP", iso: "ja-JP", name: "日本語", file: "ja-JP/index.js" },
];

export const language = {
  open: supportLocales.map(locale => locale.code),
  className: "-locales",
};

# Tiny Image — 搜索引擎提交与 SEO 索引登记指南 (SEARCH CONSOLE GUIDE)

本文档面向运营与站长，指导如何将 Tiny Image (`https://image.tinystool.org`) 提交至主流搜索引擎（Google Search Console、Bing Webmaster Tools），并利用 IndexNow 实现首发与更新的秒级索引收录。

---

## 一、基本信息与收录基线

- **正式网站 URL**：`https://image.tinystool.org/`
- **Sitemap 地址**：`https://image.tinystool.org/sitemap.xml`
- **Robots.txt 地址**：`https://image.tinystool.org/robots.txt`
- **可索引页面清单 (INDEXABLE_ROUTES)**：
  - `/` (中文首页)
  - `/en/` (英文首页)
  - `/ja/` (日文首页)
  - `/privacy/` (中文隐私政策)
  - `/en/privacy/` (英文隐私政策)
  - `/ja/privacy/` (日文隐私政策)
- **多语言与规范化**：全站通过 `<link rel="canonical">` 指向带尾斜杠的规范地址，并通过 `<link rel="alternate" hreflang="...">` 提供全双向语言对齐；所有不带尾斜杠访问均已配置 301 永久重定向。

---

## 二、Google Search Console 提交指南

### 1. 添加资源
1. 访问 [Google Search Console](https://search.google.com/search-console)。
2. 点击左上角资源下拉框 → **添加资源 (Add property)**。
3. 选择 **网址前缀 (URL prefix)**，输入：
   `https://image.tinystool.org/`
4. 点击 **继续**。

### 2. 所有权验证 (推荐方式)
- **方式 A (推荐)：HTML 标记 (Meta Tag)**
  - 在 Search Console 中获取 `<meta name="google-site-verification" content="..." />` 验证码。
  - 将验证码注入环境变量或 `nuxt.config.ts` 的 `app.head.meta` 中，运行 `yarn generate` 重新生成即可。
- **方式 B：DNS TXT 记录**
  - 在 Cloudflare DNS 控制台，为 `tinystool.org` 添加一条 TXT 记录：
    - 主机名：`image`
    - 内容：Google 提供的验证字符串。

### 3. 提交站点地图 (Sitemaps)
1. 在左侧菜单点击 **站点地图 (Sitemaps)**。
2. 在「添加新的站点地图」输入框中输入：`sitemap.xml`。
3. 点击 **提交**。
4. 确认状态显示为绿色的 **成功 (Success)**，并确认发现的网页数量为 6（3 首页 + 3 隐私政策）。

### 4. 网址检查与申请编入索引
- 依次在顶部搜索框输入 `https://image.tinystool.org/`、`https://image.tinystool.org/en/`、`https://image.tinystool.org/ja/`。
- 点击 **请求编入索引 (Request Indexing)**，加速 Googlebot 抓取。

---

## 三、Bing Webmaster Tools 提交指南

### 1. 添加与导入站点
1. 访问 [Bing Webmaster Tools](https://www.bing.com/webmasters)。
2. 推荐直接点击 **从 Google Search Console 导入**（一键同步所有权验证与站点地图）。
3. 若手动添加：输入 `https://image.tinystool.org`，通过 XML 文件验证（将 `siteConfig.bingVerification` 填入 `config/site.js`，构建脚本会自动输出 `BingSiteAuth.xml`）。

### 2. 提交站点地图
1. 进入站点控制台 → 点击 **Sitemaps**。
2. 提交站点地图：`https://image.tinystool.org/sitemap.xml`。
3. 状态验证为「Success」。

---

## 四、IndexNow 自动批量推送（Bing / Yandex / Seznam）

本项目已内置自动化 IndexNow 推送工具，无需等待爬虫定时扫描即可即时通知搜索引擎更新。

### 1. 配置密钥
在 Cloudflare Pages 或本地环境变量中配置：
```bash
INDEXNOW_KEY=your_generated_indexnow_api_key
```

### 2. 生成清单与即时推送
```bash
# 生成当前可索引页面的 manifest 列表
yarn indexnow:manifest

# 向 IndexNow API 发起全量推送
yarn indexnow:submit
```

---

## 五、结构化数据 (Rich Results) 验证

全站已在 SSG 构建期预渲染双重 JSON-LD 结构化数据：
1. **WebApplication**：包含应用名、类别、操作平台、是否免费、多语言支持与功能描述。
2. **FAQPage**：包含高频问答，符合 Google 富摘要呈现规范。

### 验证步骤：
1. 打开 [Google 富媒体搜索结果测试工具 (Rich Results Test)](https://search.google.com/test/rich-results)。
2. 输入 `https://image.tinystool.org/`。
3. 检查返回的结构化数据，确保检测到 `WebApplication` 与 `FAQPage` 且 **0 错误、0 警告**。

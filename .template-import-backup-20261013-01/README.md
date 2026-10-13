# Nuxt 网站公共模板

从本站点提取的 Nuxt 3 + Vue 3 + TypeScript 模板，保留网站的通用基础设施。业务页面、工具/游戏逻辑、文章数据、业务组件、专属图片及历史报告已移除，仅保留一个中英双语占位首页。

## 保留的能力

- SSR、按路由白名单预渲染，以及静态生成。
- Tailwind、Sass、VueUse、全局样式、响应式容器、公共页头/页脚和多语言插件。
- 中英双语：英文 `/`，中文 `/zh/`，页头可切换语言。
- GA4 统计模块及 `useGtag()` / `useTrackEvent()`。
- AdSense 脚本与 `ads.txt`，Google/Bing 站长验证。
- 统一页面 SEO：标题、描述、robots、canonical、hreflang、Open Graph、Twitter Card 和 JSON-LD。
- Sitemap、真实内容更新日期、robots.txt、SSR 与静态资源层的永久斜杠重定向。
- 通用 SEO 构建产物检查及线上/本地预览检查。
- IndexNow 公共 key 文件、发布 URL 指纹清单，以及只提交新增、实质更新、删除 URL 的脚本。
- Cloudflare Module Worker 构建、Wrangler 部署配置和运行观测；另提供 Node.js 构建。

## 开始使用

需要 Node.js 20.19+（20.x）或 22.12+，Yarn 4.5.0。可以直接在本文件夹开发，也可以复制整个文件夹到新项目目录。

```bash
corepack enable
cd nuxt-template
cp .env.example .env
# 先填写 .env 中的新站点配置
yarn install --immutable
yarn dev
```

`.env` 中的域名、名称等配置由 Nuxt 和独立脚本共用。修改后需要重新构建，使静态 HTML、Sitemap、验证文件和 SSR 配置一致。

| 配置 | 用途 |
| --- | --- |
| `NUXT_PUBLIC_SITE_URL` | 新站点域名，默认 `https://example.com` |
| `NUXT_PUBLIC_SITE_NAME` | 品牌名，默认 `Nuxt Template` |
| `NUXT_PUBLIC_SITE_IMAGE` | 分享图片路径/URL；先添加自己的 `public/og-image.png` |
| `NUXT_PUBLIC_GTAG_ID` | GA4 测量 ID；填写后启用统计 |
| `NUXT_PUBLIC_ADSENSE_CLIENT` | AdSense 发布者 ID；填写后输出广告脚本与 `ads.txt` |
| `GOOGLE_SITE_VERIFICATION` | Google 验证 meta |
| `BING_SITE_VERIFICATION` | Bing 验证 meta 与 `BingSiteAuth.xml` |
| `INDEXNOW_KEY` | IndexNow key，构建时生成公开验证文件 |

统计、广告和站长验证的可选配置默认留空，填写自己的账号信息即可使用。原站域名、账号 ID、验证 token 没有复制到模板中。

## 构建、检查和部署

```bash
yarn build                         # 默认 Cloudflare Worker + 预渲染静态资源
yarn seo-check                     # 检查构建结果
yarn preview:cloudflare            # 本机 Cloudflare 预览，端口 8787
yarn seo:live http://localhost:8787 # 检查预览的 HTTP 响应
yarn deploy                        # 重新构建并发布到自己的 Cloudflare 账户
```

`preview:cloudflare` 和 `deploy` 使用 `npx wrangler`，首次运行需要下载 Wrangler。发布前，在 `wrangler.jsonc` 和 `nuxt.config.ts` 中同步修改 Worker 名称；自定义域名绑定写在 `wrangler.jsonc` 的 `routes` 中。模板采用 [Cloudflare 静态资源的尾斜杠策略](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)，保留 SSR fallback，不添加全站 SPA 重写。

其他部署方式：

```bash
yarn build:node
yarn preview
# 或 node .output/server/index.mjs

yarn generate
# 将 .output/public 发布到静态托管
```

## 新增页面与 SEO

1. 在 `pages/` 添加页面，公共逻辑放入 `components/`、`composables/` 或 `utils/`。
2. 在 `i18n/locales/en-US/` 和 `i18n/locales/zh-CN/` 补齐文案，内部链接使用 `useLocalePath()`。
3. 调用 `usePageSeo()` 设置页面元信息，例如：

```ts
usePageSeo({
  titleKey: "home.title",
  descriptionKey: "home.description",
  schemaType: "WebPage",
})
```

支持 `WebPage`、`WebSite`、`WebApplication` 和 `TechArticle`；按页面真实内容选择类型。可通过 `image` 设置单页分享图，通过 `noIndex: true` 排除索引。

4. 在 `config/indexableRoutes.js` 的 `PAGE_ROUTES` 加入页面路径和真实 `lastmod`。该表统一生成双语预渲染 URL、Sitemap 与重定向；没有加入表中的页面默认 `noindex, follow`。
5. 执行 `yarn build` 和 `yarn seo-check`。模板仅包含占位内容，正式上线前替换首页与默认文案。

`layouts/default.vue` 使用 `<slot />` 渲染页面，`app.vue` 负责 `NuxtLayout` / `NuxtPage`，避免重复渲染。

## IndexNow

发布后先通过 `yarn seo:live https://你的域名`，再独立执行提交。构建和部署命令不会自动通知搜索引擎。

```bash
yarn indexnow:manifest /path/to/current.json
# 上一次发布的 manifest 必须预先保存；第一次可以直接提交需要通知的 URL
yarn indexnow:submit --dry-run https://你的域名/ https://你的域名/zh/
yarn indexnow:submit https://你的域名/ https://你的域名/zh/
yarn indexnow:changes /path/to/previous.json /path/to/current.json --dry-run
yarn indexnow:changes /path/to/previous.json /path/to/current.json
```

只允许本站 HTTPS 规范 URL；跨域、查询参数和片段会被拒绝。变更清单中的重复 URL、无效指纹也会被拒绝。Manifest 使用渲染内容指纹，单独修改 `lastmod` 不触发重复提交。公开 key 文件属于 IndexNow 验证流程；[官方协议](https://www.indexnow.org/documentation)中的 HTTP 202 表示 key 验证仍在处理，不表示已经收录。

## 主要目录

```text
assets/                  全局样式
components/              公共页头、页脚
composables/             通用页面 SEO
config/                  站点、统计、语言、Head、CSS 与索引路由配置
i18n/locales/            通用中英文案
layouts/                 默认布局
pages/                   唯一的占位首页
plugins/                 通用语言辅助插件
public/                  通用 favicon；放入新站点的静态资源
scripts/                 构建资源、SEO 检查与 IndexNow
server/middleware/       规范 URL 与索引策略
server/routes/           robots.txt、ads.txt
.env.example             新站点配置入口
nuxt.config.ts           Nuxt 模块、SSR、预渲染、Cloudflare
wrangler.jsonc           Cloudflare 部署配置
```

依赖锁文件沿用原项目已解析版本，并按模板依赖重新生成。`node_modules`、构建产物、Cloudflare 缓存和 `.env` 不属于可复制模板文件。

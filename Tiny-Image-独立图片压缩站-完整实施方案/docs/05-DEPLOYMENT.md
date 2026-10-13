# 05｜本地搭建、GitHub、Cloudflare Pages、DNS 部署操作手册

## 1. 创建独立 GitHub 仓库

- 在 GitHub 账号下新建 `tinystool-image-tools`，不需要与主站代码产生 Git submodule 或 monorepo 关系。
- 初期设 private 或 public 由用户决定；没有必要为了 Cloudflare Git 集成而强制 public。
- 默认分支 `main`；开发分支 `feature/*`、修复 `fix/*`；开启 PR 检查与主分支保护。
- `.gitignore`: `.nuxt`, `.output`, `node_modules`, `.env*`, `.wrangler`, Playwright output；`yarn.lock`、`public/_headers` 必须提交。

## 2. 本地初始化

以 Node.js 22 和 Yarn 4 为基础。Nuxt 3 的新项目通过官方 Nuxt v3 模板创建，下面命令里的 `-- -t v3` 必须确保落在创建器支持的参数中；若 CLI 行为变化，以官方 Nuxt 3 文档为准：

```bash
corepack enable
npm create nuxt@latest tinystool-image-tools -- -t v3
cd tinystool-image-tools
# 设置 packageManager 为已验证的 Yarn 4.x 版本并保留 lockfile
corepack yarn install
corepack yarn dev
```

然后加入 TypeScript strict、Tailwind、`@nuxtjs/i18n`、Vitest、Playwright、`@jsquash/jpeg`、`@jsquash/oxipng`、`@jsquash/webp`、ZIP 库等（遵照兼容性 spike 分批加入、锁版本）。

推荐 package.json scripts：

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "typecheck": "nuxt typecheck",
    "lint": "eslint .",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "check": "yarn typecheck && yarn lint && yarn test:unit && yarn generate"
  }
}
```

## 3. Nuxt 静态生成要求

- 保留 Nuxt 默认 SSR 预渲染能力（不要全局 `ssr:false`）；只让上传/压缩组件成为 client-only。
- `nitro.prerender.routes` 或对应 i18n 自动预渲染保证 `/`、`/en/`、`/ja/`、三语言 privacy 都被预渲染。
- 生产构建：`yarn generate`；产物目录：`.output/public`。不要误填旧文档中的 `dist`。
- 检查 `.output/public/index.html`、`.output/public/en/index.html`、`.output/public/ja/index.html`、`robots.txt`、`sitemap.xml`、所有 codec `.wasm`/worker chunk。
- `public/_headers` 增加安全头、静态资源缓存策略；最终真实部署使用 `curl -I` 验证（不同 Pages/Worker 部署类型的头应用机制可能不同）。

## 4. GitHub Actions 质量门禁

提交本包提供的 `.github/workflows/ci.yml.example` 并在工程仓库里改名为 `.github/workflows/ci.yml`。GitHub PR 必须通过 typecheck、lint、unit、generate；浏览器 E2E 在第二步增加或独立 job。建议开启 main branch required checks。

## 5. 连接 Cloudflare Pages

1. 登录 Cloudflare → **Workers & Pages** → Create application → Pages → Import existing Git repository。
2. 连接新仓库 `tinystool-image-tools`；项目名同名。
3. Production branch：`main`。
4. 构建命令：`yarn generate`（若 Cloudflare 构建环境 Yarn Corepack 需要额外初始化，使用 `corepack yarn generate` 或项目正式确认的构建命令）。
5. Build output directory：`.output/public`。
6. 环境：设置 Node 22（例如 `NODE_VERSION=22`）、禁用不需要的运行时 API；自动检测包管理器需要以实际构建日志为准。
7. 推送开发分支，检查 preview Pages URL：资源路径、WASM、Worker、CSP、JS 内容和路由。**务必生产构建可用后再绑定正式域名**。

官方文档明确：Pages Git 集成关联 GitHub 后按提交部署；且不能把已经通过某些方式建立的 Direct Upload Pages 项目原地转换为 Git 集成。故建议**一开始就选择 Git integration 创建项目**，不要先用 Direct Upload 建同名正式项目。

## 6. 添加新子域名

1. 在新 Pages 项目 → `Custom domains` → `Set up a domain` → 输入 `image.tinystool.org`。
2. 如果 tinystool.org DNS 同样在 Cloudflare 管理，确认绑定后 Cloudflare 通常会自动创建相应 CNAME；若未创建，根据 Pages 提示人工添加。
3. 期望 DNS 样式：`image CNAME tinystool-image-tools.pages.dev`（仅作为示例目标：实际 `pages.dev` URL 必须读取新建 Pages 项目的真实返回值，不能假定名称没有冲突）。
4. 不要只在 DNS 配 CNAME 而漏掉 Pages 的 Custom domain 绑定；官方说明可能因此导致解析异常/522。
5. 验证 DNS、HTTPS 证书和首页，以及 `/en/`、`/ja/` 与各语言 privacy 的 HTTP 200。
6. 不修改 tinystool.org 主站原有 DNS 记录；只新增 `image` 子域名记录。

## 7. 缓存、HTTPS、安全响应头

- HTML：不要长期强缓存，允许及时更新；带哈希的 `/_nuxt/*` 静态资源可长缓存并 `immutable`，注意 Cloudflare 规则与框架输出关系。
- 自定义 `_headers` 可设置 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`、CSP 等；**先在预览环境测试** WASM 编译、Blob URL、下载、worker 是否被阻止。
- 避免把 `.wasm` 错误地作为 `text/html` 返回（往往是资源路径 fallback 问题）；对真实 wasm URL 用 `curl -I` 确认响应。
- 压缩流不需要 COOP/COEP 跨源隔离，优先采用兼容的单线程 WASM；若改为多线程 SharedArrayBuffer 才设计跨源隔离及资源兼容测试。
- Pages preview 通过 Cloudflare Access 保护或设置 noindex；正式 `*.pages.dev` 建议重定向到 image.tinystool.org，避免重复索引；canonical 仍指向自定义域名。

### 推荐的静态 `_headers` 起点（上线前必须浏览器验证）

在 `public/_headers` 放入经过本项目验证的响应头配置，下面只给**兼容性测试起点**，不能保证无需修改便可配合所有 Nuxt 版本、WASM 加载方式运行：

```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

CSP 应在首个 WASM 预览构建通过后增量开启，包含 `wasm-unsafe-eval`、`worker-src`、`img-src blob:` 等必要指令与对 Nuxt 内联资源的处置。不能未经实测直接照搬严格 CSP，造成压缩功能生产不可用。

## 8. 验证命令模板

```bash
# 本地
corepack yarn install --immutable
corepack yarn check
corepack yarn preview

# 上线后：真实域名
curl -I https://image.tinystool.org/
curl -I https://image.tinystool.org/en/
curl -I https://image.tinystool.org/robots.txt
curl -I https://image.tinystool.org/sitemap.xml
```

不要仅凭 HEAD 200 判定压缩成功。必须在生产 URL 的 Chrome、Safari（含 iOS）和 Firefox/Edge 上运行 JPEG、PNG、WebP 下载与重新解码测试。

## 9. SEO 收录操作

- Search Console 增加 `image.tinystool.org` URL 前缀属性（或使用已有域名属性按子域名筛选）。
- 提交 sitemap；分别检查中文、英文、日文首页 URL 检查结果；多语言页面质量审核后再开放索引。
- 主站只加一个适当入口/相关文章互链；不要为人为 SEO 制造几十个仅改关键词的重复页。

## 10. 回滚

- 保存最近一个已验证成功部署 ID；Cloudflare Pages 控制台可选择回滚/重新部署最近稳定提交，具体操作按当前 Pages 控制台提供的功能执行。
- 如果出现 WASM 404/Worker 崩溃，高优先级回滚；不切换到隐形上传 API 的服务端版本。
- 有必要时临时关闭故障格式选项，注明不可用，保留另两种工作模式。

# AGENTS.md — Tiny Image (tinystool-image-tools)

> 阅读顺序：本文件 → [MEMORY.md](MEMORY.md) → [TASKS.md](TASKS.md) → [docs/01-PRD.md](docs/01-PRD.md) ~ [docs/08-RISK-AND-DECISIONS.md](docs/08-RISK-AND-DECISIONS.md)。
> 新会话第一轮仅提醒一次：「💡 如需检查历史记录遗漏，可以说：请检查 memory。」

## 项目概述

- 名称：Tiny Image 独立图片压缩站；仓库与 Cloudflare Pages 项目命名 `tinystool-image-tools`。
- 正式域名：`https://image.tinystool.org`。
- 目标与用户：面向个人站长、前端开发者、内容运营和普通用户的纯前端本地图片压缩工具。
- 架构：Nuxt 3 + Vue 3 + TypeScript (strict) + Tailwind CSS + Nuxt SSG 静态预渲染 + 浏览器端 Web Worker + 按需 WASM。
- 当前阶段：阶段 0（技术验证与 SSG 基线）。
- 范围：JPEG、PNG、WebP 客户端本地压缩，多语言 (zh-CN, en, ja)，静态预渲染 SEO 与隐私政策。

## 项目不可变约束

1. 项目完全独立，不要改动 tinystool.org 主站源码、仓库、Cloudflare 项目。
2. 正式域名 `https://image.tinystool.org`；独立仓库与 Pages 项目均命名 `tinystool-image-tools`。
3. 图片文件不得以任何方式上传服务器或第三方；不接后端压缩 API、Cloudflare Images、R2、图片 CDN 转码；不得把图片内容或文件名发送至分析与错误上报。
4. 使用 Nuxt 3 + Vue 3 + TS strict + SSG；压缩过程必须在浏览器，本地创建 Worker。只能访问本站静态 WASM/JS/CSS 资源。
5. 不要一次性下载所有编码器；按输出格式动态加载，首屏不下载编码器。
6. 第一版 JPEG/PNG/WebP；AVIF/GIF 动图/HEIC/SVG 作为明确的后续任务，不得伪装已支持。
7. 单个文件出错不能影响其他任务；可取消、可重试、状态正确；清理 ObjectURL、ImageBitmap 和 Worker 等资源。
8. 默认保留图像原尺寸；质量选项只有有损编码生效；绝不宣称“无损图片质量 80%”。
9. 保证 JPEG 不输出透明黑底；透明 PNG/WebP 不得意外丢失透明度。文件扩展名必须匹配 MIME；失败要有可理解提示。
10. 第一版页面支持 zh-CN (`/`)、en (`/en/`)、ja (`/ja/`)。预渲染首页及多语言页面；canonical/hreflang/sitemap/robots 基于生产域名。
11. 对安全、性能、SEO 的声明必须和实装相符；不编造压缩节省百分比或绝对隐私承诺。
12. 使用测试和真实浏览器验证生产构建，尤其验证 Nuxt/Vite 和 jSquash WASM 路径、Worker URL、MIME/CSP。

## 架构总览

| 模块 | 职责与依赖 |
|---|---|
| `app.vue`、`layouts/`、`pages/`、`components/` | NuxtLayout/NuxtPage、图片上传/配置/进度/对比/下载组件、SEO 内容 |
| `i18n/locales/` | 中文 (`/`)、英文 (`/en/`)、日文 (`/ja/`) 文案与路由 |
| `lib/image/` | 格式 magic 检测、尺寸探测、策略路由与决策纯函数、codec 适配器 |
| `workers/image.worker.ts` | 任务消息协议、Transferable ArrayBuffer 编解码运行 |
| `composables/` | `useCompressionQueue.client.ts` 队列与状态管理、`usePageSeo.ts` |
| `config/` | 站点环境变量、多语言与 SEO 规范路径配置 |
| `nuxt.config.ts` | SSG 静态预渲染、Tailwind、i18n、sitemap 配置 |

## 执行纪律

### 任务与范围

修改代码、行为、数据或协作机制前登记 TASKS；已有任务置 doing，没有则按最大编号递增新建。
同一项目 WIP=1：同时最多一个 doing。冲突的新需求先登记 todo；用户明确要求立即切换时，原任务转 blocked 并记录断点。
状态：todo → doing → done；todo/doing → blocked；blocked → doing。done 不回流，后续问题另建任务并引用原编号。

### 三层完成定义

1. 静态：相关编译、类型、语法、结构或文档链接检查。
2. 运行时：受影响组件、命令、接口或服务实际运行，行为符合约定。
3. 系统级：真实代表场景端到端完成，输入、输出和副作用正确。

按顺序记录环境、命令、结果和证据。适用验证未通过时保持 doing 或 blocked。纯文档任务可将后两层标为 N/A。

## 启动与验证（运行契约）

| 能力 | 命令或操作 | 前置条件 | 最近结果及证据 |
|---|---|---|---|
| 本地开发 | `yarn dev` | Node 22, Yarn 4 | 待验证 |
| 静态生成 | `yarn generate` | 依赖已就绪 | 待验证 |
| 本地预览 | `yarn preview` | 静态生成已完成 | 待验证 |
| 单元测试 | `yarn test:unit` | Vitest 配置 | 待验证 |
| 端到端测试 | `yarn test:e2e` | Playwright 配置 | 待验证 |
| 全量门禁检查 | `yarn check` | typecheck + unit + generate | 待验证 |
| SEO 产物检查 | `yarn seo-check` | `.output/public` 生成 | 待验证 |

## 日志与一致性

- TASKS 是任务状态唯一事实源；MEMORY 是历史索引；ROADMAP.md 是阶段摘要。
- 登记任务 done 后写 memory 并更新索引；重要未完成决策也可记。
- 日志文件名 `YYMMDD-HH-简述.md`。
- 收尾报告产出、验证、限制、下一步及路径。

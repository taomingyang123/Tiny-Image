# TASKS.md — 任务单一事实源

> 每条任务包含行为、验证、状态、进展、证据。WIP=1；规则见 [AGENTS.md](AGENTS.md)。

## 任务清单

### 阶段 0：技术验证

#### T00-01 · 仓库初始化与 Nuxt 3 静态方案
- **行为**：建立 `tinystool-image-tools` 基础工程配置，包括 `.nvmrc` (Node 22)、package.json 规范化命令（dev/generate/preview/check/typecheck/test:unit）、AGENTS.md、README.md、多语言（zh 为默认 `/`，en 为 `/en/`，ja 为 `/ja/`）与 Cloudflare Pages SSG 预渲染路由配置。
- **验证**：静态：`yarn typecheck` 与 `yarn seo-check` 0 错误；运行时：`yarn generate` 预渲染 20 条路由无 SSR 异常；系统级：`.output/public` 生成 6 个多语言页面、sitemap.xml、robots.txt、_headers 及规范化 hreflang。
- **状态**：done
- **进展**：2026-10-14 完成配置并全量构建验证通过。
- **证据**：`yarn typecheck` 成功；`yarn generate` 成功；`yarn seo-check` 通过（6 pages, metadata, hreflang, JSON-LD, sitemap, robots and redirects）。

#### T00-02 · WASM 编解码 Spike（关键风险）
- **行为**：在本地 dev 路由接入 `@jsquash/jpeg`、`@jsquash/oxipng`、`@jsquash/webp`，通过 Web Worker 针对 JPEG/PNG/WebP fixtures 运行解码与压缩；验证 WASM 打包路径与 Nuxt/Vite 兼容性。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`yarn test:unit` 3 项编解码单元测试通过，`yarn generate` 成功将所有 6 个 `.wasm` 与 ESM Worker 打包至 `.output/public/_nuxt/`；系统级：写入 ADR-009。
- **状态**：done
- **进展**：2026-10-14 验证完成，依赖及 Vite ESM Worker 打包模式就绪。
- **证据**：`tests/unit/codec-spike.test.ts` 3/3 通过；`.output/public/_nuxt/` 包含全部 wasm 产物；ADR-009 登记。

### 阶段 1：核心引擎

#### T01-01 · 数据契约与格式校验
- **行为**：根据 03-CONTRACTS 实现 TypeScript 类型定义、图片魔数检测（magic bytes）、静态/动画检测（APNG/动画 WebP 拒绝）、像素上限与尺寸限制判断、任务状态机纯函数。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`yarn test:unit` 20/20 全部通过（格式魔数、APNG/动画 WebP 拒绝、尺寸探测、政策函数）；系统级：通过类型与魔数杜绝伪造后缀与非法尺寸。
- **状态**：done
- **进展**：2026-10-14 落地 `lib/image/` 类型、魔数探测、尺寸限制与策略纯函数。
- **证据**：`tests/unit/image-contracts.test.ts` 17 项断言全部通过；`yarn test:unit` 20/20 通过。

#### T01-02 · Codec 适配器
- **行为**：实现 `lib/image/codec/jpeg.ts`、`lib/image/codec/png.ts`、`lib/image/codec/webp.ts` 与统一调度门面 `lib/image/codec/index.ts`；动态 import 编码器；实现 PNG 二进制 OxiPNG 优化通道、透明背景填充白底（JPEG 输出时）与 JPEG/WebP 有损重编码。
- **验证**：纯函数与各适配器单元测试通过，验证透明填充、尺寸缩放与输出格式。
- **状态**：done
- **进展**：2026-10-14 完成 JPEG/PNG/WebP 适配器、双线性插值缩放与透明通道纯白填充，统一调度门面 processImage。
- **证据**：`tests/unit/codecs.test.ts` 6 项测试通过；全量 26 项单元测试全绿。

#### T01-03 · Worker 与队列管理
- **行为**：实现 `workers/image.worker.ts`，主线程与 Worker 通过 Transferable ArrayBuffer 通信；单任务并发；支持超时强杀、取消、重试与内存释放。
- **验证**：队列测试：批量任务顺序执行、取消活动任务不阻塞后续任务、内存资源释放。
- **状态**：done
- **进展**：2026-10-14 完成 workers/image.worker.ts、lib/image/workerClient.ts 及 composables/useCompressionQueue.client.ts，支持输入四重校验、超时强杀、取消与状态机。
- **证据**：`tests/unit/queue.test.ts` 9 项测试通过；全量 35 项单元测试通过；`yarn check` 门禁通过。

#### T01-04 · ZIP 打包与下载
- **行为**：单张 Blob 下载与 fflate 批量打包 ZIP，支持文件名去重与路径清理；移动端超限保护。
- **验证**：单张下载与 ZIP 包解析内容正确、无路径穿越。
- **状态**：done
- **进展**：2026-10-14 引入 fflate 实现单张下载、客户端流式 ZIP 归档（level: 0）、文件名清理与同名去重及超限保护。
- **证据**：`tests/unit/download.test.ts` 5 项测试通过；全量 40 项单元测试通过；`yarn check` 门禁通过。

### 阶段 2：UI、语言与静态内容

#### T02-01 · 页面交互与响应式布局
- **行为**：实现拖拽上传区、设置面板（格式选择、质量滑杆、最长边缩放）、文件状态列表、前后对比预览抽屉、ZIP/单张下载按钮。
- **验证**：PC与移动端响应式测试，无卡死，键盘可访问。
- **状态**：doing
- **进展**：2026-10-14 开始构建核心 UI 组件与页面布局交互。
- **证据**：进行中。

#### T02-02 · 国际化多语言
- **行为**：提供中文 (`/`)、英文 (`/en/`)、日文 (`/ja/`) 完整文案，包括错误码与提示文本，切换时不丢失现有任务状态。
- **验证**：三语言路由正常渲染，无硬编码中文残留。
- **状态**：todo
- **进展**：待 T02-01 完成后启动。
- **证据**：未验证。

#### T02-03 · 静态内容、SEO 与隐私声明
- **行为**：实现预渲染正文说明、FAQ、三语言隐私政策页面（`/privacy/`、`/en/privacy/`、`/ja/privacy/`）、sitemap、robots、canonical 与 hreflang。
- **验证**：`yarn generate` 后检查生成的 HTML 源码中包含正文与结构化标签。
- **状态**：todo
- **进展**：待 T02-02 完成后启动。
- **证据**：未验证。

### 阶段 3：测试、安全与体验

#### T03-01 · 自动化测试与质量门禁
- **行为**：完善 Vitest 单元测试与 Playwright E2E 真实浏览器压缩流程测试，配置 `yarn check` 门禁。
- **验证**：本地及 CI 运行 `yarn check` 全绿。
- **状态**：todo
- **进展**：待阶段 2 完成后启动。
- **证据**：未验证。

#### T03-02 · 性能调优与资源管理
- **行为**：内存泄漏排查、超大图保护、首屏零 WASM 懒加载验证、Lighthouse 审计。
- **验证**：Lighthouse 报告达标，压缩过程中主线程保持响应。
- **状态**：todo
- **进展**：待 T03-01 完成后启动。
- **证据**：未验证。

#### T03-03 · 安全审查与 CSP
- **行为**：验证零出站图片数据流量（DevTools Network 审计）、文件名安全清理、配置 `_headers` 安全响应头与 CSP。
- **验证**：静态产物符合安全清单，无 CSP 报错。
- **状态**：todo
- **进展**：待 T03-02 完成后启动。
- **证据**：未验证。

### 阶段 4：上线交付

#### T04-01 · CI 与部署配置
- **行为**：配置 GitHub Actions 工作流与 Cloudflare Pages Git 集成配置文件。
- **验证**：CI 流程验证通过。
- **状态**：todo
- **进展**：待阶段 3 完成后启动。
- **证据**：未验证。

#### T04-02 · 域名绑定与上线核查手册
- **行为**：编写 Cloudflare Pages 绑定 `image.tinystool.org`、DNS CNAME 配置、HTTPS 检查与验证手册。
- **验证**：文档完整清晰可复现。
- **状态**：todo
- **进展**：待 T04-01 完成后启动。
- **证据**：未验证。

#### T04-03 · SEO 登记与交付归档
- **行为**：编写 Search Console 提交指南、变更记录 CHANGELOG.md 与 DEPLOYMENT-RESULTS.md。
- **验证**：交付物核对清单完整。
- **状态**：todo
- **进展**：待 T04-02 完成后启动。
- **证据**：未验证。

---

### 已归档任务（历史模板）

#### F01 · 接入已有项目协作文档
- **状态**：done（已归档）
- **证据**：[导入验收](docs/verification/2026-10-13-template-import.md)

## 完成进度

- todo：11
- doing：1 (T01-02)
- blocked：0
- done：4 (T00-01, T00-02, T01-01, F01 归档)
- 总数：16
- 已启动或受阻数 = doing + blocked + done：5
- 收尾比例 = done / (doing + blocked + done)：80%（4 / 5）

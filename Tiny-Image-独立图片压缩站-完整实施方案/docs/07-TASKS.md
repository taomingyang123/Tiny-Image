# 07｜任务拆分、依赖关系与每阶段验收

## 阶段 0：技术验证（先做，阻塞后续）

### T00-01 仓库初始化与 Nuxt 3 静态方案

- 创建独立 Nuxt 3、Vue 3、TS strict 工程、Yarn lockfile、.nvmrc、README、AGENTS.md；配置 SSG。
- 验收：`yarn generate` 输出静态首页到 `.output/public`，不出现浏览器 API 的 SSR 错误。

### T00-02 WASM 编解码 Spike（关键风险）

- 在 `/dev/codec-spike`（或本地 dev-only 页面，不对搜索引擎开放）接入 jSquash JPEG、OxiPNG、WebP；针对三张 fixtures 在 Web Worker 运行；按真实线上静态构建测试。
- 对 jSquash 依赖逐个确认版本、许可证、WASM 文件路径、Nuxt 构建；对单线程/依赖优化配置逐项验证。
- 验收：`yarn generate`、本地 static server、Cloudflare Pages preview 三环境通过，同类型 Blob 可重新解码；技术方案写入 ADR。
- 如果失败：阻塞 P0 产品编码，优先修复/更换 codec adapter，不要直接转后端。

## 阶段 1：核心引擎

### T01-01 数据契约与格式校验

- 根据 03-CONTRACTS 实现 types、magic 检测、静态动画判断、像素/体积限制、任务状态机。
- 验收：Vitest 覆盖核心边界条件、误标后缀/错误格式、透明/动画报错。

### T01-02 Codec adapters

- 实现 `codec/jpeg.ts`、`codec/png.ts`、`codec/webp.ts`，按需要动态 import 编码器。
- PNG 保留 bytes→OxiPNG 路径；JPEG/WebP 有损 codec 路径；输出 MIME 及格式验证。
- 验收：三种小图无崩溃，输出能被 Web 浏览器/测试库解码。

### T01-03 Worker 与队列

- `image.worker.ts` + `workerClient.ts` + `useCompressionQueue.client.ts`；单任务并发；超时强杀；取消/重试；错误隔离；配套清理。
- 验收：20 张任务能逐张完成，取消活动任务后其余仍可运行；内存清理可观察。

### T01-04 ZIP 与文件下载

- 生成正确 Blob、对象 URL、文件名、去重、批量 ZIP；移动端大包限制。
- 验收：下载文件 MIME/扩展名正确，ZIP 成功文件集合正确，不包含失败文件与路径穿越。

## 阶段 2：UI、语言与静态内容

### T02-01 页面布局

- Header、Hero、上传卡片、全局参数、文件列表/卡片、预览对比、进度和结果、FAQ/Footer；PC/手机响应式。
- 验收：拖拽/多选/质量滑杆/尺寸设置/取消/重试/下载均可操作；键盘可访问。

### T02-02 三语言

- zh-CN、en、ja 翻译和对应路由；错误码/状态所有 UI 文案本地化。
- 验收：三种语言无硬编码中文残留；切换语言保留用户已有队列状态（若采用单页内部切换需要验证路由状态策略；若切换路由会重置任务，必须先警告用户）。

### T02-03 SEO、隐私与关于

- 静态有价值说明文本、独立三语言 privacy、canonical、hreflang、robots、sitemap、OG 图、favicon、FAQ。
- 验收：查看预渲染 HTML 包含可见正文/metadata；隐私准确并说明元数据不保证处理。

## 阶段 3：测试、安全与体验

### T03-01 自动化测试

- Vitest 核心逻辑；Playwright UI 浏览器流程；mock / fixtures / 大小限制；CI 集成。
- 验收：`yarn check` 完成；playwright 在 Chrome 运行 JPEG/PNG/WebP 的生产预览端到端测试。

### T03-02 资源与性能

- 大图内存保护、下载后释放 ObjectURL、Worker 生命周期、懒加载首屏无 WASM、避免压缩时 UI 阻塞。
- 验收：测试矩阵 T01–T30 和 Lighthouse 报告；已知限制写 README。

### T03-03 安全检查

- 无图片出站请求；文件名安全处理；CSP/header；依赖安全与许可证；异常边界。
- 验收：安全 checklist 全过；CSP 无 console 报错。

## 阶段 4：上线运维

### T04-01 CI/CD

- 独立 GitHub 仓库 + main branch protection + Pages Git 集成，Production branch main。
- 验收：PR 可预览、合并 main 自动上线，构建失败不影响上个稳定线上部署。

### T04-02 绑定子域名

- 在 Pages `Custom domains` 绑定 image.tinystool.org；按 Dashboard 结果设置/校验 DNS；HTTPS 验证。
- 验收：六条站点路径 HTTP 200，压缩模块在线可加载，主站解析不变。

### T04-03 SEO/监控/回滚

- Search Console sitemap、域名索引、页面质量和错误记录；Pages 部署回滚操作文档。
- 验收：DNS/HTTPS/SEO 已经能手动检查，不代表保证 Google 收录；明确回滚目标。

## 推荐执行顺序与 PR 拆分

`PR-01 工程骨架 → PR-02 WASM Spike → PR-03 类型/校验 → PR-04 codec 引擎 → PR-05 Worker 队列 → PR-06 下载/ZIP → PR-07 UI → PR-08 i18n/SEO/隐私 → PR-09 E2E/安全/性能 → PR-10 Cloudflare 上线`。

阶段 0 验证通过才能继续其余 PR；每个 PR 至少要有自测命令和文档，不必每次切模型，更重要的是保持统一的 AGENTS.md 和执行契约。

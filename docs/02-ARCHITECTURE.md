# 02｜技术架构与编解码方案

## 1. 基本架构

`Cloudflare Pages 静态资源 → Nuxt 3 SSG 页面 → client-only 文件队列 → Module Web Worker → 按需 jSquash WASM → Blob/ZIP 本地下载`。

SSR/SSG 只生成文本、导航、SEO 内容。不得在服务端 `import` 需要 `window/OffscreenCanvas/File` 的运行时代码；通过 `.client.ts`、`<ClientOnly>`、动态 import 和 `new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })` 隔离。编解码仅处理用户选择的本地文件。

## 2. 依赖选择

| 用途 | 首选 | 备用/边界 |
|---|---|---|
| JPEG 编码 | `@jsquash/jpeg` MozJPEG | 编译失败可临时使用 Canvas encoder，明确功能与画质差别 |
| PNG 无损 | `@jsquash/oxipng` | 版本过旧/构建失败时先对生产构建做单线程/变体验证，保底为原图直出而不是伪压缩 |
| WebP 编码 | `@jsquash/webp` | Canvas `toBlob('image/webp')` 兼容性兜底；检查 `Blob.type` |
| PNG/JPEG/WebP 解码 | `createImageBitmap` + `OffscreenCanvas`（能力支持时） | 在 Worker 不可用时，主线程最小化解码并传送 ImageData/Bitmap，限定文件大小 |
| 批量 ZIP | `fflate` 或经体积测试的等价库 | JSZip 可用但注意额外内存与最终包体；ZIP 不强制二次压缩已经压缩的图片 |
| 多语言 | `@nuxtjs/i18n`（Nuxt 3 兼容版） | 路由静态预渲染中文/英文/日文 |
| 测试 | Vitest + Playwright | 真正验证浏览器中的 Worker/WASM |

依赖不要仅凭文档安装：jSquash README 明确提及 Vite `optimizeDeps.exclude`、Nuxt `build.transpile`（按具体症状）及嵌套 Worker 构建问题。**P0.1 技术预研要锁版本并验证 `yarn generate` 和线上静态预览。** 不要不加测试地同时添加所有 `transpile` 排除/强制规则。

## 3. 三条处理路径

### A. PNG 原格式、无损、不调整尺寸

`File.arrayBuffer → OxiPNG.optimise(ArrayBuffer) → 对比字节数 → 输出较小者的 PNG Blob`。

这条路径不使用 canvas 重绘。好处：保留图像像素，避免重编码打散调色板或直接增加体积。注意某些元数据可能被更改/剥离或保留；未经审计绝不承诺保留/删除特定 EXIF、ICC、GPS 块。

### B. JPEG/WebP 原格式有损重新编码

`File → decode (worker createImageBitmap 或 WASM) → ImageData → 可选降采样 → 对应 WASM encode(质量) → Blob → 结果`。

- 每次压缩都可能有视觉失真；默认不调整尺寸，但质量 80 会重新编码。
- JPEG 图像 alpha 必须填白；用户选择的背景色后续可拓展。
- 解码/编码时正确保留方位，依赖解码 API 对 EXIF Orientation 的处理，建立多浏览器样例回归；必要时显式修正。

### C. 转换输出格式（JPG/PNG/WebP → JPEG/WebP）

`File → 识别解码器/浏览器能力 → ImageData → 可选重采样 → JPEG/WebP encode → Blob`。

- 输入格式由文件魔数、容器标识和解码试运行共同确认；`file.type` / 扩展名不能作为唯一证据。
- 静态 WebP v1 支持；动画 WebP、APNG 检测到动画后明确报“不支持动图”，避免静默丢帧。
- 不支持的目标格式不出现在 UI；AVIF 暂不启用开关。

## 4. 分层模块

- `lib/image/magic.ts`：读取文件头、识别 MIME、验证可支持的格式，不信任拓展名。
- `lib/image/dimensions.ts`：轻量图片宽高探测与像素上限；如果必须完整解码探测则执行严格内存保护。
- `lib/image/policy.ts`：输出格式、透明处理、同格式 PNG skip、体积展示、文件名去重等纯函数。
- `lib/image/codec/*.ts`：适配器，暴露 `encode/decode/optimise`；按需 import，对上层屏蔽 WASM API 差异。
- `workers/image.worker.ts`：任务协议，主线程与 Worker 间 Transferable ArrayBuffer；Worker 管理器中断任务时 terminate 并重建。
- `composables/useCompressionQueue.client.ts`：任务队列、状态、配置快照、异常与资源释放；并发默认为 1。
- `components/*`：上传、配置、队列、进度、对比、下载组件。
- `locales/*.json`：3 语言翻译与帮助文本。

## 5. 内存控制和效率

- 8000×6000 RGBA 图像单份像素约 183 MiB；解码/画布/编码器可能产生多份拷贝，不能只根据文件大小估算内存。
- v1 单任务活动并发=1；队列可接受最多 20 项，但是未轮到的任务不要提前 decode；未完成项缩略图可惰性创建。
- 限额：单张 30 MiB、桌面 32 MP、移动端 16 MP，全部为初始值，随后根据真实设备压力调整。
- 使用 `ArrayBuffer` 转移而非深拷贝；及时释放 Blob URL、ImageBitmap、Canvas、Worker 临时结果；将图片尺寸限制校验置于正式解码前。
- Worker 要有硬性任务超时/卡死兜底（例如 60s 起配、根据数据调整）；超时终止 Worker 并保持队列可用，不让任务永久 processing。
- zip 在低内存移动端额外占内存：控制单批输出上限，例如输出文件总字节数 > 200 MiB 禁用一次性打包并提示逐张下载；值可按设备测试调整。
- 主页面只展示 1–2 张完整前后预览，其他列表显示小缩略图；预览大图片要限制渲染尺寸。

## 6. 动态 WASM 加载及 Nuxt/Vite 风险

1. 在技术预研分支只集成一张测试 JPG、PNG、WebP，验证真机/桌面上的压缩成功和输出可读。
2. 查看生产 `nuxt generate` 产物是否包含所有 `.wasm` 和 worker JS；访问网络面板确认 200、正确 MIME、路径没有落入 SSR。
3. 若 jSquash WASM URL 失败，按官方 README 的 `optimizeDeps.exclude` 和 Nuxt 配置顺序排查；只配置受影响包，并在 `README` 记录原因。
4. 若 wasm 内部嵌套 Worker 使构建不稳定，尝试经验证的单线程版本/替代适配器。外层仍使用独立浏览器 Worker。
5. 若实在无法在 Nuxt 静态包中稳定运行，可将编解码 Worker 独立成 Vite-built ESM 静态资源并随 Pages 一起部署；不引入服务端。

## 7. 网络、安全和隐私

- 图片 File、二进制、数据 URL 不经 fetch/Beacon/Analytics/错误上报输出。禁止远程图片 URL 输入与远程转码。
- 默认仅加载本站 JS/WASM/字体/icon；无需第三方 CDN、Google Font（优先系统字体）；加入 CSP，但需先在生产验证 WASM 所需的 `wasm-unsafe-eval`、Blob 预览/worker 的限制，再收紧。
- CSP 初始方向：`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`。Nuxt 内联脚本/样式可能需要 nonce/hash/经过审核的例外；不能复制即认为可用。
- 文件名需作为文本插入，不允许 HTML；ZIP 路径清理 `/\\`、控制字符及 `..`；不得执行用户上传的 SVG/HTML。
- 使用被检查过的库版本；生成 LICENSE 与第三方许可证说明。
- 整个页面在 HTTPS 下运行；不存用户图片至 localStorage、indexedDB 或 service worker。

## 8. API 设计

**没有 HTTP 图片压缩接口。** 唯一的接口是“页面进程 ↔ Web Worker”的本地消息协议，详见 `03-CONTRACTS.md`。HTTP 请求只用于加载静态站点资源。后续即使增加 API，也必须经显式新需求审批。

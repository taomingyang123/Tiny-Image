# Codex 项目级工作规范 — Tiny Image

在新建 `tinystool-image-tools` 仓库根目录放置本文件，并将 `docs/` 和 `CODEX_START_HERE.md` 同步放入仓库。

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
10. 第一版页面支持 zh-CN、en、ja。预渲染首页及多语言页面；canonical/hreflang/sitemap/robots 基于生产域名。
11. 对安全、性能、SEO 的声明必须和实装相符；不编造压缩节省百分比或绝对隐私承诺。
12. 使用测试和真实浏览器验证生产构建，尤其验证 Nuxt/Vite 和 jSquash WASM 路径、Worker URL、MIME/CSP。

## 执行方式

- 读取 `CODEX_START_HERE.md`，按照 `docs/07-TASKS.md` 分阶段实施。
- 每完成阶段必须运行对应测试，出具“已完成文件 / 测试命令及结果 / 未完成事项 / 下一阶段”。
- 无法使用浏览器、联网、Cloudflare 或 GitHub 授权时，不要假装成功；保留可复制的人工操作指令。
- 需要替换 codec 依赖时，在 `docs/08-RISK-AND-DECISIONS.md` 记录原因、验证和许可证信息。
- 依赖必须固定在 lockfile；检查其 WASM 工作线程、许可证、发布活跃度和打包路径。
- 严禁无必要的高成本插件、MCP 或 AI 图片生成；优先本地调试。
- 不因为运行速度问题擅自把图片发送到服务端处理。

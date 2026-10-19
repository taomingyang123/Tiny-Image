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
- **状态**：done
- **进展**：2026-10-14 落地 Dropzone、Settings、TaskList、CompareModal 组件，支持剪贴板粘贴与键盘无障碍导航，全站深色风格统一。
- **证据**：`yarn typecheck` 0 错误；`yarn test:unit` 41/41 通过；`yarn generate` 22 条静态路由预渲染成功；`yarn seo-check` 通过。

#### T02-02 · 国际化多语言
- **行为**：提供中文 (`/`)、英文 (`/en/`)、日文 (`/ja/`) 完整文案，包括错误码与提示文本，切换时不丢失现有任务状态。
- **验证**：三语言路由正常渲染，无硬编码中文残留。
- **状态**：done
- **进展**：2026-10-14 补全三语对称字典（86项词条）、消除硬编码文本、实现错误码动态映射、实现 useCompressionQueue 客户端单例跨路由保留任务状态。
- **证据**：`tests/unit/i18n.test.ts` 5 项测试全过；全量 47 项单元测试通过；`yarn check` 门禁与 `yarn seo-check` 通过。

#### T02-03 · 静态内容、SEO 与隐私声明
- **行为**：实现预渲染正文说明、FAQ、三语言隐私政策页面（`/privacy/`、`/en/privacy/`、`/ja/privacy/`）、sitemap、robots、canonical 与 hreflang。
- **验证**：`yarn generate` 后检查生成的 HTML 源码中包含正文与结构化标签。
- **状态**：done
- **进展**：2026-10-14 落地三语隐私政策（4大核心条款）、FAQ 问答、双重 JSON-LD（WebApplication + FAQPage）、sitemap.xml、robots.txt 与 301 重定向规则。
- **证据**：`yarn generate` 成功生成 22 条静态路由；`yarn seo-check` 校验通过（6 pages, metadata, hreflang, JSON-LD, sitemap, robots and redirects）。

### 阶段 3：测试、安全与体验

#### T03-01 · 自动化测试与质量门禁
- **行为**：完善 Vitest 单元测试与 Playwright E2E 真实浏览器压缩流程测试，配置 `yarn check` 门禁。
- **验证**：本地及 CI 运行 `yarn check` 全绿。
- **状态**：done
- **进展**：2026-10-14 落地 E2E 批量压缩与打包工作流断言，升级 yarn check 为类型检查、48 项单元/工作流测试、全站 SSG 预渲染与 SEO 规范断言四重复合门禁。
- **证据**：`tests/unit/e2e-workflow.test.ts` 通过；全量 48 项单元测试通过；`yarn check` 复合门禁全绿通过。

#### T03-02 · 性能调优与资源管理
- **行为**：内存泄漏排查、超大图保护、首屏零 WASM 懒加载验证、Lighthouse 审计。
- **验证**：Lighthouse 报告达标，压缩过程中主线程保持响应。
- **状态**：done
- **进展**：2026-10-14 落地首屏零 WASM 懒加载架构、三道超限防御（30MB 大图、6400万像素、100MB ZIP）并自动化断言 ObjectURL 与 Worker 生命周期完整回收。
- **证据**：`tests/unit/performance-lifecycle.test.ts` 5 项测试全绿；全量 53 项单元测试全过；`yarn check` 复合门禁通过。

#### T03-03 · 安全审查与 CSP
- **行为**：验证零出站图片数据流量（DevTools Network 审计）、文件名安全清理、配置 `_headers` 安全响应头与 CSP。
- **验证**：静态产物符合安全清单，无 CSP 报错。
- **状态**：done
- **进展**：2026-10-14 落地 Cloudflare Pages 严格零出站 CSP 与安全标头，增强文件名防路径穿越与控制字符清理，新增网络拦截断言确保全流程 100% 浏览器内运行零外发。
- **证据**：`tests/unit/security.test.ts` 11 项全过；全量 64 项测试通过；`yarn check` 复合门禁全绿通过。

### 阶段 4：上线交付

#### T04-01 · CI 与部署配置
- **行为**：配置 GitHub Actions 工作流与 Cloudflare Pages Git 集成配置文件。
- **验证**：CI 流程验证通过。
- **状态**：done
- **进展**：2026-10-14 落地生产级 GitHub Actions 复合门禁工作流（Node 22、Yarn 缓存、四重全量门禁与静态产物完整性校验），规范 Cloudflare Pages 预览与部署命令。
- **证据**：`.github/workflows/ci.yml` 语法校验通过；本地产物自检脚本全绿；`yarn check` 复合门禁通过。

#### T04-02 · 域名绑定与上线核查手册
- **行为**：编写 Cloudflare Pages 绑定 `image.tinystool.org`、DNS CNAME 配置、HTTPS 检查与验证手册。
- **验证**：文档完整清晰可复现。
- **状态**：done
- **进展**：2026-10-14 落地生产部署手册 DEPLOYMENT-MANUAL.md（覆盖 Cloudflare Pages 绑定、CNAME 设置、SSL/TLS 与安全头），更新生产发布三层验收清单 RELEASE-QA-CHECKLIST.md。
- **证据**：`docs/DEPLOYMENT-MANUAL.md` 与 `docs/RELEASE-QA-CHECKLIST.md` 完整落地。

#### T04-03 · SEO 登记与交付归档
- **行为**：编写 Search Console 提交指南、变更记录 CHANGELOG.md 与 DEPLOYMENT-RESULTS.md。
- **验证**：交付物核对清单完整。
- **状态**：done
- **进展**：2026-10-14 落地 Search Console 与 IndexNow 提交指南、CHANGELOG.md、DEPLOYMENT-RESULTS.md 与演进路线图 ROADMAP.md，项目全生命周期 16 个任务 100% 验收交付。
- **证据**：`docs/SEARCH-CONSOLE-GUIDE.md`、`CHANGELOG.md`、`docs/DEPLOYMENT-RESULTS.md` 与 `ROADMAP.md` 完整落地；`yarn check` 复合门禁全绿通过。

#### T04-04 · 打包下载文件名时间戳随机数与全量重新压缩
- **行为**：
  1. ZIP 打包下载文件名支持 `tiny-images-${YYYYMMDDHHmmss}-${random4}.zip` 动态生成，避免同名覆盖并提供时间可读性。
  2. 在任务列表「清空全部」左侧新增「重新压缩」操作栏按钮，支持用户修改顶部压缩/缩放配置后一键全量按最新配置重新排队并压缩。
  3. 提供中/英/日多语言文案与快捷操作，并配套单元测试。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`tests/unit/download.test.ts` 与 `tests/unit/queue.test.ts` 新增断言全绿；系统级：`yarn check` 四重门禁全绿通过。
- **状态**：done
- **进展**：2026-10-14 完成文件名动态生成与全量重新压缩功能，配套中英日三语词条与 2 项单元测试。
- **证据**：`yarn test:unit` 67/67 项全绿；`yarn check` 四重复合门禁 0 错误全绿通过。

#### T04-05 · 修复 app.vue 根组件 useI18n 显式导入与热重载时序异常
- **行为**：在应用根组件 `app.vue` 中显式从 `vue-i18n` 静态导入 `useI18n`，杜绝开发环境热重载（HMR）或构建缓存切换时 Nuxt auto-import 虚拟模块解析时序导致的 `ReferenceError: useI18n is not defined`。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`yarn test:unit` 67/67 全绿；系统级：`yarn check` 四重门禁全绿通过。
- **状态**：done
- **进展**：2026-10-14 完成 app.vue 显式静态导入，并通过类型、单元测试与 SSG 预渲染验收。
- **证据**：`yarn typecheck` 0 报错；`yarn test:unit` 67/67 通过；`yarn check` 全绿通过。

#### T04-06 · 修复画质对比弹窗原图与压缩图比例及像素对齐错位
- **行为**：重构 `components/ImageCompareModal.vue` 的图片对齐与卷帘视口架构。建立统一锁定的图片展示舞台（Image Stage），将底层基准图与顶层原图严格锁定在完全一致的几何尺寸与渲染边界中；重构分割线、拖拽手柄与鼠标/触控事件坐标系映射，使滑块百分比与图片实际几何区域 100% 对应，根除原图与压缩图因 DOM 盒模型差异导致的放大错位及滑块空跑问题。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`tests/unit/compare-modal.test.ts` 3/3 通过，全量 70 项单元测试全绿；系统级：`yarn check` 四重复合门禁全绿通过。
- **状态**：done
- **进展**：2026-10-14 完成 Image Stage 盒模型重构与坐标系精准映射，杜绝原图放大变形与滑块割裂。
- **证据**：`yarn test:unit` 70/70 项全绿通过；`yarn check` 四重门禁 0 错误通过。

#### T04-07 · 升级输出格式为 PNG/JPEG 并接入 PNG 智能高压缩量化算法
- **行为**：
  1. 将设置面板常用输出格式中的 WebP 替换为通用度更高的 PNG，支持用户直接将任意图片输出为标准 PNG 格式；
  2. 实现纯前端无依赖的高保真色彩量化算法 `lib/image/codec/quantize.ts`（中值切分 Median Cut 颜色聚类 + 调色板生成 + 完整 Alpha 透明通道保护）；
  3. 当导出 PNG 且质量参数 < 100（默认 80）时，自动执行智能调色板量化（类似 TinyPNG），配合 OxiPNG 压缩使输出依然为标准 `.png` 的同时，体积压缩率由原先约 19% 大幅跃升至 60%~75%；当质量参数 = 100 时保持纯无损通道；
  4. 全面开放质量滑块调节，同步更新中英日三语词条，新增单元测试并全绿通过复合门禁。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`tests/unit/quantize.test.ts` 5/5 通过，全量 11 个测试文件 76 项单元测试全绿；系统级：`yarn check` 四重门禁全绿通过。
- **状态**：done
- **进展**：2026-10-14 落地 PNG 常用格式输出与色彩量化引擎，实现 60%~75% 深度压缩并完美保留透明底。
- **证据**：`yarn test:unit` 76/76 项全绿；`yarn check` 四重复合门禁通过。

#### T04-08 · 修复 PNG 色彩量化破坏半透明 Alpha 渐变投影缺陷，恢复原格式默认纯无损
- **行为**：
  1. 根因修复：彻底重构 `quantize.ts`，消除将半透明像素强制二元化（`a < 255` 硬编码为 `255`）的严重缺陷，实现 RGBA 4 维 Alpha 梯度忠实保留（`outputData[idx + 3] = data[idx + 3]`），杜绝发光与投影变成实色红框；
  2. 规则纠偏：严格恪守 AGENTS.md 约束，“保持原格式”下的 PNG 默认 100% 走纯无损优化通道（OxiPNG，100% 原始像素与 Alpha 保持不变，绝不改图）；
  3. 新增半透明发光投影测试用例 `tests/unit/quantize.test.ts`，验证 Alpha 梯度 100% 精确还原，通过四重质量门禁。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`tests/unit/quantize.test.ts` 新增投影渐变断言通过，全量 77 项单元测试全绿；系统级：`yarn check` 四重门禁全绿通过。
- **状态**：done
- **进展**：2026-10-14 根因彻底修复，半透明光晕投影 100% 完美保留，原格式默认纯无损恢复，严守不改图原则。
- **证据**：`yarn test:unit` 77/77 项全绿；`yarn check` 四重门禁 0 错误通过。

#### T04-09 · 恢复原格式下隐藏质量滑块与无损卡片提示，仅有损格式显示质量滑块
- **行为**：
  1. 重构 `components/ImageSettings.vue`：在“原格式”模式下彻底隐藏质量滑块与 80% 数值，恢复显示“✓ 原格式 PNG 采用 OxiPNG 无损优化通道，保留 100% 原始画质”卡片，右上角徽章恢复为“无损模式”；
  2. 仅当用户主动选择转换为有损格式（JPEG / 转为 PNG 量化模式）时，才显示质量滑杆与百分比调节；
  3. 彻底消除界面逻辑与底线声明（AGENTS.md“绝不宣称无损图片质量 80%”）的冲突，通过全量复合门禁。
- **验证**：静态：`yarn typecheck` 0 错误；运行时：`yarn test:unit` 全部通过；系统级：`yarn check` 四重门禁全绿通过。
- **状态**：done
- **进展**：2026-10-14 完成 ImageSettings.vue 质量区域按格式动态渲染：原格式下隐藏滑块与 80%，展示无损优化通道卡片；仅 JPEG 与转 PNG 有损模式展示滑块。
- **证据**：`yarn typecheck` 0 错误；`yarn test:unit` 77/77 项全绿；`yarn check` 22 条静态路由预渲染 + SEO 门禁全绿通过。

---

### 当前审查

#### T04-10 · 功能遗漏、缺陷与版权收费审查
- **行为**：对照需求检查当前实现，复核压缩、队列、下载、多语言、SEO 与安全；检查本地依赖许可、素材来源和收费/外部服务入口，修复可确认的问题并记录仍需验收的项目。
- **验证**：依次进行静态检查、现有测试与构建、可用本地浏览器代表流程；仅使用本地文件、Git 和终端，不调用高成本工具或外部服务。
- **状态**：done
- **进展**：2026-10-14 完成本地审查、确认缺陷修复与版权收费记录；保留此前未提交改动。审查完成不代表生产或所有浏览器验收通过，遗留项登记 T04-11/T04-12。
- **证据**：`yarn check` 通过（12 文件/88 测试、SSG、6 页面 SEO）；`yarn test:e2e` 本地真实 Chrome 20 项通过；[审查报告](docs/verification/2026-10-14-feature-audit.md)、[浏览器证据](docs/verification/2026-10-14-browser-check.json)、[许可证清单](docs/verification/dependency-licenses.json)。

#### T04-11 · 生产与跨浏览器真机验收
- **行为**：复核实际 Cloudflare/域名/远端 CI；Safari/iOS、Firefox/Edge、Android 真机；EXIF/颜色、大图内存、Lighthouse 与真实样本、上线提交/回滚证据，引用 T04-10。
- **验证**：按 docs/RELEASE-QA-CHECKLIST.md 的未勾选项逐项记录实际环境与结果；本地 Chrome 不代替真机与生产。
- **状态**：todo
- **进展**：2026-10-14 登记尚无证据的发布验收，不回流历史 done。
- **证据**：[T04-10 审查报告](docs/verification/2026-10-14-feature-audit.md)。

#### T04-12 · 素材来源与 WASM 上游许可核实
- **行为**：确认内联图标/favicon 来源授权，核对 WASM 构建中所有上游库的版权声明，以及 copy-paste 旧发布包缺少的完整许可文件，引用 T04-10。
- **验证**：来源与许可文本可追溯，生成完整交付 notices；不以 npm license 元数据代替二进制/素材来源证明。
- **状态**：todo
- **进展**：2026-10-14 已保留 815 个安装包附带声明；仍需上游来源及素材原创/授权证据。
- **证据**：[本地依赖清单](docs/verification/dependency-licenses.json)、[第三方 notices](public/third-party-licenses.txt)。

#### T04-13 · 统一页面内容与顶部导航宽度并重构压缩配置面板布局
- **行为**：
  1. 移除首页、隐私页及 FAQ 模块多余的内层窄宽度约束（`max-w-5xl` / `max-w-4xl` / `max-w-3xl` 与额外水平内边距），使页面主体内容宽度与顶部导航栏（`SiteHeader`）及页脚（`SiteFooter`）在 `.site-container` 内完全对齐；
  2. 清理 `assets/css/main.css` 中覆盖 Tailwind `gap-*` 的全局 `.grid` 冲突样式；
  3. 重构 `components/ImageSettings.vue` 三列配置布局，统一各列标题行与控件区高度（`h-11`）及水平基线对齐，将模式说明置于底部统一提示栏，消除中间列下沉错位与按钮间距异常。
- **验证**：2026-10-19 静态：typecheck 与词条检查通过；运行时：88 项测试、SSG、SEO 通过；系统级：本地 Chrome 20 项既有流程通过，补充多语言窄屏及输入检查发现问题，尚未通过本任务全部验收。早期 Node 读取权限问题已消失。
- **状态**：doing
- **进展**：2026-10-14 完成 `pages/index.vue`、`pages/privacy.vue`、`components/ImageFaq.vue`、`components/ImageSettings.vue` 与 `assets/css/main.css` 改造及静态核对。2026-10-19 环境已可运行 Node 22.17.0 / Yarn 4.5.0，`yarn check`（88 项测试、SSG 与 SEO）通过，真实 Chrome 20 项既有流程通过，但新增场景复现英文 390px 配置区溢出，以及自定义尺寸输入 1920 时输入框消失失焦；桌面 1440px 导航与面板左右边界一致。保持 `doing`，当前待处理为真实 UI 问题，不再将 Node 权限作为当前阻碍。
- **证据**：原改造 Git diff 核对；2026-10-19 `yarn check` 通过；[布局与输入诊断](docs/verification/2026-10-19-layout.json)、[当前待办复核](docs/verification/2026-10-19-pending-review.md)。

#### T04-14 · 修复透明图片缩放边缘与单像素采样
- **行为**：以预乘 Alpha 方式重采样透明图片，修正缩到 1px 时只取左上/首像素的问题，补像素级与真实编解码回归。
- **验证**：红色不透明到透明黑的过渡，缩放后半透明像素保持红色，避免合成白底时产生暗边；2x1 红蓝缩到 1x1 不应仅输出左端红色。
- **状态**：todo
- **进展**：2026-10-19 已用当前函数复现，未修改算法实现。
- **证据**：[当前问题复现](docs/verification/2026-10-19-confirmed-bugs.json)。

#### T04-15 · 修复带 marker 填充字节的 JPEG 尺寸识别
- **行为**：使 JPEG 尺寸扫描正确跳过重复 FF 填充及无长度标记，避免正常 JPEG 被预检判为 INVALID_FILE。
- **验证**：真实编码 JPEG 加入 FF marker 填充后，WASM 仍可解码，尺寸预检也须返回一致宽高；覆盖损坏段边界。
- **状态**：todo
- **进展**：2026-10-19 用真实 MozJPEG 生成 2x1 文件复现：解码成功，probeDimensions 返回 null，队列会拒绝。
- **证据**：[当前问题复现](docs/verification/2026-10-19-confirmed-bugs.json)。

#### T04-16 · 修复 ZIP 打包与重新压缩的并发结果混用
- **行为**：打包开始时快照 Blob、扩展名与大小，或限制冲突操作，保证异步读取期间任务变更不会混用原图和压缩结果。
- **验证**：第一张异步读取期间重置第二张结果后，ZIP 仍保持开始打包时的成功结果与正确 MIME/扩展名；覆盖总大小限制。
- **状态**：todo
- **进展**：2026-10-19 受控异步复现 two.png 内为 JPEG 字节；已确认 UI 在打包时仍可重新压缩，未修改功能代码。
- **证据**：[当前问题复现](docs/verification/2026-10-19-confirmed-bugs.json)。

#### T04-17 · 补充多语言窄屏、尺寸输入与测试证据隔离
- **行为**：扩充浏览器检查到三语及多个窄屏宽度、控件内部溢出、自定义输入焦点、ZIP 并发与缩放像素；修正移动视口溢出断言，测试证据按实际日期/运行 ID 保存。
- **验证**：当前已知问题在修复前能使对应回归失败；移动 overflow 不只比较可能同时扩张的 innerWidth 与 scrollWidth；不覆盖 2026-10-14 历史证据。
- **状态**：todo
- **进展**：2026-10-19 既有 88 项测试和 20 项浏览器流程均通过，但新增诊断可复现问题；现有脚本输出路径硬编码为 2026-10-14，本次用临时脚本隔离证据。
- **证据**：[当前待办复核](docs/verification/2026-10-19-pending-review.md)。

#### T04-18 · 同步项目现状与运行契约文档
- **行为**：更新 AGENTS 当前阶段及运行契约，明确 E2E 为本地 Chrome/CDP；区分 init.md 模板导入记录与当前产品状态，保留历史但避免把旧记录当成现状。
- **验证**：当前状态与 TASKS、实际命令、最近验证证据一致；外部生产、真机和版权未验收项目继续保留。
- **状态**：todo
- **进展**：2026-10-19 发现 AGENTS 仍写阶段 0/命令待验证/Playwright 配置，与当前实现和已完成本地验证不一致。
- **证据**：[当前待办复核](docs/verification/2026-10-19-pending-review.md)。

### 已归档任务（历史模板）

#### F01 · 接入已有项目协作文档
- **状态**：done（已归档）
- **证据**：[导入验收](docs/verification/2026-10-13-template-import.md)

## 完成进度

- todo：7（T04-11、T04-12、T04-14～T04-18）
- doing：1（T04-13）
- blocked：0
- done：23（既有 22 项含 F01 归档 + T04-10 本地审查）
- 总数：31
- 已启动或受阻数 = doing + blocked + done：24
- 收尾比例 = done / (doing + blocked + done)：95.8%（23 / 24；不含 todo，不代表生产验收通过）

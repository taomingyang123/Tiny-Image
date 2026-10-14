# CHANGELOG — Tiny Image (tinystool-image-tools)

本项目的所有重要更新与架构演进记录于此。

---

## [1.0.0] - 2026-10-14 · 正式发布交付 (Production Release)

### 🌟 概述
Tiny Image (`tinystool-image-tools`) 是专为个人站长、前端开发者与内容运营打造的**纯前端本地图片压缩工具**。基于 Nuxt 3 SSG 全静态预渲染架构，所有图片处理 100% 在用户浏览器本地运行，实现绝对的数据隐私安全、首屏零 WASM 加载与极速本地并发处理。

### 🚀 核心特性与架构落地

#### 1. 核心格式与本地编解码引擎 (阶段 0 & 阶段 1)
- **多格式支持**：全面支持 JPEG、PNG、WebP 三大主流格式的有损与无损本地压缩。
- **动态 Web Worker + WASM 架构**：集成 `@jsquash/jpeg`、`@jsquash/oxipng`、`@jsquash/webp`，首屏不下载任何 WASM 编解码模块，仅在用户提交特定格式任务时按需懒加载。
- **智能策略纯函数**：
  - 自动魔数识别与防篡改校验，拦截非图片二进制文件；
  - 精准检测并友好拦截 APNG 与动画 WebP；
  - 针对无尺寸变更的 PNG 自动选择极速无损优化路径；
  - 针对 JPEG 智能填充白色背景，避免透明底导出黑底问题；
  - 支持保持原图尺寸或限制最长边等比缩放（双线性插值），绝不放大图片。
- **并发调度队列与保护**：
  - 支持多任务顺序消费与单任务并发隔离；
  - 具备单任务执行超时强杀机制（默认 45s）与用户主动取消能力；
  - 采用 Transferable ArrayBuffer 零拷贝通信，成对管理并彻底释放 ObjectURL 与 ImageBitmap。

#### 2. 流式打包与安全下载 (T01-04)
- **客户端流式 ZIP**：基于 `fflate` 库实现纯客户端流式打包，内存友好且无 UI 卡顿。
- **安全文件名清理**：严格过滤路径穿越序列（`../../`、`..\\`）、ASCII 控制字符与系统非法字符，纯特殊符号输入智能兜底为 `image`，杜绝文件系统注入风险。
- **批量稳定去重**：自动重名递增重命名（如 `photo.webp`, `photo-2.webp`）。

#### 3. 现代化界面与全对称国际化 (阶段 2)
- **响应式 UI**：基于 Tailwind CSS 构建全站深色科技风格设计，包含拖拽/剪贴板上传区、配置面板、多任务进度列表。
- **卷帘对比弹窗**：支持鼠标/触控拖拽卷帘对比原图与压缩图画质细节。
- **无障碍体验**：遵循 WCAG 标准，支持全键盘 `Tab`/`Enter`/`Escape` 导航与聚焦轮廓指示。
- **全对称多语言**：深度整合 `@nuxtjs/i18n`，支持简体中文 (`/`)、英语 (`/en/`)、日语 (`/ja/`)，3 语 86 个词条 100% 对称，消除硬编码残留。
- **单例队列状态持久化**：路由与语言切换期间保留已有上传任务与压缩成果。

#### 4. 极致 SEO 与静态预渲染 (T02-03)
- **全站 SSG 预渲染**：预渲染 22 条静态路由（3 语言首页、独立隐私政策页、sitemap、robots、_headers 与 _redirects）。
- **双重 JSON-LD 结构化数据**：内联 `WebApplication` 与 `FAQPage` 结构化元数据，符合搜索引擎富摘要收录规范。
- **规范化路由与重定向**：强制统一尾斜杠规范，301 永久重定向非斜杠路径。

#### 5. 质量门禁、安全审计与 CI 部署 (阶段 3 & 阶段 4)
- **四重复合质量门禁 (`yarn check`)**：
  1. TypeScript 严格类型检查 (`vue-tsc --noEmit`) 0 报错；
  2. 9 套测试套件，**64 / 64 项单元与安全测试全绿通过**；
  3. 全站 SSG 预渲染无警告；
  4. 静态产物 SEO、Sitemap、Robots 与 CSP 完整性断言。
- **三道超限防御与资源保护**：
  - 单张大图 30MB 拦截保护；
  - 6400 万像素防内存暴涨拦截；
  - 100MB ZIP 批量打包内存溢出拦截。
- **严格零出站安全响应头**：
  - Cloudflare Pages `_headers` 配置严格 CSP，断言 `connect-src 'self'`，杜绝任何数据外发；
  - 开启 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Strict-Transport-Security`。
- **CI/CD 与交付文档**：
  - GitHub Actions 生产流水线 `.github/workflows/ci.yml`；
  - 域名绑定手册 `docs/DEPLOYMENT-MANUAL.md`；
  - 验收清单 `docs/RELEASE-QA-CHECKLIST.md`；
  - 搜索引擎提交指南 `docs/SEARCH-CONSOLE-GUIDE.md`。

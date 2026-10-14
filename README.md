# Tiny Image (tinystool-image-tools)

> 纯浏览器本地运行的现代图片压缩工具。无需上传、不经服务器，支持 JPG、PNG、WebP 格式压缩与转换。
> 正式域名：`https://image.tinystool.org/`

## 项目概述

Tiny Image 是一个纯前端、可静态部署（Cloudflare Pages SSG）的独立图片压缩站点：
- **零服务端处理**：图片所有像素解码与编码均在浏览器本地 Web Worker 内运行，绝不上传到任何服务器或第三方接口。
- **现代格式支持**：
  - JPEG：MozJPEG 有损编码器，支持质量 1–100。
  - PNG：原格式不缩放走无损优化；显式 PNG 转换质量低于 100 时进行有损量化；缩放会改变像素。
  - WebP：支持 WebP 编码，保留透明通道。
- **多语言与静态 SEO**：
  - 默认中文：`/`
  - 英文：`/en/`
  - 日文：`/ja/`
  - 对应隐私政策：`/privacy/`、`/en/privacy/`、`/ja/privacy/`
- **安全与隐私**：全站静态预渲染，严格内容安全策略 (CSP)，无图片相关远程请求与数据追踪。

## 技术栈

- 框架：Nuxt 3 (SSG) + Vue 3 (Composition API)
- 语言：TypeScript (Strict)
- 样式：Tailwind CSS
- 编解码：`@jsquash/jpeg`、`@jsquash/oxipng`、`@jsquash/webp` (WASM in Web Worker)
- 打包与下载：`fflate` (ZIP 打包)
- 部署目标：Cloudflare Pages

## 常用命令

```bash
# 安装依赖
yarn install

# 本地开发
yarn dev

# 静态预渲染构建（输出至 .output/public）
yarn generate

# 本地静态预览
yarn preview

# 门禁与校验
yarn check       # 包含类型检查、单元测试与静态生成验证
yarn test:unit   # 运行 Vitest 单元测试
yarn test:e2e    # 已 generate 后，用本地 Chrome 验证生产 Worker/WASM 与下载（无需外部服务）
yarn licenses:build # 从本地安装包生成第三方许可声明
```

## 规范文档目录

- [`docs/01-PRD.md`](docs/01-PRD.md)：产品需求、范围与用户流程
- [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md)：技术架构、编解码路径与内存控制
- [`docs/03-CONTRACTS.md`](docs/03-CONTRACTS.md)：TypeScript 数据契约、Worker 协议与状态机
- [`docs/04-UI-I18N-SEO.md`](docs/04-UI-I18N-SEO.md)：界面设计、多语言与 SEO 规范
- [`docs/05-DEPLOYMENT.md`](docs/05-DEPLOYMENT.md)：本地搭建、CI 与 Cloudflare Pages 部署手册
- [`docs/06-TEST-ACCEPTANCE.md`](docs/06-TEST-ACCEPTANCE.md)：测试矩阵与验收标准
- [`docs/07-TASKS.md`](docs/07-TASKS.md)：分阶段任务拆分与执行依赖
- [`docs/08-RISK-AND-DECISIONS.md`](docs/08-RISK-AND-DECISIONS.md)：架构决策 (ADR) 与风险清单

## 当前验证与版权收费

本地门禁与真实 Chrome 验收结果见 [功能审查报告](docs/verification/2026-10-14-feature-audit.md)。跨浏览器真机、生产部署和素材/上游授权来源尚有待办；不能由任务标签推断生产验收完成。

没有会员、支付、订阅或收费压缩 API；统计与广告固定关闭。托管和域名等基础设施实际账单未核对。依赖许可声明见 [第三方 notices](public/third-party-licenses.txt)，依赖清单见 [安装包记录](docs/verification/dependency-licenses.json)。本项目自身未授予对外开源许可。

系统级测试需要本机 Chrome（默认 macOS `/Applications/Google Chrome.app/...`，Linux `/usr/bin/google-chrome`），其他路径设置 `CHROME_PATH`。测试使用隔离临时用户目录及 127.0.0.1 静态服务；它模拟本地 CSP，不能替代 Cloudflare 的真实响应头验收。

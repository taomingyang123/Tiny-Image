# Tiny Image｜独立图片压缩工具执行方案

> 方案日期：2026-10-14。**这是开发实施资料包，不是已创建/部署的生产项目。** 请按 `CODEX_START_HERE.md` 分阶段执行，GitHub 仓库、Cloudflare Pages 和 DNS 均需要执行相应账号侧步骤。

## 固定项目决策

| 配置 | 值 |
|---|---|
| 产品名 | Tiny Image（暂定展示品牌，不影响域名） |
| 正式站点 | https://image.tinystool.org/（拟建，当前不保证可访问） |
| GitHub 独立仓库 | `tinystool-image-tools`（拟建） |
| Cloudflare Pages 项目 | `tinystool-image-tools`（拟建） |
| 框架 | Nuxt 3、Vue 3、TypeScript strict、Tailwind CSS |
| 运行方式 | Nuxt SSG 静态生成 + 浏览器端 Web Worker + 按需 WASM |
| 第一版语言 | 中文 `/`、英语 `/en/`、日语 `/ja/` |
| 第一版图片 | JPEG、PNG、WebP；AVIF 延期至第二阶段 |
| 后端 | 无；不上传用户图片；无需数据库、R2、Workers 图片处理、付费 API |
| 包管理 | Node.js 22 + Corepack + Yarn 4；Git 提交 yarn.lock |

## 阅读次序

1. `docs/01-PRD.md`：产品范围、交互和规则
2. `docs/02-ARCHITECTURE.md`：技术架构、编码管线、性能与安全
3. `docs/03-CONTRACTS.md`：TS 接口、任务协议、状态机、错误规范
4. `docs/04-UI-I18N-SEO.md`：页面设计、多语言、SEO 和隐私
5. `docs/05-DEPLOYMENT.md`：仓库、CI、Cloudflare、域名、上线步骤
6. `docs/06-TEST-ACCEPTANCE.md`：测试矩阵、验收标准和回归
7. `docs/07-TASKS.md`：按阶段拆分的 Codex 任务、依赖和验收
8. `docs/08-RISK-AND-DECISIONS.md`：决策、风险、降级、发布和回滚
9. `CODEX_START_HERE.md`：交给 Codex 的任务总提示词
10. `AGENTS.md`：Codex 仓库级约束

## 官方验证材料（2026-10-14 调研）

- [jSquash README：编码器及 Nuxt/Vite 常见问题](https://github.com/jamsinclair/jSquash/blob/main/README.md)
- [jSquash OxiPNG：直接优化 PNG 的二进制数据](https://www.npmjs.com/package/@jsquash/oxipng)
- [Nuxt deployment：静态预渲染和 ClientOnly](https://github.com/nuxt/nuxt/blob/main/docs/1.getting-started/16.deployment.md)
- [Cloudflare Pages：Nuxt](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nuxt-site/)
- [Cloudflare Pages：Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages：自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Pages：自定义响应头](https://developers.cloudflare.com/pages/configuration/headers/)
- [Squish：前端 WASM 压缩器参考项目](https://github.com/addyosmani/squish)

## 重要边界

- 文档中目标值属于工程验收目标，并非已实测性能或压缩率。
- 精确依赖版本要在开发时按照实际兼容性验证后锁定，不要盲用 `latest` 上线。
- 压缩不承诺对所有图片都减少大小；JPEG/WebP 的质量滑杆是有损编码；PNG 无损优化不能调质量。
- 不承诺压缩后必定删除所有元数据。第一版明确不提供“安全清理 GPS/EXIF”的保证。详细见隐私文件。
- 避免将站点部署为 SSR + 图片上传的动态服务：这是纯静态应用。

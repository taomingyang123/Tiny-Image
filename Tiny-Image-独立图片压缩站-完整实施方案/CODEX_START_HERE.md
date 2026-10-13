# 交给 Codex 的主提示词（在新仓库根目录执行）

你是本仓库的主实现工程师。请将本仓库从空白 Nuxt 3 工程建设成可部署到 Cloudflare Pages 的独立图片压缩网站 Tiny Image。要求严格遵循仓库根目录 `AGENTS.md`，并**先完整阅读**：

- `README.md`
- `docs/01-PRD.md`
- `docs/02-ARCHITECTURE.md`
- `docs/03-CONTRACTS.md`
- `docs/04-UI-I18N-SEO.md`
- `docs/05-DEPLOYMENT.md`
- `docs/06-TEST-ACCEPTANCE.md`
- `docs/07-TASKS.md`
- `docs/08-RISK-AND-DECISIONS.md`

## 工作方式

1. 首先检查当前代码库、Node/Yarn 环境与依赖状况；若尚未初始化，按文档建 Nuxt 3 项目并合并本文件及 docs，避免覆盖文档。
2. **先执行阶段 0：JPEG/PNG/WebP WASM + Nuxt/Vite Worker 构建 spike**，确认 `yarn generate` 和真实静态站可以解码、压缩、下载。未通过禁止宣称核心功能完成。
3. 通过后按 `docs/07-TASKS.md` 每个阶段实现全功能：校验、编码器、Worker 队列、下载/ZIP、UI、多语言、SEO、测试、部署文档。
4. 所有输入都在浏览器本地处理，任何时候不得将图片字节/文件名/元信息发往服务端。不要创建图片处理 API、R2 或数据库。
5. 使用 Vue 3 Composition API + TypeScript strict，业务逻辑在纯函数与 composable，不把处理流程全部塞入页面 SFC。
6. 产品必须如实显示压缩后的大小；PNG 无损优化不能使用有损滑杆；JPEG 输出透明图要填白；动图不支持时明确拒绝；AVIF/GIF/HEIC 不要当作已完成。
7. 页面需适配手机；生成 `/`、`/en/`、`/ja/` 和相应隐私页；正确 canonical、hreflang、sitemap、robots。
8. 给出有效的自动化测试，包括至少 JPEG、PNG、WebP 真实浏览器压缩与输出下载；检查压缩结果能被重新解析。
9. 建立 GitHub Actions 检查，部署默认走 Cloudflare Pages Git integration；**不能自动假定我授权了 GitHub/Cloudflare**，如果未授权，只需完成项目和清晰的人工操作手册。
10. 不要在尚未验证的依赖版本、压缩效果、上线状态上作成功声明。

## 开发交付标准

- 每阶段提供：修改文件列表、执行命令、测试结果、已知问题与后续任务；不能运行命令时说明原因。
- `yarn check`（typecheck+lint+unit+generate）、`yarn test:e2e` 至少在支持的环境完成。
- 确认所有 Web Worker/WASM 的 production static 路径正确。运行 `yarn preview` 后从浏览器实测，不能只过 TypeScript。
- 生成 docs/CHANGELOG.md、docs/DEPLOYMENT-RESULTS.md，记录可复现的验证证据；如果 GitHub/Cloudflare 没有账号权限，部署状态写“未部署”。
- 完成后给出最终按键式上线清单（GitHub 创建/推送、Cloudflare 绑定 Git、设置 main、构建命令、输出目录、自定义域名与 DNS、HTTPS、Search Console）。

## 立即执行

从 **T00-01** 开始。除非必须获取外部账号授权，否则不要中断实施去问风格和框架细节，按文档既定决策执行。遇到 WASM 构建问题优先查当前依赖源码/类型与官方 README 并编写最小重现；不要直接退回只有 Canvas 的伪“专业压缩器”。

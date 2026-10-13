# AGENTS.md — Nuxt 网站公共模板

> 阅读顺序：本文件 → [MEMORY.md](MEMORY.md) → [TASKS.md](TASKS.md) → 按需读取 [init.md](init.md)、docs/ 与 memory/。
> 新会话第一轮仅提醒一次：「💡 如需检查历史记录遗漏，可以说：请检查 memory。」流程见 [memory 自检](docs/workflows/memory-check.md)。

## 项目概述

- 名称：Nuxt 网站公共模板；包名 `nuxt-template`，当前目录 `TemplateRepository`。
- 目标与用户：供开发者复用的网站基础设施；用户确认目标为「整理为可复用模板，准备验收与交付」。
- 项目模式：已有项目；本次仅接入协作文档。
- 当前阶段：模板验收与交付准备；协作文档接入已完成，运行基线未验证。
- 范围：双语占位网站及通用 SEO、统计、广告、IndexNow 和部署配置；本次不包含业务开发、依赖安装、部署或搜索引擎通知。

## 架构总览

以下描述来自当前代码，作为接入时的现状，不代表新的架构改造决策。

| 模块 | 职责与依赖 |
|---|---|
| `app.vue`、`layouts/`、`pages/`、`components/` | NuxtLayout/NuxtPage、公共布局、占位首页与页头页脚 |
| `i18n/locales/`、`plugins/` | 中英文案与语言辅助；英文 `/`，中文 `/zh/` |
| `config/site.js` | 读取站点环境变量；Nuxt 配置与独立脚本共同依赖 |
| `config/indexableRoutes.js`、`config/seoPolicy.js` | 路由白名单、更新日期及规范路径，驱动预渲染、Sitemap、重定向与索引策略 |
| `composables/usePageSeo.ts`、`server/` | 页面元信息、结构化数据、canonical、robots 和公开站点文件 |
| `scripts/` | 构建公开文件、SEO 检查、URL 指纹清单与 IndexNow 提交 |
| `nuxt.config.ts`、`wrangler.jsonc` | SSR、预渲染、Cloudflare Worker；另有 Node 与静态构建入口 |

配置 → 页面/服务端/构建脚本 → HTML、Sitemap、公开文件及部署产物。当前未发现数据库、账户权限或持久化业务数据。

关键兼容行为：保留双语路径、页面尾斜杠、查询参数重定向、白名单外 noindex、真实 lastmod 和显式 IndexNow 提交；`app.vue` 与布局只渲染一份页面。

确认来源：2026-10-13 用户选择已有项目，并确认目标和本次范围；架构、目录、命令来自仓库盘点。未来迁移方案：无。被否方案：无（未讨论）。项目级方向变更需先说明理由并取得确认；已有明确授权的变更不重复询问。

## 技术路线

| 阶段 | 目标 | 交付与验收 | 进入条件 |
|---|---|---|---|
| 协作文档接入 | 建立事实与流程入口 | F01：结构、链接、任务计数和原有文件保全检查 | 用户已确认仅接入文档 |
| 验收与交付 | 核实现有模板能否复用 | F02：记录构建、预览、SEO 与代表场景证据；最终交付方式待确认 | 后续启动 F02；本次不执行业务验证 |

不把已有实现直接标为 done。未来交付方式及目标站点信息待确认，阶段进入前再细化需要的后续任务。

## 技术选型

| 用途 | 当前实现及来源 | 已确认的未来方案 | 待确认 |
|---|---|---|---|
| 网站框架 | Nuxt 3.20.2、Vue 3.5.26；`package.json`、`yarn.lock`，本地安装版本一致 | 无迁移计划 | 无 |
| 类型与样式 | TypeScript 5.9.3、Tailwind 3.4.19、Sass；锁文件与配置 | 无 | 尚无独立 lint/typecheck/test 脚本 |
| 多语言与 Sitemap | i18n 10.2.1、Sitemap 7.5.0；锁文件 | 无 | 运行行为未验证 |
| 运行与包管理 | `engines.node = ^20.19.0 || >=22.12.0`，Yarn 4.5.0；本次终端 Node v22.17.0 | 沿用当前配置 | 构建能力未验证 |
| 部署 | 默认 `cloudflare-module`；`build:node`、`generate` 为现有替代入口 | 无新增平台决策 | 账户、正式域名和交付方式待确认 |
| 数据存储 | N/A：未发现持久化业务数据或数据库依赖 | 无 | 新需求出现时再评估 |

## 开发约定

- 页面放 `pages/`，公共 UI 放 `components/`，SEO 放 `composables/`；双语文案进入两份 locale，内部链接使用 `useLocalePath()`。
- 新公开页面同步更新 `config/indexableRoutes.js` 与真实内容更新日期；不得靠修改 lastmod 虚构内容更新。
- 沿用现有代码风格及 TS strict 配置；不引入未经选择的格式化、测试或类型检查工具。
- `.env` 仅在本地配置，文档只记录变量名与获取方式，不输出密钥值。配置入口为 `.env.example` 与 `config/site.js`；可选统计、广告、验证配置由目标站点所有者提供。
- 交互沿用当前响应式容器与公共布局；可访问性、实际断点效果及完整设计要求未验收。
- 权限与数据隔离：N/A，当前无账户或权限系统；启用第三方统计/广告时，目标站点的隐私要求待确认。
- 术语：基线为实际运行证据；「已发现实现」不等于已验证；IndexNow 接收不等于搜索收录。
- 项目内入口：[README](README.md)、[导入流程](docs/workflows/import-project.md)、[memory 自检](docs/workflows/memory-check.md) 和 `package.json` 命令；未发现项目专属注册技能或快捷命令。

## 执行纪律

### 任务与范围

修改代码、行为、数据或协作机制前登记 TASKS；已有任务置 doing，没有则按最大编号递增新建。纯问答及不影响行为的微小文案、格式调整可不登记。

同一项目 WIP=1：同时最多一个 doing。冲突的新需求先登记 todo；用户明确要求立即切换时，原任务转 blocked 并记录断点及插队编号。禁止顺手扩大范围。

状态：todo → doing → done；todo/doing → blocked；blocked → doing（当前没有 doing 时）。done 不回流，后续问题另建任务并引用原编号。

项目级结论写本文件，需求写 init.md，任务级结论写 TASKS。只记录实际讨论过的被否方案。收尾更新进展、证据与计数；未完成任务必须可直接恢复。

### 三层完成定义

1. 静态：相关编译、类型、语法、结构或文档链接检查。
2. 运行时：受影响组件、命令、接口或服务实际运行，行为符合约定。
3. 系统级：真实代表场景端到端完成，输入、输出和副作用正确。

按顺序记录环境、命令、结果和证据。适用验证未通过时保持 doing 或 blocked；Mock 不替代真实集成验收。N/A 仅用于确实不适用并注明原因；无权限、无工具或服务不可达属于未验证。纯文档任务可将后两层标为 N/A，但仍须检查文档结构与交付要求。

### 基线与授权

本项目沿用已有实现，仅核验，不执行新项目破坏性初始化。没有既有任务清单，首次从 F01 接入、F02 核验登记；不补造 F00 和历史完成记录。开始业务工作前检查受影响运行契约。纯文档交付无需启动业务服务。

保留已有本地修改与删除状态；提交、发布、迁移按用户授权执行。本次不自动提交或部署。

## 启动与验证（运行契约）

以下业务命令仅由 `package.json` 证实存在，本次未执行。工作目录均为项目根目录；README 的 `cd nuxt-template` 为复制后目录示例，当前使用实际目录 `TemplateRepository`。

| 能力 | 命令或操作 | 前置条件 | 最近结果及证据 |
|---|---|---|---|
| 开发启动 | `yarn dev` | 安装依赖、配置本地环境 | 未验证 |
| 默认构建 | `yarn build` | Node/Yarn 满足清单，站点配置就绪 | 未验证 |
| Node / 静态构建 | `yarn build:node` / `yarn generate` | 同上；每次覆盖 `.output` | 未验证 |
| 构建 SEO 检查 | `yarn seo-check` | 当前配置的完整 `.output/public` | 未验证；仅覆盖脚本列出的产物断言 |
| 预览与 HTTP 检查 | `yarn preview:cloudflare`，另终端 `yarn seo:live http://localhost:8787` | Wrangler 可用；首用 npx 可能下载；配置域名与预览目标分开记录 | 未验证 |
| Node 预览 | `yarn preview` | Node 构建产物 | 未验证 |
| IndexNow 预演 | `yarn indexnow:submit --dry-run` 后附本站规范 URL；`yarn indexnow:changes` 附前后 manifest 与 `--dry-run` | 目标站点配置及必要 key；不执行真实提交 | 未验证 |
| 类型 / 格式 / 单元测试 | 无独立脚本 | 后续按需求选择工具，不把 build 当完整类型检查 | 未验证 |
| 文档验收 | `python3 .template-import-draft-20261013-01/verify_import.py --target root` | 保留接入证据目录；仅标准库 | 结果见 [接入验收](docs/verification/2026-10-13-template-import.md) |
| 查看进度 / 续接 | 阅读 TASKS、MEMORY；优先 doing，否则首条依赖已满足的 todo | 项目根目录 | F02 尚未启动 |

## 日志与一致性

- TASKS 是任务状态唯一事实源；MEMORY 是历史索引；ROADMAP.md 是阶段摘要。
- 登记任务 done 后写 memory 并更新索引；重要未完成决策也可记，须明确未验收。
- 未登记的微小文案/格式调整无需日志；功能、修复、重构、事故、选型及废弃能力需要记录。
- 文件名 `YYMMDD-HH-简述.md`；同天同功能追加补充节；字段与四章见 [日志模板](docs/MEMORY-ENTRY-TEMPLATE.md)。
- 长期坑点写 MEMORY。不得补造测试、提交或历史日期。阶段推进或里程碑交付时更新看板，普通任务完成仅更新 TASKS 和 memory。
- 收尾报告产出、验证、限制、下一步及路径。

## 关键风险与对策

| 风险 | 触发条件 | 对策或验证 |
|---|---|---|
| 覆盖已有修改 | 本地大量改动尚未提交 | 只合并 README 并备份，新增文档；以导入前摘要核对其余文件和原删除状态 |
| 配置与产物错位 | 修改域名或切换构建 preset 后复用旧产物 | 按同一配置重新构建，记录 preset 并核验 SEO/HTTP |
| 占位模板误作生产站 | 默认域名、品牌、文案或分享图未配置 | 目标站点发布前替换配置与内容；此模板不宣称已可上线 |
| 对外动作产生副作用 | deploy 或真实 IndexNow 提交 | 明确任务授权后独立执行，不在文档导入中运行 |

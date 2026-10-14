# Tiny Image 功能、缺陷与版权收费审查

日期：2026-10-14。任务：T04-10。范围：当前工作区全部实现与本地生产构建，保留审查前已有未提交修改；没有部署、联网搜集、外部账号操作或调用高成本工具。

## 结论

JPEG/PNG/WebP 输入、原格式压缩、JPEG/PNG 转换、尺寸限制、取消/重试、单图/原图/ZIP 下载、多语言与静态 SEO 均有实现。此次确认并修复多个边界缺陷。本地质量门禁和真实 Chrome 流程已验证，不能据此宣称所有浏览器及生产环境全部验收。

前期 `tests/unit/e2e-workflow.test.ts` 使用模拟 Worker，属于单元/集成测试；不是真实浏览器 E2E。此前文档中“生产就绪”“100% 全部验收”、64 MP 和多线程等表述缺乏对应证据。本报告及更新的发布清单取代这些过度结论，不追溯补造历史测试结果。

## 修复与补全

| 问题与具体触发 | 修复后的行为 | 证据 |
|---|---|---|
| ZIP 同时包含 `photo.png`、重复 `photo.png` 和已有 `photo-2.png` 时，生成重名条目导致覆盖 | 去重同时避开已使用与原始预留名称，兼顾大小写 | 回归测试解析 ZIP，验证所有字节条目保留 |
| 在读取 File 时取消/移除/清空，异步代码仍分发压缩或创建结果 URL | 调度使用独立运行标记，文件读取、进度、结果与错误都检查标记及任务状态 | 取消读取、清空验证、旧 Worker 消息回归 |
| 重新压缩后，旧 Promise 拒绝和旧 Worker 回包覆盖新任务状态 | 失效旧调度，清理旧消息监听，检查 Worker 实例 | 回归与真实浏览器取消/重试 |
| 批量与重复上传没有落实 20 张限制 | 同步占用 validating 槽位，限制总任务数并显示三语提示 | 并发上传回归，浏览器上传 21 张仅接纳 20 张 |
| PNG 的 acTL 位于前 64 KiB 之后时漏判动图 | PNG 完整扫描动画控制块；Worker 再检查完整数据 | 后置 acTL 回归 |
| 静态 WebP 负载恰有 `ANIM` 字节时误判动图 | 只在 RIFF 实际 chunk 边界识别 ANIM/ANMF | 静态负载回归 |
| 质量 80 的“原格式 PNG”选择缩放时偷偷执行有损量化 | 原格式 PNG 缩放后以不量化的编码路径输出；文案明确缩放改变像素 | 实际 WASM 编解码回归 |
| 低于 16 的非零 Alpha 彩色像素被替换成黑色 | 仅完全透明像素排除在颜色采样之外，保留低透明度颜色与 Alpha | 有/无抖动的微弱红色投影回归 |
| WASM 初次加载失败后，复用已失败的模块 Promise，重试仍失败 | 对模块加载/内存错误终止 Worker，让重试重新加载 | WASM 错误后的新 Worker 回归 |
| 有损输出更大时单项显示 `+0%`，总节省被截断为零，对比弹窗显示“保持最佳” | 列表、总统计和弹窗显示实际增加幅度 | 负节省回归与代码核验 |
| 原格式统一标“无损”，隐藏了 JPEG/WebP 实际为有损编码的区别；质量标成百分比画质 | 原格式显示按格式的处理说明；质量显示编码参数数值；FAQ 与实际路径一致 | 三语词条对称与 Chrome 界面检查 |
| 自定义尺寸从 1920 等预设切换时不能出现自定义输入；禁用设置未阻止键盘操作 | 自定义预设切换为有效自定义值；使用 disabled fieldset | 代码核验与生产构建 |
| 错误提示把中文内部错误拼到英日译文后面 | 对用户仅显示本地化错误码；ZIP 错误也按码翻译 | 浏览器英日路由切换 |
| 对比弹窗没有焦点进入/循环/恢复，滑块缺少可访问语义 | 开启后聚焦、Tab 焦点循环、关闭恢复，滑块可用键盘并有数值属性 | Chrome 键盘检查 |
| JPEG/WebP 输出变大后没有下载原图入口 | 单独提供原始 File 下载，按已识别格式命名 | 真实 Chrome 实际下载 |
| 所有格式适配器静态导入，不满足按格式动态加载的结构约定 | 调度管线按输入/输出动态 import 适配器；首屏无 WASM 请求 | 构建及 Worker 网络记录 |
| dev Spike 被显式预渲染到发布包 | 生产预渲染忽略所有语言 dev 路径，SEO 门禁阻止误发布 | 产物断言 |
| 没有统一交付第三方授权声明及 IJG 署名 | 生成 notices、815 个安装包清单，页脚链接；构建时刷新 | `public/third-party-licenses.txt` 与依赖清单 |
| GA4/AdSense 可由继承的环境变量意外启用，与本站服务范围/CSP 不一致 | 本版固定禁用统计与广告，不注入外部脚本 | 配置核验及真实浏览器网络检查 |

修复前新增 9 项回归：8 失败、1 通过；修复后补充后置 APNG 与 WASM 重试用例，共 11 项新回归。原有测试与回归一起运行，当前 12 个测试文件、88 项通过。

## 三层验证

环境：macOS，本机 Node v22.17.0、Yarn 4.5.0；Chrome 使用隔离临时用户目录，通过 CDP 驱动。静态服务器仅监听 127.0.0.1，从生产 `.output/public` 提供文件，并应用项目全局 CSP、安全头及对应 MIME。没有引入 Playwright 或远程浏览器依赖。

1. 静态：`yarn typecheck` 通过；脚本语法通过；词条键名对称；本地安装包版权/许可文件检查。`git diff --check` 对原有未提交文件仍提示两处末尾空行（旧的 download/queue 测试文件）；未覆盖这些原有改动。
2. 运行时：`yarn check` 通过：类型、88 项单元/集成测试、20 条预渲染资源/路由、6 个业务页面 SEO 断言。20 条含 payload/词条/SEO 资源，不等于 20 个业务页面。构建仍提示 caniuse-lite 数据较旧；本轮未联网更新依赖。
3. 系统级：`yarn test:e2e` 对本地 Chrome 运行生产产物，验证真实 Worker、WASM HTTP/MIME、三种压缩结果实际下载及重新解码、ZIP、白底、半透明、三语状态保留、键盘焦点、批次数量、取消/重试及网络。证据见 [浏览器记录](2026-10-14-browser-check.json)。390px 视口通过；这属于桌面 Chrome 的移动视口模拟，不能替代真机内存或 iOS Safari。

首次绑定本地端口在沙箱内返回 EPERM；获准的本地终端测试运行后完成验证。未调用 MCP、插件、联网搜索、云端浏览器或生成媒体服务。

## 版权与依赖许可

这里记录本地文件的事实与交付缺口，不把 npm 的 license 字段当作全部源代码及二进制的授权证明。

| 检查对象 | 本地证据 | 结论/后续 |
|---|---|---|
| 21 个直接运行/开发依赖 | 安装包 package.json 与 LICENSE | jSquash/TypeScript 为 Apache-2.0；dotenv 为 BSD-2-Clause；其余主要为 MIT。未发现直接依赖的付费 SDK 或强制商用授权收费声明 |
| JPEG WASM | `@jsquash/jpeg/codec/LICENSE.codec.md` | 包含 IJG/BSD/zlib 要求；已加入 “This software is based in part on the work of the Independent JPEG Group.” 及打包许可文本 |
| WebP、PNG、OxiPNG | 各包 `LICENSE`、`codec/LICENSE.codec.md` 与 README | 已保留包内声明；仍需要依据构建来源核对 WASM 内所有上游库的完整许可清单，不能仅用顶层 Apache 覆盖内部编码库 |
| 全部安装包（含开发工具） | [清单](dependency-licenses.json)，815 个包版本 | copy-paste/only 元数据缺失但 README 有 MIT 声明；tosource 的 LICENSE 为 zlib 风格。node-forge 标注 BSD-3-Clause OR GPL-2.0，不能把可选 GPL 误判为全站强制 GPL |
| 旧开发工具许可文件 | copy-paste README 只链接 MIT；only README 附完整 MIT | only 已提取完整文本；copy-paste 发布包缺少独立完整版权许可文件，仍需核对上游。它来自 Nuxt CLI 的开发工具依赖链，不是收费功能 |
| 素材与字体 | public 仅 favicon SVG、headers、生成 notices；界面为 CSS/内联 SVG；字体只有本机 font-family 名称 | 没有打包字体文件、图库素材、收费模板或调用素材服务。但内联图标/favicon 无来源授权记录，需确认是否自行绘制或来自允许使用的图标库；“无付费素材文件”不能证明原创 |
| 项目自身代码 | package.json 的 private=true，页脚 Tiny Image 版权声明，无项目 LICENSE | private 是包发布标记，不是开源授权。没有擅自给项目代码授予 MIT 等对外使用许可 |

依赖声明为开源不代表没有义务：随分发保留相应声明，不冒用上游名称作背书。新加的 notices 包含构建/测试包，某包出现在清单中不代表它被发送至浏览器。由于本轮只做本地审查，上游来源核实、商标/素材原创性及真实账号合同仍未确认。

## 收费与外部服务

- 没有会员、订阅、支付、充值、定价、付费下载、账户系统，也没有服务端图片压缩或第三方按次收费压缩接口；页面结构化数据声明 `price: 0`。
- 未使用 TinyPNG API、Cloudflare Images、R2 或图片 CDN 转码。色彩量化是仓库本地算法，不调用 TinyPNG 服务。
- GA4 与 AdSense 本轮前配置值均为空，本轮后固定禁用，不接入统计与广告外部脚本。原有包和未启用的 ads.txt 辅助代码不等于收费模块。
- Cloudflare Pages 托管、域名注册/续费、GitHub 账号/CI 或其他部署基础设施的实际费用取决于账号与合同。本地代码无法确认账单，也不能据此承诺运营完全零费用。`deploy` 和 IndexNow 提交命令本轮没有执行。

## 仍待验收及范围说明

- T04-11：Safari/macOS、iOS Safari、Firefox/Edge、Android 真机，EXIF orientation、颜色配置/16-bit PNG、大图/低内存、12 个真实样本与 Lighthouse、实际 Cloudflare Worker/WASM/MIME/CSP、HTTPS/域名/CI 和搜索引擎提交证据。
- T04-12：图标/favicon 来源、WASM 构建中上游许可证、copy-paste 缺少的完整许可文件。补充来源证据前，版权不能标成“全部无问题”。
- WebP 输出适配器存在，当前 UI 支持保留 WebP 与转换 JPEG/PNG；单独“转 WebP”按钮被历史 T04-07 有意移除。本轮尊重该既有产品修改，修正文案，没有擅自恢复按钮。
- AVIF、SVG、HEIC、动画 GIF/APNG/WebP、PWA 离线缓存、GPS/EXIF 保证清除仍是延后范围，页面不宣称已支持。文件选择后自动进入压缩，UI 的“重新压缩”应用最新参数。
- 单线程 OxiPNG 与单活动 Worker 为当前实现；没有“多线程更快”的实测依据。像素保护值实际为桌面 32 MP / 移动 UA 16 MP，用户代理判定只是保护启发式，不是内存充足保证。

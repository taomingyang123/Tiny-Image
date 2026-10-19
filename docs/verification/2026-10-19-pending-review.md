# 2026-10-19 当前待处理问题复核

范围：本地当前工作区，起始提交 `c6c045c`，检查前 Git 工作区干净。用户请求为排查剩余问题；本轮仅复核、复现、更新待办和保存证据，没有修改应用功能代码、升级依赖、部署或访问外部服务。

## 当前结论

既有本地门禁仍然通过，但新增场景确认了待处理的功能缺陷。T04-13 应保持 doing：原 Node 权限阻碍已消失，当前剩余的是实际布局与输入问题。其余缺陷已登记为 todo，保持 WIP=1。

| 优先顺序 | 问题 | 触发与实测 | 跟踪 |
|---|---|---|---|
| 1 | ZIP 打包与重新压缩并发会混用结果，扩展名不匹配 | 打包读第一张期间，重压清除第二张 result/resultBlob；最终 ZIP 的 `two.png` 实际为 JPEG 字节。UI 只禁用 ZIP 按钮，没有限制重压；输入对象为 Vue 任务引用而非 Blob/名称快照 | T04-16 |
| 2 | 透明图缩小会出现暗边；单像素缩放采样不正确 | 4x1 红色/透明黑过渡缩至 3x1，中间像素为 `[128,0,0,128]`，预乘 Alpha 插值应为 `[255,0,0,128]`；2x1 红蓝缩到 1x1 只留下首像素红色 | T04-14 |
| 3 | 英文移动端质量控件溢出；更窄屏中日也存在内部溢出 | 390px 仿真设备、英文 JPEG 模式：配置内容宽 292px，内部 scrollWidth 达 357px，质量滑块及左右 nowrap 文本的最小内容宽度不能收缩；375/320px 也复现。桌面 1440px 面板与导航左右边界一致，不能据此判手机通过 | T04-13 |
| 4 | 自定义尺寸输入触发预设值时丢失输入框和焦点 | 点击“自定义”，输入值 1920 后 computed 将模式改成 `1920`，`v-if` 卸载输入框，活动元素回到 BODY；1280/800 同样存在逻辑触发条件 | T04-13 |
| 5 | 特定正常 JPEG 被错误拒绝 | 实际 MozJPEG 编码得到 2x1 JPEG，加入 marker FF 填充字节后 WASM 仍能解码，`probeDimensions` 返回 null；队列预检随后把文件判为 INVALID_FILE | T04-15 |

相关代码：
- `components/ImageSettings.vue:37`、`:186`、`:300`：模式从尺寸数值反推、range 最小宽度与条件卸载。
- `lib/image/codec/resize.ts:17`、`:43`：端点坐标映射与直接插值 RGB/Alpha。
- `lib/image/dimensions.ts:79`、`:100`：JPEG marker 填充未跳过，按长度跳段失去同步。
- `lib/image/download.ts:108`、`:130`：过滤任务对象后仍在多次 await 之间读取可变结果；`components/ImageTaskList.vue:108` 的重压按钮没有检查 isZipping。

## 已实际验证

环境：Node 22.17.0、Yarn 4.5.0、本机隔离 Chrome；静态服务仅监听 127.0.0.1，应用项目 CSP 与 MIME。沙箱首次拒绝绑定本地端口，允许本地终端运行后完成；未使用 MCP、插件、联网搜索或云端浏览器。

1. 静态/运行时：`yarn check` 通过，12 个测试文件、88 项测试通过，生成 20 条含资源路由，6 个业务页面 SEO 通过。保留 [完整日志](2026-10-19-check.txt)。构建有 caniuse-lite 数据较旧的非阻断警告，本轮未联网更新。
2. 系统级：在当前生产构建上运行现有 Chrome/CDP 20 项流程，全部通过，包括真实 WASM/Worker、三种图片下载并重新解码、三语状态、透明转白、部分 Alpha、ZIP、取消/重试、CSP 与网络检查。结果见 [浏览器记录](2026-10-19-browser-check.json)、[日志](2026-10-19-browser-check.txt)。
3. 新增诊断：三语、390/375/320px、1440px 桌面与自定义输入；结果见 [布局测量](2026-10-19-layout.json)。浏览器日志记录 `CUSTOM_INPUT {visible:false,activeTag:"BODY"...}`。
4. 算法与 ZIP 问题：直接调用当前生产纯函数、真实 JPEG WASM、实际 ZIP 打包逻辑，见 [确认问题数据](2026-10-19-confirmed-bugs.json)。可复现命令：`node docs/verification/2026-10-19-reproduce.mjs`。该脚本检查的是“当前问题能否复现”，退出 0 不表示产品已修复；修复时应改写为正常行为的回归断言。

本轮的浏览器扩展检查使用项目脚本的临时副本，将输出重定向到本次日期，避免改写历史 2026-10-14 证据。未改变原始浏览器检查脚本。

## 测试与记录本身的待办

- T04-17：当前 E2E 只在中文 390px 检查一次页面 overflow，没有覆盖英文/日文质量控件与自定义输入。它比较 `document.documentElement.scrollWidth <= window.innerWidth`；移动浏览器的 layout viewport 可能随溢出一起扩张，本次英文 390px 测量中 innerWidth/pageWidth 均变成 406px，所以该比较可能漏报。应使用目标设备/可视区域宽度并检查内部控件。
- T04-17：`scripts/browser-check.mjs` 输出文件硬编码 `2026-10-14-browser-check.json`，之后每次运行都覆盖历史记录；缺少真实运行日期、commit 与浏览器版本的标识。新增边界应纳入正式回归。
- T04-18：AGENTS.md 仍写阶段 0、运行命令待验证、E2E 前提为 Playwright，与实际已具备的本地门禁和 Chrome/CDP 脚本不一致。init.md 是模板导入时期记录，不应作为产品现状依据。
- 仓库仍跟踪 `.template-import-*` 等历史材料；它们不位于 `public/`，不是当前网站运行缺陷。是否另行归档属于低优先级整理，本轮不删除。

## 继续保留的验收待办

- T04-11：实际 Cloudflare、域名/HTTPS、远端 CI、回滚 ID；Safari/iOS、Android 真机、Firefox/Edge；EXIF/ICC/16-bit PNG、低内存、大图、Lighthouse 与真实样本。本轮没有把本地 Chrome 结果当作生产或真机证据。
- T04-12：图标/favicon 来源、WASM 内部全部上游许可、copy-paste 完整声明来源；现有 notices 保留了本地安装包附带文件，不等于来源已全部确认。
- 本轮没有发现需要因“收费功能”新增的待办。站点无会员/支付/订阅/收费压缩接口，广告统计仍固定关闭；实际基础设施账单依然不在本地代码审查范围。

当前 TASKS：7 todo、1 doing、23 done，共 31 项；未完成共 8 项。优先收尾 T04-13，并安排 T04-16/T04-14/T04-15 的修复，随后扩充测试。T04-11/T04-12 的外部验收或来源核实继续保留，不提前标 done。

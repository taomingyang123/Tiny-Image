# Tiny Image 发布验收清单

更新：2026-10-14，T04-10。仅对本次有证据的检查打勾，历史完成标签不作为验收依据。

| 检查 | 状态与证据 |
|---|---|
| TypeScript strict | 本地通过 `yarn typecheck` |
| 单元/集成/WASM | 88 项通过；模拟 Worker 的测试不等同浏览器 E2E |
| SSG / SEO | 本地通过：6 个业务页面及 canonical/hreflang/JSON-LD/sitemap/robots/redirects |
| 真实 Chrome Worker/WASM/下载 | 本地生产产物通过，见 [记录](verification/2026-10-14-browser-check.json) |
| 首屏 WASM / 外部请求 / CSP | 本地 Chrome 无 WASM 首屏请求、无页面/Worker 外部或上传请求、无 CSP 错误 |
| 20 张/30 MiB/32 MP 桌面/16 MP 移动/100 MiB ZIP | 单元边界与 20 张真实浏览器流程通过；移动内存仍待真机 |
| 第三方声明文件 | 已生成，来源核实仍待 T04-12 |
| CI 配置 | 已加入真实 Chrome 步骤；未运行远端 GitHub Actions，不宣称远端 CI 通过 |

- [x] 本地 `yarn check` 通过。
- [x] 本地 `yarn test:e2e` 通过真实 Chrome 代表流程。
- [x] 三语静态页面及隐私页存在。
- [x] dev Spike 不发布；页脚可访问第三方 notices。
- [ ] 独立 GitHub 仓库远端、main 保护及远端 CI 成功证据。
- [ ] Cloudflare Pages Git 集成、预览/生产部署、真实六条页面路径、域名 DNS/HTTPS。
- [ ] 生产 WASM MIME/URL/CSP、取消/重试、下载、网络数据流及回滚部署 ID。
- [ ] Safari/macOS、iOS Safari、Android Chrome 真机、Firefox/Edge。
- [ ] EXIF 方位、ICC/16-bit PNG、低内存场景、12 个真实样本与 Lighthouse 报告。
- [ ] SVG 图标/favicon 与上游 WASM 内部许可来源核实。
- [ ] Search Console / Bing 提交证据（不保证收录）。

未完成项跟踪于 TASKS.md 的 T04-11/T04-12。详细范围与结果见 [审查报告](verification/2026-10-14-feature-audit.md)。

# 08｜关键决策 ADR / 风险清单 / 发布与回滚

## 架构决策

- ADR-001：采用独立子域名 `image.tinystool.org` 而非主站路径，便于工具族扩展，牺牲一部分主站域名路径的 SEO 积累；通过主站互链而不是复制内容弥补。
- ADR-002：独立 GitHub 仓库 `tinystool-image-tools`、Cloudflare Pages 项目同名；不依赖主站发布。
- ADR-003：Nuxt 3 SSG（不是全站纯 CSR），因为独立站的 SEO/FAQ 内容需要服务端生成后的 HTML。
- ADR-004：客户端压缩 + WASM Web Worker，拒绝远程图片处理；便于隐私声明、极低后端运维。
- ADR-005：MVP JPEG/PNG/WebP，不把 AVIF/HEIC/GIF 动图提前纳入上线阻塞。AVIF 的 WASM 编码体积/耗时和线程兼容性可以 P1 spike 后决定。
- ADR-006：PNG 原格式无损直接 OxiPNG 二进制优化、无收益保持原字节；有损格式压缩结果如实展示，即使变大也不假装节省。
- ADR-007：默认单 Worker 单并发，优先用户可取消、稳定和移动端内存，再考虑并发池。
- ADR-008：图片元数据保留/删除需要可验证独立能力；第一版不承诺剥离 GPS/EXIF。
- ADR-009：经 T00-02 Spike 验证，jSquash 依赖锁定（@jsquash/jpeg, @jsquash/oxipng, @jsquash/webp）；Vite 构建需配置 worker.format = 'es' 解决 Worker 代码分割兼容；静态生成将 WASM 资源独立打包至 .output/public/_nuxt/。

## 风险登记

| 风险 | 级别 | 触发信号 | 应对 |
|---|---|---|---|
| jSquash/Vite/Nuxt 打包不兼容 | 高 | 生产 WASM 404、嵌套 Worker error | P0 spike、锁版本、单线程 variant、替换 adapter |
| Safari / iOS 性能差 | 高 | 大图崩溃、标签页重载 | 初期像素限制与单线程，及时回收，友好降级 |
| PNG 效果不明显 | 中 | 已优化图无收益 | 解释无损限制，保留原图；可建议 WebP（有损且改格式） |
| 压缩体积增加 | 中 | 结果 > 原图 | 界面红/黄文字实报，不伪造正收益 |
| 透明通道与颜色失真 | 中 | JPEG 黑底、WebP alpha 不见 | 测试矩阵、显式 JPEG 白背景、ICC 限制告知 |
| 文件名与 SVG 安全 | 高 | 恶意 HTML/ZIP 路径 | 仅支持三格式，签名验证，文件名转义清理 |
| SEO 子域名起步慢 | 中 | GSC 已抓取未收录 | 独特价值内容、互链、稳定索引，不堆空页 |
| 云端静态资源缓存错误 | 中 | 新版页面请求旧 WASM JS | 文件哈希、正确 cache headers、回滚 |
| 发布版本不受控 | 中 | Pages 自动部署未通过测试代码 | main branch protection + CI + Pages Git 集成 |
| 版权/依赖漏洞 | 中 | codec 许可或停更 | SBOM/许可证审计、锁版本、定期检查 |

## 性能与质量基线（目标，不是现状）

- 体积缩减：不设统一最低百分比承诺；运行后根据 12 张标准数据集记录真实数字。
- 空闲首页：WASM 不加载，Lighthouse Accessibility/SEO/Best Practices 目标 ≥90。
- 主线程：编码期间滚动/点击取消仍有响应；瓶颈与内存通过 Chrome Performance 量测。
- 编码任务：超时 60s 为初始保护值，不在 UI 保证“秒压”。
- 页面：优先中文/英语/日语真实内容，各语言独立 canonical/hreflang。

## 发布检查及运营

- 首发为 v1.0.0，Git tag `v1.0.0`；记录对应 Pages 部署 URL/commit SHA。
- 发布当天验证首页、各语言、下载 3 种格式、ZIP、隐私、无外发图片、GSC sitemap。
- 发布后关注公开错误报告、实际浏览器失败率（只在用户同意且不含图片内容/文件名的前提下统计）、Pages 构建状态。分析不是 P0 必需。
- 线上失败时按上个 tag 恢复稳定部署；对于 codec 故障单独隐藏对应格式按钮也可以是紧急修复。

## 禁止偏离

不要在 v1 编写后端 `POST /api/compress`、接入第三方上传、默认跟踪文件名、强制用户登录或收费、用图片上传换取性能。任何偏离需先更新架构决策并明确与隐私声明的冲突。

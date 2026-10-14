# Tiny Image — 域名绑定与上线核查手册 (DEPLOYMENT MANUAL)

本文档面向工程运维与协作团队，详细说明 Tiny Image (`tinystool-image-tools`) 在 Cloudflare Pages 的上线部署、域名绑定、SSL/TLS 配置与全量发布核查规程。

---

## 一、项目基准与不可变约束

1. **项目独立性**：独立仓库与 Cloudflare Pages 项目均命名为 `tinystool-image-tools`，严禁改动 `tinystool.org` 主站源码、主仓库或主站 Cloudflare 项目。
2. **正式域名**：`https://image.tinystool.org`。
3. **架构属性**：Nuxt 3 SSG 全静态预渲染 + 浏览器端 Web Worker + 按需 WASM 编解码。**100% 本地运算，图片数据零上站、零后端 API**。
4. **DNS 边界**：在 `tinystool.org` 根域名 DNS 管理中，**仅允许新增** `image` 子域名 CNAME 记录，严禁修改或删除已有记录。

---

## 二、Cloudflare Pages 创建与 Git 集成

建议在 Cloudflare 采用 **Git Integration** 模式创建，实现与 GitHub `main` 分支提交的自动化持续构建与部署。

### 1. 创建 Pages 项目
1. 登录 Cloudflare Dashboard → 进入 **Workers & Pages**。
2. 点击 **Create application** → 选择 **Pages** 选项卡 → 点击 **Connect to Git**。
3. 选择 GitHub 账户，授权并选中独立仓库 `tinystool-image-tools`。
4. 设置 **Project name** 为：`tinystool-image-tools`。
5. **Production branch** 设置为：`main`。

### 2. 构建与输出配置
在 Build settings 中配置如下参数：
- **Framework preset**：`None`（或 `Nuxt`）
- **Build command**：`yarn generate`
- **Build output directory**：`.output/public`
- **Root directory**：`/`（留空或根目录）

### 3. 环境变量设置
在 **Environment variables** (Production & Preview) 中添加：
- `NODE_VERSION`：`22`
- `NITRO_PRESET`：`cloudflare-pages-static`（默认即可）

点击 **Save and Deploy**，等待首次生产构建完成。

---

## 三、自定义域名绑定与 DNS CNAME 配置

### 1. Pages 控制台绑定自定义域名
1. 进入新建的 Pages 项目 `tinystool-image-tools`。
2. 导航至 **Custom domains** 选项卡。
3. 点击 **Set up a custom domain**。
4. 输入正式域名：`image.tinystool.org`。
5. 点击 **Continue**。

### 2. DNS 记录配置
如果 `tinystool.org` 域名已托管在同一 Cloudflare 账号：
- Cloudflare 会自动检测并在 DNS 表中添加相应的 CNAME 记录。

如果需要人工确认或手动配置 DNS 记录：
- **Type (类型)**：`CNAME`
- **Name (主机名)**：`image`
- **Target (目标地址)**：`tinystool-image-tools.pages.dev`（或 Pages 控制台给出的专用目标）
- **Proxy status (代理状态)**：`Proxied` (小橙锁已开启)
- **TTL**：`Auto`

> [!CAUTION]
> 绝对不要修改主站根域名 `@`、`www` 或已有其他子域名的 DNS 记录！

---

## 四、SSL/TLS 与安全响应头配置

1. **SSL/TLS 加密模式**：
   - 在 Cloudflare 控制台导航至 **SSL/TLS**。
   - 确保模式设为 **Full (strict)**。
2. **边缘安全策略**：
   - 启用 **Always Use HTTPS**（强制 HTTPS）。
   - 启用 **Automatic HTTPS Rewrites**。
   - 启用 **Minimum TLS Version**：`TLS 1.2` 或更高。
3. **安全响应头与 CSP 核查**：
   - 仓库已内置 `public/_headers` 并于构建时自动输出至 `.output/public/_headers`。
   - 确保包含：
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
     - `Content-Security-Policy: ... connect-src 'self' ...`（断绝外部图片流量外发）

---

## 五、上线全量核查 Checklist (Verification Runbook)

通过终端命令对生产域名 `https://image.tinystool.org` 进行全面可用性与符合性验证：

### 1. HTTP 状态码与响应头验证
```bash
# 1.1 中文首页 (默认语言)
curl -I -s https://image.tinystool.org/ | grep -E "HTTP/|content-type|x-content-type-options|content-security-policy"
# 预期：HTTP/2 200，包含 strict CSP 与 nosniff

# 1.2 英文首页
curl -I -s https://image.tinystool.org/en/ | grep -E "HTTP/|content-type"
# 预期：HTTP/2 200

# 1.3 日文首页
curl -I -s https://image.tinystool.org/ja/ | grep -E "HTTP/|content-type"
# 预期：HTTP/2 200

# 1.4 三语隐私政策页面
curl -I -s https://image.tinystool.org/privacy/ | head -n 1
curl -I -s https://image.tinystool.org/en/privacy/ | head -n 1
curl -I -s https://image.tinystool.org/ja/privacy/ | head -n 1
# 预期：均为 HTTP/2 200

# 1.5 规范化 301 永久重定向（去尾斜杠重定向）
curl -I -s https://image.tinystool.org/en | grep -E "HTTP/|location"
curl -I -s https://image.tinystool.org/privacy | grep -E "HTTP/|location"
# 预期：HTTP/2 301，Location 分别指向 /en/ 与 /privacy/

# 1.6 Sitemap 与 Robots.txt
curl -I -s https://image.tinystool.org/sitemap.xml | grep -E "HTTP/|content-type"
curl -I -s https://image.tinystool.org/robots.txt | grep -E "HTTP/|content-type"
# 预期：均为 HTTP/2 200
```

### 2. 浏览器端到端行为审计
1. **本地编解码测试**：
   - 访问 `https://image.tinystool.org/`。
   - 上传一张 JPEG、一张带透明通道的 PNG、一张 WebP 图片。
   - 检查任务列表是否正常解析尺寸、显示缩略图、计算预期体积。
   - 触发批量压缩，验证压缩耗时与节省比例准确展示。
2. **无外发网络流量审计 (Zero-Egress Audit)**：
   - 打开浏览器 DevTools (F12) → **Network** 网络面板。
   - 过滤 `Fetch/XHR`。
   - 在整个图片上传、解码、缩放、编码与 ZIP 下载过程中：
     - **断言**：绝对没有任何向外部 API 发送图片字节或文件名的 HTTP POST/PUT 请求！
     - 仅允许对同源 WASM 二进制文件的静态加载。
3. **卷帘对比与下载测试**：
   - 点击任一已完成任务的「对比」按钮，滑动卷帘检查原图与压缩图画质无明显失真。
   - 点击「打包下载全部 (ZIP)」，检查下载的 zip 压缩包能否用系统自带解压工具解压，且解压出的图片能正常查看。

---

## 六、故障排查与应急回滚

| 异常现象 | 可能原因 | 排除方案 |
|---|---|---|
| 522 Connection Timed Out | DNS 配置了 CNAME 但 Pages 自定义域名尚未绑定成功 | 检查 Pages 控制台 Custom domains 是否处于 Active 状态。 |
| WASM 加载失败或报 CSP 错误 | 响应头被代理重写，或缺少 `wasm-unsafe-eval` | 确认 `public/_headers` 中包含 `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`。 |
| 样式丢失或 404 静态资源 | 静态资源路径未配置为相对或根绝对路径 | 检查 Nuxt 配置中的 `app.baseURL: '/'`。 |
| 需紧急回滚至上一个稳定版本 | 线上出现偶发崩溃或严重缺陷 | 登录 Cloudflare Pages → **Deployments** → 找到上一个 Success 记录 → 点击右侧 `...` → 选择 **Rollback to this deployment**。 |

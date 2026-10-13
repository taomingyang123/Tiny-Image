---
date: "2026-10-14 01:09 Asia/Shanghai"
type: "技术验证"
tasks: [T00-02]
modules: ["WASM", "Worker", "jSquash", "Vite"]
---

# T00-02 WASM 编解码 Spike 验证

## 背景

评估与验证 `@jsquash/jpeg`、`@jsquash/oxipng`、`@jsquash/webp` 在 Nuxt 3/Vite 构建以及 Web Worker 环境下的可用性与 WASM 静态资源分发路径。

## 改动

- 安装 `@jsquash/jpeg`、`@jsquash/oxipng`、`@jsquash/webp` 依赖。
- 在 `nuxt.config.ts` 中配置 `vite.worker.format = 'es'`，消除 IIFE 模式对 Worker 内部动态代码分割的报错。
- 编写 `tests/unit/codec-spike.test.ts` 并在 Vitest 中通过单元测试：验证 JPEG 编解码、WebP 编解码与 PNG OxiPNG 二进制优化算法及 WASM 执行。
- 实现 `workers/spike.worker.ts` 与 `pages/dev/codec-spike.vue`，针对 3 种格式实施完整的 Worker 通信与 WASM 编解码流程。
- 执行 `yarn generate` 静态生成：确认所有 WASM 文件（`mozjpeg_enc`, `mozjpeg_dec`, `webp_enc`, `webp_dec`, `webp_enc_simd`, `squoosh_oxipng_bg`）与 ESM Worker chunk 正确打包入 `.output/public/_nuxt/`。
- 本地启动静态预览服务（端口 4173）。

## 验证

- 静态：`yarn typecheck` 0 错误；`yarn test:unit` 全部 3 项编解码单元测试通过。
- 运行时：`yarn generate` 成功，Vite 正确输出 WASM 与 ESM Worker 产物；本地 HTTP 服务响应 200。
- 系统级：静态站包含所有 6 个 `.wasm` 资产文件；写入 ADR-009。

## 后续

T00-02 已完成并标记 done；进入阶段 1：核心引擎（T01-01 数据契约与格式校验）。

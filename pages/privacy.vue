<script setup lang="ts">
const { t } = useI18n();

usePageSeo({
  titleKey: "privacy.title",
  descriptionKey: "privacy.description",
  schemaType: "WebPage",
});
</script>

<template>
  <main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <header class="space-y-2 border-b border-gray-200 dark:border-gray-800 pb-4">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {{ t("privacy.title") }}
      </h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        Tiny Image (image.tinystool.org) · 100% Client-Side Processing
      </p>
    </header>

    <article class="prose dark:prose-invert max-w-none space-y-4 text-gray-700 dark:text-gray-300">
      <section class="space-y-2">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">1. 本地处理与零上传承诺</h2>
        <p>
          Tiny Image 承诺：您在本工具中选择、拖拽或压缩的任何图片文件，全部在您的浏览器本地（Web Worker / WASM）完成解码与重新编码。
          <strong>您的图片文件、像素数据、文件名及二进制内容绝对不会上传到我们的服务器或任何第三方接口。</strong>
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">2. 访问日志与第三方服务</h2>
        <p>
          本站点为纯静态托管（Cloudflare Pages）。当您访问站点时，托管网络仅会记录常规的静态网页资源（HTML/CSS/JS/WASM）请求日志。
          站点不设数据库、不设用户账户体系、不保存任何历史压缩记录。
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">3. 元数据（EXIF / GPS）说明</h2>
        <p>
          在当前版本中，重新编码后的图片可能会因编码器特性保留或剥离部分 EXIF/ICC 元数据。
          <strong>第一版工具不承诺完全清除所有 GPS 或敏感隐私元数据。</strong>
          如您有高安全级别的隐私元数据清理需求，请使用专业离线元数据清理工具。
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">4. 本地存储与资源清理</h2>
        <p>
          本站不在您的浏览器持久化存储（如 localStorage、IndexedDB）中保存任何图片数据。
          刷新页面或关闭标签页后，所有内存中的任务与临时 Blob 对象均会被浏览器立即释放。
        </p>
      </section>
    </article>
  </main>
</template>

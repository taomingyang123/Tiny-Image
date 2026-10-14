<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

interface Props {
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  (e: "files-added", files: File[]): void;
}>();

const { t } = useI18n();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const files = Array.from(target.files);
  emit("files-added", files);
  // 清空 input 使得选择相同文件仍可再次触发
  target.value = "";
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  if (props.disabled) return;
  isDragOver.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
  if (props.disabled) return;

  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    const files = Array.from(e.dataTransfer.files);
    emit("files-added", files);
  }
};

const triggerFileInput = () => {
  if (props.disabled) return;
  fileInputRef.value?.click();
};

// 支持全局剪贴板图片粘贴
const handlePaste = (e: ClipboardEvent) => {
  if (props.disabled) return;
  const items = e.clipboardData?.items;
  if (!items) return;

  const imageFiles: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        // 为粘贴的图片起一个带时间戳的友好名称
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const renamed = new File([file], `clipboard-${Date.now()}.${ext}`, { type: file.type });
        imageFiles.push(renamed);
      }
    }
  }

  if (imageFiles.length > 0) {
    emit("files-added", imageFiles);
  }
};

onMounted(() => {
  window.addEventListener("paste", handlePaste);
});

onUnmounted(() => {
  window.removeEventListener("paste", handlePaste);
});
</script>

<template>
  <div
    tabindex="0"
    role="button"
    :aria-label="t('uploader.dragOrClick')"
    class="relative rounded-3xl p-8 md:p-12 text-center transition-all duration-300 cursor-pointer overflow-hidden group select-none border-2 border-dashed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:border-cyan-400"
    :class="[
      isDragOver
        ? 'border-cyan-400 bg-cyan-950/20 scale-[1.01] shadow-2xl shadow-cyan-500/10'
        : 'border-white/15 bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-cyan-400/50 hover:bg-white/[0.06] shadow-xl',
      disabled ? 'opacity-50 pointer-events-none' : '',
    ]"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @click="triggerFileInput"
    @keydown.enter.prevent="triggerFileInput"
    @keydown.space.prevent="triggerFileInput"
  >
    <!-- 背景流光装饰 -->
    <div
      class="absolute -top-24 -left-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-500"
    ></div>
    <div
      class="absolute -bottom-24 -right-24 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500"
    ></div>

    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="handleFileSelect"
    />

    <div class="relative z-10 flex flex-col items-center justify-center space-y-4">
      <!-- 拖拽图标徽章 -->
      <div
        class="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg"
        :class="
          isDragOver
            ? 'bg-gradient-to-tr from-cyan-400 to-purple-400 text-gray-950 scale-110'
            : 'bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-white/10'
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-8 h-8 md:w-10 md:h-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </div>

      <!-- 文字提示 -->
      <div class="space-y-1.5">
        <h3 class="text-lg md:text-xl font-bold text-gray-100 tracking-tight">
          {{ isDragOver ? t("uploader.dropNow") : t("uploader.dragOrClick") }}
        </h3>
        <p class="text-xs md:text-sm text-gray-400 max-w-md mx-auto">
          {{ t("uploader.pasteSupported") }}
        </p>
      </div>

      <!-- 格式与限制标签 -->
      <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
          JPG / JPEG
        </span>
        <span class="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-purple-950/60 text-purple-300 border border-purple-500/30">
          PNG
        </span>
        <span class="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
          WebP
        </span>
        <span class="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-gray-900/60 text-gray-400 border border-white/5">
          {{ t("uploader.maxSizeBadge") }}
        </span>
      </div>
    </div>
  </div>
</template>

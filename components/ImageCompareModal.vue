<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { formatBytes } from "../lib/image/policy";

interface Props {
  modelValue: boolean;
  originalUrl?: string;
  resultUrl?: string;
  originalName?: string;
  originalBytes?: number;
  resultBytes?: number;
  width?: number;
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  originalUrl: "",
  resultUrl: "",
  originalName: "",
  originalBytes: 0,
  resultBytes: 0,
  width: 0,
  height: 0,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "download"): void;
}>();

const { t } = useI18n();

const sliderPos = ref(50); // 0..100
const containerRef = ref<HTMLDivElement | null>(null);
const isDragging = ref(false);

const savingsPercent = computed(() => {
  if (props.originalBytes <= 0) return 0;
  return (((props.originalBytes - props.resultBytes) / props.originalBytes) * 100).toFixed(1);
});

const close = () => {
  emit("update:modelValue", false);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.modelValue) {
    close();
  }
};

const updateSlider = (clientX: number) => {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const x = clientX - rect.left;
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
  sliderPos.value = percentage;
};

const onMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  updateSlider(e.clientX);
};

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  updateSlider(e.clientX);
};

const onMouseUp = () => {
  isDragging.value = false;
};

const onTouchMove = (e: TouchEvent) => {
  if (e.touches.length > 0) {
    updateSlider(e.touches[0].clientX);
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      sliderPos.value = 50;
      if (typeof document !== "undefined") {
        document.body.style.overflow = "hidden";
      }
    } else {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    }
  },
);

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("mousemove", onMouseMove);
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md transition-all duration-300 animate-fadeIn"
    @click.self="close"
  >
    <div
      class="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-gray-950/90 border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden glass"
    >
      <!-- 弹窗顶部栏 -->
      <div
        class="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-gray-900/40"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <h3 class="text-sm md:text-base font-bold text-gray-100 truncate max-w-xs md:max-w-md">
            {{ originalName }}
          </h3>
          <span v-if="width && height" class="text-xs text-gray-400 font-mono hidden sm:inline">
            {{ width }}×{{ height }}
          </span>
        </div>

        <div class="flex items-center gap-2.5">
          <!-- 节省百分比徽章 -->
          <span
            v-if="resultBytes > 0"
            class="px-2.5 py-1 rounded-full text-xs font-mono font-bold"
            :class="
              resultBytes < originalBytes
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                : 'bg-gray-800 text-gray-300'
            "
          >
            {{ resultBytes < originalBytes ? `-${savingsPercent}%` : t("queue.unchanged") }}
          </span>

          <button
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/30 hover:border-cyan-400 transition-all flex items-center gap-1.5"
            @click="emit('download')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            <span>{{ t("queue.download") }}</span>
          </button>

          <button
            type="button"
            class="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            :title="t('common.close')"
            @click="close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 对比视口（卷帘分割器） -->
      <div
        ref="containerRef"
        class="relative flex-1 min-h-[380px] md:min-h-[500px] max-h-[70vh] bg-[radial-gradient(#1f293d_1px,transparent_1px)] [background-size:16px_16px] bg-gray-950 flex items-center justify-center select-none overflow-hidden cursor-ew-resize"
        @mousedown="onMouseDown"
        @touchmove="onTouchMove"
      >
        <!-- 压缩后图片（底层/右侧） -->
        <img
          :src="resultUrl || originalUrl"
          alt="Compressed Image"
          class="max-w-full max-h-full object-contain pointer-events-none"
        />

        <!-- 原始图片（顶层/左侧，通过 clip-path 实现卷帘展开） -->
        <div
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
          :style="{
            clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
          }"
        >
          <img
            :src="originalUrl"
            alt="Original Image"
            class="max-w-full max-h-full object-contain"
          />
        </div>

        <!-- 分割线与拖拽手柄 -->
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_12px_rgba(110,231,255,0.8)] pointer-events-none flex items-center justify-center"
          :style="{ left: `${sliderPos}%` }"
        >
          <div
            class="w-7 h-7 rounded-full bg-cyan-400 text-gray-950 flex items-center justify-center shadow-lg border border-white transform -translate-x-1/2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>

        <!-- 左侧悬浮标签：原图 -->
        <div
          class="absolute top-4 left-4 pointer-events-none px-3 py-1 rounded-xl bg-gray-950/70 border border-white/10 text-xs font-mono text-gray-300 backdrop-blur-md flex flex-col"
        >
          <span class="font-bold text-gray-100">{{ t("compare.before") }}</span>
          <span class="text-[11px] text-gray-400">{{ formatBytes(originalBytes) }}</span>
        </div>

        <!-- 右侧悬浮标签：压缩后 -->
        <div
          class="absolute top-4 right-4 pointer-events-none px-3 py-1 rounded-xl bg-gray-950/70 border border-white/10 text-xs font-mono text-cyan-300 backdrop-blur-md flex flex-col items-end"
        >
          <span class="font-bold text-cyan-200">{{ t("compare.after") }}</span>
          <span class="text-[11px] text-cyan-400">{{ formatBytes(resultBytes || originalBytes) }}</span>
        </div>
      </div>

      <!-- 底部提示栏 -->
      <div class="px-5 py-2.5 bg-gray-900/60 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
        <span>{{ t("compare.dragTip") }}</span>
        <span class="font-mono">ESC {{ t("common.close") }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out forwards;
}
</style>

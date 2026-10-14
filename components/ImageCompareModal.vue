<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
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
const stageRef = ref<HTMLDivElement | null>(null);
const isDragging = ref(false);
const dialogRef = ref<HTMLDivElement | null>(null);
let returnFocus: HTMLElement | null = null;
let previousOverflow = "";

const savingsPercent = computed(() => {
  if (props.originalBytes <= 0) return 0;
  return (((props.originalBytes - props.resultBytes) / props.originalBytes) * 100).toFixed(1);
});

const close = () => {
  emit("update:modelValue", false);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.modelValue) return;

  if (e.key === "Tab") {
    const items = dialogRef.value?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
    if (!items?.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    return;
  }
  if (e.key === "Escape") {
    close();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    sliderPos.value = Math.max(0, sliderPos.value - 5);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    sliderPos.value = Math.min(100, sliderPos.value + 5);
  } else if (e.key === "Home") {
    e.preventDefault();
    sliderPos.value = 0;
  } else if (e.key === "End") {
    e.preventDefault();
    sliderPos.value = 100;
  }
};

/**
 * 依据实际渲染的图片 stageRef 几何矩形计算滑块百分比
 * 保证滑块在 0%~100% 之间精准对应图片左右边缘，绝不在背景黑边空跑
 */
const updateSlider = (clientX: number) => {
  const target = stageRef.value || containerRef.value;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0) return;
  const x = clientX - rect.left;
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
  sliderPos.value = Number(percentage.toFixed(2));
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

const onTouchStart = (e: TouchEvent) => {
  if (e.touches.length > 0) {
    isDragging.value = true;
    updateSlider(e.touches[0].clientX);
  }
};

const onTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return;
  if (e.touches.length > 0) {
    updateSlider(e.touches[0].clientX);
  }
};

const onTouchEnd = () => {
  isDragging.value = false;
};

const resetCenter = () => {
  sliderPos.value = 50;
};

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      sliderPos.value = 50;
      if (typeof document !== "undefined") {
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        await nextTick();
        if (props.modelValue) dialogRef.value?.querySelector<HTMLElement>('button')?.focus();
      }
    } else {
      if (typeof document !== "undefined") {
        document.body.style.overflow = previousOverflow;
        returnFocus?.focus();
      }
    }
  },
);

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchmove", onTouchMove);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("touchend", onTouchEnd);
  window.removeEventListener("touchmove", onTouchMove);
  if (typeof document !== "undefined") {
    document.body.style.overflow = previousOverflow;
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
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-label="t('compare.compareTitle')"
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
            {{ resultBytes < originalBytes ? `-${savingsPercent}%` : resultBytes > originalBytes ? `+${Math.abs(Number(savingsPercent))}%` : t("queue.unchanged") }}
          </span>

          <button
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/30 hover:border-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer"
            @click="emit('download')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            <span>{{ t("queue.download") }}</span>
          </button>

          <button
            type="button"
            class="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            :title="t('common.close')"
            @click="close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 对比视口（背景与交互监听区域） -->
      <div
        ref="containerRef"
        class="relative flex-1 min-h-[360px] md:min-h-[480px] max-h-[72vh] bg-[radial-gradient(#1f293d_1px,transparent_1px)] [background-size:16px_16px] bg-gray-950 flex items-center justify-center p-4 md:p-6 select-none overflow-hidden cursor-ew-resize"
        @mousedown="onMouseDown"
        @touchstart.passive="onTouchStart"
      >
        <!-- 核心：统一锁定的展示舞台（Image Stage） -->
        <!-- 由底层基准图片撑开精确宽高，顶层与底层共享同个舞台盒模型，根除任何比例或尺寸错位 -->
        <div
          ref="stageRef"
          role="slider"
          tabindex="0"
          :aria-label="t('compare.compareTitle')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="sliderPos"
          class="relative inline-block max-w-full max-h-full rounded-xl overflow-hidden shadow-2xl select-none"
          @dblclick="resetCenter"
        >
          <!-- 底层：压缩后图片（或单图基准） -->
          <img
            :src="resultUrl || originalUrl"
            :alt="t('compare.after')"
            class="block max-w-full max-h-[66vh] w-auto h-auto object-contain pointer-events-none rounded-xl"
            draggable="false"
          />

          <!-- 顶层：原始图片（通过 clip-path 实现基于图片真实宽度的卷帘展开） -->
          <div
            class="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
            :style="{
              clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
            }"
          >
            <img
              :src="originalUrl"
              :alt="t('compare.before')"
              class="absolute top-0 left-0 w-full h-full object-fill pointer-events-none"
              draggable="false"
            />
          </div>

          <!-- 分割线与拖拽手柄（精准跟随图片内部宽度，与 clipPath 裁切线 100% 严丝合缝） -->
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_14px_rgba(110,231,255,0.9)] pointer-events-none flex items-center justify-center"
            :style="{ left: `${sliderPos}%` }"
          >
            <div
              class="w-8 h-8 rounded-full bg-cyan-400 text-gray-950 flex items-center justify-center shadow-xl border-2 border-white transform -translate-x-1/2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <!-- 左侧悬浮标签：原图 -->
        <div
          class="absolute top-4 left-4 pointer-events-none px-3 py-1.5 rounded-xl bg-gray-950/75 border border-white/10 text-xs font-mono text-gray-300 backdrop-blur-md flex flex-col shadow-lg"
        >
          <span class="font-bold text-gray-100 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {{ t("compare.before") }}
          </span>
          <span class="text-[11px] text-gray-400">{{ formatBytes(originalBytes) }}</span>
        </div>

        <!-- 右侧悬浮标签：压缩后 -->
        <div
          class="absolute top-4 right-4 pointer-events-none px-3 py-1.5 rounded-xl bg-gray-950/75 border border-white/10 text-xs font-mono text-cyan-300 backdrop-blur-md flex flex-col items-end shadow-lg"
        >
          <span class="font-bold text-cyan-200 flex items-center gap-1.5">
            {{ t("compare.after") }}
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          </span>
          <span class="text-[11px] text-cyan-400">{{ formatBytes(resultBytes || originalBytes) }}</span>
        </div>
      </div>

      <!-- 底部提示栏 -->
      <div class="px-5 py-2.5 bg-gray-900/60 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
        <span>{{ t("compare.dragTip") }}</span>
        <span class="font-mono hidden sm:inline">ESC {{ t("common.close") }}</span>
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

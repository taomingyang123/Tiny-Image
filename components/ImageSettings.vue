<script setup lang="ts">
import { computed } from "vue";
import type { CompressionOptions, OutputMode } from "../lib/image/types";

interface Props {
  modelValue: CompressionOptions;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: CompressionOptions): void;
}>();

const { t } = useI18n();

// 格式切换
const currentOutput = computed({
  get: () => props.modelValue.output,
  set: (val: OutputMode) => {
    emit("update:modelValue", { ...props.modelValue, output: val });
  },
});

// 质量数值
const currentQuality = computed({
  get: () => props.modelValue.quality,
  set: (val: number) => {
    emit("update:modelValue", { ...props.modelValue, quality: val });
  },
});

// 最长边选项
const currentEdgePreset = computed({
  get: () => {
    if (props.modelValue.maxLongEdge === null) return "none";
    if (props.modelValue.maxLongEdge === 1920) return "1920";
    if (props.modelValue.maxLongEdge === 1280) return "1280";
    if (props.modelValue.maxLongEdge === 800) return "800";
    return "custom";
  },
  set: (preset: string) => {
    if (preset === "none") {
      emit("update:modelValue", { ...props.modelValue, maxLongEdge: null });
    } else if (preset === "1920") {
      emit("update:modelValue", { ...props.modelValue, maxLongEdge: 1920 });
    } else if (preset === "1280") {
      emit("update:modelValue", { ...props.modelValue, maxLongEdge: 1280 });
    } else if (preset === "800") {
      emit("update:modelValue", { ...props.modelValue, maxLongEdge: 800 });
    } else if (preset === "custom") {
      emit("update:modelValue", {
        ...props.modelValue,
        maxLongEdge: 1024,
      });
    }
  },
});

const customEdgeValue = computed({
  get: () => props.modelValue.maxLongEdge ?? 1024,
  set: (val: number) => {
    if (!Number.isFinite(Number(val))) return;
    const num = Math.min(10000, Math.max(1, Math.round(Number(val))));
    emit("update:modelValue", { ...props.modelValue, maxLongEdge: num });
  },
});
</script>

<template>
  <fieldset
    :disabled="disabled"
    data-testid="settings"
    class="glass rounded-2xl p-5 md:p-6 transition-all duration-300 border border-white/10 shadow-xl"
    :class="{ 'opacity-60 pointer-events-none': disabled }"
  >
    <!-- 顶部标题栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 animate-pulse"></span>
        <h2 class="text-base font-bold text-gray-100 tracking-wide">
          {{ t("settings.title") }}
        </h2>
      </div>
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-gray-300 font-mono bg-white/[0.04] border border-white/10">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>{{ t("settings.localSafeBadge") }}</span>
      </span>
    </div>

    <!-- 三列等高配置区 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      <!-- 1. 输出格式选择 -->
      <div class="rounded-xl bg-white/[0.02] border border-white/[0.07] p-4 flex flex-col justify-between gap-3">
        <div class="flex items-center justify-between h-6">
          <label class="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {{ t("settings.outputFormat") }}
          </label>
          <span class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-400 border border-white/10">
            {{
              currentOutput === "keep"
                ? t("settings.formatKeep")
                : currentOutput === "jpeg"
                ? "JPEG"
                : t("settings.formatPng")
            }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-1.5 p-1 bg-gray-950/70 rounded-xl border border-white/10 h-11 items-center">
          <button
            type="button"
            class="h-full flex items-center justify-center px-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentOutput === 'keep'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            "
            data-output="keep"
            @click="currentOutput = 'keep'"
          >
            {{ t("settings.formatKeep") }}
          </button>
          <button
            type="button"
            class="h-full flex items-center justify-center px-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentOutput === 'jpeg'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            "
            data-output="jpeg"
            @click="currentOutput = 'jpeg'"
          >
            JPEG
          </button>
          <button
            type="button"
            class="h-full flex items-center justify-center px-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentOutput === 'png'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            "
            data-output="png"
            @click="currentOutput = 'png'"
          >
            {{ t("settings.formatPng") }}
          </button>
        </div>
      </div>

      <!-- 2. 图片质量控制 -->
      <div class="rounded-xl bg-white/[0.02] border border-white/[0.07] p-4 flex flex-col justify-between gap-3">
        <div class="flex items-center justify-between h-6">
          <label class="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {{ t("settings.quality") }}
          </label>
          <span
            class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md"
            :class="
              currentOutput === 'keep'
                ? 'bg-purple-950/50 text-purple-300 border border-purple-500/30'
                : 'bg-cyan-950/50 text-cyan-300 border border-cyan-500/30'
            "
          >
            {{ currentOutput === "keep" ? t("settings.keepMode") : `${currentQuality}` }}
          </span>
        </div>

        <div
          v-if="currentOutput !== 'keep'"
          class="h-11 px-3.5 bg-gray-950/70 rounded-xl border border-white/10 flex items-center gap-3"
        >
          <span class="text-[11px] text-gray-400 font-mono whitespace-nowrap">{{ t("settings.qualityLow") }}</span>
          <input
            v-model.number="currentQuality"
            type="range"
            :aria-label="t('settings.quality')"
            min="1"
            max="100"
            step="1"
            class="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
          />
          <span class="text-[11px] text-gray-400 font-mono whitespace-nowrap">{{ t("settings.qualityHigh") }}</span>
        </div>
        <div
          v-else
          class="h-11 px-3.5 rounded-xl bg-gray-950/70 border border-white/10 flex items-center justify-between gap-2 text-xs text-gray-300"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
              ✓
            </span>
            <span class="truncate font-medium">{{ t("settings.keepMode") }}</span>
          </div>
          <span class="text-[11px] font-mono text-gray-400 flex-shrink-0">PNG · JPEG · WebP</span>
        </div>
      </div>

      <!-- 3. 最长边等比缩放 -->
      <div class="rounded-xl bg-white/[0.02] border border-white/[0.07] p-4 flex flex-col justify-between gap-3">
        <div class="flex items-center justify-between h-6">
          <label class="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {{ t("settings.maxLongEdge") }}
          </label>
          <span class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-400 border border-white/10">
            {{ currentEdgePreset === "none" ? t("settings.edgeOriginal") : `${customEdgeValue}px` }}
          </span>
        </div>

        <div class="grid grid-cols-4 gap-1.5 p-1 bg-gray-950/70 rounded-xl border border-white/10 h-11 items-center">
          <button
            type="button"
            class="h-full flex items-center justify-center px-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentEdgePreset === 'none'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            "
            @click="currentEdgePreset = 'none'"
          >
            {{ t("settings.edgeOriginal") }}
          </button>
          <button
            type="button"
            class="h-full flex items-center justify-center px-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentEdgePreset === '1920'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            "
            @click="currentEdgePreset = '1920'"
          >
            1920px
          </button>
          <button
            type="button"
            class="h-full flex items-center justify-center px-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentEdgePreset === '1280'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            "
            @click="currentEdgePreset = '1280'"
          >
            1280px
          </button>
          <button
            type="button"
            class="h-full flex items-center justify-center px-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentEdgePreset === 'custom'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            "
            @click="currentEdgePreset = 'custom'"
          >
            {{ t("settings.edgeCustom") }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部状态提示与自定义输入栏 -->
    <div class="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div
        v-if="currentOutput === 'keep'"
        class="flex items-center gap-2 text-gray-400"
      >
        <span class="text-cyan-400 font-bold">✓</span>
        <span>{{ t("settings.keepDesc") }}</span>
      </div>
      <div
        v-else-if="currentOutput === 'jpeg'"
        class="flex items-center gap-2 text-amber-300/90"
      >
        <span class="font-bold">*</span>
        <span>{{ t("settings.jpegWhiteBgNotice") }}</span>
      </div>
      <div
        v-else
        class="flex items-center gap-2 text-cyan-300/90"
      >
        <span class="font-bold">*</span>
        <span>{{ t("settings.pngSmartDesc") }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-3 ml-auto">
        <span
          v-if="currentOutput !== 'keep'"
          class="text-[11px] font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 px-2.5 py-1 rounded-lg"
        >
          {{ t("settings.recommended") }} 80
        </span>

        <div v-if="currentEdgePreset === 'custom'" class="flex items-center gap-2">
          <span class="text-xs text-gray-400">{{ t("settings.maxLongEdge") }}:</span>
          <input
            v-model.number="customEdgeValue"
            type="number"
            :aria-label="t('settings.maxLongEdge')"
            min="100"
            max="10000"
            step="10"
            class="w-28 bg-gray-950/80 border border-cyan-500/40 rounded-lg px-3 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-400 font-mono"
            :placeholder="t('settings.pixelPlaceholder')"
          />
          <span class="text-xs text-gray-400 font-mono">px</span>
        </div>
      </div>
    </div>
  </fieldset>
</template>

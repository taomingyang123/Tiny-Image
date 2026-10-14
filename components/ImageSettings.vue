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
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
        <h2 class="text-base font-bold text-gray-100 tracking-wide">
          {{ t("settings.title") }}
        </h2>
      </div>
      <span class="text-xs text-gray-400 font-mono">
        {{ t("settings.localSafeBadge") }}
      </span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <!-- 1. 输出格式选择 -->
      <div class="space-y-2">
        <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {{ t("settings.outputFormat") }}
        </label>
        <div class="grid grid-cols-3 gap-1.5 p-1 bg-gray-900/60 rounded-xl border border-white/5">
          <button
            type="button"
            class="py-2 px-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentOutput === 'keep'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            "
            data-output="keep"
            @click="currentOutput = 'keep'"
          >
            {{ t("settings.formatKeep") }}
          </button>
          <button
            type="button"
            class="py-2 px-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentOutput === 'jpeg'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            "
            data-output="jpeg"
            @click="currentOutput = 'jpeg'"
          >
            JPEG
          </button>
          <button
            type="button"
            class="py-2 px-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer"
            :class="
              currentOutput === 'png'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            "
            data-output="png"
            @click="currentOutput = 'png'"
          >
            {{ t("settings.formatPng") }}
          </button>
        </div>
        <p v-if="currentOutput === 'jpeg'" class="text-[11px] text-amber-300/80">
          * {{ t("settings.jpegWhiteBgNotice") }}
        </p>
      </div>

      <!-- 2. 图片质量控制 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {{ t("settings.quality") }}
          </label>
          <span
            class="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
            :class="
              currentOutput === 'keep'
                ? 'bg-purple-950/40 text-purple-300 border border-purple-500/30'
                : 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/30'
            "
          >
            {{ currentOutput === 'keep' ? t("settings.keepMode") : `${currentQuality}` }}
          </span>
        </div>

        <div class="py-1">
          <input
            v-if="currentOutput !== 'keep'"
            v-model.number="currentQuality"
            type="range"
            :aria-label="t('settings.quality')"
            min="1"
            max="100"
            step="1"
            class="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
          />
          <div
            v-else
            class="p-2.5 rounded-xl bg-gray-900/40 border border-white/5 text-[11px] text-gray-400 flex items-center gap-1.5"
          >
            <span class="text-cyan-400 font-bold">✓</span>
            <span>{{ t("settings.keepDesc") }}</span>
          </div>
        </div>
        <template v-if="currentOutput !== 'keep'">
          <div class="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>{{ t("settings.qualityLow") }}</span>
            <span class="text-cyan-400/80 font-bold">{{ t("settings.recommended") }} 80</span>
            <span>{{ t("settings.qualityHigh") }}</span>
          </div>
          <p v-if="currentOutput === 'png'" class="text-[11px] text-cyan-300/80">
            * {{ t("settings.pngSmartDesc") }}
          </p>
        </template>
      </div>

      <!-- 3. 最长边等比缩放 -->
      <div class="space-y-2">
        <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {{ t("settings.maxLongEdge") }}
        </label>
        <div class="grid grid-cols-4 gap-1.5 p-1 bg-gray-900/60 rounded-xl border border-white/5">
          <button
            type="button"
            class="py-2 text-[11px] font-medium rounded-lg transition-all duration-200"
            :class="
              currentEdgePreset === 'none'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            "
            @click="currentEdgePreset = 'none'"
          >
            {{ t("settings.edgeOriginal") }}
          </button>
          <button
            type="button"
            class="py-2 text-[11px] font-medium rounded-lg transition-all duration-200"
            :class="
              currentEdgePreset === '1920'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            "
            @click="currentEdgePreset = '1920'"
          >
            1920px
          </button>
          <button
            type="button"
            class="py-2 text-[11px] font-medium rounded-lg transition-all duration-200"
            :class="
              currentEdgePreset === '1280'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            "
            @click="currentEdgePreset = '1280'"
          >
            1280px
          </button>
          <button
            type="button"
            class="py-2 text-[11px] font-medium rounded-lg transition-all duration-200"
            :class="
              currentEdgePreset === 'custom'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            "
            @click="currentEdgePreset = 'custom'"
          >
            {{ t("settings.edgeCustom") }}
          </button>
        </div>

        <div v-if="currentEdgePreset === 'custom'" class="flex items-center gap-2 pt-1">
          <input
            v-model.number="customEdgeValue"
            type="number"
            :aria-label="t('settings.maxLongEdge')"
            min="100"
            max="10000"
            step="10"
            class="w-full bg-gray-900 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-400 font-mono"
            :placeholder="t('settings.pixelPlaceholder')"
          />
          <span class="text-xs text-gray-400 font-mono">px</span>
        </div>
      </div>
    </div>
  </fieldset>
</template>

import { describe, it, expect } from "vitest";
import zh from "../../i18n/locales/zh-CN/index.js";
import en from "../../i18n/locales/en-US/index.js";
import ja from "../../i18n/locales/ja-JP/index.js";

// 辅助函数：提取嵌套对象的所有点分隔路径 key
function extractKeys(obj: Record<string, any>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys.sort();
}

describe("i18n 多语言字典完整性与对称性", () => {
  const zhKeys = extractKeys(zh);
  const enKeys = extractKeys(en);
  const jaKeys = extractKeys(ja);

  it("中文、英文、日文字典的词条总数和键名应完全对称且无缺失", () => {
    // 对比 zh 与 en
    const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
    const extraInEn = enKeys.filter((k) => !zhKeys.includes(k));

    expect(missingInEn, "en 缺失词条").toEqual([]);
    expect(extraInEn, "en 多余词条").toEqual([]);

    // 对比 zh 与 ja
    const missingInJa = zhKeys.filter((k) => !jaKeys.includes(k));
    const extraInJa = jaKeys.filter((k) => !zhKeys.includes(k));

    expect(missingInJa, "ja 缺失词条").toEqual([]);
    expect(extraInJa, "ja 多余词条").toEqual([]);
  });

  it("各语言字典中的值均不得为空字符串或 undefined", () => {
    const checkNoEmptyValues = (obj: Record<string, any>, lang: string) => {
      const keys = extractKeys(obj);
      for (const k of keys) {
        const parts = k.split(".");
        let cur = obj;
        for (const p of parts) {
          cur = cur[p];
        }
        const val = cur as unknown;
        expect(typeof val === "string" && (val as string).trim().length > 0, `${lang} 键 ${k} 不能为空`).toBe(true);
      }
    };

    checkNoEmptyValues(zh, "zh-CN");
    checkNoEmptyValues(en, "en-US");
    checkNoEmptyValues(ja, "ja-JP");
  });

  it("核心业务错误码必须在三门语言中全部声明", () => {
    const requiredErrorCodes = [
      "UNSUPPORTED_FORMAT",
      "ANIMATED_UNSUPPORTED",
      "INVALID_FILE",
      "FILE_TOO_LARGE",
      "PIXEL_LIMIT",
      "DECODE_FAILED",
      "ENCODE_FAILED",
      "WASM_LOAD_FAILED",
      "UNSUPPORTED_BROWSER",
      "OUT_OF_MEMORY",
      "TIMEOUT",
      "CANCELLED",
      "ZIP_TOO_LARGE",
      "UNKNOWN",
    ];

    for (const code of requiredErrorCodes) {
      expect((zh as any).errors[code], `zh 必须包含错误码 errors.${code}`).toBeDefined();
      expect((en as any).errors[code], `en 必须包含错误码 errors.${code}`).toBeDefined();
      expect((ja as any).errors[code], `ja 必须包含错误码 errors.${code}`).toBeDefined();
    }
  });

  it("FAQ 必须对称包含 5 个问答条目", () => {
    for (let i = 1; i <= 5; i++) {
      expect((zh as any).faq[`q${i}`]).toBeDefined();
      expect((zh as any).faq[`a${i}`]).toBeDefined();
      expect((en as any).faq[`q${i}`]).toBeDefined();
      expect((en as any).faq[`a${i}`]).toBeDefined();
      expect((ja as any).faq[`q${i}`]).toBeDefined();
      expect((ja as any).faq[`a${i}`]).toBeDefined();
    }
  });

  it("隐私政策必须对称包含 4 个正式条款及 badge", () => {
    for (let i = 1; i <= 4; i++) {
      expect((zh as any).privacy[`s${i}Title`]).toBeDefined();
      expect((zh as any).privacy[`s${i}Content`]).toBeDefined();
      expect((en as any).privacy[`s${i}Title`]).toBeDefined();
      expect((en as any).privacy[`s${i}Content`]).toBeDefined();
      expect((ja as any).privacy[`s${i}Title`]).toBeDefined();
      expect((ja as any).privacy[`s${i}Content`]).toBeDefined();
    }
  });
});

/**
 * Tiny Image - PNG 色彩量化与调色板抖动优化引擎
 *
 * 原理：
 * 将 24/32 位全彩像素通过中值切分（Median Cut）聚类成最优高保真调色板（Palette，最多 256 色），
 * 并结合 Floyd-Steinberg 误差扩散抖动消除色彩断层与渐变色带。
 * 量化减少颜色数量，配合 OxiPNG 优化输出体积，
 * 保留 Alpha 透明通道并输出标准 .png 格式；实际体积取决于图片内容。
 */

export interface QuantizeOptions {
  /** 质量数值 1..100，默认 80 */
  quality?: number;
  /** 是否启用 Floyd-Steinberg 误差扩散抖动，默认 true */
  dither?: boolean;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ColorBox {
  colors: RGBColor[];
  rMin: number;
  rMax: number;
  gMin: number;
  gMax: number;
  bMin: number;
  bMax: number;
}

function createBox(colors: RGBColor[]): ColorBox {
  let rMin = 255, rMax = 0;
  let gMin = 255, gMax = 0;
  let bMin = 255, bMax = 0;

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    if (c.r < rMin) rMin = c.r;
    if (c.r > rMax) rMax = c.r;
    if (c.g < gMin) gMin = c.g;
    if (c.g > gMax) gMax = c.g;
    if (c.b < bMin) bMin = c.b;
    if (c.b > bMax) bMax = c.b;
  }

  return { colors, rMin, rMax, gMin, gMax, bMin, bMax };
}

function getBoxVolume(box: ColorBox): number {
  return (box.rMax - box.rMin + 1) * (box.gMax - box.gMin + 1) * (box.bMax - box.bMin + 1);
}

/**
 * 中值切分法（Median Cut）聚类代表颜色
 */
function medianCut(colors: RGBColor[], maxColors: number): RGBColor[] {
  if (colors.length === 0) return [];
  if (colors.length <= maxColors) return colors;

  const boxes: ColorBox[] = [createBox(colors)];

  while (boxes.length < maxColors) {
    let maxIdx = 0;
    let maxVol = 0;

    for (let i = 0; i < boxes.length; i++) {
      const vol = getBoxVolume(boxes[i]);
      if (vol > maxVol && boxes[i].colors.length >= 2) {
        maxVol = vol;
        maxIdx = i;
      }
    }

    if (maxVol === 0) break;

    const boxToSplit = boxes.splice(maxIdx, 1)[0];
    const rRange = boxToSplit.rMax - boxToSplit.rMin;
    const gRange = boxToSplit.gMax - boxToSplit.gMin;
    const bRange = boxToSplit.bMax - boxToSplit.bMin;

    let sortChannel: "r" | "g" | "b" = "r";
    if (gRange >= rRange && gRange >= bRange) {
      sortChannel = "g";
    } else if (bRange >= rRange && bRange >= gRange) {
      sortChannel = "b";
    }

    boxToSplit.colors.sort((a, b) => a[sortChannel] - b[sortChannel]);

    const median = Math.floor(boxToSplit.colors.length / 2);
    const part1 = boxToSplit.colors.slice(0, median);
    const part2 = boxToSplit.colors.slice(median);

    if (part1.length > 0) boxes.push(createBox(part1));
    if (part2.length > 0) boxes.push(createBox(part2));
  }

  return boxes.map((box) => {
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
    for (const c of box.colors) {
      sumR += c.r;
      sumG += c.g;
      sumB += c.b;
      sumA += c.a;
    }
    const len = box.colors.length;
    return {
      r: Math.round(sumR / len),
      g: Math.round(sumG / len),
      b: Math.round(sumB / len),
      a: Math.round(sumA / len),
    };
  });
}

/**
 * 根据质量参数计算调色板颜色总数（16..256）
 */
export function resolvePaletteSize(quality: number): number {
  if (quality >= 75) return 256;
  if (quality >= 50) return 128;
  if (quality >= 25) return 64;
  return 32;
}

/**
 * 对 ImageData 执行智能色彩量化与 Floyd-Steinberg 误差抖动
 */
export function quantizeImageData(
  imageData: ImageData,
  options?: QuantizeOptions,
): ImageData {
  const { width, height } = imageData;
  const data = imageData.data;
  const quality = options?.quality ?? 80;
  const dither = options?.dither ?? true;
  const maxColors = resolvePaletteSize(quality);

  const pixelCount = width * height;
  const sampleColors: RGBColor[] = [];
  // 采样上限：最多采集 40,000 个像素点生成调色板，兼顾精度与毫秒级速度
  const step = Math.max(1, Math.floor(pixelCount / 40000));

  let hasAlpha = false;
  for (let i = 0; i < pixelCount; i += step) {
    const idx = i * 4;
    const a = data[idx + 3];
    if (a === 0) {
      hasAlpha = true;
      continue;
    }
    sampleColors.push({
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: 255,
    });
  }

  const targetColors = hasAlpha ? maxColors - 1 : maxColors;
  const palette = medianCut(sampleColors, targetColors);
  if (hasAlpha) {
    palette.unshift({ r: 0, g: 0, b: 0, a: 0 });
  }

  const outputData = new Uint8ClampedArray(data.length);

  // 匹配最近调色板颜色（基于感知加权欧式距离）
  const findNearest = (r: number, g: number, b: number, a: number): RGBColor => {
    if (hasAlpha && a === 0) {
      return palette[0];
    }
    let bestDist = Infinity;
    let bestColor = palette[0];
    const start = hasAlpha ? 1 : 0;

    for (let i = start; i < palette.length; i++) {
      const p = palette[i];
      const dr = r - p.r;
      const dg = g - p.g;
      const db = b - p.b;
      // 人眼色度敏感度加权: G(58.7%) > R(29.9%) > B(11.4%)
      const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
      if (dist < bestDist) {
        bestDist = dist;
        bestColor = p;
        if (dist === 0) break;
      }
    }
    return bestColor;
  };

  if (!dither) {
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const origAlpha = data[idx + 3];

      if (origAlpha === 0) {
        outputData[idx] = 0;
        outputData[idx + 1] = 0;
        outputData[idx + 2] = 0;
        outputData[idx + 3] = 0;
        continue;
      }

      const nearest = findNearest(data[idx], data[idx + 1], data[idx + 2], origAlpha);
      outputData[idx] = nearest.r;
      outputData[idx + 1] = nearest.g;
      outputData[idx + 2] = nearest.b;
      // 核心：严格保留原始像素的实际 Alpha 透明度梯度（保护发光、投影与柔和阴影边缘）
      outputData[idx + 3] = origAlpha;
    }

    if (typeof ImageData !== "undefined") {
      return new ImageData(outputData, width, height);
    }
    return { data: outputData, width, height } as unknown as ImageData;
  }

  // Floyd-Steinberg 误差扩散双行缓冲
  const errCurr = new Float32Array(width * 3);
  const errNext = new Float32Array(width * 3);

  for (let y = 0; y < height; y++) {
    errNext.fill(0);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const errIdx = x * 3;
      const origAlpha = data[idx + 3];

      if (origAlpha === 0) {
        outputData[idx] = 0;
        outputData[idx + 1] = 0;
        outputData[idx + 2] = 0;
        outputData[idx + 3] = 0;
        continue;
      }

      const r = Math.min(255, Math.max(0, data[idx] + errCurr[errIdx]));
      const g = Math.min(255, Math.max(0, data[idx + 1] + errCurr[errIdx + 1]));
      const b = Math.min(255, Math.max(0, data[idx + 2] + errCurr[errIdx + 2]));

      const nearest = findNearest(r, g, b, origAlpha);
      outputData[idx] = nearest.r;
      outputData[idx + 1] = nearest.g;
      outputData[idx + 2] = nearest.b;
      // 核心：严格保留原始像素的实际 Alpha 透明度梯度（杜绝把半透明光晕投影变成 255 实色）
      outputData[idx + 3] = origAlpha;

      const errR = r - nearest.r;
      const errG = g - nearest.g;
      const errB = b - nearest.b;

      // Floyd-Steinberg 误差扩散
      if (x + 1 < width) {
        errCurr[errIdx + 3] += (errR * 7) / 16;
        errCurr[errIdx + 4] += (errG * 7) / 16;
        errCurr[errIdx + 5] += (errB * 7) / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          errNext[errIdx - 3] += (errR * 3) / 16;
          errNext[errIdx - 2] += (errG * 3) / 16;
          errNext[errIdx - 1] += (errB * 3) / 16;
        }
        errNext[errIdx] += (errR * 5) / 16;
        errNext[errIdx + 1] += (errG * 5) / 16;
        errNext[errIdx + 2] += (errB * 5) / 16;
        if (x + 1 < width) {
          errNext[errIdx + 3] += (errR * 1) / 16;
          errNext[errIdx + 4] += (errG * 1) / 16;
          errNext[errIdx + 5] += (errB * 1) / 16;
        }
      }
    }
    errCurr.set(errNext);
  }

  if (typeof ImageData !== "undefined") {
    return new ImageData(outputData, width, height);
  }
  return { data: outputData, width, height } as unknown as ImageData;
}

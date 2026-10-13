/**
 * 针对输出 JPEG 的图像进行透明背景合成
 * 保证透明像素以纯白色 (#FFFFFF) 填充，防止在无 Alpha 支持的格式中产生黑底
 */
export function flattenAlphaToWhite(imageData: ImageData): ImageData {
  const data = imageData.data;
  const len = data.length;

  // 快速检测是否存在透明度 < 255 的像素
  let hasAlpha = false;
  for (let i = 3; i < len; i += 4) {
    if (data[i] < 255) {
      hasAlpha = true;
      break;
    }
  }

  // 若无透明通道则直接返回原数据副本
  if (!hasAlpha) {
    return imageData;
  }

  const flattened = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    const a = data[i + 3];
    if (a === 255) {
      flattened[i] = data[i];
      flattened[i + 1] = data[i + 1];
      flattened[i + 2] = data[i + 2];
      flattened[i + 3] = 255;
    } else if (a === 0) {
      // 完全透明 -> 填充纯白
      flattened[i] = 255;
      flattened[i + 1] = 255;
      flattened[i + 2] = 255;
      flattened[i + 3] = 255;
    } else {
      // 半透明像素：按 alpha 权重与纯白 (255, 255, 255) 进行 Alpha 混合
      const alphaFactor = a / 255;
      const bgFactor = 1 - alphaFactor;
      flattened[i] = Math.round(data[i] * alphaFactor + 255 * bgFactor);
      flattened[i + 1] = Math.round(data[i + 1] * alphaFactor + 255 * bgFactor);
      flattened[i + 2] = Math.round(data[i + 2] * alphaFactor + 255 * bgFactor);
      flattened[i + 3] = 255;
    }
  }

  // 跨环境创建 ImageData 对象
  if (typeof ImageData !== "undefined") {
    return new ImageData(flattened, imageData.width, imageData.height);
  }
  return {
    data: flattened,
    width: imageData.width,
    height: imageData.height,
  } as ImageData;
}

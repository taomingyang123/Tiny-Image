/**
 * 基于双线性插值 (Bilinear Interpolation) 对 ImageData 进行重采样缩放
 * 纯算法实现，不依赖 DOM / Canvas / 外部二进制，在 Web Worker 中 100% 可用且保真
 */
export function resizeImageData(
  source: ImageData,
  targetWidth: number,
  targetHeight: number,
): ImageData {
  const { width: srcW, height: srcH, data: srcData } = source;

  if (srcW === targetWidth && srcH === targetHeight) {
    return source;
  }

  const dstData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const xRatio = (srcW - 1) / Math.max(1, targetWidth - 1);
  const yRatio = (srcH - 1) / Math.max(1, targetHeight - 1);

  for (let y = 0; y < targetHeight; y++) {
    const srcY = y * yRatio;
    const yFloor = Math.floor(srcY);
    const yCeil = Math.min(srcH - 1, Math.ceil(srcY));
    const yWeight = srcY - yFloor;

    const rowFloorOffset = yFloor * srcW * 4;
    const rowCeilOffset = yCeil * srcW * 4;
    const dstRowOffset = y * targetWidth * 4;

    for (let x = 0; x < targetWidth; x++) {
      const srcX = x * xRatio;
      const xFloor = Math.floor(srcX);
      const xCeil = Math.min(srcW - 1, Math.ceil(srcX));
      const xWeight = srcX - xFloor;

      const p00 = rowFloorOffset + xFloor * 4;
      const p10 = rowFloorOffset + xCeil * 4;
      const p01 = rowCeilOffset + xFloor * 4;
      const p11 = rowCeilOffset + xCeil * 4;

      const dstOffset = dstRowOffset + x * 4;

      for (let c = 0; c < 4; c++) {
        // 双线性加权
        const top = srcData[p00 + c] * (1 - xWeight) + srcData[p10 + c] * xWeight;
        const bottom = srcData[p01 + c] * (1 - xWeight) + srcData[p11 + c] * xWeight;
        dstData[dstOffset + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }

  if (typeof ImageData !== "undefined") {
    return new ImageData(dstData, targetWidth, targetHeight);
  }
  return {
    data: dstData,
    width: targetWidth,
    height: targetHeight,
  } as ImageData;
}

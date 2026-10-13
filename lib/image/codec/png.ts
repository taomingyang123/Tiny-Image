/**
 * PNG 编解码适配器 (OxiPNG 二进制优化 + PNG WASM 解码)
 */
export async function optimisePng(
  bufferOrImageData: ArrayBuffer | ImageData,
  level: number = 2,
): Promise<ArrayBuffer> {
  const { optimise } = await import("@jsquash/oxipng");
  return optimise(bufferOrImageData, { level });
}

export async function decodePng(buffer: ArrayBuffer): Promise<ImageData> {
  const { decode } = await import("@jsquash/png");
  return decode(buffer);
}

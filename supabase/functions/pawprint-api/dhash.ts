/** Pure 64-bit difference hash helpers. Kept separate so the image policy can
 * be tested without uploading a real photo or exposing user data. */
export function dHashFromRgba(data: Uint8Array, width: number, height: number): string | null {
  if (!width || !height || data.length < width * height * 4) return null;
  const gray = (x: number, y: number) => {
    const sourceX = Math.min(width - 1, Math.round((x / 8) * (width - 1)));
    const sourceY = Math.min(height - 1, Math.round((y / 7) * (height - 1)));
    const offset = (sourceY * width + sourceX) * 4;
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? red;
    const blue = data[offset + 2] ?? red;
    return (red * 299 + green * 587 + blue * 114) / 1000;
  };
  let value = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      value = (value << 1n) | BigInt(gray(x, y) > gray(x + 1, y) ? 1 : 0);
    }
  }
  return value.toString(16).padStart(16, "0");
}

export function hammingDistance(left: string, right: string) {
  if (!/^[0-9a-f]{16}$/i.test(left) || !/^[0-9a-f]{16}$/i.test(right)) return 64;
  let bits = 0n;
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  while (value) { bits += value & 1n; value >>= 1n; }
  return Number(bits);
}

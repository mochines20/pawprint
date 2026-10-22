import { dHashFromRgba, hammingDistance } from "./dhash.ts";

function image(rows: number[][]) {
  const height = rows.length;
  const width = rows[0]?.length || 0;
  const data = new Uint8Array(width * height * 4);
  rows.forEach((row, y) => row.forEach((value, x) => {
    const offset = (y * width + x) * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }));
  return { data, width, height };
}

Deno.test("dHash is 64-bit and stable for the same pixels", () => {
  const sample = image(Array.from({ length: 8 }, (_, y) => Array.from({ length: 9 }, (_, x) => (x + y) % 2 ? 255 : 0)));
  const first = dHashFromRgba(sample.data, sample.width, sample.height);
  const second = dHashFromRgba(sample.data, sample.width, sample.height);
  if (!first || first.length !== 16 || first !== second) throw new Error("dHash was not stable");
});

Deno.test("near-identical hashes are within the duplicate threshold", () => {
  if (hammingDistance("ffffffffffffffff", "fffffffffffffff0") !== 4) throw new Error("Hamming distance is incorrect");
  if (hammingDistance("ffffffffffffffff", "0000000000000000") !== 64) throw new Error("Hamming distance maximum is incorrect");
});

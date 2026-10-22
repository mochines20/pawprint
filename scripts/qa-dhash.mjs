import assert from "node:assert/strict";
import { dHashFromRgba, hammingDistance } from "../supabase/functions/pawprint-api/dhash.ts";

function grayscaleImage(rows) {
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

const sample = grayscaleImage(Array.from({ length: 8 }, (_, y) => Array.from({ length: 9 }, (_, x) => (x + y) % 2 ? 255 : 0)));
const first = dHashFromRgba(sample.data, sample.width, sample.height);
const second = dHashFromRgba(sample.data, sample.width, sample.height);
assert.match(first || "", /^[0-9a-f]{16}$/);
assert.equal(first, second);
assert.equal(hammingDistance("ffffffffffffffff", "fffffffffffffff0"), 4);
assert.equal(hammingDistance("ffffffffffffffff", "0000000000000000"), 64);
console.log("dHash QA passed: stable 64-bit hash and correct Hamming distance.");

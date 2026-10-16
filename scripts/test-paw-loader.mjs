import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../assets/paw-loader.js", import.meta.url), "utf8");

test("PawLoader exposes only the production variants", () => {
  for (const variant of ["paws", "pin", "tap"]) {
    assert.match(source, new RegExp(`${variant}:`));
  }
  assert.match(source, /const VARIANTS = new Set\(\["paws", "pin", "tap"\]\)/);
  assert.doesNotMatch(source, /variant: 'chase'/);
});

test("each SVG is status-labelled and aria-hidden", () => {
  assert.ok((source.match(/<svg[^>]+aria-hidden="true"/g) || []).length >= 4);
  assert.match(source, /setAttribute\('role', 'status'\)/);
  assert.match(source, /setAttribute\('aria-live', 'polite'\)/);
  assert.match(source, /setAttribute\('aria-label', options\.label\)/);
});

test("loader timing avoids flicker and holds a visible loader", () => {
  assert.match(source, /const MIN_DELAY = 200/);
  assert.match(source, /const MIN_VISIBLE = 400/);
  assert.match(source, /setTimeout\(reveal, MIN_DELAY\)/);
  assert.match(source, /MIN_VISIBLE - \(performance\.now\(\) - shownAt\)/);
});

test("copy includes English and Filipino large-loader messages", () => {
  for (const phrase of ["Sniffing around...", "Checking for a cat...", "Counting whiskers...", "Almost there...", "Hinahanap ang pusa...", "Sinisilip kung may pusa...", "Konti na lang..."]) {
    assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /}, 2500\)/);
});

test("reduced motion uses a calm opacity-only alternative", () => {
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /animation: pawloader-calm 1s ease-in-out infinite/);
  assert.match(source, /@keyframes pawloader-calm/);
});

test("the loader reserves responsive space and uses the Pawprint token palette", () => {
  for (const token of ["--paw-ink: #151515", "--paw-paper: #FAF8F4", "--paw-stone: #8C8A84", "--paw-line: #E4E1DA", "--paw-amber: #FFB400", "--paw-care: #D9402B"]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /min-height: 10rem/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
});

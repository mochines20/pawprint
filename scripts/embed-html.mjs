import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const template = fs.readFileSync(path.join(root, "worker", "index.template.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist", "index.html"), "utf8");
const sneakPeek = fs.readFileSync(path.join(root, "assets", "pawprint-sneak-peek.gif")).toString("base64");
const sneakPeekSvg = fs.readFileSync(path.join(root, "assets", "pawprint-sneakpeek.svg"), "utf8");
const icon = fs.readFileSync(path.join(root, "assets", "pawprint-icon.svg"), "utf8");
const output = template
  .replace("__PAWPRINT_HTML__", JSON.stringify(html))
  .replace("__PAWPRINT_SNEAK_PEEK_GIF__", sneakPeek)
  .replace("__PAWPRINT_SNEAK_PEEK_SVG__", JSON.stringify(sneakPeekSvg))
  .replace("__PAWPRINT_ICON_SVG__", JSON.stringify(icon));
fs.mkdirSync(path.join(root, "dist", "server"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "server", "index.js"), output);
console.log("Generated dist/server/index.js");

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const template = fs.readFileSync(path.join(root, "worker", "index.template.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist", "index.html"), "utf8");
const output = template.replace("__PAWPRINT_HTML__", JSON.stringify(html));
fs.mkdirSync(path.join(root, "dist", "server"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "server", "index.js"), output);
console.log("Generated dist/server/index.js");

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "dist", ".openai", "hosting.json"), "utf8"));
const worker = fs.readFileSync(path.join(root, "dist", "server", "index.js"), "utf8");
if (manifest.project_id !== "appgprj_6ad040da867c8191b7a3af555277c943") throw new Error("Wrong Site project id");
if (manifest.static || !Object.prototype.hasOwnProperty.call(manifest.d1 || {}, "DB") || !Object.prototype.hasOwnProperty.call(manifest.r2 || {}, "BUCKET")) throw new Error("Worker bindings are missing");
if (!worker.includes("export default") || !worker.includes("/api/sightings")) throw new Error("Worker routes are missing");
console.log("Validated Pawprint Worker artifact");

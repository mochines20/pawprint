import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "dist", ".openai", "hosting.json"), "utf8"));
if (manifest.project_id !== "appgprj_6ad040da867c8191b7a3af555277c943") throw new Error("Wrong Site project id");
const html = fs.readFileSync(path.join(root, "dist", "index.html"), "utf8");
if (!html.includes("supabase-auth-gate.js") || !html.includes("/api/sightings")) throw new Error("Pawprint browser routes are missing");
console.log("Validated Pawprint browser artifact; Supabase is the application backend");

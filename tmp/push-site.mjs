import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const input = JSON.parse(readFileSync(0, "utf8"));
const credential = input.credential;
const root = process.cwd();
const clone = path.join(root, "tmp", "pawprint-push");
rmSync(clone, { recursive: true, force: true });
mkdirSync(path.dirname(clone), { recursive: true });

const authEnv = { ...process.env, SITES_GIT_AUTHORIZATION: `Authorization: Bearer ${credential.token}` };
const authArgs = ["-c", "credential.helper=", "-c", "http.extraHeader=", `--config-env=http.${credential.remote_url}.extraHeader=SITES_GIT_AUTHORIZATION`];
function run(args, options = {}) {
  const result = spawnSync("git", [...authArgs, ...args], { env: authEnv, encoding: "utf8", stdio: options.stdio ?? "inherit", ...options });
  if (result.status !== 0) process.exit(result.status || 1);
  return result;
}

run(["clone", "--branch", credential.branch, credential.remote_url, clone]);
const excluded = new Set([".git", ".agents", ".codex", ".sites-checkout", "node_modules", ".sites-runtime", "tmp"]);
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  cpSync(path.join(root, entry.name), path.join(clone, entry.name), { recursive: entry.isDirectory(), force: true, errorOnExist: false });
}
run(["-C", clone, "add", "--all", "--", "."]);
const commit = spawnSync("git", ["-C", clone, "-c", "user.name=Sites", "-c", "user.email=sites@users.noreply.openai.com", "commit", "-m", "Replace landing diamond with cat paw"], { env: authEnv, encoding: "utf8", stdio: "inherit" });
if (commit.status !== 0 && commit.status !== 1) process.exit(commit.status || 1);
const head = spawnSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
run(["-C", clone, "push", credential.remote_url, `${head}:refs/heads/${credential.branch}`]);
console.log(JSON.stringify({ commit_sha: head, checkout_path: clone }));

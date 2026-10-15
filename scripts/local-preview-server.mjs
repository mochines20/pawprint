import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, normalize, resolve, sep } from "node:path";

const root = resolve(process.cwd(), process.argv[2] || "dist");
const port = Number(process.env.PAWPRINT_PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

function safePath(requestPath) {
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const target = resolve(root, normalize(relative));
  return target.startsWith(`${root}${sep}`) ? target : null;
}

async function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = await readFile(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#") || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

await loadLocalEnv();

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/auth/config") {
    const supabaseUrl = process.env.PAWPRINT_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.PAWPRINT_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      enabled: Boolean(supabaseUrl && supabaseAnonKey),
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    }));
    return;
  }
  if (url.pathname === "/api/journal" && request.method === "GET") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ entries: [], demo: true }));
    return;
  }
  if (url.pathname === "/api/dashboard" && request.method === "GET") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ streak: { current: 4, best: 7 }, journal: { unique: 8 }, xp: 248, sightings: [], demo: true }));
    return;
  }
  if (url.pathname === "/api/me" && request.method === "GET") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ user: null, demo: true }));
    return;
  }
  if (url.pathname === "/api/care-flags" && request.method === "GET") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ flags: [], demo: true }));
    return;
  }
  if (url.pathname === "/api/sightings" && request.method === "GET") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ sightings: [], demo: true }));
    return;
  }
  if (url.pathname === "/favicon.ico" && request.method === "GET") {
    const icon = await readFile(resolve(root, "assets", "pawprint-icon.svg"));
    response.writeHead(200, { "cache-control": "public, max-age=3600", "content-type": "image/svg+xml" });
    response.end(icon);
    return;
  }
  const target = safePath(url.pathname);
  if (!target || !existsSync(target)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes[extname(target).toLowerCase()] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Preview server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pawprint localhost preview: http://localhost:${port}`);
});

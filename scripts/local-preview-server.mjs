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
  ".webp": "image/webp",
};

function safePath(requestPath) {
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const target = resolve(root, normalize(relative));
  return target.startsWith(`${root}${sep}`) ? target : null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/auth/config") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ enabled: false, url: "", anonKey: "" }));
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

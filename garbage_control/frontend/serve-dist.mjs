import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const indexFile = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypes[ext] || "application/octet-stream";

  res.writeHead(statusCode, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPath = path.normalize(path.join(distDir, relativePath));

  if (!resolvedPath.startsWith(distDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(resolvedPath, (statError, stats) => {
    if (!statError && stats.isFile()) {
      sendFile(res, resolvedPath);
      return;
    }

    fs.stat(indexFile, (indexError, indexStats) => {
      if (indexError || !indexStats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("dist/index.html not found");
        return;
      }

      sendFile(res, indexFile);
    });
  });
});

server.listen(port, host, () => {
  console.log(`Serving dist on http://${host}:${port}`);
});

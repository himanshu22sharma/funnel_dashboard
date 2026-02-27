#!/usr/bin/env node
/**
 * Serves the static export so that basePath /Lending_Dashboard_v1 works.
 * Run after: npm run build
 * Then open: http://localhost:3000/Lending_Dashboard_v1/
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const BASE = "/Lending_Dashboard_v1";
const OUT_DIR = path.join(__dirname, "out");

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain",
};

function send(res, status, body, contentType) {
  res.writeHead(status, { "Content-Type": contentType || "text/plain" });
  res.end(body);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => send(res, 404, "Not Found", "text/plain"));
  stream.on("open", () => {
    res.writeHead(200, { "Content-Type": contentType });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  let p = url.pathname;

  // Root → redirect to app
  if (p === "/" || p === "") {
    res.writeHead(302, { Location: BASE + "/" });
    res.end();
    return;
  }

  // Strip base path to get file path under out/
  if (!p.startsWith(BASE + "/") && p !== BASE) {
    send(res, 404, "Not Found. Use " + BASE + "/", "text/plain");
    return;
  }

  const relative = p.slice(BASE.length) || "/";
  const filePath = path.join(OUT_DIR, relative === "/" ? "index.html" : relative);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Try adding .html for clean URLs (e.g. /insights-summary)
      const withHtml = path.join(OUT_DIR, relative === "/" ? "index.html" : relative + ".html");
      fs.stat(withHtml, (e2, s2) => {
        if (e2 || !s2?.isFile()) {
          send(res, 404, "Not Found", "text/plain");
          return;
        }
        serveFile(res, withHtml);
      });
      return;
    }
    serveFile(res, filePath);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  Dashboard (static) at:");
  console.log("  → http://localhost:" + PORT + BASE + "/");
  console.log("");
});

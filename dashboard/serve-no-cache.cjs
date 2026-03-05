/**
 * Serves the "out" folder with no-cache headers so the browser always loads
 * the latest build. Run after: PREVIEW=1 npm run build
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out");
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(OUT) || !fs.existsSync(path.join(OUT, "index.html"))) {
  console.error("\n  ERROR: No build found. Run first: npm run preview");
  console.error("  (That builds the app and then starts this server.)\n");
  process.exit(1);
}

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const NO_CACHE = "no-store, no-cache, must-revalidate, max-age=0";

const server = http.createServer((req, res) => {
  let url = req.url || "/";
  const q = url.indexOf("?");
  if (q >= 0) url = url.slice(0, q);
  // Strip basePath so /Lending_Dashboard_v1/disbursal-summary and /disbursal-summary both work
  if (url.startsWith("/Lending_Dashboard_v1")) url = url.slice("/Lending_Dashboard_v1".length) || "/";
  if (url === "/") url = "/index.html";
  // Normalize: path.join(OUT, "/x") can be wrong on some platforms; use relative segment
  const rel = url.replace(/^\//, "") || "index.html";
  const file = path.join(OUT, rel);

  const setNoCache = () => {
    res.setHeader("Cache-Control", NO_CACHE);
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  };

  const tryFile = (f, cb) => {
    fs.stat(f, (err, stat) => {
      if (!err && stat.isFile()) return cb(null, f);
      if (!f.endsWith(".html")) return tryFile(f + ".html", cb);
      cb(new Error("not found"));
    });
  };

  tryFile(file, (err, resolvedPath) => {
    if (err || !resolvedPath) {
      const index = path.join(OUT, "index.html");
      fs.readFile(index, (e, data) => {
        if (e) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          setNoCache();
          res.end("Not found");
          return;
        }
        setNoCache();
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      });
      return;
    }
    fs.readFile(resolvedPath, (e, data) => {
      if (e) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        setNoCache();
        res.end("Error");
        return;
      }
      const ext = path.extname(resolvedPath);
      const contentType = MIME[ext] || "application/octet-stream";
      setNoCache();
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("  Dashboard (no-cache) → http://localhost:" + PORT);
  console.log("  Browser will always load the latest build.");
  console.log("");
});

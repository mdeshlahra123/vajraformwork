// Local preview of /admin with the real api/admin.js (not deployed). node tests/admin.serve.mjs <sheets-token.json>
import fs from "node:fs"; import http from "node:http";
const tok = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.env.SHEETS_TOKEN = JSON.stringify({ client_id: tok.client_id, client_secret: tok.client_secret, refresh_token: tok.refresh_token });
process.env.ADMIN_PIN = "1234"; process.env.ADMIN_SECRET = "local-test-secret";
const { default: handler } = await import("../api/admin.js");
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/admin") {
    let b = ""; for await (const c of req) b += c;
    const r = { setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return r; },
      json(j) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(j)); } };
    return handler({ method: req.method, query: Object.fromEntries(u.searchParams), body: b, headers: req.headers }, r);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(fs.readFileSync(new URL("../admin.html", import.meta.url)));
}).listen(8765, () => console.log("http://localhost:8765/admin"));

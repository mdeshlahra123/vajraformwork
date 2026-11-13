// Local check of api/admin.js against the real sheet (not run in CI). Writes only the same value back.
import fs from "node:fs";
const tok = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.env.SHEETS_TOKEN = JSON.stringify({ client_id: tok.client_id, client_secret: tok.client_secret, refresh_token: tok.refresh_token });
process.env.ADMIN_PIN = "1234"; process.env.ADMIN_SECRET = "local-test-secret";
const { default: handler } = await import("../api/admin.js");

function call(a, { method = "GET", body, cookie = "", hdr = {} } = {}) {
  return new Promise((done) => {
    const res = { h: {}, code: 200, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
      json(j) { done({ code: this.code, j, cookie: this.h["Set-Cookie"] }); } };
    handler({ method, query: { a }, body, headers: { cookie, ...hdr } }, res);
  });
}
const t0 = Date.now(); let r = await call("login", { method: "POST", body: { pin: "0000" } });
console.log("wrong pin:", r.code, r.j.error, `(${Date.now() - t0} ms)`);
r = await call("orders"); console.log("orders without login:", r.code);
r = await call("login", { method: "POST", body: { pin: "1234" } });
const cookie = r.cookie.split(";")[0]; console.log("right pin:", r.code, "cookie flags:", r.cookie.split("; ").slice(1).join(" "));
r = await call("orders", { cookie }); const o = r.j.orders;
console.log("orders:", r.code, o.length, "rows | first:", o[0].row, o[0].name, o[0].status, "| last:", o.at(-1).row, o.at(-1).name, o.at(-1).month, o.at(-1).status);
console.log("tracking_sent values:", [...new Set(o.map((x) => x.tracking_sent))], "| feedback in use:", [...new Set(o.map((x) => x.feedback))]);
r = await call("update", { method: "POST", cookie, body: { row: o[0].row, field: "notes", value: o[0].notes } });
console.log("update without header:", r.code);
r = await call("update", { method: "POST", cookie, hdr: { "x-vajra-admin": "1" }, body: { row: o[0].row, field: "notes", value: o[0].notes } });
console.log("update same note back:", r.code, JSON.stringify(r.j));
r = await call("update", { method: "POST", cookie, hdr: { "x-vajra-admin": "1" }, body: { row: o[0].row, field: "status", value: "hacked" } });
console.log("bad status:", r.code, r.j.error);
r = await call("update", { method: "POST", cookie, hdr: { "x-vajra-admin": "1" }, body: { row: 400, field: "notes", value: "x" } });
console.log("empty row write:", r.code, r.j.error);
r = await call("update", { method: "POST", cookie, hdr: { "x-vajra-admin": "1" }, body: { row: 5, field: "name", value: "x" } });
console.log("column not allowed:", r.code, r.j.error);
r = await call("orders", { cookie: "vadm=9999999999." + "0".repeat(64) }); console.log("forged cookie:", r.code);

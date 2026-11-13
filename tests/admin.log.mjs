// Local check of ?a=log on one real row, then restores J, K, R:T exactly. node tests/admin.log.mjs <token> <row>
import fs from "node:fs";
const tok = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const ROW = Number(process.argv[3]);
process.env.SHEETS_TOKEN = JSON.stringify({ client_id: tok.client_id, client_secret: tok.client_secret, refresh_token: tok.refresh_token });
process.env.ADMIN_PIN = "1234"; process.env.ADMIN_SECRET = "local-test-secret";
const { default: handler } = await import("../api/admin.js");
const call = (a, { method = "GET", body, cookie = "" } = {}) => new Promise((done) => {
  const res = { h: {}, code: 200, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(j) { done({ code: this.code, j, cookie: this.h["Set-Cookie"] }); } };
  handler({ method, query: { a }, body, headers: { cookie, "x-vajra-admin": "1" } }, res);
});
// google token for the restore
const g = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: tok.client_id, client_secret: tok.client_secret }) })).json();
const SID = "1O2AqihNecxMMJ6hfqXhrAVP2JcOWN5dI8GlAAZliwSY";
const sheet = async (p, o = {}) => (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SID}/${p}`, { ...o, headers: { Authorization: "Bearer " + g.access_token, "Content-Type": "application/json" } })).json();
const before = (await sheet(`values/${encodeURIComponent(`Orders!A${ROW}:T${ROW}`)}`)).values[0];
console.log("before: status", before[9], "| notes", JSON.stringify(before[10] || ""), "| R:T", JSON.stringify(before.slice(17, 20)));
const cookie = (await call("login", { method: "POST", body: { pin: "1234" } })).cookie.split(";")[0];
try {
  for (let i = 1; i <= 3; i++) {
    const r = await call("log", { method: "POST", cookie, body: { row: ROW, outcome: "no_answer", note: i === 3 ? "test note" : "" } });
    console.log(`no_answer #${i}:`, r.code, JSON.stringify({ status: r.j.status, attempts: r.j.attempts, next: r.j.next, last: r.j.last, notes: r.j.notes }));
  }
  let r = await call("log", { method: "POST", cookie, body: { row: ROW, outcome: "call_back", next: "2026-11-20" } });
  console.log("call_back with date:", r.code, JSON.stringify({ status: r.j.status, attempts: r.j.attempts, next: r.j.next }));
  r = await call("log", { method: "POST", cookie, body: { row: ROW, outcome: "ordered" } });
  console.log("ordered:", r.code, JSON.stringify({ status: r.j.status, next: r.j.next }));
  r = await call("log", { method: "POST", cookie, body: { row: ROW, outcome: "bogus" } }); console.log("bad outcome:", r.code, r.j.error);
  r = await call("log", { method: "POST", cookie, body: { row: ROW, outcome: "talked", next: "13/11" } }); console.log("bad date:", r.code, r.j.error);
} finally {
  await sheet("values:batchUpdate", { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data: [
    { range: `Orders!J${ROW}:K${ROW}`, values: [[before[9] || "", before[10] || ""]] },
    { range: `Orders!R${ROW}:T${ROW}`, values: [[before[17] || "", before[18] || "", before[19] || ""]] }] }) });
  const after = (await sheet(`values/${encodeURIComponent(`Orders!A${ROW}:T${ROW}`)}`)).values[0];
  const same = JSON.stringify(after.slice(0, 20).map((x) => x || "")) === JSON.stringify(before.slice(0, 20).map((x) => x || "")) ||
    (after[9] === before[9] && (after[10] || "") === (before[10] || "") && !after.slice(17, 20).some(Boolean) === !before.slice(17, 20).some(Boolean));
  console.log("restored:", same ? "yes, row is as before" : "CHECK ROW " + ROW, "| status", after[9], "| R:T", JSON.stringify(after.slice(17, 20)));
}

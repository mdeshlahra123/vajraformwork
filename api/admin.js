// VAJRA admin: Orders sheet for the owners (page /admin). The Google Sheet stays the master copy.
// Env (Vercel project settings, never in this public repo):
//   SHEETS_TOKEN  Google OAuth JSON (client_id, client_secret, refresh_token) with the spreadsheets scope
//   ADMIN_PIN     shared PIN            ADMIN_SECRET  random string that signs the login cookie
// Routes (same file):  POST ?a=login {pin} | GET ?a=orders | POST ?a=update {row, field, value} | POST ?a=logout
// Only Status, Notes, Tracking ID, Tracking sent, Feedback can be written. Rows are never added or deleted.
import crypto from "node:crypto";

const SHEET_ID = "1O2AqihNecxMMJ6hfqXhrAVP2JcOWN5dI8GlAAZliwSY";
const TAB = "Orders";
const COLS = { status: "J", notes: "K", tracking: "L", tracking_sent: "N", feedback: "P" };
const STATUSES = ["⏳ Pending", "❌ Not sent", "📦 Sent", "✅ Delivered", "💰 Quote sent", "🤔 Thinking", "🧮 Needs cost estimate",
  "📐 Needs 5+ sheets", "📞 Call back", "🔥 Hot - ready to order", "🎉 Ordered", "📵 No answer", "🚫 Not interested"];
const FEEDBACK = ["", "Asked", "👍 Good", "😐 OK", "👎 Bad", "No reply", "Ordered"];
const TRACK = /^(?=.*\d)[A-Za-z0-9-]{8,}$/;      // same rule as social/sheets_auto.py
const DAY = 86400;

let access = { token: "", exp: 0 };

async function googleToken() {
  if (access.token && Date.now() < access.exp - 60000) return access.token;
  const t = JSON.parse(process.env.SHEETS_TOKEN || "{}");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token || "",
      client_id: t.client_id || "", client_secret: t.client_secret || "" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("google auth failed");
  access = { token: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
  return access.token;
}

async function sheets(path, opt = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/${path}`, {
    ...opt, headers: { Authorization: "Bearer " + (await googleToken()), "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("sheets " + r.status);
  return r.json();
}

// ---- login cookie: "<expiry>.<hmac>" signed with ADMIN_SECRET, HttpOnly, 30 days ----
const sign = (s) => crypto.createHmac("sha256", process.env.ADMIN_SECRET || "").update(s).digest("hex");
function cookieOk(req) {
  const m = /(?:^|;\s*)vadm=(\d+)\.([a-f0-9]{64})/.exec(req.headers.cookie || "");
  if (!m || !process.env.ADMIN_SECRET) return false;
  const good = Buffer.from(sign(m[1])), got = Buffer.from(m[2]);
  return Number(m[1]) > Date.now() / 1000 && good.length === got.length && crypto.timingSafeEqual(good, got);
}
function setCookie(res, value, maxAge) {
  res.setHeader("Set-Cookie", `vadm=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
const body = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const a = String(req.query.a || "");
  try {
    if (a === "login" && req.method === "POST") {
      const pin = String(body(req).pin || "");
      const want = String(process.env.ADMIN_PIN || "");
      const ok = want && pin.length === want.length && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(want));
      if (!ok) {
        await new Promise((r) => setTimeout(r, 2000));   // slow down guessing
        return res.status(401).json({ error: "Galat PIN" });
      }
      const exp = String(Math.floor(Date.now() / 1000) + 30 * DAY);
      setCookie(res, `${exp}.${sign(exp)}`, 30 * DAY);
      return res.status(200).json({ ok: true });
    }
    if (a === "logout") { setCookie(res, "x", 0); return res.status(200).json({ ok: true }); }

    if (!cookieOk(req)) return res.status(401).json({ error: "login" });
    // writes need our own header too (a form on another site can't add it)
    if (req.method === "POST" && req.headers["x-vajra-admin"] !== "1") return res.status(403).json({ error: "bad request" });

    if (a === "orders" && req.method === "GET") {
      const j = await sheets(`values/${encodeURIComponent(TAB + "!A1:Q500")}?valueRenderOption=FORMATTED_VALUE`);
      const [head, ...rows] = j.values || [];
      const cell = (r, i) => String(r[i] ?? "").trim();
      const out = [];
      rows.forEach((r, i) => {
        if (!cell(r, 2) && !cell(r, 3)) return;   // empty template rows
        out.push({ row: i + 2, n: cell(r, 0), month: cell(r, 1), name: cell(r, 2), phone: cell(r, 3), city: cell(r, 4),
          state: cell(r, 5), item: cell(r, 6), qty: cell(r, 7), paid: cell(r, 8), status: cell(r, 9), notes: cell(r, 10),
          tracking: cell(r, 11), tracking_sent: cell(r, 13).toUpperCase() === "TRUE", feedback: cell(r, 15), address: cell(r, 16) });
      });
      return res.status(200).json({ head, orders: out, statuses: STATUSES, feedback: FEEDBACK });
    }

    if (a === "update" && req.method === "POST") {
      const { row, field, value } = body(req);
      const r = Number(row), v = String(value ?? "").slice(0, 500);
      if (!Number.isInteger(r) || r < 2 || r > 500 || !COLS[field]) return res.status(400).json({ error: "bad field" });
      if (field === "status" && !STATUSES.includes(v)) return res.status(400).json({ error: "bad status" });
      if (field === "feedback" && !FEEDBACK.includes(v)) return res.status(400).json({ error: "bad feedback" });
      // never write into an empty row (protects the sheet from stray row numbers)
      const cur = await sheets(`values/${encodeURIComponent(`${TAB}!A${r}:L${r}`)}`);
      const cr = (cur.values || [[]])[0];
      if (!String(cr[2] || "").trim() && !String(cr[3] || "").trim()) return res.status(400).json({ error: "empty row" });
      const data = [{ range: `${TAB}!${COLS[field]}${r}`, values: [[field === "tracking_sent" ? (v === "true") : v]] }];
      let status = null;
      // same rule as the hourly autopilot: a real tracking ID on a Pending / Not sent row -> Sent
      const st = String(cr[9] || "").trim();
      if (field === "tracking" && TRACK.test(v) && (!st || st.includes("Pending") || st.includes("Not sent"))) {
        status = "📦 Sent"; data.push({ range: `${TAB}!J${r}`, values: [[status]] });
      }
      await sheets("values:batchUpdate", { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
      return res.status(200).json({ ok: true, status });
    }
    return res.status(404).json({ error: "not found" });
  } catch (e) {
    return res.status(500).json({ error: "server: " + String(e.message || e).slice(0, 80) });
  }
}

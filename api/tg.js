// Telegram webhook relay for the VAJRA approvals bot.
// Telegram can't call Google Apps Script directly (it answers with a 302), so Telegram calls this,
// we reply 200 at once-ish and pass the update on to the Apps Script web app (?to=...), which checks the secret itself.
export default async function handler(req, res) {
  const to = String(req.query.to || "");
  if (req.method !== "POST" || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(to)) {
    return res.status(200).send("ok");
  }
  const secret = req.headers["x-telegram-bot-api-secret-token"] || "";
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  try {
    await fetch(to + "?s=" + encodeURIComponent(secret), {
      method: "POST", headers: { "Content-Type": "application/json" }, body, redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    return res.status(502).send("retry"); // Telegram retries; Apps Script skips updates it already handled
  }
  res.status(200).send("ok");
}

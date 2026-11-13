// Check the live /api/admin: wrong PIN, right PIN, orders, no writes. node tests/admin.live.mjs
const B = "https://vajraformwork.vercel.app/api/admin?a=";
const H = { "Content-Type": "application/json", "X-Vajra-Admin": "1" };
let r = await fetch(B + "login", { method: "POST", headers: H, body: JSON.stringify({ pin: "0000" }) });
console.log("wrong PIN:", r.status, (await r.json()).error);
r = await fetch(B + "login", { method: "POST", headers: H, body: JSON.stringify({ pin: "1234" }) });
const j = await r.json(); console.log("right PIN:", r.status, JSON.stringify(j));
const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
r = await fetch(B + "orders", { headers: { ...H, cookie } });
const o = await r.json();
console.log("orders:", r.status, o.error || `${o.orders.length} leads, today ${o.today}, last: ${o.orders.at(-1).name}`);
r = await fetch(B + "orders", { headers: H }); console.log("orders without login:", r.status);

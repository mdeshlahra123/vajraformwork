// Live A1 check on the real site: read the queue, send "down" then "up" on the 2nd evening reel (order ends as before),
// run the GitHub sync after each, and confirm queue.json changed and came back. node tests/admin.queue.live.mjs
import { execSync } from "node:child_process";
const B = "https://vajraformwork.vercel.app/api/admin?a=", H = { "Content-Type": "application/json", "X-Vajra-Admin": "1" };
const login = await fetch(B + "login", { method: "POST", headers: H, body: JSON.stringify({ pin: "1234" }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const get = async () => (await fetch(B + "queue", { headers: { ...H, cookie } })).json();
const send = async (cmd, id) => (await fetch(B + "qcmd", { method: "POST", headers: { ...H, cookie }, body: JSON.stringify({ cmd, id }) })).json();
const raw = async () => (await (await fetch("https://api.github.com/repos/mdeshlahra123/vajra-automation/contents/social/queue.json",
  { headers: { Accept: "application/vnd.github.raw" } })).json());
const evLane = (q) => q.posts.filter((p) => !p.posted && p.video && p.evening).map((p) => p.id);
const sh = (c) => execSync(c, { cwd: "C:/Users/mehul/Desktop/vajra-automation", encoding: "utf8" });
function sync() {
  sh("gh workflow run queue-sync.yml");
  execSync("powershell -c Start-Sleep 12");
  const id = JSON.parse(sh("gh run list --workflow=queue-sync.yml --limit 1 --json databaseId"))[0].databaseId;
  try { sh(`gh run watch ${id} --exit-status`); } catch { }
  return sh(`gh run view ${id} --json conclusion -q .conclusion`).trim();
}
let s = await get();
console.log("read:", s.snap ? `snapshot ${s.snap.updated}, ${s.snap.schedule.length} slots` : "NO SNAPSHOT");
const before = evLane(await raw()); const id = before[1];
console.log("evening lane before:", before.join(", "));
console.log("send down", id, JSON.stringify(await send("down", id)));
console.log("sync:", sync());
const mid = evLane(await raw()); console.log("after down:", mid.join(", "));
console.log("send up", id, JSON.stringify(await send("up", id)));
console.log("sync:", sync());
const after = evLane(await raw()); console.log("after up:  ", after.join(", "));
s = await get();
console.log("cmd rows:", s.cmds.slice(-2).map((c) => `${c.cmd} ${c.id} -> ${c.status} ${c.note}`).join(" | "));
console.log(JSON.stringify(mid) !== JSON.stringify(before) && JSON.stringify(after) === JSON.stringify(before) ? "PASS: moved and restored" : "CHECK");

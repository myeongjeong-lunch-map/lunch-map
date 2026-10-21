// .env.local 의 값을 Vercel 프로젝트(production)에 올린다. 값은 화면에 출력하지 않는다.
// 사용법: node scripts/push-env.mjs
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SKIP = new Set(["VERCEL_OIDC_TOKEN"]);
const lines = readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/);
const vercel = process.platform === "win32" ? "npx.cmd" : "npx";

for (const line of lines) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m || SKIP.has(m[1])) continue;
  const [, name, rawValue] = m;
  const value = rawValue.replace(/^"(.*)"$/, "$1");
  if (!value) {
    console.log(`- ${name}: 비어 있어서 건너뜀`);
    continue;
  }
  // 이미 있으면 지우고 다시 넣는다
  spawnSync(vercel, ["--yes", "vercel@65.0.0", "env", "rm", name, "production", "--yes"], { stdio: "ignore", shell: process.platform === "win32" });
  const r = spawnSync(vercel, ["--yes", "vercel@65.0.0", "env", "add", name, "production"], {
    input: value,
    stdio: ["pipe", "ignore", "pipe"],
    shell: process.platform === "win32",
  });
  console.log(r.status === 0 ? `✓ ${name}` : `✗ ${name}: ${r.stderr.toString().split("\n").filter(Boolean).pop()}`);
}

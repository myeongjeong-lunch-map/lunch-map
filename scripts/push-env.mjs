// env 파일의 값을 Vercel 프로젝트(production)에 올린다. 값은 화면에 출력하지 않는다.
// 사용법: node scripts/push-env.mjs                     → .env.local을 연결된 운영 프로젝트로
//         node scripts/push-env.mjs .env.dev.shared dev → 개발용 키를 dev 프로젝트로
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SKIP = new Set(["VERCEL_OIDC_TOKEN"]);
const [file = ".env.local", target] = process.argv.slice(2);
const lines = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split(/\r?\n/);
const vercel = process.platform === "win32" ? "npx.cmd" : "npx";

// dev 프로젝트는 링크하지 않고 VERCEL_ORG_ID/VERCEL_PROJECT_ID 환경 변수로 고른다
const PROJECTS = { dev: "prj_wgcsx9g4IO8kRO90XLzKXWC8vwVj" };
const env = { ...process.env };
if (target) {
  if (!PROJECTS[target]) throw new Error(`모르는 대상: ${target}`);
  env.VERCEL_ORG_ID = "team_2QaPYjA6n3yHvrcbWJG4zfJd";
  env.VERCEL_PROJECT_ID = PROJECTS[target];
}

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
  spawnSync(vercel, ["--yes", "vercel@65.0.0", "env", "rm", name, "production", "--yes"], { stdio: "ignore", shell: process.platform === "win32", env });
  const r = spawnSync(vercel, ["--yes", "vercel@65.0.0", "env", "add", name, "production"], {
    input: value,
    stdio: ["pipe", "ignore", "pipe"],
    shell: process.platform === "win32",
    env,
  });
  console.log(r.status === 0 ? `✓ ${name}` : `✗ ${name}: ${r.stderr.toString().split("\n").filter(Boolean).pop()}`);
}

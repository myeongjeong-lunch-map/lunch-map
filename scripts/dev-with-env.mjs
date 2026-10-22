// 지정한 env 파일의 값으로 next dev를 띄운다 (.env.local보다 우선). 개발용 키 확인용.
// 사용법: node scripts/dev-with-env.mjs .env.dev.shared 3001
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const [file = ".env.dev.shared", port = "3001"] = process.argv.slice(2);
const env = { ...process.env };
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", port], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));

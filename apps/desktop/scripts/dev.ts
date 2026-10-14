// `bun run dev`: Vite for the renderer, a one-shot bundle of main + preload,
// then Electron pointed at the Vite server. Restart to pick up main changes;
// renderer changes hot-reload.
import { spawn } from "node:child_process";
import * as path from "node:path";

import electronPath from "electron";

const root = path.resolve(import.meta.dir, "../../..");
const desktop = path.join(root, "apps/desktop");
const DEV_URL = "http://localhost:5791";

for (const entry of ["main", "preload"]) {
  const result = await Bun.build({
    entrypoints: [path.join(desktop, `src/${entry}.ts`)],
    outdir: path.join(desktop, "dist-electron"),
    naming: `${entry}.cjs`,
    target: "node",
    format: "cjs",
    external: ["electron"],
  });
  if (!result.success) {
    console.error(result.logs.join("\n"));
    process.exit(1);
  }
}

const vite = spawn("bun", ["run", "dev"], { cwd: path.join(root, "apps/web"), stdio: "inherit" });
for (let attempt = 0; attempt < 100; attempt++) {
  if (await fetch(DEV_URL).then((r) => r.ok, () => false)) break;
  await Bun.sleep(100);
}

const electron = spawn(String(electronPath), [desktop], {
  stdio: "inherit",
  env: { ...process.env, PUDU_DEV_URL: DEV_URL },
});
electron.on("exit", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});
process.on("SIGINT", () => electron.kill());

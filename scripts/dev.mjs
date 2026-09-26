import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, APP_SECRET: process.env.APP_SECRET || randomBytes(32).toString("hex") } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code || 0));

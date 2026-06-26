import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";

const password = argv[2];
if (!password) {
  console.error("用法: node scripts/set-auth-password.mjs <新密碼>");
  process.exit(1);
}

const hash = createHash("sha256").update(password, "utf8").digest("hex");
const configPath = new URL("../assets/jessi-auth-config.js", import.meta.url);
let content = await readFile(configPath, "utf8");
content = content.replace(/passwordHash:\s*"[^"]*"/, `passwordHash: "${hash}"`);
await writeFile(configPath, content);
console.log("已更新 assets/jessi-auth-config.js 密碼 hash。");
console.log("請 commit 並 push 後，GitHub Pages 先會用新密碼。");

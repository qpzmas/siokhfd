#!/usr/bin/env node
// 重新生成 README 里的预览图（开发用）
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });

fs.mkdirSync(".preview", { recursive: true });
fs.mkdirSync("assets", { recursive: true });

run(process.execPath, [
  "fatfish.mjs", "--record", ".preview/demo",
  "--frames", "120", "--width", "100", "--height", "60", "--fps", "20", "--seed", "11",
]);

const py = process.platform === "win32" ? "python" : "python3";
run(py, ["tools/render.py", "--in", ".preview/demo", "--gif", "assets/preview.gif", "--scale", "5", "--colors", "128"]);
run(py, ["tools/render.py", "--in", ".preview/demo", "--webp", "assets/preview.webp", "--scale", "6", "--quality", "82"]);
run(py, ["tools/render.py", "--in", ".preview/demo", "--png", "assets/preview.png", "--frame", "52", "--scale", "6"]);

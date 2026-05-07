const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const entries = [
  "index.html",
  "README.md",
  "REPORT.md",
  "css",
  "js",
  "public"
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of entries) {
  const src = path.join(root, entry);
  const dest = path.join(dist, entry);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, dest, { recursive: true });
}

console.log(`Static site built at ${path.relative(root, dist)}`);

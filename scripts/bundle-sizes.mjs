// First-load JS per route of a production build, raw and gzipped (level 9).
// Usage: node scripts/bundle-sizes.mjs [.next]
// A route's first load is the root main files plus the chunks its layouts and page name in
// the client reference manifest, counted once each.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

const root = process.argv[2] ?? ".next";
const shared = JSON.parse(readFileSync(join(root, "build-manifest.json"), "utf8")).rootMainFiles;
const sizes = new Map();
function size(file) {
  if (!sizes.has(file)) {
    const bytes = readFileSync(join(root, file));
    sizes.set(file, [bytes.length, gzipSync(bytes, { level: 9 }).length]);
  }
  return sizes.get(file);
}
function manifests(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) manifests(path, out);
    else if (entry.name === "page_client-reference-manifest.js") out.push(path);
  }
  return out;
}
const total = (files) => [...files].reduce(([r, g], f) => { const [a, b] = size(f); return [r + a, g + b]; }, [0, 0]);
const kb = (n) => (n / 1024).toFixed(1);

const rows = manifests(join(root, "server", "app")).map((file) => {
  const context = { globalThis: {} };
  context.globalThis.__RSC_MANIFEST = {};
  runInNewContext(readFileSync(file, "utf8"), context);
  const [route, manifest] = Object.entries(context.globalThis.__RSC_MANIFEST)[0];
  const files = new Set(shared);
  for (const [entry, chunks] of Object.entries(manifest.entryJSFiles ?? {})) {
    if (/\/(layout|page)$/.test(entry)) for (const chunk of chunks) files.add(chunk);
  }
  const [raw, gz] = total(files);
  return { route, raw, gz };
});
rows.sort((a, b) => b.gz - a.gz || a.route.localeCompare(b.route));
console.log("route\traw KB\tgzip KB");
for (const { route, raw, gz } of rows) console.log(`${route}\t${kb(raw)}\t${kb(gz)}`);
const [raw, gz] = total(shared);
console.log(`(shared root)\t${kb(raw)}\t${kb(gz)}`);

// Proves a production build carries none of the browser-test fake session (src/lib/supabase/fake-session.ts
// and fake-account.ts). Builds with the CI placeholder env unless --skip-build, then searches every file under
// .next/server and .next/static for strings that exist only inside that dev-only code.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The guard's own strings. Server source maps embed fake-session.ts as original source text, which never
// runs, so these are searched in every built file except .map files.
const GUARD_MARKERS = ["E2E_FAKE_SESSION", "axiis-e2e-session", "axiis-e2e-account"];
// The fake account's fixtures, searched in every built file including source maps: the module must not be bundled at all.
const ACCOUNT_MARKERS = ["e2e@axiis.invalid", "e2e00000-0000-4000"];
// Text that a correct production build does contain, so an empty or missing output cannot pass.
const PRESENT = "Sign in to export your data.";
const ROOTS = [".next/server", ".next/static"];

if (!process.argv.includes("--skip-build")) {
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-placeholder-not-a-secret",
    },
  });
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const found = [];
let scanned = 0;
let sawPresent = false;
for (const root of ROOTS) {
  for (const path of files(root)) {
    const text = readFileSync(path, "latin1");
    scanned += 1;
    if (text.includes(PRESENT)) sawPresent = true;
    const markers = path.endsWith(".map") ? ACCOUNT_MARKERS : [...GUARD_MARKERS, ...ACCOUNT_MARKERS];
    for (const marker of markers) if (text.includes(marker)) found.push(`${path}: ${marker}`);
  }
}

if (!sawPresent) {
  console.error(`check:no-fake-session: "${PRESENT}" is missing from ${scanned} built files, so the build output is not what this check expects.`);
  process.exit(1);
}
if (found.length > 0) {
  console.error("check:no-fake-session: the production build contains browser-test session code:\n" + found.join("\n"));
  process.exit(1);
}
console.log(`check:no-fake-session: no fake session markers in ${scanned} built files.`);

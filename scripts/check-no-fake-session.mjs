// Proves a normal production build carries none of the browser-test fake session (src/lib/supabase/fake-session.ts
// and fake-account.ts), which only the AXIIS_E2E_BUILD=1 build compiles in. See docs/e2e-session.md.
//
//   node scripts/check-no-fake-session.mjs [--skip-build]   builds .next without the flag (unless --skip-build), finds
//                                                            no marker in it, then serves it and shows the cookie is ignored.
//   node scripts/check-no-fake-session.mjs --control <dir>   finds every marker in a browser-test build, which shows the
//                                                            search would catch the fake session if it leaked.
import { execSync, spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The guard's own strings, including the env names of the switch and its secret. Server source maps embed
// fake-session.ts as original source text, which never runs, so these are searched in every file except .map files.
const GUARD_MARKERS = ["E2E_FAKE_SESSION", "axiis-e2e-session", "axiis-e2e-account"];
// The fake account, searched in every built file including source maps: the module must not be bundled at all.
const ACCOUNT_MARKERS = ["e2e@axiis.invalid", "e2e00000-0000-4000", "axiisE2EAccount"];
// Text that a correct production build does contain, so an empty or missing output cannot pass.
const PRESENT = "Sign in to export your data.";
const PORT = 3601;
const SECRET = "s".repeat(48);

// Thrown rather than exiting, so the probe's `finally` still stops the server it started.
function fail(message) {
  throw new Error(message);
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

/** Every marker found under `<dist>/server` and `<dist>/static`, as `path: marker`. */
function scan(dist) {
  const found = [];
  let scanned = 0;
  let sawPresent = false;
  for (const root of ["server", "static"]) {
    for (const path of files(join(dist, root))) {
      const text = readFileSync(path, "latin1");
      scanned += 1;
      if (text.includes(PRESENT)) sawPresent = true;
      const markers = path.endsWith(".map") ? ACCOUNT_MARKERS : [...GUARD_MARKERS, ...ACCOUNT_MARKERS];
      for (const marker of markers) if (text.includes(marker)) found.push({ path, marker });
    }
  }
  if (!sawPresent) fail(`"${PRESENT}" is missing from ${scanned} files in ${dist}, so the build output is not what this check expects.`);
  return { found, scanned };
}

async function expectRedirect(path, location) {
  const response = await fetch(`http://localhost:${PORT}${path}`, {
    redirect: "manual",
    headers: { cookie: `axiis-e2e-session=${SECRET}` },
  });
  const got = response.headers.get("location") ?? "";
  if (response.status !== 307 || !got.endsWith(location)) {
    fail(`${path} with the fake session cookie answered ${response.status} ${got}, expected 307 to ${location}.`);
  }
}

/** Serves the normal build with the fake session switched on at runtime: the cookie must still sign nobody in. */
async function serveAndProbe() {
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production", AXIIS_E2E_BUILD: "", E2E_FAKE_SESSION: "1", E2E_FAKE_SESSION_SECRET: SECRET },
  });
  try {
    const deadline = Date.now() + 60_000;
    for (;;) {
      const up = await fetch(`http://localhost:${PORT}/robots.txt`).then((r) => r.ok, () => false);
      if (up) break;
      if (server.exitCode !== null || Date.now() > deadline) fail(`next start on port ${PORT} did not come up.`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await expectRedirect("/today", "/login?next=%2Ftoday");
    await expectRedirect("/settings/export", "/login?next=%2Fsettings%2Fexport");
    await expectRedirect("/dev/score", "/login?next=%2Fdev%2Fscore");
  } finally {
    server.kill();
  }
}

function checkControl(dist) {
  const { found, scanned } = scan(dist);
  const missing = [...GUARD_MARKERS, ...ACCOUNT_MARKERS].filter((m) => !found.some((f) => f.marker === m));
  if (missing.length > 0) fail(`the browser-test build in ${dist} lacks ${missing.join(", ")}, so the search could miss a leak.`);
  console.log(`check:no-fake-session: every marker found in the browser-test build (${scanned} files in ${dist}).`);
}

async function checkProduction() {
  if (!process.argv.includes("--skip-build")) {
    execSync("npx next build", {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
        AXIIS_E2E_BUILD: "",
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-placeholder-not-a-secret",
      },
    });
  }
  const { found, scanned } = scan(".next");
  if (found.length > 0) {
    fail("the production build contains browser-test session code:\n" + found.map((f) => `${f.path}: ${f.marker}`).join("\n"));
  }
  await serveAndProbe();
  console.log(`check:no-fake-session: no fake session markers in ${scanned} built files, and the served build ignores the cookie.`);
}

const control = process.argv.indexOf("--control");
try {
  if (control !== -1) checkControl(process.argv[control + 1]);
  else await checkProduction();
} catch (error) {
  console.error(`check:no-fake-session: ${error.message}`);
  process.exitCode = 1;
}

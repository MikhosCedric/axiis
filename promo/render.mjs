// Renders the Axiis promo by seeking the page frame by frame (never by recording real time), then encodes with ffmpeg.
//
//   node promo/render.mjs sheet [t1 t2 ...]   contact sheets of key times -> promo/frames/sheet-*.png
//   node promo/render.mjs film                40 s master, 15 s cut and poster -> promo/out/
//   node promo/render.mjs loop                hero loop webm -> promo/out/
//   node promo/render.mjs all                 film + loop
//
// Env: WORKERS (default 4), CHANNEL (default msedge; set CHANNEL= to use Playwright's bundled Chromium), KEEP=1 keeps frames, REUSE=1 encodes again from kept frames.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FRAMES = path.join(ROOT, "frames");
const OUT = path.join(ROOT, "out");
const FPS = 30;
const WORKERS = Number(process.env.WORKERS || 4);
const CHANNEL = process.env.CHANNEL ?? "msedge";

/* The 15 s cut: [from, to) in master seconds, hard cuts between, each on the 120 BPM grid (0.5 s beats). */
export const SHORT = [
  [0.5, 5.0], // capture: typed, sent, in the Inbox
  [7.75, 12.25], // dragged onto the day, now crosses it, live
  [14.25, 16.25], // done
  [35.0, 39.0], // the close
];
const POSTER_T = 12.5;

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png" };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const f = path.join(ROOT, u === "/" ? "index.html" : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

async function openPages(base, mode, n) {
  const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
  const pages = [];
  for (let i = 0; i < n; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("page error:", e.message));
    await page.goto(`${base}/index.html?mode=${mode}`);
    await page.evaluate(() => window.__ready);
    pages.push(page);
  }
  return { browser, pages };
}

async function shoot(page, t, file) {
  await page.evaluate((ms) => window.__seek(ms), t * 1000);
  await page.screenshot({ path: file, type: "png", caret: "initial" });
}

async function renderFrames(base, mode, dir, count) {
  if (process.env.REUSE && fs.existsSync(dir) && fs.readdirSync(dir).length === count) return; // encode again from kept frames
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { browser, pages } = await openPages(base, mode, WORKERS);
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(
    pages.map(async (page) => {
      for (;;) {
        const i = next++;
        if (i >= count) return;
        await shoot(page, i / FPS, path.join(dir, `f_${String(i).padStart(5, "0")}.png`));
        if (++done % 60 === 0) process.stdout.write(`  ${mode}: ${done}/${count} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
      }
    })
  );
  await browser.close();
}

function ff(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + args.join(" "));
}
const H264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart"];

async function film(base) {
  const dir = path.join(FRAMES, "film");
  const count = 40 * FPS;
  await renderFrames(base, "film", dir, count);
  fs.mkdirSync(OUT, { recursive: true });
  ff(["-framerate", String(FPS), "-i", path.join(dir, "f_%05d.png"), ...H264, path.join(OUT, "axiis-promo.mp4")]);
  // the 15 s cut, from the same frames
  const sdir = path.join(FRAMES, "short");
  fs.rmSync(sdir, { recursive: true, force: true });
  fs.mkdirSync(sdir, { recursive: true });
  let k = 0;
  for (const [a, b] of SHORT)
    for (let i = Math.round(a * FPS); i < Math.round(b * FPS); i++)
      fs.copyFileSync(path.join(dir, `f_${String(i).padStart(5, "0")}.png`), path.join(sdir, `f_${String(k++).padStart(5, "0")}.png`));
  ff(["-framerate", String(FPS), "-i", path.join(sdir, "f_%05d.png"), ...H264, path.join(OUT, "axiis-promo-15s.mp4")]);
  ff(["-i", path.join(dir, `f_${String(Math.round(POSTER_T * FPS)).padStart(5, "0")}.png`), "-q:v", "2", path.join(OUT, "axiis-poster.jpg")]);
  if (!process.env.KEEP) fs.rmSync(sdir, { recursive: true, force: true });
}

async function loop(base) {
  const dir = path.join(FRAMES, "loop");
  const N = Math.round(9.6 * FPS), X = 18; // 9.6 s, the last 0.6 s dissolved into the first
  await renderFrames(base, "loop", dir, N);
  fs.mkdirSync(OUT, { recursive: true });
  const fc =
    `[0]split=3[a][b][c];` +
    `[a]trim=start_frame=${X}:end_frame=${N - X},setpts=PTS-STARTPTS[mid];` +
    `[b]trim=start_frame=0:end_frame=${X},setpts=PTS-STARTPTS[head];` +
    `[c]trim=start_frame=${N - X}:end_frame=${N},setpts=PTS-STARTPTS[tail];` +
    `[tail][head]blend=all_expr='A*(1-(N+0.5)/${X})+B*((N+0.5)/${X})'[x];` +
    `[x][mid]concat=n=2:v=1[o];[o]scale=1280:720:flags=lanczos,format=yuv420p[v]`;
  const out = path.join(OUT, "axiis-hero-loop.webm");
  const common = ["-framerate", String(FPS), "-i", path.join(dir, "f_%05d.png"), "-filter_complex", fc, "-map", "[v]", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", process.env.VP9_CRF || "16", "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-an"];
  const log = path.join(FRAMES, "vp9pass");
  ff([...common, "-pass", "1", "-passlogfile", log, "-f", "webm", process.platform === "win32" ? "NUL" : "/dev/null"]);
  ff([...common, "-pass", "2", "-passlogfile", log, out]);
  for (const f of fs.readdirSync(FRAMES)) if (f.startsWith("vp9pass")) fs.rmSync(path.join(FRAMES, f));
}

async function sheet(base, times, name) {
  fs.mkdirSync(FRAMES, { recursive: true });
  const tmp = path.join(FRAMES, "sheet-tmp");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const { browser, pages } = await openPages(base, process.env.MODE || "film", 1);
  for (let i = 0; i < times.length; i++) await shoot(pages[0], times[i], path.join(tmp, `s_${String(i).padStart(2, "0")}.png`));
  await browser.close();
  const cols = 3, rows = Math.ceil(times.length / cols);
  ff(["-i", path.join(tmp, "s_%02d.png"), "-vf", `scale=640:-1,tile=${cols}x${rows}:padding=6:color=black`, "-frames:v", "1", path.join(FRAMES, `${name}.png`)]);
  console.log("contact sheet:", path.join(FRAMES, `${name}.png`), "(full frames in", tmp + ")");
}

const [cmd = "all", ...rest] = process.argv.slice(2);
const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
try {
  if (cmd === "sheet") {
    const times = rest.length ? rest.map(Number) : [1.6, 3.3, 4.8, 6.5, 8.6, 10.6, 12.4, 14.9, 16.4, 19.8, 22.9, 24.8];
    await sheet(base, times, process.env.NAME || "sheet");
  } else if (cmd === "frame") {
    fs.mkdirSync(FRAMES, { recursive: true });
    const { browser, pages } = await openPages(base, process.env.MODE || "film", 1);
    for (const t of rest.map(Number)) await shoot(pages[0], t, path.join(FRAMES, `frame-${t}.png`));
    await browser.close();
  } else {
    if (cmd === "film" || cmd === "all") await film(base);
    if (cmd === "loop" || cmd === "all") await loop(base);
    if (!process.env.KEEP) for (const d of ["film", "loop"]) fs.rmSync(path.join(FRAMES, d), { recursive: true, force: true });
  }
} finally {
  srv.close();
}

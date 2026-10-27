// The landing on a slow phone: 375px, the CPU slowed 4x through the DevTools protocol. Prints layout
// shift, LCP and long tasks on load, then frames a second and long tasks while the whole page is
// scrolled by a touch gesture. Point it at a running production build.
// Usage: node scripts/landing-perf.mjs [baseURL] [runs]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3710";
const runs = Number(process.argv[3] ?? 3);

const browser = await chromium.launch({ channel: "msedge" });
for (let run = 1; run <= runs; run++) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    const seen = { cls: 0, lcp: 0, tasks: [] };
    window.__perf = seen;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (seen.cls += e.value))).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (seen.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => seen.tasks.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true });
  });
  await page.goto(base + "/");
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.waitForTimeout(2500);
  const load = await page.evaluate(() => ({ ...window.__perf, tasks: [...window.__perf.tasks] }));
  await page.evaluate(() => {
    window.__perf.tasks.length = 0;
    window.__frames = 0;
    const tick = () => {
      window.__frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const start = Date.now();
  await cdp.send("Input.synthesizeScrollGesture", { x: 180, y: 600, yDistance: -(height - 812), speed: 2400, gestureSourceType: "touch" });
  const seconds = (Date.now() - start) / 1000;
  const scroll = await page.evaluate(() => ({ frames: window.__frames, tasks: [...window.__perf.tasks], cls: window.__perf.cls }));
  console.log(
    `run ${run}: load CLS ${load.cls.toFixed(3)}, LCP ${(load.lcp / 1000).toFixed(2)} s, long tasks [${load.tasks.join(", ")}] ms; ` +
      `scroll ${(scroll.frames / seconds).toFixed(0)} fps over ${seconds.toFixed(1)} s, long tasks [${scroll.tasks.join(", ")}] ms, CLS after ${scroll.cls.toFixed(3)}`,
  );
  await context.close();
}
await browser.close();

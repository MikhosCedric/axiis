/*
 * Axiis promo film: one master timeline, drawn from one time value.
 *
 * Every frame is a pure function of t (seconds): window.__seek(ms) sets every style from t, so the renderer can
 * seek to any frame in any order and get the same pixels. No CSS animations, no transitions, no Date, no Math.random:
 * the one source of variety is a seeded PRNG.
 *
 *   ?mode=film   the 40 s film (default)       ?mode=loop  the 9.6 s hero loop (the Today page only, no type)
 *   ?t=12.5      open at a time                ?play=1     play in real time (a preview, not used for rendering)
 *   ?grain=0     no paper grain
 */
(() => {
  "use strict";
  const Q = new URLSearchParams(location.search);
  const MODE = Q.get("mode") || "film";
  const GRAIN = Q.get("grain") !== "0";
  const stage = document.getElementById("stage");
  const DURATION = MODE === "loop" ? 9.6 : 40;

  /* ================= utilities ================= */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261110);
  function bez(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 40; i++) {
        const v = sx(t);
        if (Math.abs(v - x) < 1e-7) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }
  const E = {
    lin: (x) => x,
    ax: bez(0.16, 1, 0.3, 1), // --ease-axiis
    exit: bez(0.4, 0, 1, 1), // --ease-exit
    spr: bez(0.34, 1.56, 0.64, 1), // --ease-spring
    io: bez(0.65, 0, 0.35, 1),
    cam: bez(0.5, 0, 0.12, 1), // a camera that leans in, then lands softly
    drag: bez(0.42, 0, 0.18, 1),
    expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    wipe: bez(0.7, 0, 0.25, 1),
  };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const P = (t, a, b, e = E.ax) => (t <= a ? 0 : t >= b ? 1 : e((t - a) / (b - a)));
  /** A damped spring from 0 to 1 that starts at time a: overshoots, then settles. */
  function spring(t, a, f = 2.1, z = 0.52) {
    const x = t - a;
    if (x <= 0) return 0;
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));
  }
  /** 0 → 1 → 0 bump between a and b. */
  const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
  /** A pop at t0: scale 1, overshoots to about 1 + 0.56 a, settles back to 1. */
  const pop = (t, t0, a = 0.1, f = 2.6) => {
    const x = t - t0;
    return x <= 0 ? 1 : 1 + a * Math.exp(-6 * x) * Math.sin(2 * Math.PI * f * x);
  };
  const wrap = (v, lo, hi) => {
    const w = hi - lo;
    return lo + ((((v - lo) % w) + w) % w);
  };
  /* A second seeded PRNG for the life layer, so the first one's sequence (typing, the month's items) is unchanged. */
  const rnd2 = mulberry32(4242);

  function h(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  /** Set styles, skipping ones that have not changed (fast seeking). */
  function S(e, o) {
    const c = e.__s || (e.__s = {});
    for (const k in o) {
      const v = o[k];
      if (c[k] === v) continue;
      c[k] = v;
      if (k[0] === "-") e.style.setProperty(k, v);
      else e.style[k] = v;
    }
  }
  const px = (v) => v + "px";
  function place(e, x, y, w, hh) {
    const o = { left: px(x), top: px(y) };
    if (w != null) o.width = px(w);
    if (hh != null) o.height = px(hh);
    S(e, o);
  }
  const blurF = (b) => (b > 0.05 ? `blur(${b.toFixed(2)}px)` : "none");
  function vis(e, on) {
    S(e, { display: on ? "" : "none" });
  }
  /** Fade-and-rise in, fall-away out. Returns the arrival progress. */
  function appear(e, t, tin, tout, o = {}) {
    const dy = o.dy ?? 30, blur = o.blur ?? 12, dur = o.dur ?? 0.8, s0 = o.s0 ?? 1, dx = o.dx ?? 0;
    const pi = tin == null ? 1 : P(t, tin, tin + dur, o.ease || E.ax);
    const po = tout == null ? 0 : P(t, tout, tout + (o.outDur ?? 0.45), E.exit);
    const op = pi * (1 - po);
    const y = (1 - pi) * dy + po * (o.dyOut ?? -14);
    const x = (1 - pi) * dx + po * (o.dxOut ?? 0);
    const b = (1 - pi) * blur + po * blur * 0.8;
    const s = lerp(s0, 1, pi) * lerp(1, o.sOut ?? 1, po);
    S(e, {
      opacity: op.toFixed(4),
      transform: `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(4)})`,
      filter: blurF(b),
      visibility: op <= 0.001 ? "hidden" : "visible",
    });
    return pi;
  }
  const fmtClock = (hr) => {
    let hh = Math.floor(hr + 1e-6), mm = Math.round((hr - hh) * 60);
    if (mm === 60) { hh += 1; mm = 0; }
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${String(mm).padStart(2, "0")}`;
  };
  const fmtHour = (hr) => String(((hr + 11) % 12) + 1);

  /* ================= kinetic type ================= */
  /** A line of display type made of parts; each word can arrive on its own. */
  function kline(parent, parts, x, y, size, cls = "") {
    const el = h("div", "kin disp " + cls, parent);
    S(el, { left: px(x), top: px(y), fontSize: px(size) });
    const words = [];
    parts.forEach((part, pi) => {
      const toks = part.text.split(/(?<= )/);
      toks.forEach((tk) => {
        const w = h("span", "w " + (part.cls || ""), el, tk);
        words.push({ el: w, part: pi });
      });
    });
    return { el, words };
  }
  /** Words arrive one after another (blur, rise) and leave together, faster. */
  function kin(L, t, tin, tout, o = {}) {
    const st = o.st ?? 0.075, dur = o.dur ?? 0.85, part = o.part;
    let k = 0;
    L.words.forEach((w) => {
      if (part != null && w.part !== part) return;
      const a = tin == null ? -1 : tin + k * st;
      const pi = tin == null ? 0 : P(t, a, a + dur, E.ax);
      const b0 = tout == null ? 1e9 : tout + k * 0.03;
      const po = P(t, b0, b0 + 0.42, E.exit);
      const op = pi * (1 - po);
      const y = (1 - pi) * 0.42 - po * 0.22;
      const bl = (1 - pi) * 16 + po * 12;
      S(w.el, {
        opacity: op.toFixed(4),
        transform: `translate3d(0,${y.toFixed(4)}em,0)`,
        filter: blurF(bl),
        visibility: op <= 0.001 ? "hidden" : "visible",
      });
      k++;
    });
  }

  /* ================= shared parts ================= */
  /** The glyph: a head and a beam (task), a square head (checklist), or two ticks (event). */
  function glyph(parent, type = "task", gh = 18, w = null) {
    const g = h("div", "g " + type, parent);
    S(g, { "--gh": px(gh) });
    if (w != null) S(g, { width: px(w) });
    const bm = h("div", "bm", g);
    const G = {
      g, type,
      dash: h("div", "bm-dash", bm),
      out: h("div", "bm-out", bm),
      live: h("div", "bm-live", bm),
      sw: h("div", "bm-sweep", bm),
      hd: h("div", "hd", g),
      hdl: h("div", "hd hd-live", g),
      hdd: h("div", "hd hd-done", g),
    };
    G.sh = h("div", "bm-sheen", G.live);
    return G;
  }
  const ST = { planned: { plan: 1 }, live: { live: 1 }, done: { done: 1 } };
  function setG(G, st) {
    const plan = st.plan || 0, live = st.live || 0, sweep = st.sweep || 0, so = st.sweepOut || 0, done = st.done || 0;
    S(G.dash, { opacity: (plan * (1 - live) * (1 - done)).toFixed(3) });
    S(G.live, { transform: `scaleX(${live.toFixed(4)})`, opacity: (1 - done).toFixed(3) });
    S(G.sw, { transform: `scaleX(${sweep.toFixed(4)})`, opacity: (sweep > 0 ? 1 - so : 0).toFixed(3) });
    S(G.out, { opacity: done.toFixed(3) });
    S(G.hd, { opacity: (1 - done).toFixed(3) });
    S(G.hdl, { opacity: (live * (1 - sweep) * (1 - done)).toFixed(3) });
    S(G.hdd, { opacity: done.toFixed(3), transform: `scale(${(st.doneS ?? 0.55 + 0.45 * done).toFixed(3)})` });
    const shn = st.sheen || 0;
    S(G.sh, { opacity: shn > 0 && shn < 1 ? "1" : "0", transform: `translateX(${lerp(-110, 240, shn).toFixed(1)}%)` });
    if (G.type === "event") S(G.g, { color: done > 0.5 ? "var(--ink-3)" : live > 0.5 ? "var(--accent)" : "var(--ink)" });
  }

  function grain(parent) {
    if (!GRAIN) return;
    const g = h("div", "grain", parent);
    g.style.backgroundImage = `url(${GRAIN_URL})`;
    return g;
  }
  let GRAIN_URL = "";
  function makeGrain() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    const d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 120 + Math.floor(rnd() * 136);
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    GRAIN_URL = c.toDataURL("image/png");
  }

  /** Loose fragments of the score floating behind a scene, at a few depths. */
  /*
   * The life layer behind a scene, back to front: a faint hour grid, translucent paper bubbles rising at three
   * depths (screen space, wrapped, so a pan never runs out of them), then the loose fragments of the score and a few
   * product forms (glyphs, a chip, key caps) that drift and bob. All of it sits behind the world, so it never covers UI.
   */
  function buildDrift(scene, spec, life = {}) {
    const back = h("div", "a", scene);
    S(back, { inset: "0" });
    const grid = h("div", "hgrid", back);
    const bubbles = [];
    const depths = life.bubbles ?? [
      { f: 0.16, n: 10, r: [5, 13], op: 0.7, blur: 0.4, v: [9, 16] },
      { f: 0.4, n: 8, r: [14, 28], op: 0.75, blur: 0, v: [16, 26] },
      { f: 0.78, n: 4, r: [38, 66], op: 0.5, blur: 1.6, v: [26, 38] },
    ];
    depths.forEach((D) => {
      for (let i = 0; i < D.n; i++) {
        const rad = lerp(D.r[0], D.r[1], rnd2());
        const e = h("div", "bub", back);
        S(e, { width: px(rad * 2), height: px(rad * 2), opacity: String(D.op), filter: blurF(D.blur) });
        bubbles.push({ e, f: D.f, rad, x0: rnd2() * 2220, y0: rnd2() * 1380, v: lerp(D.v[0], D.v[1], rnd2()), ph: rnd2() * 6.283, sw: 8 + rnd2() * 16 });
      }
    });
    if (life.forms) {
      const forms = ["gsolid", "gdash", "ghollow", "chip", "key", "gdash", "ghollow", "key"];
      const [x0, x1, y0, y1] = life.forms.region;
      const pieces = [];
      for (let i = 0; i < life.forms.n; i++) {
        const form = forms[i % forms.length];
        pieces.push({ form, x: lerp(x0, x1, rnd2()), y: lerp(y0, y1, rnd2()), w: form.startsWith("g") ? 70 + rnd2() * 70 : form === "chip" ? 150 + rnd2() * 60 : null, txt: form === "key" ? ["C", "A", "Ctrl", "Enter"][i % 4] : null });
      }
      spec = spec.concat([{ f: life.forms.f ?? 0.5, op: life.forms.op ?? 0.3, pieces, life: true }]);
    }
    const layers = spec.map((L) => {
      const el = h("div", "world", scene);
      const pieces = L.pieces.map((p) => {
        const e = h("div", "piece p-" + p.form, el);
        place(e, p.x, p.y, p.w);
        if (p.txt) {
          e.textContent = p.txt;
          if (p.txt.length > 1) S(e, { width: px(14 + p.txt.length * 10) });
        }
        S(e, { opacity: String(L.op) });
        const R = L.life ? rnd2 : rnd;
        return { e, p, ph: R() * Math.PI * 2, sp: 0.5 + R() * 0.5, rot: L.life ? (R() - 0.5) * 8 : 0 };
      });
      return { el, f: L.f, pieces };
    });
    const D = {
      grain: null,
      update(t, cam) {
        // the hour grid slides with a slow parallax of its own
        S(grid, { backgroundPosition: `${(-cam.cx * 0.12 * cam.s - t * 5).toFixed(2)}px 0` });
        for (const b of bubbles) {
          const sf = 1 + (cam.s - 1) * b.f;
          const sx = wrap(b.x0 - cam.cx * b.f * sf + Math.sin(t * 0.45 + b.ph) * b.sw, -150, 2070);
          const sy = wrap(b.y0 - b.v * t - cam.cy * b.f * sf, -150, 1230);
          const br = sf * (1 + 0.025 * Math.sin(t * 1.3 + b.ph));
          S(b.e, { transform: `translate(${(sx - b.rad).toFixed(2)}px,${(sy - b.rad).toFixed(2)}px) scale(${br.toFixed(4)})` });
        }
        for (const L of layers) {
          const s = 1 + (cam.s - 1) * L.f;
          S(L.el, { transform: `translate(960px,540px) scale(${s.toFixed(4)}) translate(${(-cam.cx * L.f).toFixed(2)}px,${(-cam.cy * L.f).toFixed(2)}px)` });
          for (const q of L.pieces) {
            const by = Math.sin(t * q.sp * 1.6 + q.ph) * 7;
            const bx = Math.cos(t * q.sp * 1.1 + q.ph) * 4;
            const rr = q.rot ? q.rot + Math.sin(t * q.sp + q.ph) * 2.5 : 0;
            S(q.e, { transform: `translate(${bx.toFixed(2)}px,${by.toFixed(2)}px)${rr ? ` rotate(${rr.toFixed(2)}deg)` : ""}` });
          }
        }
        // the paper's grain belongs to the paper: it travels with the camera, a little slower
        if (D.grain) S(D.grain, { backgroundPosition: `${(-cam.cx * cam.s * 0.6).toFixed(1)}px ${(-cam.cy * cam.s * 0.6 - t * 3).toFixed(1)}px` });
      },
    };
    return D;
  }

  /* ---- micro effects ---- */
  /** A small burst: a hairline ring and n tiny circles (solid and hollow) radiating from a point, then fading. */
  function makeBurst(parent, o = {}) {
    const r = mulberry32(o.seed ?? 5);
    const n = o.n ?? 8, R = o.R ?? 44, dur = o.dur ?? 0.8;
    const g = h("div", "burst" + (o.accent ? " acc" : ""), parent);
    const ring = h("div", "bring", g);
    const rr = o.ring ?? R * 0.9;
    S(ring, { width: px(rr * 2), height: px(rr * 2), marginLeft: px(-rr), marginTop: px(-rr) });
    const dots = [];
    for (let i = 0; i < n; i++) {
      const sz = 3.5 + r() * 5;
      const e = h("div", "bdot" + (i % 3 === 1 ? " hollow" : ""), g);
      S(e, { width: px(sz), height: px(sz), marginLeft: px(-sz / 2), marginTop: px(-sz / 2) });
      dots.push({ e, a: (i / n) * Math.PI * 2 + (r() - 0.5) * 0.7 + (o.rot ?? -0.4), d: R * (0.65 + r() * 0.6), lag: r() * 0.08 });
    }
    S(g, { visibility: "hidden" });
    return {
      el: g,
      fire(t, t0, x, y, k = 1) {
        const p = (t - t0) / dur;
        if (p <= 0 || p >= 1) {
          S(g, { visibility: "hidden" });
          return;
        }
        S(g, { visibility: "visible", left: px(x), top: px(y), transform: `scale(${k})` });
        const pr = E.expo(clamp(p * 1.15));
        S(ring, { opacity: (0.8 * Math.pow(1 - p, 1.6)).toFixed(3), transform: `scale(${(0.25 + 0.85 * pr).toFixed(4)})` });
        for (const d of dots) {
          const q = clamp((p - d.lag) / (1 - d.lag));
          const e = E.expo(q);
          S(d.e, {
            opacity: (q > 0 ? 0.85 * Math.pow(1 - q, 1.3) : 0).toFixed(3),
            transform: `translate(${(Math.cos(d.a) * d.d * e).toFixed(2)}px,${(Math.sin(d.a) * d.d * e - q * 6).toFixed(2)}px) scale(${(1 - 0.6 * q).toFixed(3)})`,
          });
        }
      },
    };
  }

  /* Motion blur for camera moves: a directional SVG Gaussian applied to the whole scene, sized by camera speed. */
  const SVGNS = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(SVGNS, "svg");
  defs.setAttribute("width", "0");
  defs.setAttribute("height", "0");
  defs.style.position = "absolute";
  stage.appendChild(defs);
  function mblur(id) {
    const f = document.createElementNS(SVGNS, "filter");
    f.id = id;
    f.setAttribute("x", "-2%"); f.setAttribute("y", "-2%"); f.setAttribute("width", "104%"); f.setAttribute("height", "104%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    const fe = document.createElementNS(SVGNS, "feGaussianBlur");
    fe.setAttribute("edgeMode", "duplicate");
    f.appendChild(fe);
    defs.appendChild(f);
    let last = "";
    return (el, bx, by) => {
      bx = Math.min(4.5, bx); by = Math.min(2.5, by);
      if (bx < 0.4 && by < 0.4) {
        S(el, { filter: "none" });
        return;
      }
      const v = `${bx.toFixed(1)} ${by.toFixed(1)}`;
      if (v !== last) { fe.setAttribute("stdDeviation", v); last = v; }
      S(el, { filter: `url(#${id})` });
    };
  }
  /** Screen speed of a camera at t, in px per frame. */
  function camSpeed(keys, t) {
    const a = camAt(keys, t - 1 / 30), b = camAt(keys, t);
    const zs = Math.abs(b.s - a.s) / b.s;
    return [Math.abs(b.cx - a.cx) * b.s + zs * 60, Math.abs(b.cy - a.cy) * b.s + zs * 35];
  }
  /** Scatter pieces over a region, seeded. */
  function scatter(n, x0, x1, y0, y1) {
    const forms = ["staff", "staff", "head", "bar", "final", "ledger", "head"];
    const out = [];
    for (let i = 0; i < n; i++) {
      const form = forms[Math.floor(rnd() * forms.length)];
      out.push({ form, x: lerp(x0, x1, rnd()), y: lerp(y0, y1, rnd()), w: form === "staff" ? 120 + rnd() * 160 : null });
    }
    return out;
  }

  /* ---- camera ---- */
  /** The keyed camera plus a slow breath (drift and a hint of zoom), so no shot is ever locked off. */
  function camAt(keys, t) {
    const c = camKey(keys, t), k = 2 * Math.PI, L = MODE === "loop";
    return {
      cx: c.cx + 5 * Math.sin((k * t) / (L ? 9.6 : 7.4)),
      cy: c.cy + 3.5 * Math.sin((k * t) / (L ? 4.8 : 9.2) + 1.3),
      s: c.s * (1 + 0.0045 * Math.sin((k * t) / (L ? 9.6 : 11.5) + 0.6)),
    };
  }
  function camKey(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (let i = 1; i < keys.length; i++) {
      const b = keys[i];
      if (t <= b.t) {
        const a = keys[i - 1];
        const p = (b.e || E.cam)((t - a.t) / (b.t - a.t));
        return { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), s: lerp(a.s, b.s, p) };
      }
    }
    return keys[keys.length - 1];
  }
  function applyCam(world, c) {
    S(world, { transform: `translate(960px,540px) scale(${c.s.toFixed(5)}) translate(${(-c.cx).toFixed(3)}px,${(-c.cy).toFixed(3)}px)` });
  }
  const toScreen = (c, x, y) => [(x - c.cx) * c.s + 960, (y - c.cy) * c.s + 540];

  /* ---- cursor (screen space, above every scene) ---- */
  const cursorEl = (() => {
    const d = h("div", null, stage);
    d.id = "cursor";
    d.innerHTML =
      '<svg viewBox="0 0 24 32" width="34" height="46"><path d="M2.2 2.2 L2.2 25.6 L8 20.2 L12.3 29.6 L16.6 27.7 L12.4 18.5 L20.2 18.5 Z" fill="#fcfcf9" stroke="#14151b" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    return d;
  })();
  const mkRipple = (w) => {
    const r = h("div", "a", stage);
    S(r, { width: "60px", height: "60px", marginLeft: "-30px", marginTop: "-30px", borderRadius: "50%", border: `${w}px solid rgb(90 92 102 / 0.55)`, boxSizing: "border-box", zIndex: 49, opacity: 0 });
    return r;
  };
  const rippleEl = mkRipple(2), rippleEl2 = mkRipple(1.25);
  let cursorState = null;
  function cursor(x, y, op = 1, press = 0, ripple = null) {
    cursorState = { x, y, op, press, ripple };
  }
  function flushCursor() {
    const c = cursorState;
    if (!c || c.op <= 0.001) {
      S(cursorEl, { opacity: 0, visibility: "hidden" });
      S(rippleEl, { opacity: 0 });
      S(rippleEl2, { opacity: 0 });
      return;
    }
    // a click squishes the arrow a little (wider, shorter), then it springs back
    const sq = c.press;
    S(cursorEl, { opacity: c.op.toFixed(3), visibility: "visible", transform: `translate(${(c.x - 3).toFixed(2)}px,${(c.y - 3).toFixed(2)}px) scale(${(1 - 0.06 * sq).toFixed(3)},${(1 - 0.17 * sq).toFixed(3)})` });
    // two rings from the click point, the second a beat behind and wider
    const ring = (el, p, s0, s1, a) => {
      if (p != null && p > 0 && p < 1) {
        const e = E.expo(p);
        S(el, { left: px(c.x), top: px(c.y), opacity: (Math.pow(1 - p, 1.4) * a).toFixed(3), transform: `scale(${(s0 + e * s1).toFixed(3)})` });
      } else S(el, { opacity: 0 });
    };
    ring(rippleEl, c.ripple, 0.2, 0.85, 0.9);
    ring(rippleEl2, c.ripple != null ? (c.ripple - 0.14) / 0.86 : null, 0.3, 1.5, 0.55);
  }
  /** Press amount and ripple for a click at tc. */
  const click = (t, tc) => ({ press: bump(t, tc - 0.06, tc + 0.18), ripple: t > tc ? (t - tc) / 0.5 : null });

  /* ================= the sheet of the day ================= */
  const H0 = 9, H1 = 17;
  const DAY = [
    { name: "Work", items: [
      { id: "standup", title: "Standup", s: 9, d: 0.25, type: "event", state: "done" },
      { id: "brief", title: "Write the launch brief", s: 10, d: 1.5, state: "done" },
      { id: "sync", title: "Design sync", s: 13, d: 0.75, type: "event", state: "planned" },
    ] },
    { name: "Home", items: [
      { id: "landlord", title: "Call the landlord", s: 9.5, d: 0.5, state: "done" },
      { id: "vet", title: "Call the vet from the train", s: 12.5, d: 0.75, state: "planned" },
      { id: "packing", title: "Packing list", s: 15.5, d: 1, type: "checklist", state: "planned" },
    ] },
    { name: "Health", items: [
      { id: "stretch", title: "Stretch", s: 9.75, d: 0.33, state: "done" },
      { id: "walk", title: "Walk to the park", s: 11, d: 0.66, state: "done" },
      { id: "run", title: "Run", s: 14, d: 0.75, state: "planned" },
    ] },
  ];

  function makeItem(parent, it, gh, fs, w) {
    const el = h("div", "it", parent);
    const G = glyph(el, it.type || "task", gh, w);
    S(G.g, { left: "0px", top: px(-gh / 2) });
    const lbl = h("div", "lbl", el);
    lbl.append(document.createTextNode(it.title + "  "));
    h("span", "tm", lbl, fmtClock(it.s));
    S(lbl, { fontSize: px(fs), top: px(-gh / 2 - 8 - fs * 1.2), lineHeight: "1.2" });
    return { el, G, lbl, it };
  }

  function buildSheet(parent, o) {
    const pad = o.pad ?? 36, nameW = o.nameW ?? 170, axisH = o.axisH ?? 84, fs = o.fs ?? 18, gh = o.gh ?? 18;
    const el = h("div", "sheet", parent);
    place(el, o.x, o.y, o.w, o.h);
    const x0 = pad + nameW, tw = o.w - pad * 2 - nameW, pxh = tw / (H1 - H0);
    const staffH = (o.h - pad - axisH - pad * 0.5) / DAY.length;
    const lx = (hr) => x0 + (hr - H0) * pxh;
    const ly = (i) => pad + axisH + staffH * (i + 0.6);
    const parts = { rules: [], lines: [], bars: [], hours: [], names: [] };
    const title = h("div", "a disp sh-title", el, "Today");
    S(title, { left: px(pad), top: px(pad - 2), fontSize: px(o.titleFs ?? 30) });
    const date = h("div", "a sh-date", el, "Tuesday 10 November");
    S(date, { left: px(pad + (o.titleFs ?? 30) * 2.9), top: px(pad + 6), fontSize: px(fs - 1) });
    for (let hr = H0; hr <= H1; hr++) {
      const lab = h("div", "a sh-hour tab", el, fmtHour(hr));
      S(lab, { left: px(lx(hr)), top: px(pad + axisH - 30), fontSize: px(fs - 3) });
      parts.hours.push(lab);
      const bar = h("div", "a sh-bar", el);
      place(bar, lx(hr), pad + axisH, null, o.h - pad - axisH - pad * 0.5);
      parts.bars.push(bar);
    }
    DAY.forEach((st, i) => {
      const r = h("div", "a sh-rule", el);
      place(r, pad, pad + axisH + staffH * i, o.w - pad * 2);
      parts.rules.push(r);
      const n = h("div", "a disp sh-name", el, st.name);
      S(n, { left: px(pad), top: px(ly(i) - fs * 0.6), fontSize: px(fs + 2) });
      parts.names.push(n);
      const ln = h("div", "a sh-lines", el);
      place(ln, x0, ly(i) - 16.5, tw);
      parts.lines.push(ln);
    });
    const items = {};
    DAY.forEach((st, i) =>
      st.items.forEach((it) => {
        const m = makeItem(el, it, gh, fs - 1, Math.max(it.d * pxh, gh * 2.2));
        place(m.el, lx(it.s), ly(i));
        m.staff = i;
        setG(m.G, ST[it.state]);
        if (it.state === "done") S(m.lbl, { color: "var(--ink-2)" });
        items[it.id] = m;
      })
    );
    const now = h("div", "now", el);
    place(now, 0, pad + axisH - 12, null, o.h - pad - axisH - pad * 0.5 + 12);
    const flag = h("div", "flag tab", now, "11:52");
    S(flag, { fontSize: px(fs - 2) });
    return { el, lx, ly, pxh, items, now, flag, parts, title, date, x: o.x, y: o.y, w: o.w, h: o.h, x0, tw, staffH, pad, axisH };
  }
  function setNow(SH, hr, draw = 1, op = 1) {
    S(SH.now, { left: px(SH.lx(hr)), transform: `scaleY(${draw.toFixed(4)})`, opacity: op.toFixed(3), visibility: op > 0.001 ? "visible" : "hidden" });
    S(SH.flag, { opacity: clamp(draw * 3 - 2).toFixed(3) });
    const txt = fmtClock(hr);
    if (SH.flag.textContent !== txt) SH.flag.textContent = txt;
  }

  /* ================= scene A: capture, place, done (one world, one camera) ================= */
  const VET = DAY[1].items[1];
  const COL = { x: 1100, w: 540 };
  const SHEET = { x: 1720, y: 300, w: 1320, h: 700 };
  const NEXT = { x: 3120, y: 300, w: 420, h: 318 };
  const INBOX = { x: COL.x, y: 440, w: COL.w, h: 400 };
  const CAP = { x: COL.x, y: 300, w: COL.w, h: 80 };
  const ROW0 = 92, ROWH = 66;
  const TYPED = "Call the vet from the train";

  function buildSceneA() {
    const scene = h("div", "scene", stage);
    const drift = buildDrift(scene, [
      { f: 0.35, op: 0.22, pieces: scatter(16, -500, 1500, -300, 900) },
      { f: 0.62, op: 0.32, pieces: scatter(14, -300, 2500, -250, 1050) },
    ], { forms: { n: 9, region: [-200, 2600, -150, 1100], f: 0.5, op: 0.26 } });
    const world = h("div", "world", scene);
    drift.grain = grain(scene);
    const A = { scene, world, drift, mb: mblur("mbA") };
    // a long, faint staff under the whole page that draws itself ahead of the pan into the day
    A.guide = Array.from({ length: 5 }, (_, i) => {
      const e = h("div", "a", world);
      place(e, 1060, 1046 + i * 9, 2560, 1);
      S(e, { background: "var(--rule-soft)", transformOrigin: "left" });
      return e;
    });

    // titles, printed on the page
    A.t1a = kline(world, [{ text: "Write it down now." }], 140, 368, 92);
    A.t1b = kline(world, [{ text: "Sort it out later.", cls: "ink3" }], 140, 368 + 96, 92);
    A.t1c = h("div", "a", world);
    S(A.t1c, { left: "146px", top: "612px", display: "flex", alignItems: "center", gap: "14px", fontSize: "24px", color: "var(--ink-2)", whiteSpace: "nowrap" });
    A.t1c.append("Press");
    const kc = h("span", null, A.t1c, "C");
    S(kc, { display: "inline-grid", placeItems: "center", width: "40px", height: "40px", border: "1px solid var(--rule)", borderRadius: "7px", background: "var(--sheet)", boxShadow: "0 2px 0 var(--rule)", fontWeight: 600, fontSize: "20px", color: "var(--ink)" });
    A.t1c.append("on any page. Two seconds, and back to your day.");
    A.t2 = kline(world, [{ text: "Drop it on the day. " }, { text: "Now it has a time.", cls: "ink3" }], SHEET.x, 150, 72);
    A.t3 = kline(world, [{ text: "Done, " }, { text: "without the fanfare.", cls: "ink3" }], 2300, 158, 74);

    // the C key, pressed
    A.key = h("div", "kbd", world, "C");
    place(A.key, COL.x, 196, 64, 64);
    S(A.key, { fontSize: "28px" });
    A.keyLbl = h("div", "a", world, "from any page");
    S(A.keyLbl, { left: px(COL.x + 84), top: "216px", fontSize: "20px", color: "var(--ink-3)", whiteSpace: "nowrap" });

    // the capture field
    A.cap = h("div", "capture", world);
    place(A.cap, CAP.x, CAP.y, CAP.w, CAP.h);
    A.capRing = h("div", "ring", A.cap);
    const cg = glyph(A.cap, "task", 16, 40);
    S(cg.g, { position: "relative", flex: "none" });
    setG(cg, ST.planned);
    const tw = h("div", null, A.cap);
    S(tw, { position: "relative", flex: "1", height: "30px", display: "flex", alignItems: "center" });
    A.ph = h("div", "ph", tw, "Capture anything, then place it later");
    S(A.ph, { fontSize: "21px" });
    A.typed = h("span", "typed", tw);
    A.typedTxt = document.createTextNode("");
    A.typed.append(A.typedTxt);
    A.caret = h("span", "caret", A.typed);
    A.enter = h("div", "kbd", A.cap, "Enter");
    S(A.enter, { position: "relative", flex: "none", width: "74px", height: "38px", fontSize: "15px" });

    // the inbox
    A.inbox = h("div", "card", world);
    place(A.inbox, INBOX.x, INBOX.y, INBOX.w, INBOX.h);
    S(A.inbox, { overflow: "hidden" });
    const ih = h("div", "a disp card-h", A.inbox, "Inbox");
    S(ih, { left: "28px", top: "28px" });
    A.count = h("div", "a count tab", A.inbox, "3");
    S(A.count, { right: "28px", top: "32px" });
    A.rows = ["Renew the passport", "Ideas for the garden", "Ask Jo about the cabin"].map((txt) => {
      const r = h("div", "row", A.inbox);
      S(r, { left: "28px", right: "28px", height: px(ROWH), borderTop: "1px solid var(--rule-soft)" });
      const g = glyph(r, "task", 16, 44);
      setG(g, ST.planned);
      h("span", null, r, txt);
      return r;
    });

    // the sheet of the day
    A.sh = buildSheet(world, SHEET);
    A.vet = A.sh.items.vet;

    // a slot that shows where the drop lands
    A.slot = h("div", "slot", A.sh.el);
    A.slotTime = h("div", "slot-time tab", A.slot, "");

    // next up
    A.next = h("div", "card", world);
    place(A.next, NEXT.x, NEXT.y, NEXT.w, NEXT.h);
    S(A.next, { overflow: "hidden" });
    const nh = h("div", "a disp card-h", A.next, "Next up");
    S(nh, { left: "28px", top: "28px" });
    A.nextRows = [DAY[1].items[1], DAY[0].items[2], DAY[2].items[2], DAY[1].items[2]].map((it) => {
      const r = h("div", "row", A.next);
      S(r, { left: "28px", right: "28px", height: "68px", borderTop: "1px solid var(--rule-soft)" });
      const g = glyph(r, it.type || "task", 16, 44);
      setG(g, ST[it.state]);
      const ttl = h("span", null, r, it.title);
      S(ttl, { overflow: "hidden", textOverflow: "ellipsis" });
      h("span", "tm", r, fmtClock(it.s));
      return { r, g, it };
    });

    // the chip carried from the field to the inbox, then to the day
    A.chip = h("div", "chip", world);
    S(A.chip, { height: "54px", fontSize: "19px", left: "0px", top: "0px", transformOrigin: "26px 27px" });
    A.chipRing = h("div", "a", A.chip);
    S(A.chipRing, { inset: "-1px", borderRadius: "10px", boxShadow: "inset 0 0 0 2px var(--accent)", opacity: 0 });
    A.chipG = glyph(A.chip, "task", 16, 44);
    setG(A.chipG, ST.planned);
    A.chipTxt = h("span", null, A.chip, TYPED);
    // bursts: the capture lands in the Inbox, the chip drops on the day, the item is done
    A.bLand = makeBurst(world, { n: 7, R: 40, seed: 3 });
    A.bDrop = makeBurst(world, { n: 9, R: 52, seed: 8, accent: true });
    A.bDone = makeBurst(world, { n: 10, R: 56, seed: 12, dur: 0.9 });
    S(A.count, { transformOrigin: "70% 50%" });
    return A;
  }

  /* Times for the world scene. The film and the loop tell the same story on different clocks. */
  const typeTimes = (t0, n, dt, seed) => {
    const r = mulberry32(seed), out = [];
    let t = t0;
    for (let i = 0; i < n; i++) {
      out.push(t);
      const ch = TYPED[i];
      t += dt * (0.65 + r() * 0.7) + (ch === " " ? dt * 0.5 : 0);
    }
    return out;
  };
  const TF = {
    keyC: 0.55, keyOut: 3.2, focus: 0.62, types: typeTimes(0.92, TYPED.length, 0.054, 7), enter: 2.74, send: 2.8, land: 3.28,
    t1: 3.45, t1b: 3.75, t1c: 4.15, t1out: 5.2,
    sheetIn: 5.4, t2: 6.55, cursorIn: 7.05, grab: 7.85, drag0: 7.95, drag1: 9.25, drop: 9.3, t2b: 9.85,
    nowIn: 10.25, now0: 10.95, now1: 12.35, nowFrom: 11 + 52 / 60, nowTo: 12 + 31 / 60, t2out: 12.55,
    nextIn: 13.35, cursor2: 13.85, click: 14.55, nextFlow: 15.3, t3: 15.45, t3out: 17.4, end: 18,
    cam: [
      { t: 0, cx: 1372, cy: 330, s: 1.62 },
      { t: 2.75, cx: 1372, cy: 345, s: 1.5, e: E.lin },
      { t: 4.35, cx: 900, cy: 560, s: 1.0, e: E.cam },
      { t: 5.35, cx: 915, cy: 560, s: 1.015, e: E.lin },
      { t: 6.75, cx: 2072, cy: 560, s: 0.92, e: E.cam },
      { t: 12.45, cx: 2085, cy: 575, s: 0.965, e: E.lin },
      { t: 14.1, cx: 2960, cy: 540, s: 1.28, e: E.cam },
      { t: 16.95, cx: 2981, cy: 544, s: 1.322, e: E.lin },
      // the dive: a whip back to the done vet item and into it; the next scene opens out of its head (keyed in assemble)
    ],
  };
  const TL = {
    keyC: 0.12, keyOut: 2.0, focus: 0.2, types: typeTimes(0.42, TYPED.length, 0.042, 7), enter: 1.82, send: 1.88, land: 2.32,
    sheetIn: -10, cursorIn: 2.55, grab: 3.25, drag0: 3.35, drag1: 4.55, drop: 4.6,
    nowIn: -10, now0: 4.95, now1: 6.0, nowFrom: 12 + 14 / 60, nowTo: 12 + 31 / 60,
    nextIn: null, cursor2: 6.25, click: 6.85, end: 9.6,
    cam: [{ t: 0, cx: 2072, cy: 560, s: 0.92 }],
  };

  /** When now first passes an hour, for a now that moves from `from` to `to` between n0 and n1. */
  function crossTime(T, hr) {
    let lo = T.now0, hi = T.now1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (nowHour(T, m) < hr) lo = m; else hi = m;
    }
    return hi;
  }
  const nowHour = (T, t) => lerp(T.nowFrom, T.nowTo, P(t, T.now0, T.now1, bez(0.55, 0, 0.3, 1)));

  function updateA(A, T, t, film) {
    const cam = camAt(T.cam, t);
    applyCam(A.world, cam);
    A.drift.update(t, cam);
    const [vx, vy] = camSpeed(T.cam, t);
    A.mb(A.scene, Math.min(1.6, vx * 0.1), Math.min(1, vy * 0.1)); // capped: the item stays readable through the whip

    // ---- the C key and the field
    appear(A.key, t, T.keyC - 0.35, T.keyOut, { dy: 14, blur: 8, dur: 0.5 });
    appear(A.keyLbl, t, T.keyC - 0.25, T.keyOut, { dy: 10, blur: 6, dur: 0.5 });
    const kp = bump(t, T.keyC, T.keyC + 0.22);
    S(A.key, { boxShadow: `0 ${(3 - 2.5 * kp).toFixed(2)}px 0 var(--rule), 0 8px 16px -8px rgb(14 12 10 / 0.3)`, translate: `0 ${(kp * 2.5).toFixed(2)}px`, scale: (pop(t, T.keyC - 0.35, 0.12) * pop(t, T.keyC + 0.16, 0.1)).toFixed(4) });
    // the faint staff under the page draws ahead of the pan
    A.guide.forEach((e, i) => S(e, { transform: `scaleX(${P(t, T.sheetIn - 0.3 + i * 0.07, T.sheetIn + 1.3 + i * 0.07, E.wipe).toFixed(4)})` }));
    const foc = P(t, T.focus, T.focus + 0.35) * (1 - P(t, T.send + 0.1, T.send + 0.6));
    S(A.capRing, { opacity: foc.toFixed(3), transform: `scale(${(1.02 - 0.02 * foc).toFixed(4)})` });
    let n = 0;
    for (const ts of T.types) if (t >= ts) n++;
    const sent = t >= T.send;
    const txt = sent ? "" : TYPED.slice(0, n);
    if (A.typedTxt.data !== txt) A.typedTxt.data = txt;
    S(A.ph, { opacity: (n === 0 || sent ? (sent ? P(t, T.send + 0.25, T.send + 0.6) : 1 - P(t, T.focus, T.focus + 0.2)) : 0).toFixed(3) });
    const typing = n > 0 && n < TYPED.length && t < T.types[TYPED.length - 1] + 0.1;
    const caretOn = foc > 0.5 && (typing || Math.floor((t - T.focus) * 2) % 2 === 0);
    S(A.caret, { opacity: caretOn ? 1 : 0 });
    const ep = bump(t, T.enter, T.enter + 0.2);
    S(A.enter, { translate: `0 ${(ep * 2.5).toFixed(2)}px`, boxShadow: `0 ${(3 - 2.5 * ep).toFixed(2)}px 0 var(--rule)`, scale: pop(t, T.enter + 0.12, 0.12).toFixed(4) });

    // ---- the chip: from the field into the inbox, then dragged onto the day
    const rowX = INBOX.x + 28 - 18, rowY = INBOX.y + ROW0; // chip top-left when it sits as the inbox's first row
    const fieldX = CAP.x + 22 + 40 + 16 - 18 - 44 - 14, fieldY = CAP.y + 13; // so its text starts where the typed text was
    const drag = t >= T.grab;
    let cx = 0, cy = 0, cs = 1, bg = 0, lift = 0, ring = 0, op = 1;
    if (t < T.send) op = 0;
    else if (t < T.land + 0.6 && !drag) {
      const fp = P(t, T.send, T.land, bez(0.3, 0, 0.2, 1));
      const sp = spring(t, T.land - 0.12, 2.4, 0.45);
      cx = lerp(fieldX, rowX, fp);
      const arc = -Math.sin(fp * Math.PI) * 40;
      cy = t < T.land - 0.12 ? lerp(fieldY, rowY, fp) + arc : lerp(fieldY, rowY, 1) + (1 - sp) * -18;
      cs = lerp(24 / 19, 1, P(t, T.send, T.send + 0.3));
      bg = P(t, T.send, T.send + 0.15) * (1 - P(t, T.land + 0.1, T.land + 0.5));
      lift = bg;
    } else if (!drag) {
      cx = rowX; cy = rowY;
    } else {
      // grabbed: lift, carry along an arc, then let go onto the Home staff at 12:30
      const sh = A.sh;
      const endX = sh.x + sh.lx(VET.s) - 26, endY = sh.y + sh.ly(1) - 27;
      const dp = P(t, T.drag0, T.drag1, E.drag);
      const ax = lerp(rowX, endX, dp), ay = lerp(rowY, endY, dp) - Math.sin(dp * Math.PI) * 150;
      cx = ax; cy = ay;
      lift = P(t, T.grab, T.grab + 0.2) * (1 - P(t, T.drop, T.drop + 0.15));
      bg = lift;
      ring = lift;
      cs = 1 + 0.045 * lift - 0.12 * P(t, T.drop, T.drop + 0.2);
      op = 1 - P(t, T.drop + 0.02, T.drop + 0.2, E.lin);
      // a little tilt while it travels
      A._tilt = Math.sin(dp * Math.PI) * -2.2 * (1 - P(t, T.drag1 - 0.15, T.drag1));
    }
    const tilt = drag ? A._tilt || 0 : 0;
    if (!drag) cs *= pop(t, T.land - 0.04, 0.11);
    A.bLand.fire(t, T.land - 0.02, rowX + 18 + 8, rowY + 27);
    S(A.chip, {
      transform: `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px) scale(${cs.toFixed(4)}) rotate(${tilt.toFixed(3)}deg)`,
      opacity: op.toFixed(3),
      visibility: op > 0.001 ? "visible" : "hidden",
      background: `rgb(from var(--sheet) r g b / ${bg.toFixed(3)})`,
      borderColor: `rgb(from var(--ink) r g b / ${(0.1 * bg).toFixed(3)})`,
      boxShadow: lift > 0.01 ? `0 ${(14 * lift).toFixed(1)}px ${(30 * lift).toFixed(1)}px rgb(28 27 34 / ${(0.26 * lift).toFixed(3)}), 0 2px 5px rgb(28 27 34 / ${(0.12 * lift).toFixed(3)})` : "none",
      fontSize: "19px",
    });
    S(A.chipRing, { opacity: ring.toFixed(3) });
    S(A.chipG.g, { opacity: P(t, T.send + 0.05, T.send + 0.3).toFixed(3) });

    // inbox rows make room for it, then close up when it leaves
    const inN = spring(t, T.land - 0.15, 2.2, 0.6) * (1 - P(t, T.grab + 0.15, T.grab + 0.6));
    A.rows.forEach((r, i) => {
      const y = ROW0 + (i + inN) * ROWH;
      S(r, { top: px(y), opacity: String(1 - clamp(y + ROWH - INBOX.h + 10, 0, 40) / 40) });
    });
    const cnt = t >= T.land && t < T.grab + 0.3 ? "4" : "3";
    if (A.count.textContent !== cnt) A.count.textContent = cnt;
    S(A.count, { scale: (pop(t, T.land, 0.32, 2.2) * pop(t, T.grab + 0.3, 0.22, 2.2)).toFixed(4) });

    // ---- the sheet rules itself in
    const sh = A.sh;
    const si = T.sheetIn;
    appear(sh.el, t, si, null, { dy: 40, blur: 0, dur: 0.9, s0: 0.985 });
    sh.parts.rules.forEach((r, i) => S(r, { transform: `scaleX(${P(t, si + 0.15 + i * 0.08, si + 0.95 + i * 0.08).toFixed(4)})` }));
    sh.parts.lines.forEach((r, i) => S(r, { transform: `scaleX(${P(t, si + 0.25 + i * 0.09, si + 1.15 + i * 0.09).toFixed(4)})` }));
    sh.parts.bars.forEach((r, i) => S(r, { opacity: P(t, si + 0.3 + i * 0.04, si + 0.8 + i * 0.04).toFixed(3) }));
    sh.parts.hours.forEach((r, i) => appear(r, t, si + 0.3 + i * 0.04, null, { dy: 8, blur: 6, dur: 0.6 }));
    sh.parts.names.forEach((r, i) => appear(r, t, si + 0.3 + i * 0.1, null, { dy: 10, blur: 8, dur: 0.7 }));
    appear(sh.title, t, si + 0.2, null, { dy: 12, blur: 8, dur: 0.7 });
    appear(sh.date, t, si + 0.3, null, { dy: 12, blur: 8, dur: 0.7 });
    let k = 0;
    for (const id in sh.items) {
      const m = sh.items[id];
      if (id === "vet") continue;
      const p = P(t, si + 0.5 + k * 0.06, si + 1.2 + k * 0.06);
      S(m.G.g, { transformOrigin: "left center", transform: `scaleX(${p.toFixed(4)})` });
      appear(m.lbl, t, si + 0.55 + k * 0.06, null, { dy: 8, blur: 6, dur: 0.6 });
      k++;
    }

    // ---- the slot under the dragged chip
    const dp = P(t, T.drag0, T.drag1, E.drag);
    const headX = lerp(rowX, sh.x + sh.lx(VET.s) - 26, dp) + 26 - sh.x;
    const snapped = clamp(Math.round(((headX - sh.x0) / sh.pxh + H0) * 4) / 4, H0, H1 - 1);
    const slotOn = t < T.drop ? P(t, lerp(T.drag0, T.drag1, 0.62), lerp(T.drag0, T.drag1, 0.85)) : 1 - P(t, T.drop, T.drop + 0.25);
    place(A.slot, sh.lx(snapped) - 6, sh.ly(1) - 24, VET.d * sh.pxh + 12, 48);
    S(A.slot, { opacity: (drag ? slotOn : 0).toFixed(3) });
    const stxt = `${fmtClock(snapped)} – ${fmtClock(snapped + VET.d)}`;
    if (A.slotTime.textContent !== stxt) A.slotTime.textContent = stxt;

    // ---- the vet beam: dropped, planned, then live as now crosses it, then done
    const vet = A.vet;
    const dropP = spring(t, T.drop, 2.3, 0.5);
    S(vet.el, { opacity: t >= T.drop ? 1 : 0 });
    S(vet.G.g, { transformOrigin: "left center", transform: `scaleX(${clamp(0.25 + 0.75 * dropP, 0, 1.2).toFixed(4)})` });
    appear(vet.lbl, t, T.drop + 0.05, null, { dy: 10, blur: 8, dur: 0.6 });
    const tc = crossTime(T, VET.s);
    const live = P(t, tc, tc + 0.55);
    const sweep = P(t, T.click + 0.05, T.click + 0.5);
    const sweepOut = P(t, T.click + 0.45, T.click + 0.75);
    const done = P(t, T.click + 0.42, T.click + 0.8);
    // a sheen runs along the beam once it is live; the done head springs in with a small overshoot
    const sheen = P(t, tc + 0.4, tc + 1.15, E.io);
    const doneS = t < T.click + 0.42 ? 0.55 : 0.55 + 0.45 * spring(t, T.click + 0.42, 2.4, 0.42);
    const vst = { plan: 1, live, sweep, sweepOut, done, sheen, doneS };
    setG(vet.G, vst);
    S(vet.G.g, { scale: (pop(t, T.click + 0.02, 0.08) * pop(t, tc, 0.06)).toFixed(4) });
    const vhx = sh.x + sh.lx(VET.s) + 9, vhy = sh.y + sh.ly(1);
    A.bDrop.fire(t, T.drop + 0.04, vhx, vhy);
    A.bDone.fire(t, T.click + 0.4, vhx, vhy);
    S(vet.lbl, { fontWeight: String(Math.round(500 + 200 * live * (1 - done))), color: `color-mix(in oklab, var(--ink) ${(100 - done * 100).toFixed(1)}%, var(--ink-2))` });

    // ---- now
    const nh = nowHour(T, t);
    setNow(sh, nh, P(t, T.nowIn, T.nowIn + 0.75, E.ax), 1);

    // ---- next up
    if (T.nextIn != null) {
      appear(A.next, t, T.nextIn, null, { dy: 40, blur: 10, dur: 0.9, s0: 0.97 });
      const fl = (i) => P(t, T.nextFlow + i * 0.07, T.nextFlow + 0.7 + i * 0.07);
      A.nextRows.forEach((R, i) => {
        if (i === 0) {
          setG(R.g, vst);
          const o = fl(0);
          S(R.r, { top: px(84 - o * 30), opacity: (1 - o).toFixed(3), transform: `translateX(${(-o * 40).toFixed(2)}px)` });
        } else {
          const y = 84 + (i - fl(i)) * 68;
          S(R.r, { top: px(y), opacity: (1 - clamp((y - 220) / 60)).toFixed(3) });
        }
      });
    } else S(A.next, { opacity: 0 });

    // ---- titles (film only)
    if (film) {
      kin(A.t1a, t, T.t1, T.t1out);
      kin(A.t1b, t, T.t1b, T.t1out + 0.08);
      appear(A.t1c, t, T.t1c, T.t1out + 0.12, { dy: 16, blur: 8, dur: 0.7 });
      kin(A.t2, t, T.t2, T.t2out, { part: 0 });
      kin(A.t2, t, T.t2b, T.t2out, { part: 1 });
      kin(A.t3, t, T.t3, T.t3out, { part: 0 });
      kin(A.t3, t, T.t3 + 0.25, T.t3out, { part: 1 });
    } else {
      for (const L of [A.t1a, A.t1b, A.t2, A.t3]) S(L.el, { display: "none" });
      S(A.t1c, { display: "none" });
    }

    // ---- the hand
    // the hand holds the chip by its left end, above the slot time and below the dropped label
    const grabPt = (x, y) => toScreen(cam, x + 6, y + 14);
    if (t >= T.cursorIn && t < T.drop + 1.1) {
      const [gx, gy] = grabPt(rowX, rowY);
      let x, y;
      if (t < T.grab) {
        const p = P(t, T.cursorIn, T.grab - 0.08, E.ax);
        const [sx, sy] = toScreen(cam, SHEET.x + 620, SHEET.y + 700);
        x = lerp(sx, gx, p); y = lerp(sy, gy, p);
      } else if (t < T.drop) {
        [x, y] = grabPt(cx, cy);
      } else {
        const [ex, ey] = grabPt(sh.x + sh.lx(VET.s) - 26, sh.y + sh.ly(1) - 27);
        const p = P(t, T.drop + 0.1, T.drop + 1.0);
        x = ex - p * 110; y = ey + p * 60; // away down-left, clear of the label and the time
      }
      const c1 = click(t, T.grab);
      const held = t >= T.grab && t < T.drop ? 0.6 : 0;
      cursor(x, y, P(t, T.cursorIn, T.cursorIn + 0.25) * (1 - P(t, T.drop + 0.3, T.drop + 0.7)), Math.max(c1.press, held), c1.ripple != null && c1.ripple < 1 ? c1.ripple : null);
    } else if (t >= T.cursor2 && t < T.click + 1.4) {
      const [hx, hy] = toScreen(cam, sh.x + sh.lx(VET.s) + 9, sh.y + sh.ly(1));
      const p = P(t, T.cursor2, T.click - 0.05, E.ax);
      const away = P(t, T.click + 0.35, T.click + 1.2);
      const x = lerp(hx + 380, hx, p) + away * 90, y = lerp(hy + 260, hy, p) + away * 120;
      const c = click(t, T.click);
      cursor(x, y, P(t, T.cursor2, T.cursor2 + 0.25) * (1 - P(t, T.click + 0.8, T.click + 1.3)), c.press, c.ripple);
    } else cursor(0, 0, 0);
  }

  /* ================= scene B: everything connects, one item in every view ================= */
  const WEEK = ["Mon 9", "Tue 10", "Wed 11", "Thu 12", "Fri 13", "Sat 14", "Sun 15"];
  const OTHER = [
    { day: 0, title: "Plan the week", s: 9, state: "done" },
    { day: 0, title: "Gym", s: 18, type: "event", state: "done" },
    { day: 0, title: "Book the dentist", s: 11, state: "done" },
    { day: 2, title: "Dentist", s: 9.5, type: "event", state: "planned" },
    { day: 2, title: "Draft the newsletter", s: 11, state: "planned" },
    { day: 2, title: "Water the plants", s: 17, state: "planned" },
    { day: 3, title: "Team lunch", s: 12, type: "event", state: "planned" },
    { day: 3, title: "Review pull requests", s: 14, state: "planned" },
    { day: 4, title: "Release notes", s: 10, state: "planned" },
    { day: 4, title: "Haircut", s: 16, type: "event", state: "planned" },
    { day: 5, title: "Farmers market", s: 9, state: "planned" },
    { day: 6, title: "Call Mum", s: 18, type: "event", state: "planned" },
  ];
  const POOL = ["Gym", "Pay rent", "Book club", "Haircut", "Plan the week", "Library books", "Water the plants", "Team lunch", "Run", "Call Mum", "Dentist", "Recycling", "Piano lesson", "Groceries", "Fix the bike"];

  function buildSceneB() {
    const scene = h("div", "scene", stage);
    const drift = buildDrift(scene, [{ f: 0.4, op: 0.2, pieces: scatter(14, -200, 2100, -100, 1200) }], { forms: { n: 6, region: [-100, 2000, -50, 1150], f: 0.55, op: 0.24 } });
    const world = h("div", "world", scene);
    drift.grain = grain(scene);
    const B = { scene, world, drift, mb: mblur("mbB") };
    B.t4a = kline(world, [{ text: "Everything " }, { text: "connects.", cls: "ink3" }], 140, 92, 80);
    B.t4b = kline(world, [{ text: "One item. " }, { text: "Every view.", cls: "ink3" }], 140, 92, 80);
    B.panel = h("div", "panel", world);
    B.head = [h("div", "a disp sh-title", B.panel, "Today"), h("div", "a disp sh-title", B.panel, "Week"), h("div", "a disp sh-title", B.panel, "November")];
    B.sub = h("div", "a sh-date", B.panel, "Tuesday 10 November");
    B.seg = h("div", "seg", B.panel);
    B.pill = h("div", "pill", B.seg);
    B.tabs = ["Today", "Week", "Month"].map((s) => h("span", null, B.seg, s));
    // view backgrounds
    B.bgT = h("div", "vgrid", B.panel);
    B.bgW = h("div", "vgrid", B.panel);
    B.bgM = h("div", "vgrid", B.panel);
    B.tNames = DAY.map((d) => h("div", "a disp sh-name", B.bgT, d.name));
    B.tLines = DAY.map(() => h("div", "a sh-lines", B.bgT));
    B.tRules = DAY.map(() => h("div", "a sh-rule", B.bgT));
    B.tHours = [];
    B.tBars = [];
    for (let hr = H0; hr <= H1; hr++) {
      B.tHours.push(h("div", "a sh-hour tab", B.bgT, fmtHour(hr)));
      B.tBars.push(h("div", "a sh-bar", B.bgT));
    }
    B.wHeads = WEEK.map((d, i) => {
      const e = h("div", "a", B.bgW, d);
      S(e, { fontSize: "17px", fontWeight: i === 1 ? 700 : 500, color: i === 1 ? "var(--ink)" : "var(--ink-3)" });
      return e;
    });
    B.wToday = h("div", "a", B.bgW);
    S(B.wToday, { height: "2px", background: "var(--ink)" });
    B.wSeps = WEEK.map(() => h("div", "a sh-bar", B.bgW));
    B.wRule = h("div", "a sh-rule", B.bgW);
    B.mHeads = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
      const e = h("div", "a", B.bgM, d);
      S(e, { fontSize: "15px", color: "var(--ink-3)" });
      return e;
    });
    B.mV = Array.from({ length: 8 }, () => h("div", "a sh-bar", B.bgM));
    B.mH = Array.from({ length: 7 }, () => h("div", "a sh-rule", B.bgM));
    B.mNums = [];
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 7; c++) {
        const date = r * 7 + c - 6; // 0 = Oct 31? Oct 26 is r0 c0 → Nov date = r*7+c-5
        const nov = r * 7 + c - 5;
        const label = nov < 1 ? String(31 + nov) : nov > 30 ? String(nov - 30) : String(nov);
        const e = h("div", "cellnum tab", B.bgM, label);
        if (nov < 1 || nov > 30) S(e, { opacity: 0.45 });
        if (nov === 10) S(e, { color: "var(--on-accent)", background: "var(--ink)", borderRadius: "999px", padding: "1px 7px", fontWeight: 700 });
        B.mNums.push({ e, r, c, nov, date });
      }
    B.mMore = h("div", "more", B.bgM, "8 more");

    // the items: today's ten glide between views; the rest of the week and month arrive around them
    const todays = [];
    DAY.forEach((st, si) => st.items.forEach((it) => todays.push({ ...it, staff: si, day: 1, state: it.id === "vet" ? "done" : it.state })));
    todays.sort((a, b) => a.s - b.s);
    B.items = todays.map((it) => mkMv(B.panel, it));
    B.others = OTHER.map((it) => mkMv(B.panel, it));
    // month-only extras, seeded, on November days outside this week
    B.extras = [];
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 7; c++) {
        const nov = r * 7 + c - 5;
        if (nov < 1 || nov > 30 || r === 2) continue;
        const n = Math.floor(rnd() * 2.6);
        for (let k = 0; k < n; k++) {
          const st = nov < 10 ? "done" : "planned";
          const m = mkMv(B.panel, { title: POOL[Math.floor(rnd() * POOL.length)], s: 9 + Math.floor(rnd() * 9), state: st, type: rnd() < 0.3 ? "event" : "task" });
          m.r = r; m.c = c; m.k = k;
          B.extras.push(m);
        }
      }
    // the note and its link
    B.note = h("div", "note", world);
    place(B.note, 1350, 318, 440);
    const nh3 = h("h3", "disp", B.note, "Notes for the vet");
    ["Ask about the booster.", "Moss has been off her food since Sunday.", "Records are in the blue folder."].forEach((s) => h("p", null, B.note, s));
    B.link = h("div", "link", B.note);
    B.linkG = glyph(B.link, "task", 14, 36);
    setG(B.linkG, ST.done);
    h("span", null, B.link, "Call the vet from the train");
    void nh3;
    B.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    B.svg.setAttribute("width", "1920");
    B.svg.setAttribute("height", "1080");
    B.svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
    world.appendChild(B.svg);
    B.path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    B.path.setAttribute("fill", "none");
    B.path.setAttribute("stroke", "var(--ink-2)");
    B.path.setAttribute("stroke-width", "2");
    B.path.setAttribute("stroke-linecap", "round");
    B.svg.appendChild(B.path);
    B.dot = h("div", "a", world);
    S(B.dot, { width: "12px", height: "12px", marginLeft: "-6px", marginTop: "-6px", borderRadius: "50%", background: "var(--ink-2)" });
    B.focus = h("div", "a", B.panel);
    S(B.focus, { borderRadius: "9px", border: "2px solid var(--accent)", boxSizing: "border-box" });
    B.bLink = makeBurst(world, { n: 7, R: 34, seed: 21 });
    return B;
  }
  function mkMv(parent, it) {
    const el = h("div", "mv", parent);
    const G = glyph(el, it.type || "task", 18, 100);
    S(G.g, { left: "0px" });
    setG(G, ST[it.state]);
    const lbl = h("div", "lbl", el);
    lbl.append(document.createTextNode(it.title + "  "));
    h("span", "tm", lbl, fmtClock(it.s));
    S(lbl, { color: it.state === "done" ? "var(--ink-2)" : "var(--ink)" });
    return { el, G, lbl, it };
  }

  /* Layouts: where an item sits in each view, for a panel rect R. */
  function layT(R, it) {
    const x0 = R.x + 36 + 150, tw = R.w - 72 - 150, pxh = tw / (H1 - H0);
    const staffH = (R.h - 110 - 24) / 3;
    const cy = R.y + 110 + staffH * (it.staff + 0.6);
    const gh = 18, fs = 17;
    return { x: x0 + (it.s - H0) * pxh, y: cy - gh / 2 - 8 - fs * 1.2, w: Math.max(it.d * pxh, gh * 2.2), gh, fs, lw: 420, op: 1 };
  }
  function weekCol(R, day) {
    const cw = (R.w - 72) / 7;
    return { x: R.x + 36 + day * cw, w: cw };
  }
  function layW(R, it, k) {
    const c = weekCol(R, it.day);
    return { x: c.x + 14, y: R.y + 110 + 58 + k * 50, w: c.w - 28, gh: 13, fs: 15, lw: c.w - 28, op: 1 };
  }
  function monthCell(R, r, c) {
    const cw = (R.w - 72) / 7, ch = (R.h - 110 - 36 - 22) / 6;
    return { x: R.x + 36 + c * cw, y: R.y + 110 + 36 + r * ch, w: cw, h: ch };
  }
  function layM(R, r, c, k, n) {
    const cell = monthCell(R, r, c);
    const gh = 9, fs = 13;
    if (k >= n) return { x: cell.x + cell.w - 70, y: cell.y + 10, w: 30, gh, fs, lw: 30, op: 0 };
    return { x: cell.x + 12, y: cell.y + 34 + k * 30, w: Math.min(cell.w - 24, 46 + 30 * (k % 2)), gh, fs, lw: cell.w - 24, op: 1 };
  }
  function mixL(a, b, p) {
    const o = {};
    for (const k in a) o[k] = lerp(a[k], b[k], p);
    return o;
  }
  function putMv(m, L, extraOp = 1) {
    S(m.el, { left: px(L.x), top: px(L.y), width: px(L.w), opacity: (L.op * extraOp).toFixed(3), visibility: L.op * extraOp > 0.002 ? "visible" : "hidden" });
    S(m.G.g, { "--gh": px(L.gh), width: px(L.w), top: px(L.fs * 1.2 + 8) });
    S(m.lbl, { fontSize: px(L.fs), maxWidth: px(L.lw), lineHeight: "1.2" });
  }

  const TB = {
    t4: 18.4, t4out: 21.1, t4b: 21.55, t4bout: 25.35, focus: 18.7, note: 18.85, draw0: 19.35, draw1: 20.15, noteOut: 21.2,
    expand0: 21.25, expand1: 22.15, toWeek: 22.4, toMonth: 23.85, wipe: 25.7,
    open0: 17.72, open1: 18.32, // the circle that opens out of the vet item's head
    cam: [
      // first key (17.72, on the vet item, close) is set in assemble
      { t: 19.0, cx: 960, cy: 540, s: 1.03, e: bez(0.25, 0.6, 0.2, 1) },
      { t: 21.2, cx: 960, cy: 540, s: 1.0, e: E.lin },
      { t: 22.3, cx: 960, cy: 550, s: 0.985, e: E.cam },
      { t: 26.4, cx: 960, cy: 545, s: 1.02, e: E.lin },
    ],
  };

  function updateB(B, t) {
    const T = TB;
    const cam = camAt(T.cam, t);
    applyCam(B.world, cam);
    B.drift.update(t, cam);
    const [vx, vy] = camSpeed(T.cam, t);
    B.vel = [Math.min(1.6, vx * 0.1), Math.min(1, vy * 0.1)]; // capped, so the pull back out of the circle stays readable
    kin(B.t4a, t, T.t4, T.t4out, { part: 0 });
    kin(B.t4a, t, T.t4 + 0.2, T.t4out, { part: 1 });
    kin(B.t4b, t, T.t4b, T.t4bout, { part: 0 });
    kin(B.t4b, t, T.t4b + 0.55, T.t4bout, { part: 1 });

    const ep = P(t, T.expand0, T.expand1, E.ax);
    const R = { x: 140, y: 236, w: lerp(1130, 1640, ep), h: 770 };
    place(B.panel, R.x, R.y, R.w, R.h);
    const L = { x: 0, y: 0, w: R.w, h: R.h }; // panel-local
    // header
    const vp = (a) => P(t, a, a + 0.85, E.ax);
    const pW = vp(T.toWeek), pM = vp(T.toMonth);
    const wT = 1 - pW, wW = pW * (1 - pM), wM = pM;
    [wT, wW, wM].forEach((w, i) => {
      S(B.head[i], { left: "36px", top: "34px", opacity: w.toFixed(3), filter: blurF((1 - w) * 8), transform: `translateY(${((1 - w) * (i === 0 ? -1 : 1) * 10).toFixed(2)}px)` });
    });
    S(B.sub, { left: "190px", top: "42px", opacity: wT.toFixed(3) });
    place(B.seg, L.w - 36 - 298, 26);
    // the pill springs to the new tab (a few px past, then back); the chosen label pops
    const pp = spring(t, T.toWeek - 0.02, 2.0, 0.55) + spring(t, T.toMonth - 0.02, 2.0, 0.55);
    S(B.pill, { left: px(4 + 96 * pp), scale: (pop(t, T.toWeek, 0.08) * pop(t, T.toMonth, 0.08)).toFixed(4) });
    B.tabs.forEach((s, i) => S(s, { color: Math.round(pW + pM) === i ? "var(--ink)" : "var(--ink-3)", scale: (i === 1 ? pop(t, T.toWeek + 0.02, 0.14) : i === 2 ? pop(t, T.toMonth + 0.02, 0.14) : 1).toFixed(4) }));

    // today backdrop
    const x0 = 36 + 150, tw = L.w - 72 - 150, pxh = tw / (H1 - H0), staffH = (L.h - 110 - 24) / 3;
    S(B.bgT, { opacity: wT.toFixed(3), transform: `scale(${lerp(0.985, 1, wT).toFixed(4)})` });
    DAY.forEach((_, i) => {
      const cy = 110 + staffH * (i + 0.6);
      place(B.tNames[i], 36, cy - 12);
      S(B.tNames[i], { fontSize: "20px" });
      place(B.tLines[i], x0, cy - 16.5, tw);
      place(B.tRules[i], 36, 110 + staffH * i, L.w - 72);
    });
    B.tHours.forEach((e, i) => place(e, x0 + i * pxh, 110 - 30));
    B.tBars.forEach((e, i) => place(e, x0 + i * pxh, 110, null, L.h - 110 - 24));
    // week backdrop
    S(B.bgW, { opacity: wW.toFixed(3) });
    const cw = (L.w - 72) / 7;
    B.wHeads.forEach((e, i) => place(e, 36 + i * cw + 14, 128));
    place(B.wToday, 36 + cw + 14, 156, 58);
    B.wSeps.forEach((e, i) => place(e, 36 + i * cw, 116, null, L.h - 140));
    place(B.wRule, 36, 166, L.w - 72);
    // month backdrop
    S(B.bgM, { opacity: wM.toFixed(3) });
    const mcw = cw, mch = (L.h - 110 - 36 - 22) / 6;
    B.mHeads.forEach((e, i) => place(e, 36 + i * mcw + 12, 118));
    B.mV.forEach((e, i) => place(e, 36 + i * mcw, 146, null, mch * 6));
    B.mH.forEach((e, i) => place(e, 36, 146 + i * mch, L.w - 72));
    B.mNums.forEach((n) => place(n.e, 36 + n.c * mcw + 10, 146 + n.r * mch + 7));
    place(B.mMore, 36 + 1 * mcw + mcw - 64, 146 + 2 * mch + 9);
    S(B.mMore, { opacity: P(t, T.toMonth + 0.5, T.toMonth + 0.8).toFixed(3), scale: pop(t, T.toMonth + 0.5, 0.25).toFixed(4) });

    // items (positions are panel-local; layouts use R at origin)
    const R0 = { x: 0, y: 0, w: L.w, h: L.h };
    const stagger = 0.03;
    B.items.forEach((m, i) => {
      const a = layT(R0, m.it), b = layW(R0, m.it, i), c = layM(R0, 2, 1, i, 2);
      const p1 = P(t, T.toWeek + i * stagger, T.toWeek + 0.8 + i * stagger, E.ax);
      const p2 = P(t, T.toMonth + i * stagger, T.toMonth + 0.8 + i * stagger, E.ax);
      let Lx = mixL(a, b, p1);
      Lx = mixL(Lx, c, p2);
      // a gentle arc while it travels
      Lx.y -= Math.sin(p1 * Math.PI) * 18 + Math.sin(p2 * Math.PI) * 18;
      putMv(m, Lx);
    });
    // the rest of the week fades in around today's column, a ripple outward
    const perDay = {};
    B.others.forEach((m) => {
      const k = (perDay[m.it.day] = (perDay[m.it.day] ?? -1) + 1);
      const d = Math.abs(m.it.day - 1);
      const inW = P(t, T.toWeek + 0.25 + d * 0.07, T.toWeek + 0.9 + d * 0.07);
      const r = 2, c = m.it.day;
      const b = layW(R0, m.it, k), cM = layM(R0, r, c, k, 2);
      const p2 = P(t, T.toMonth + d * 0.03, T.toMonth + 0.8 + d * 0.03, E.ax);
      const Lx = mixL(b, cM, p2);
      putMv(m, Lx, inW);
      S(m.el, { filter: blurF((1 - inW) * 8) });
    });
    // the month fills, rippling out from today
    B.extras.forEach((m) => {
      const d = Math.hypot(m.c - 1, (m.r - 2) * 1.2);
      const p = P(t, T.toMonth + 0.3 + d * 0.06, T.toMonth + 0.9 + d * 0.06);
      putMv(m, layM(R0, m.r, m.c, m.k, 2), p);
      S(m.el, { filter: blurF((1 - p) * 8) });
    });

    // ---- the note and the link
    const vetM = B.items.find((m) => m.it.id === "vet");
    const vL = layT(R0, vetM.it);
    const fo = P(t, T.focus, T.focus + 0.4) * (1 - P(t, T.noteOut - 0.2, T.noteOut + 0.2));
    place(B.focus, vL.x - 10, vL.y - 8, 330, vL.fs * 1.2 + 8 + vL.gh + 18);
    S(B.focus, { opacity: fo.toFixed(3), transform: `scale(${(lerp(1.06, 1, spring(t, T.focus, 2.2, 0.5)) ).toFixed(4)})` });
    const nIn = P(t, T.note, T.note + 0.9, E.ax);
    const nOut = P(t, T.noteOut, T.noteOut + 0.5, E.exit);
    S(B.note, {
      opacity: (nIn * (1 - nOut)).toFixed(3),
      transform: `translate(${((1 - nIn) * 50 + nOut * 120).toFixed(2)}px,${((1 - nIn) * 10).toFixed(2)}px)`,
      clipPath: `inset(0 0 ${((1 - nIn) * 100).toFixed(2)}% 0 round 14px)`,
      filter: blurF((1 - nIn) * 6 + nOut * 8),
      visibility: nIn * (1 - nOut) > 0.001 ? "visible" : "hidden",
    });
    const ax0 = R.x + vL.x + vL.w + 8, ay0 = R.y + vL.y + vL.fs * 1.2 + 8 + vL.gh / 2;
    const lk = B.link;
    const bx = 1350 + (1 - nIn) * 50 + nOut * 120, by = 318 + lk.offsetTop + lk.offsetHeight / 2;
    const d = `M ${ax0} ${ay0} C ${ax0 + 160} ${ay0 - 150}, ${bx - 220} ${by - 110}, ${bx - 4} ${by}`;
    B.path.setAttribute("d", d);
    const len = 900;
    const dr = P(t, T.draw0, T.draw1, E.io) * (1 - nOut);
    B.path.setAttribute("stroke-dasharray", `${len} ${len}`);
    B.path.setAttribute("stroke-dashoffset", String(len * (1 - dr)));
    B.path.style.opacity = String((1 - nOut) * (dr > 0 ? 1 : 0));
    place(B.dot, ax0, ay0);
    S(B.dot, { opacity: (P(t, T.draw0 - 0.1, T.draw0 + 0.1) * (1 - nOut)).toFixed(3) });
    const pulse = bump(t, T.draw1 - 0.05, T.draw1 + 0.45);
    S(B.link, { background: `color-mix(in oklab, var(--hover), var(--accent-wash) ${(pulse * 100).toFixed(1)}%)`, scale: pop(t, T.draw1 - 0.02, 0.07).toFixed(4) });
    B.bLink.fire(t, T.draw1 - 0.04, bx + 6, by);

    // ---- the hand switches views
    const tabPt = (i) => toScreen(cam, R.x + L.w - 36 - 298 + 4 + 96 * i + 48, R.y + 26 + 24);
    if (t > T.expand1 - 0.4 && t < T.toMonth + 1.3) {
      const [w1x, w1y] = tabPt(1), [w2x, w2y] = tabPt(2);
      let x, y;
      const a = P(t, T.expand1 - 0.4, T.toWeek - 0.05, E.ax);
      const b = P(t, T.toWeek + 0.6, T.toMonth - 0.05, E.ax);
      x = lerp(lerp(w1x + 260, w1x, a), w2x, b);
      y = lerp(lerp(w1y + 320, w1y, a), w2y, b);
      const away = P(t, T.toMonth + 0.35, T.toMonth + 1.2);
      x += away * 120; y += away * 260;
      const c1 = click(t, T.toWeek - 0.02), c2 = click(t, T.toMonth - 0.02);
      cursor(x, y, P(t, T.expand1 - 0.4, T.expand1 - 0.15) * (1 - P(t, T.toMonth + 0.8, T.toMonth + 1.2)), Math.max(c1.press, c2.press), t > T.toMonth - 0.02 ? c2.ripple : c1.ripple);
    } else cursor(0, 0, 0);
  }

  /* ================= scene C: the desktop, at night ================= */
  const BRAND = (size, dark) =>
    `<svg viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" rx="7" fill="${dark ? "#111218" : "#efeee8"}"/><g fill="none" stroke="${dark ? "#ecebe6" : "#14151b"}" stroke-linecap="round"><path d="M5 20.5h22M12 5v22" stroke-width="2.75"/><path d="M19.5 16v9M24.5 16v9" stroke-width="2.25"/></g><circle cx="12" cy="20.5" r="3.75" fill="${dark ? "#47d3b8" : "#066a5b"}"/></svg>`;
  const WIN = { x: 104, y: 76, w: 1250, h: 830 };
  const ICON = {
    wifi: (off) =>
      `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#ecebe6" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 7.5a11 11 0 0 1 15 0" opacity="${off ? 0.35 : 1}"/><path d="M5 10.5a7.2 7.2 0 0 1 10 0" opacity="${off ? 0.35 : 1}"/><path d="M7.6 13.4a3.4 3.4 0 0 1 4.8 0" opacity="${off ? 0.35 : 1}"/><circle cx="10" cy="16" r="0.9" fill="#ecebe6" stroke="none"/>${off ? '<path d="M3.5 3.5l13 13" stroke="#ecebe6"/>' : ""}</svg>`,
    vol: `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#ecebe6" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3 8h3l4-3.5v11L6 12H3z"/><path d="M13 7.5a3.5 3.5 0 0 1 0 5M15.2 5.5a6.5 6.5 0 0 1 0 9"/></svg>`,
    chev: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="#ecebe6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5L10 8l4.5 4.5"/></svg>`,
    folder: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#bcbcb6" stroke-width="1.5" stroke-linejoin="round"><path d="M3 6.5h6l2 2h10v10H3z"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#bcbcb6" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17"/></svg>`,
  };

  function buildSceneC() {
    const scene = h("div", "scene night desk", stage);
    // a wallpaper: the night paper with one large faint staff running through it
    const wall = h("div", "a", scene);
    S(wall, { inset: "0", background: "radial-gradient(80% 70% at 30% 10%, rgb(71 211 184 / 0.05), transparent 60%), var(--paper-2)" });
    const drift = buildDrift(scene, [{ f: 0.3, op: 0.16, pieces: scatter(16, -200, 2100, -100, 1100) }], { forms: { n: 5, region: [1300, 2000, -50, 1000], f: 0.45, op: 0.2 } });
    const big = h("div", "a", scene);
    S(big, { left: "-100px", right: "-100px", top: "640px", height: "180px", background: "repeating-linear-gradient(to bottom, rgb(236 235 230 / 0.05) 0 2px, transparent 2px 44px)" });
    const world = h("div", "world", scene);
    drift.grain = grain(scene);
    const C = { scene, world, drift, mb: mblur("mbC") };
    // a hairline under the captions that rules itself in with each new line
    C.capRule = h("div", "a", world);
    place(C.capRule, 1432, 432, 380, 1);
    S(C.capRule, { background: "var(--rule)" });
    C.t5 = kline(world, [{ text: "On the desktop, " }], 1430, 110, 64);
    C.t5b = kline(world, [{ text: "too.", cls: "ink3" }], 1430, 110 + 66, 64);
    C.subs = [
      ["Today’s list,", "in the tray."],
      ["A reminder,", "ten minutes before."],
      ["No connection?", "Capture anyway."],
      ["Back online,", "it sends itself."],
    ].map((ls) => {
      const L1 = kline(world, [{ text: ls[0], cls: "ink2" }], 1432, 320, 40);
      const L2 = kline(world, [{ text: ls[1], cls: "ink3" }], 1432, 366, 40);
      return [L1, L2];
    });

    // the window
    C.win = h("div", "win", world);
    place(C.win, WIN.x, WIN.y, WIN.w, WIN.h);
    const tb = h("div", "titlebar", C.win);
    tb.innerHTML = BRAND(20, true) + "<span>Axiis</span>";
    C.badge = h("div", "badge", tb, "Offline");
    S(C.badge, { left: "110px", top: "10px" });
    const caps = h("div", "caps", tb);
    caps.innerHTML =
      '<span><svg width="12" height="12"><path d="M1 6.5h10" stroke="#bcbcb6" stroke-width="1.2"/></svg></span><span><svg width="12" height="12"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="#bcbcb6" stroke-width="1.2"/></svg></span><span><svg width="12" height="12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="#bcbcb6" stroke-width="1.2"/></svg></span>';
    const rail = h("div", "rail", C.win);
    const pl = (label, on, n) => {
      const e = h("div", "pl" + (on ? " on" : ""), rail);
      h("span", null, e, label);
      if (n != null) return h("span", "n", e, n);
      return null;
    };
    h("div", "grp", rail, "Plan");
    pl("Today", true);
    pl("Week");
    pl("Month");
    pl("Due");
    h("div", "grp", rail, "Library");
    C.inboxN = pl("Inbox", false, "3");
    C.inboxRow = C.inboxN.parentElement;
    pl("Lists");
    pl("Notes");
    C.sh = buildSheet(C.win, { x: 252, y: 76, w: 966, h: 640, pad: 30, nameW: 124, axisH: 72, fs: 16, gh: 15, titleFs: 26 });
    setG(C.sh.items.vet.G, ST.done);
    S(C.sh.items.vet.lbl, { color: "var(--ink-2)" });
    setNow(C.sh, 12 + 50 / 60);
    // the outbox line
    C.outbox = h("div", "outbox", C.win);
    place(C.outbox, 252, 742, 966, 58);
    C.obG = glyph(C.outbox, "task", 14, 38);
    S(C.obG.g, { position: "relative", flex: "none" });
    setG(C.obG, ST.planned);
    C.obTxt = h("span", null, C.outbox, "1 capture is saved on this device and will be sent when you are back online.");

    // the taskbar
    const bar = h("div", "taskbar", scene);
    const mid = h("div", "a", bar);
    S(mid, { left: "50%", top: "0", height: "52px", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "22px" });
    mid.innerHTML = ICON.folder + ICON.globe + `<span style="position:relative;display:grid;place-items:center">${BRAND(30, true)}<i style="position:absolute;bottom:-9px;width:16px;height:3px;border-radius:2px;background:#9b9b96"></i></span>`;
    const tray = h("div", "a", bar);
    S(tray, { right: "18px", top: "0", height: "52px", display: "flex", alignItems: "center", gap: "16px" });
    tray.innerHTML = ICON.chev;
    C.trayIcon = h("span", null, tray);
    C.trayIcon.innerHTML = BRAND(20, true);
    S(C.trayIcon, { display: "grid", placeItems: "center", width: "34px", height: "34px", borderRadius: "6px" });
    C.wifi = h("span", null, tray);
    C.wifi.innerHTML = ICON.wifi(false);
    S(C.wifi, { display: "grid" });
    const vol = h("span", null, tray);
    vol.innerHTML = ICON.vol;
    S(vol, { display: "grid" });
    const clock = h("div", "tab", tray);
    S(clock, { textAlign: "right", fontSize: "13px", lineHeight: "1.35", color: "#ecebe6", marginLeft: "4px" });
    clock.innerHTML = "12:50 PM<br>10/11/2026";
    C.offWifi = false;

    // the tray menu
    C.menu = h("div", "menu", scene);
    const rows = ["Today · 6 of 10 done", "1:00 PM  Design sync", "2:00 PM  Run", "3:30 PM  Packing list", "-", "Open Axiis", "Capture (Ctrl+Alt+A)", "Quit"];
    C.hov = h("div", "hov", C.menu);
    C.menuRows = rows.map((r, i) => {
      if (r === "-") return h("div", "sep", C.menu);
      const e = h("div", "mi tab", C.menu, r);
      if (i === 0) S(e, { color: "var(--ink-3)" });
      return e;
    });
    S(C.menu, { width: "330px", right: "120px", bottom: "62px" });

    // the reminder
    C.toast = h("div", "toast", scene);
    S(C.toast, { width: "400px", right: "16px", bottom: "68px" });
    C.toast.innerHTML =
      `<div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#9b9b96;margin-bottom:14px">${BRAND(18, true)}<span>Axiis</span><span style="margin-left:auto;font-size:16px">✕</span></div>` +
      `<div style="font-size:19px;font-weight:650;color:#ecebe6;margin-bottom:6px">Design sync</div>` +
      `<div style="font-size:17px;color:#bcbcb6">Starts in 10 minutes</div>`;

    // Ctrl+Alt+A and the quick capture window
    C.keys = ["Ctrl", "Alt", "A"].map((k, i) => {
      const e = h("div", "kbd", world, k);
      place(e, 1432 + i * 92, 450, 80, 56);
      S(e, { fontSize: "18px" });
      return e;
    });
    C.qc = h("div", "qc", world);
    place(C.qc, 420, 392, 760, 84);
    const qg = glyph(C.qc, "task", 16, 40);
    S(qg.g, { position: "relative", flex: "none" });
    setG(qg, ST.planned);
    const qw = h("div", null, C.qc);
    S(qw, { position: "relative", flex: "1", display: "flex", alignItems: "center", height: "30px" });
    C.qPh = h("div", "a", qw, "Capture anything, then place it later");
    S(C.qPh, { color: "var(--ink-3)", fontSize: "21px" });
    C.qTyped = h("span", "typed", qw);
    C.qTxt = document.createTextNode("");
    C.qTyped.append(C.qTxt);
    C.qCaret = h("span", "caret", C.qTyped);
    const qr = h("div", "a", C.qc);
    S(qr, { inset: "-5px", borderRadius: "16px", border: "2px solid var(--accent)" });
    // the capture flying into the Inbox
    C.fly = h("div", "chip", world);
    S(C.fly, { height: "48px", fontSize: "17px", background: "var(--sheet)", boxShadow: "var(--lift)" });
    const fg = glyph(C.fly, "task", 14, 38);
    setG(fg, ST.planned);
    h("span", null, C.fly, "Pick up the prescription");
    C.bEnter = makeBurst(world, { n: 8, R: 44, seed: 31 });
    C.bInbox = makeBurst(world, { n: 7, R: 36, seed: 32 });
    C.bWifi = makeBurst(scene, { n: 0, ring: 22, seed: 33, dur: 0.9 });
    C.bOnline = makeBurst(scene, { n: 0, ring: 22, seed: 34, dur: 0.9, accent: true });
    return C;
  }
  const QTEXT = "Pick up the prescription";
  const TC = {
    wipe0: 25.7, wipe1: 26.45, t5: 26.6, cursorIn: 27.0, trayClick: 27.6, menuClose: 29.0,
    sub: [[27.8, 28.95], [29.3, 30.4], [30.75, 32.75], [32.95, 33.55]],
    toast: 29.2, toastOut: 30.45, offline: 30.45, keys: 30.85, qc: 31.05, qType: 31.25, qEnter: 32.15, outbox: 32.3,
    online: 32.85, flyIn: 33.0, wipe2: 33.55, end: 34.25,
    cam: [
      // the desktop slides in behind the passing now line, in the same direction, and settles
      { t: 25.7, cx: 1150, cy: 540, s: 1.05 },
      { t: 27.2, cx: 960, cy: 540, s: 1.0, e: bez(0.2, 0.7, 0.25, 1) },
      { t: 34.3, cx: 975, cy: 548, s: 1.03, e: E.lin },
    ],
  };
  const qTimes = typeTimes(TC.qType, QTEXT.length, 0.033, 11);

  function updateC(C, t) {
    const T = TC;
    const cam = camAt(T.cam, t);
    applyCam(C.world, cam);
    C.drift.update(t, cam);
    const [vx, vy] = camSpeed(T.cam, t);
    C.mb(C.scene, Math.min(1.6, vx * 0.1), Math.min(1, vy * 0.1));
    kin(C.t5, t, T.t5, null);
    kin(C.t5b, t, T.t5 + 0.25, null);
    C.subs.forEach(([a, b], i) => {
      const [ti, to] = T.sub[i];
      kin(a, t, ti, i === 3 ? null : to, { st: 0.06, dur: 0.7 });
      kin(b, t, ti + 0.12, i === 3 ? null : to, { st: 0.06, dur: 0.7 });
    });
    appear(C.win, t, T.wipe0 - 0.2, null, { dy: 30, blur: 0, dur: 1.2, s0: 0.97 });

    // the caption rule: draws in from the left with each line, leaves to the right
    let rl = 0, rr = 1;
    T.sub.forEach(([ti, to], i) => {
      if (t >= ti - 0.05 && (i === 3 || t < to + 0.3)) {
        rr = 1 - P(t, ti - 0.05, ti + 0.55, E.wipe);
        rl = i === 3 ? 0 : P(t, to - 0.05, to + 0.3, E.exit);
      }
    });
    S(C.capRule, { clipPath: `inset(0 ${(rr * 100).toFixed(2)}% 0 ${(rl * 100).toFixed(2)}%)` });

    // tray menu: springs up out of the tray, and folds back into it when it closes
    const mo = spring(t, T.trayClick + 0.02, 2.6, 0.62);
    const mc = P(t, T.menuClose, T.menuClose + 0.26, E.exit);
    const mop = clamp(P(t, T.trayClick, T.trayClick + 0.12, E.lin) * (1 - mc));
    S(C.menu, { opacity: mop.toFixed(3), visibility: mop > 0.001 ? "visible" : "hidden", transform: `translateY(${((1 - mo) * 14 + mc * 16).toFixed(2)}px) scale(${((0.97 + 0.03 * mo) * (1 - 0.08 * mc)).toFixed(4)})` });
    // the hover follows the hand down the timed items (the hand stays at the right end of the rows, clear of the text)
    const hv = t < 28.55 ? 2 : 3;
    const hy = 6 + [0, 0, 38, 76, 114][hv];
    S(C.hov, { top: px(hy), opacity: (P(t, 28.08, 28.18, E.lin) * (1 - mc)).toFixed(3) });
    S(C.trayIcon, { background: mop > 0.01 ? `rgb(236 235 230 / ${(0.1 * mop).toFixed(3)})` : "transparent", scale: (pop(t, T.trayClick, 0.18) * pop(t, T.menuClose + 0.18, 0.14)).toFixed(4) });

    // reminder: slides out of the tray corner on a spring
    const tsp = spring(t, T.toast, 1.7, 0.6), tiO = P(t, T.toast, T.toast + 0.2, E.lin), to = P(t, T.toastOut, T.toastOut + 0.4, E.exit);
    S(C.toast, { transform: `translateX(${((1 - tsp) * 440 + to * 440).toFixed(2)}px)`, opacity: (tiO * (1 - to)).toFixed(3), visibility: tiO * (1 - to) > 0.001 ? "visible" : "hidden" });

    // offline, capture, back online
    const off = t >= T.offline && t < T.online;
    if (off !== C.offWifi) { C.wifi.innerHTML = ICON.wifi(off); C.offWifi = off; }
    const sr0 = stage.getBoundingClientRect(), wr = C.wifi.getBoundingClientRect();
    const wcx = wr.left - sr0.left + wr.width / 2, wcy = wr.top - sr0.top + wr.height / 2;
    C.bWifi.fire(t, T.offline, wcx, wcy);
    C.bOnline.fire(t, T.online, wcx, wcy);
    S(C.wifi, { scale: (pop(t, T.offline, 0.3) * pop(t, T.online, 0.3)).toFixed(4) });
    appear(C.badge, t, T.offline, T.online, { dy: 6, blur: 4, dur: 0.4, outDur: 0.3 });
    S(C.badge, { scale: pop(t, T.offline + 0.05, 0.2).toFixed(4) });
    C.keys.forEach((k, i) => {
      appear(k, t, T.keys + i * 0.06, T.qEnter - 0.2, { dy: 16, blur: 8, dur: 0.45 });
      const kp = bump(t, T.keys + 0.2 + i * 0.05, T.keys + 0.45 + i * 0.05);
      S(k, { translate: `0 ${(kp * 3).toFixed(2)}px`, scale: pop(t, T.keys + 0.3 + i * 0.05, 0.12).toFixed(4) });
    });
    // the quick capture window springs open; on Enter it drops into the window as the outbox line
    const qIn = P(t, T.qc, T.qc + 0.5, E.ax), qs = spring(t, T.qc, 2.2, 0.55);
    const qm = P(t, T.qEnter + 0.02, T.qEnter + 0.42, E.drag);
    const ob = { x: WIN.x + 252, y: WIN.y + 742, w: 966, h: 58 };
    const qk = lerp(1, ob.h / 84, qm);
    const qdx = lerp(0, ob.x - 420, qm), qdy = lerp(0, ob.y + ob.h / 2 - (392 + 42), qm);
    const qop = qIn * (1 - P(t, T.qEnter + 0.3, T.qEnter + 0.44, E.lin));
    S(C.qc, {
      opacity: qop.toFixed(3),
      visibility: qop > 0.001 ? "visible" : "hidden",
      transformOrigin: "0 50%",
      transform: `translate(${qdx.toFixed(2)}px,${(qdy + (1 - qIn) * 20).toFixed(2)}px) scale(${(qk * lerp(0.94, 1, qs)).toFixed(4)})`,
      filter: blurF((1 - qIn) * 10 + bump(qm, 0, 1) * 1.5),
    });
    C.bEnter.fire(t, T.qEnter, 420 + 22 + 8, 392 + 42);
    let n = 0;
    for (const ts of qTimes) if (t >= ts) n++;
    const qtxt = QTEXT.slice(0, n);
    if (C.qTxt.data !== qtxt) C.qTxt.data = qtxt;
    S(C.qPh, { opacity: n ? 0 : 1 });
    S(C.qCaret, { opacity: n < QTEXT.length || Math.floor(t * 2) % 2 === 0 ? 1 : 0 });
    // the outbox line: saved here, then sent
    appear(C.outbox, t, T.outbox + 0.05, T.online + 0.25, { dy: 0, blur: 6, dur: 0.35, outDur: 0.35 });
    S(C.outbox, { scale: pop(t, T.outbox + 0.1, 0.05).toFixed(4) });
    S(C.obG.g, { scale: pop(t, T.online - 0.05, 0.3).toFixed(4) });
    // after it is sent: the capture flies to the Inbox
    const fp = P(t, T.flyIn, T.flyIn + 0.6, bez(0.4, 0, 0.2, 1));
    const fx = lerp(WIN.x + 280, WIN.x + 40, fp), fy = lerp(WIN.y + 748, WIN.y + 44 + 22 + 30 + 4 * 39 + 40, fp) - Math.sin(fp * Math.PI) * 60;
    const fop = P(t, T.flyIn - 0.05, T.flyIn + 0.1, E.lin) * (1 - P(t, T.flyIn + 0.45, T.flyIn + 0.62, E.lin));
    S(C.fly, { left: "0", top: "0", transform: `translate(${fx.toFixed(2)}px,${fy.toFixed(2)}px) scale(${lerp(1, 0.7, fp).toFixed(3)})`, opacity: fop.toFixed(3), visibility: fop > 0.001 ? "visible" : "hidden" });
    const ib = t >= T.flyIn + 0.55 ? "4" : "3";
    if (C.inboxN.textContent !== ib) C.inboxN.textContent = ib;
    const ip = bump(t, T.flyIn + 0.5, T.flyIn + 1.0);
    S(C.inboxRow, { background: `rgb(236 235 230 / ${(0.09 * ip).toFixed(3)})` });
    S(C.inboxN, { display: "inline-block", scale: pop(t, T.flyIn + 0.55, 0.4, 2.2).toFixed(4) });
    C.bInbox.fire(t, T.flyIn + 0.5, WIN.x + 40 + 22, WIN.y + 44 + 22 + 30 + 4 * 39 + 40 + 18);

    // the hand opens the tray
    const [ix, iy] = [1920 - 18 - 0, 0];
    void ix; void iy;
    const r = C.trayIcon.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const tx = r.left - sr.left + 17, ty = r.top - sr.top + 17;
    if (t >= T.cursorIn && t < T.menuClose + 0.9) {
      const a = P(t, T.cursorIn, T.trayClick - 0.05, E.ax);
      let x = lerp(tx - 360, tx, a), y = lerp(ty - 380, ty, a);
      // up the right-hand end of the rows, where the menu has no text, so the hand never covers a line
      const mr = C.menu.getBoundingClientRect();
      const rowX = mr.right - sr.left - 50, rowY = (k) => mr.top - sr.top + 6 + 38 * k + 19;
      const m1 = P(t, 27.85, 28.2, E.ax), m2 = P(t, 28.35, 28.6, E.ax);
      x = lerp(x, rowX, m1); y = lerp(y, rowY(1), m1);
      y = lerp(y, rowY(2), m2);
      const away = P(t, T.menuClose - 0.1, T.menuClose + 0.6);
      x -= away * 200; y -= away * 120;
      const c = click(t, T.trayClick);
      cursor(x, y, P(t, T.cursorIn, T.cursorIn + 0.2) * (1 - P(t, T.menuClose + 0.3, T.menuClose + 0.8)), c.press, c.ripple);
    } else cursor(0, 0, 0);
  }

  /* ================= scene D: the close ================= */
  function buildSceneD() {
    const scene = h("div", "scene", stage);
    const drift = buildDrift(scene, [{ f: 0.4, op: 0.18, pieces: scatter(12, -200, 2100, -100, 1200).filter((p) => p.y < 200 || p.y > 900) }], {
      bubbles: [
        { f: 0.16, n: 9, r: [5, 12], op: 0.6, blur: 0.4, v: [8, 14] },
        { f: 0.4, n: 6, r: [14, 26], op: 0.6, blur: 0, v: [14, 22] },
        { f: 0.78, n: 3, r: [40, 64], op: 0.4, blur: 1.6, v: [22, 32] },
      ],
    });
    const world = h("div", "world", scene);
    drift.grain = grain(scene);
    const D = { scene, world, drift };
    // the staff and its final double barline
    D.lines = Array.from({ length: 5 }, (_, i) => {
      const e = h("div", "a", world);
      place(e, 300, 520 + i * 15, 1320, 1.5);
      S(e, { background: "var(--rule)", transformOrigin: "left" });
      return e;
    });
    D.bar0 = h("div", "a", world);
    place(D.bar0, 300, 520, 2, 61.5);
    S(D.bar0, { background: "var(--rule)", transformOrigin: "top" });
    D.thin = h("div", "a", world);
    place(D.thin, 1606, 520, 2.5, 61.5);
    S(D.thin, { background: "var(--ink)", transformOrigin: "top" });
    D.thick = h("div", "a", world);
    place(D.thick, 1614, 520, 8, 61.5);
    S(D.thick, { background: "var(--ink)", transformOrigin: "top" });
    // the wordmark
    D.mark = h("div", "a", world);
    S(D.mark, { left: "600px", top: "276px", width: "180px", height: "180px" });
    D.mark.innerHTML =
      '<svg viewBox="0 0 32 32" width="180" height="180"><g fill="none" stroke="var(--ink)" stroke-linecap="round"><path id="mA" d="M5 20.5h22" stroke-width="2.2" pathLength="1"/><path id="mB" d="M12 5v22" stroke-width="2.2" pathLength="1"/><path id="mC" d="M19.5 16v9" stroke-width="1.9" pathLength="1"/><path id="mD" d="M24.5 16v9" stroke-width="1.9" pathLength="1"/></g><circle id="mE" cx="12" cy="20.5" r="3.75" fill="var(--accent)"/></svg>';
    D.mParts = ["mA", "mB", "mC", "mD"].map((id) => D.mark.querySelector("#" + id));
    D.mHead = D.mark.querySelector("#mE");
    D.word = kline(world, [{ text: "A" }, { text: "x" }, { text: "i" }, { text: "i" }, { text: "s" }], 812, 270, 196);
    S(D.word.el, { fontWeight: 600, letterSpacing: "-0.02em" });
    D.tag = kline(world, [{ text: "Where your tasks, time and notes meet.", cls: "ink2" }], 960, 636, 46);
    S(D.tag.el, { transform: "translateX(-50%)" });
    D.cta = h("div", "cta", world);
    D.cta.innerHTML = 'Start with today <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h13M12 6l5 5-5 5"/></svg>';
    S(D.cta, { left: "960px", top: "728px", transformOrigin: "center" });
    D.cap = h("div", "a", world, "Free for now. On the web and on Windows. Export or delete your data anytime.");
    S(D.cap, { left: "960px", top: "846px", fontSize: "21px", color: "var(--ink-3)", whiteSpace: "nowrap" });
    S(D.cta, { overflow: "hidden" });
    D.ctaSheen = h("div", "cta-sheen", D.cta);
    D.bHead = makeBurst(world, { n: 9, R: 70, seed: 41, dur: 0.95 });
    return D;
  }
  const TD = {
    lines: 34.35, bars: 34.75, mark: 34.75, head: 35.35, word: 35.15, tag: 35.95, cta: 36.45, cap: 36.95, sheen: 37.25,
    cam: [
      { t: 33.6, cx: 960, cy: 560, s: 1.1 },
      { t: 37.2, cx: 960, cy: 545, s: 1.0, e: E.ax },
      { t: 40, cx: 960, cy: 545, s: 0.99, e: E.lin },
    ],
  };
  function updateD(D, t) {
    const T = TD;
    const cam = camAt(T.cam, t);
    applyCam(D.world, cam);
    D.drift.update(t, cam);
    D.lines.forEach((e, i) => S(e, { transform: `scaleX(${P(t, T.lines + i * 0.06, T.lines + 1.1 + i * 0.06).toFixed(4)})` }));
    // the opening barline is the returning now line itself, landed (see render); it hands over as the line settles
    S(D.bar0, { opacity: P(t, MORPH.t0 + 0.28, MORPH.t1, E.lin).toFixed(3) });
    S(D.thin, { transform: `scaleY(${P(t, T.bars + 0.35, T.bars + 0.75).toFixed(4)})` });
    S(D.thick, { transform: `scaleY(${P(t, T.bars + 0.45, T.bars + 0.85).toFixed(4)})` });
    D.mParts.forEach((p, i) => {
      const v = P(t, T.mark + i * 0.12, T.mark + 0.6 + i * 0.12);
      p.setAttribute("stroke-dasharray", "1 1");
      p.setAttribute("stroke-dashoffset", String(1 - v));
      p.style.opacity = v > 0 ? "1" : "0";
    });
    const hs = spring(t, T.head, 2.4, 0.42);
    D.mHead.setAttribute("transform", `translate(12 20.5) scale(${Math.max(0, hs).toFixed(4)}) translate(-12 -20.5)`);
    D.bHead.fire(t, T.head + 0.04, parseFloat(D.mark.style.left) + (12 / 32) * 180, 276 + (20.5 / 32) * 180);
    S(D.ctaSheen, { opacity: t > T.sheen && t < T.sheen + 0.9 ? "1" : "0", transform: `translateX(${lerp(-120, 420, P(t, T.sheen, T.sheen + 0.9, E.io)).toFixed(1)}%) skewX(-18deg)` });
    D.word.words.forEach((w, i) => {
      const a = T.word + i * 0.05;
      const p = P(t, a, a + 0.9, E.ax);
      S(w.el, { opacity: p.toFixed(3), transform: `translate3d(0,${((1 - p) * 0.25).toFixed(4)}em,0)`, filter: blurF((1 - p) * 18) });
    });
    kin(D.tag, t, T.tag, null, { st: 0.05 });
    const cs = spring(t, T.cta, 2.0, 0.5);
    S(D.cta, { opacity: P(t, T.cta, T.cta + 0.2, E.lin).toFixed(3), transform: `translateX(-50%) translateY(${((1 - cs) * 26).toFixed(2)}px) scale(${(0.92 + 0.08 * cs).toFixed(4)})` });
    appear(D.cap, t, T.cap, null, { dy: 12, blur: 8, dur: 0.8 });
    S(D.cap, { transform: (D.cap.__s.transform || "").replace(/^/, "translateX(-50%) ") });
  }

  /* ================= wipes: now passes, and the day turns ================= */
  const wipeWash = h("div", "a", stage);
  S(wipeWash, { top: "0", height: "1080px", width: "240px", zIndex: 39, opacity: 0 });
  const wipeLine = h("div", "a", stage);
  S(wipeLine, { top: "0", height: "1080px", width: "4px", marginLeft: "-2px", background: "#47d3b8", zIndex: 40, boxShadow: "6px 0 24px rgb(0 0 0 / 0.25)" });
  // the now line carries its flag across the turn to night: the desktop's clock reads 12:50
  const wipeFlag = h("div", "a tab", wipeLine, "12:50");
  S(wipeFlag, { left: "50%", top: "56px", transform: "translateX(-50%)", borderRadius: "6px", background: "#47d3b8", color: "#0b1f1b", padding: "7px 10px", fontSize: "18px", fontWeight: 650, lineHeight: "1", whiteSpace: "nowrap" });
  // a hairline that rides the edge of the circle that opens Connect
  const openRing = h("div", "a", stage);
  S(openRing, { borderRadius: "50%", border: "1.5px solid rgb(20 21 27 / 0.3)", boxSizing: "border-box", zIndex: 38, visibility: "hidden" });
  /* The returning line lands as the close's opening barline: it stops on the staff and shrinks to it. */
  const MORPH = { t0: 34.12, t1: 34.55 };

  /* ================= assemble ================= */
  makeGrain();
  const A = buildSceneA();
  const B = MODE === "film" ? buildSceneB() : null;
  const C = MODE === "film" ? buildSceneC() : null;
  const D = MODE === "film" ? buildSceneD() : null;
  // the match cut into Connect: A dives into the done vet item; B opens out of the same item, as close, and pulls back
  const AV = [A.sh.x + A.sh.lx(VET.s) + 9, A.sh.y + A.sh.ly(1)];
  TF.cam.push({ t: TB.open0, cx: AV[0] + 40, cy: AV[1], s: 2.05, e: bez(0.45, 0, 0.25, 1) }); // lands, and holds, as the circle opens
  let BV = null;
  if (B) {
    const R0 = { x: 0, y: 0, w: 1130, h: 770 };
    const vl = layT(R0, B.items.find((m) => m.it.id === "vet").it);
    BV = [140 + vl.x + vl.gh / 2, 236 + vl.y + vl.fs * 1.2 + 8 + vl.gh / 2];
    TB.cam.unshift({ t: TB.open0, cx: BV[0] + 40, cy: BV[1], s: 2.05 }, { t: 18.02, cx: BV[0] + 40, cy: BV[1], s: 2.03, e: E.lin });
  }
  // centre the close's wordmark once the fonts have laid it out
  function centreClose() {
    if (!D) return;
    const ww = D.word.el.offsetWidth;
    const total = 180 + 28 + ww;
    const left = 960 - total / 2;
    S(D.mark, { left: px(left) });
    S(D.word.el, { left: px(left + 180 + 28) });
  }

  function render(t) {
    cursorState = null;
    if (MODE === "loop") {
      vis(A.scene, true);
      updateA(A, TL, t, false);
      S(wipeLine, { opacity: 0 });
      flushCursor();
      return;
    }
    // which scenes are on screen (they overlap through each transition)
    const cEnd = MORPH.t0 + 0.02;
    const onA = t < TB.open1, onB = t >= TB.open0 && t < TC.wipe1, onC = t >= TC.wipe0 && t < cEnd, onD = t >= TC.wipe2;
    vis(A.scene, onA); vis(B.scene, onB); vis(C.scene, onC); vis(D.scene, onD);
    if (onA) updateA(A, TF, t, true);
    if (onB) updateB(B, t);
    if (onC) updateC(C, t);
    if (onD) updateD(D, t);

    // A to B: Connect opens in a circle out of the done item's head, and a hairline rides its edge
    if (onB && t < TB.open1) {
      const [ox, oy] = toScreen(camAt(TF.cam, t), AV[0], AV[1]); // exactly on the A-side head (B is framed to match)
      const p = P(t, TB.open0, TB.open1, bez(0.6, 0, 0.22, 1));
      const r = lerp(10, 2300, p);
      S(B.scene, { clipPath: `circle(${r.toFixed(1)}px at ${ox.toFixed(1)}px ${oy.toFixed(1)}px)`, zIndex: 2 });
      S(openRing, { visibility: "visible", left: px(ox - r), top: px(oy - r), width: px(2 * r), height: px(2 * r), opacity: (Math.pow(1 - p, 1.5) * 0.9).toFixed(3) });
    } else {
      if (onB) S(B.scene, { clipPath: "none", zIndex: 1 });
      S(openRing, { visibility: "hidden" });
    }

    // B to C: the night arrives behind a passing now line (left to right); Connect is pushed along ahead of it
    let wx = null, dir = 1, morph = 0;
    if (t >= TC.wipe0 && t < TC.wipe1) {
      const q = P(t, TC.wipe0, TC.wipe1, E.wipe), q0 = P(t - 1 / 30, TC.wipe0, TC.wipe1, E.wipe);
      wx = lerp(-10, 1930, q);
      S(C.scene, { clipPath: `inset(0 ${(1920 - wx).toFixed(2)}px 0 0)`, zIndex: 2 });
      S(B.scene, { transform: `translateX(${(q * 170).toFixed(2)}px)` });
      B.mb(B.scene, B.vel[0] + (q - q0) * 170 * 0.15, B.vel[1]);
    } else {
      if (onC) S(C.scene, { clipPath: "none", zIndex: 1 });
      if (onB) {
        S(B.scene, { transform: "none" });
        B.mb(B.scene, B.vel[0], B.vel[1]);
      }
    }
    // C to D: the line sweeps back (right to left) while the night folds in from both sides onto the staff's start
    if (t >= TC.wipe2 && t < MORPH.t1) {
      dir = -1;
      const camD = camAt(TD.cam, t);
      const [bx, btop] = toScreen(camD, 301, 520);
      const [, bbot] = toScreen(camD, 301, 581.5);
      wx = lerp(1930, bx, P(t, TC.wipe2, MORPH.t0, E.wipe));
      const a = lerp(-2, bx, P(t, TC.wipe2 + 0.25, MORPH.t0, E.io));
      if (onC) S(C.scene, { clipPath: `inset(0 ${Math.max(0, 1920 - wx).toFixed(2)}px 0 ${a.toFixed(2)}px)`, zIndex: 3 });
      S(D.scene, { clipPath: "none", zIndex: 2 });
      morph = P(t, MORPH.t0 - 0.06, MORPH.t1, E.ax);
      const top = lerp(0, btop, morph), hh = lerp(1080, bbot - btop, morph);
      S(wipeLine, {
        top: px(top), height: px(hh), width: px(lerp(4, 2 * camD.s, morph)), marginLeft: px(-lerp(2, camD.s, morph)),
        background: `color-mix(in oklab, #47d3b8 ${((1 - morph) * 100).toFixed(1)}%, rgb(20 21 27 / 0.3))`,
        boxShadow: `${(-6 * (1 - morph)).toFixed(1)}px 0 24px rgb(0 0 0 / ${(0.22 * (1 - morph)).toFixed(3)})`,
      });
    } else if (onD) S(D.scene, { clipPath: "none", zIndex: 2 });
    if (dir === 1) S(wipeLine, { top: "0px", height: "1080px", width: "4px", marginLeft: "-2px", background: "#47d3b8", boxShadow: "6px 0 24px rgb(0 0 0 / 0.25)" });
    if (wx != null) {
      S(wipeLine, { opacity: (1 - P(t, MORPH.t1 - 0.1, MORPH.t1, E.lin)).toFixed(3), left: px(wx), visibility: "visible" });
      S(wipeFlag, { opacity: dir === 1 ? "1" : "0" });
      // a soft wash trails the line on the side it has already crossed
      S(wipeWash, {
        opacity: (1 - morph).toFixed(3),
        left: px(dir === 1 ? wx - 240 : wx),
        background: dir === 1 ? "linear-gradient(to left, rgb(71 211 184 / 0.13), transparent)" : "linear-gradient(to right, rgb(6 106 91 / 0.08), transparent)",
      });
    } else {
      S(wipeLine, { opacity: 0, visibility: "hidden" });
      S(wipeWash, { opacity: 0 });
    }
    flushCursor();
  }

  let lastT = -1;
  window.__duration = DURATION;
  window.__seek = (ms) => {
    const t = ms / 1000;
    lastT = t;
    render(t);
    return t;
  };
  window.__ready = Promise.all([
    document.fonts.load('500 40px "Bricolage Grotesque"'),
    document.fonts.load('600 40px "Bricolage Grotesque"'),
    document.fonts.load('500 20px "Hanken Grotesk"'),
    document.fonts.load('700 20px "Hanken Grotesk"'),
  ])
    .then(() => document.fonts.ready)
    .then(() => {
      const ok = document.fonts.check('500 40px "Bricolage Grotesque"') && document.fonts.check('500 20px "Hanken Grotesk"');
      if (!ok) throw new Error("fonts not loaded");
      centreClose();
      render(Number(Q.get("t") || 0));
      return true;
    });

  if (Q.get("play")) {
    window.__ready.then(() => {
      const t0 = performance.now() - Number(Q.get("t") || 0) * 1000;
      const tick = () => {
        const t = ((performance.now() - t0) / 1000) % DURATION;
        render(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  void lastT;
})();

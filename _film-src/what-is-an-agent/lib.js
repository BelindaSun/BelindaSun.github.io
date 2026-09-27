// ---------- math & easing ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));           // 0..1 progress of t through [a,b]
const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const out3 = t => 1 - Math.pow(1 - t, 3);
const in2 = t => t * t;
const outBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const outElastic = t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1;
const smooth = t => t * t * (3 - 2 * t);
// fade in over [a,a+fi], hold, fade out over [b-fo,b]
const win = (t, a, b, fi = .4, fo = .4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// piecewise keyframes: [[t, value], ...] numeric or arrays, eased
function kf(t, keys, ease = inOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const e = (keys[i + 1][2] || ease)(seg(t, t0, t1));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], e));
      return lerp(v0, v1, e);
    }
  }
  return keys[keys.length - 1][1];
}

// ---------- fonts ----------
const F = {
  zh: '"Noto Serif SC"', en: '"Fraunces"', hand: '"Caveat"', kai: '"LXGW WenKai"', mono: '"JetBrains Mono"',
};

// ---------- drawing helpers ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

// wrap text into lines that fit maxW (handles CJK char-by-char and latin word-by-word)
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const tokens = para.match(/[　-鿿＀-￯]|[^\s　-鿿＀-￯]+|\s+/g) || [''];
    let line = '';
    for (const tok of tokens) {
      const test = line + tok;
      const punct = /^[，。、！？；：）」』”’》…,.!?;:)]/.test(tok);
      if (ctx.measureText(test).width > maxW && line.trim() && !punct) {
        out.push(line.trimEnd());
        line = /^\s+$/.test(tok) ? '' : tok;
      } else line = test;
    }
    out.push(line.trimEnd());
  }
  return out;
}

// text with optional letter-reveal (n = number of chars visible)
function textReveal(ctx, s, x, y, n) {
  if (n == null || n >= s.length) { ctx.fillText(s, x, y); return; }
  ctx.fillText(Array.from(s).slice(0, Math.max(0, Math.floor(n))).join(''), x, y);
}

function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', a)); g.addColorStop(1, color.replace('A', 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// cubic bezier point
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
}
// polyline point at fraction (by length)
function polyAt(pts, f) {
  let L = 0; const ls = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); ls.push(l); L += l; }
  let d = clamp(f) * L;
  for (let i = 0; i < ls.length; i++) {
    if (d <= ls[i] || i === ls.length - 1) { const k = ls[i] ? d / ls[i] : 0; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; }
    d -= ls[i];
  }
  return pts[pts.length - 1];
}
function sampleBez(p0, p1, p2, p3, n = 40) { const a = []; for (let i = 0; i <= n; i++) a.push(bez(p0, p1, p2, p3, i / n)); return a; }

// =====================================================================
//  THE WORLD: a room with one slot, and (later) a city of tools outside
// =====================================================================
const C = {
  ink: '#2E2440', purple: '#3D2A5C', wall: '#F4EAD8', wallShade: '#E6D6BC', floor: '#B98B63', floorLine: '#9F7552',
  desk: '#7A4E2D', deskDark: '#5A381F', brass: '#C9973B', brassHi: '#F1D089', brassLo: '#8C6420',
  paper: '#FFFDF6', human: '#FFF0CF', world: '#E6EEF7', red: '#C8412F', green: '#3E8B5A', gold: '#D08A2E',
  cork: '#C99D68', mind: '#FFF6E6', cheek: '#F2A7A0', leaf: '#6FA36B',
};
const BOOKC = ['#C4553D', '#D9A441', '#5B7F6B', '#3F5D8A', '#8C5A8F', '#E3C9A0', '#2F4858', '#A4452C', '#7B8F4A', '#B87D4B', '#546E9A', '#9C6B83'];

// ---- geometry ----
const G = {
  RX0: 900, RY0: 300, RX1: 1720, RY1: 860, WALL: 20,
  IX0: 920, IY0: 320, IX1: 1700, IY1: 840, GROUND: 860,
  DESK: { x0: 1250, x1: 1500, y: 700 },
  MIND: [1380, 648], MR: 62,
  READ: [1592, 548],          // where the mind holds a note to read / write
  SLOT_Y: 652,
  CLOCK: [1606, 382], COUNTER: [1606, 452],
  BOARD: { x0: 1245, y0: 340, x1: 1541, y1: 482 },
  CAB: { x0: 1095, y0: 692, x1: 1228, y1: 840 },
};
const TUBES = [
  { id: 'clock', zh: '时钟', en: 'CLOCK', y: 372, end: [148, 452], c: [[640, 372], [320, 452]] },
  { id: 'search', zh: '搜索', en: 'SEARCH', y: 446, end: [278, 612], c: [[620, 446], [278, 470]] },
  { id: 'phone', zh: '电话', en: 'PHONE', y: 520, end: [482, 636], c: [[700, 520], [482, 540]] },
  { id: 'email', zh: '邮件', en: 'EMAIL', y: 594, end: [662, 676], c: [[790, 594], [662, 600]] },
  { id: 'pay', zh: '付款', en: 'PAY', y: 668, end: [812, 700], c: [[860, 668], [812, 668]] },
];
for (const tb of TUBES) {
  // path from mouth inside the room -> through the wall -> out to its building
  const out = sampleBez([G.RX0, tb.y], tb.c[0], tb.c[1], tb.end, 48);
  tb.outPath = out;                                  // wall -> building
  tb.mouth = [G.IX0 + 34, tb.y];
}
const BUILDINGS = [
  { id: 'clock', x0: 70, x1: 176, top: 318, zh: '钟楼', en: 'Clock tower' },
  { id: 'search', x0: 196, x1: 360, top: 612, zh: '图书馆', en: 'Library' },
  { id: 'phone', x0: 392, x1: 572, top: 636, zh: '翠园', en: 'Jade Garden' },
  { id: 'email', x0: 600, x1: 726, top: 676, zh: '邮局', en: 'Post office' },
  { id: 'pay', x0: 752, x1: 872, top: 700, zh: '银行', en: 'Bank' },
];

// ---- static caches ----
const _cache = {};
function stars() {
  if (_cache.stars) return _cache.stars;
  const r = rng(7), a = [];
  for (let i = 0; i < 170; i++) a.push([r() * 2600 - 400, r() * 700 - 200, r() * 1.6 + .4, r() * 6.28]);
  return (_cache.stars = a);
}
function bookList(key, x0, x1, y, hMax, seed) {
  const k = key + seed; if (_cache[k]) return _cache[k];
  const r = rng(seed), a = []; let x = x0;
  while (x < x1 - 6) {
    const w = 9 + r() * 12, h = hMax * (0.62 + r() * 0.36);
    if (x + w > x1) break;
    a.push({ x, w, h, c: BOOKC[Math.floor(r() * BOOKC.length)], lean: r() < .08 ? (r() - .5) * .25 : 0, band: r() < .5 });
    x += w + (r() < .15 ? 3 : 0.8);
  }
  return (_cache[k] = a);
}

// =====================================================================
function drawSky(ctx, S) {
  const g = ctx.createLinearGradient(0, -300, 0, 1000);
  g.addColorStop(0, '#0E0B1E'); g.addColorStop(.6, '#1E1734'); g.addColorStop(1, '#2A2044');
  ctx.fillStyle = g; ctx.fillRect(-1200, -1400, 5000, 3800);
  const sa = S.stars ?? 1;
  if (sa > 0) {
    for (const [x, y, r, ph] of stars()) {
      ctx.globalAlpha = sa * (0.35 + 0.35 * Math.sin(S.t * 1.3 + ph));
      ctx.fillStyle = '#F4EAD8'; circle(ctx, x, y, r); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // moon
  if ((S.city ?? 0) > 0) {
    ctx.globalAlpha = S.city;
    glow(ctx, 330, 150, 120, 'rgba(244,234,216,A)', .18);
    ctx.fillStyle = '#F4EAD8'; circle(ctx, 330, 150, 30); ctx.fill();
    ctx.fillStyle = '#1E1734'; circle(ctx, 344, 142, 27); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawGround(ctx, S) {
  ctx.fillStyle = '#15101F';
  ctx.fillRect(-1200, G.GROUND, 5000, 1400);
  ctx.strokeStyle = 'rgba(244,234,216,0.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-1200, G.GROUND); ctx.lineTo(3800, G.GROUND); ctx.stroke();
}

// ---------------- city of tools ----------------
function drawBuilding(ctx, b, S) {
  const lit = (S.tubeGlow && S.tubeGlow[b.id]) || 0;
  const a = S.city ?? 0;
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const { x0, x1, top } = b, w = x1 - x0, h = G.GROUND - top;
  const body = '#2B2341', edge = '#4A3D6B';
  ctx.fillStyle = body; ctx.strokeStyle = edge; ctx.lineWidth = 2;
  const winColor = (k) => `rgba(255,${200 - 20 * k},${120 - 30 * k},${0.55 + 0.45 * lit})`;
  if (b.id === 'clock') {
    ctx.fillRect(x0 + 14, top + 40, w - 28, h - 40); ctx.strokeRect(x0 + 14, top + 40, w - 28, h - 40);
    ctx.beginPath(); ctx.moveTo(x0 + 6, top + 44); ctx.lineTo((x0 + x1) / 2, top - 30); ctx.lineTo(x1 - 6, top + 44); ctx.closePath(); ctx.fill(); ctx.stroke();
    const cx = (x0 + x1) / 2, cy = top + 92;
    glow(ctx, cx, cy, 80 + 40 * lit, 'rgba(255,214,140,A)', 0.25 + 0.5 * lit);
    ctx.fillStyle = '#FFE7B5'; circle(ctx, cx, cy, 30); ctx.fill();
    ctx.strokeStyle = C.purple; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 13 * Math.sin(-1.1), cy - 13 * Math.cos(-1.1)); ctx.stroke();
    const ang = S.t * 0.8; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 22 * Math.sin(ang), cy - 22 * Math.cos(ang)); ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = winColor(i % 2); ctx.fillRect(x0 + 34, top + 150 + i * 60, 14, 26); ctx.fillRect(x1 - 48, top + 150 + i * 60, 14, 26); }
  } else if (b.id === 'search') {
    ctx.fillRect(x0, top + 26, w, h - 26); ctx.strokeRect(x0, top + 26, w, h - 26);
    ctx.beginPath(); ctx.moveTo(x0 - 8, top + 28); ctx.lineTo((x0 + x1) / 2, top - 8); ctx.lineTo(x1 + 8, top + 28); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 5; i++) { const cx = x0 + 18 + i * (w - 36) / 4; ctx.fillStyle = '#3A3056'; ctx.fillRect(cx - 7, top + 40, 14, h - 58); }
    ctx.fillStyle = winColor(0); ctx.fillRect(x0 + 30, top + 60, w - 60, h - 110);
    glow(ctx, (x0 + x1) / 2, top + 130, 120, 'rgba(255,214,140,A)', 0.15 + 0.5 * lit);
  } else if (b.id === 'phone') {
    ctx.fillRect(x0, top + 30, w, h - 30); ctx.strokeRect(x0, top + 30, w, h - 30);
    // pagoda-ish roof
    ctx.fillStyle = '#3B2F57';
    ctx.beginPath(); ctx.moveTo(x0 - 18, top + 36); ctx.quadraticCurveTo((x0 + x1) / 2, top - 6, x1 + 18, top + 36); ctx.lineTo(x1 - 4, top + 26); ctx.quadraticCurveTo((x0 + x1) / 2, top - 18, x0 + 4, top + 26); ctx.closePath(); ctx.fill();
    // big window: the table
    const wx = x0 + 22, wy = top + 58, ww = w - 44, wh = 110;
    const warm = 0.35 + 0.65 * Math.max(lit, S.cake || 0);
    ctx.fillStyle = `rgba(255,196,120,${warm})`; ctx.fillRect(wx, wy, ww, wh);
    glow(ctx, wx + ww / 2, wy + wh / 2, 150, 'rgba(255,190,110,A)', 0.2 + 0.4 * warm);
    ctx.strokeStyle = '#5A381F'; ctx.lineWidth = 4; ctx.strokeRect(wx, wy, ww, wh);
    // lanterns
    for (const lx of [x0 + 10, x1 - 10]) {
      const sw = Math.sin(S.t * 2 + lx) * 3;
      ctx.strokeStyle = '#5A381F'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, top + 34); ctx.lineTo(lx + sw, top + 52); ctx.stroke();
      glow(ctx, lx + sw, top + 62, 30, 'rgba(255,90,60,A)', .5);
      ctx.fillStyle = '#E0503A'; ctx.beginPath(); ctx.ellipse(lx + sw, top + 62, 9, 11, 0, 0, 7); ctx.fill();
    }
    if ((S.cake || 0) > 0) drawTable(ctx, wx + ww / 2, wy + wh - 16, S.cake, S.t);
    // door
    ctx.fillStyle = '#1C1530'; ctx.fillRect((x0 + x1) / 2 - 16, G.GROUND - 56, 32, 56);
  } else if (b.id === 'email') {
    ctx.fillRect(x0, top, w, h); ctx.strokeRect(x0, top, w, h);
    ctx.fillStyle = winColor(0); ctx.fillRect(x0 + 20, top + 30, w - 40, 50);
    // envelope sign
    ctx.fillStyle = '#F4EAD8'; ctx.fillRect(x0 + w / 2 - 22, top + 42, 44, 28);
    ctx.strokeStyle = C.purple; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + w / 2 - 22, top + 42); ctx.lineTo(x0 + w / 2, top + 58); ctx.lineTo(x0 + w / 2 + 22, top + 42); ctx.stroke();
    glow(ctx, x0 + w / 2, top + 56, 90, 'rgba(255,214,140,A)', 0.1 + 0.5 * lit);
  } else if (b.id === 'pay') {
    ctx.fillRect(x0, top + 30, w, h - 30); ctx.strokeRect(x0, top + 30, w, h - 30);
    ctx.beginPath(); ctx.arc((x0 + x1) / 2, top + 32, w / 2 - 6, Math.PI, 0); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#3A3056'; ctx.fillRect(x0 + 14 + i * (w - 28) / 3 - 5, top + 44, 10, h - 60); }
    ctx.fillStyle = winColor(1); ctx.fillRect(x0 + 30, top + 70, w - 60, 40);
    glow(ctx, (x0 + x1) / 2, top + 90, 90, 'rgba(255,214,140,A)', 0.08 + 0.5 * lit);
  }
  // label
  const la = S.labels ?? 1;
  if (la > 0) {
    ctx.globalAlpha = a * la;
    ctx.textAlign = 'center'; ctx.fillStyle = '#F4EAD8';
    ctx.font = `600 22px ${F.zh}`; ctx.fillText(b.zh, (x0 + x1) / 2, G.GROUND + 34);
    ctx.fillStyle = '#F4EAD8'; ctx.font = `500 21px ${F.en}`; ctx.fillText(b.en, (x0 + x1) / 2, G.GROUND + 60);
  }
  ctx.restore();
}

function drawTable(ctx, cx, y, p, t) {
  ctx.save(); ctx.globalAlpha *= p;
  ctx.fillStyle = '#7A4E2D'; ctx.fillRect(cx - 50, y - 6, 100, 7); ctx.fillRect(cx - 44, y, 5, 16); ctx.fillRect(cx + 39, y, 5, 16);
  // three chairs
  ctx.fillStyle = '#5A381F';
  for (const dx of [-62, 62]) { ctx.fillRect(cx + dx - 3, y - 26, 5, 42); ctx.fillRect(cx + dx - (dx < 0 ? 0 : 12) , y + 2, 14, 4); }
  ctx.fillRect(cx - 10, y + 10, 20, 4);
  // cake
  ctx.fillStyle = '#FFF3E0'; rr(ctx, cx - 16, y - 24, 32, 18, 3); ctx.fill();
  ctx.fillStyle = '#E88BA0'; ctx.fillRect(cx - 16, y - 24, 32, 5);
  ctx.fillStyle = '#FFF'; ctx.fillRect(cx - 1.5, y - 36, 3, 12);
  const fl = 1 + 0.2 * Math.sin(t * 17);
  glow(ctx, cx, y - 40, 22, 'rgba(255,200,90,A)', .8);
  ctx.fillStyle = '#FFC14D'; ctx.beginPath(); ctx.ellipse(cx, y - 40, 3, 5 * fl, 0, 0, 7); ctx.fill();
  // plates
  ctx.fillStyle = '#F4EAD8'; for (const dx of [-34, 34]) { ctx.beginPath(); ctx.ellipse(cx + dx, y - 7, 9, 2.5, 0, 0, 7); ctx.fill(); }
  ctx.restore();
}

// ---------------- tubes ----------------
function tubePathDraw(ctx, pts, prog) {
  const n = Math.max(2, Math.floor(pts.length * prog));
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (prog < 1 && n < pts.length) { const p = polyAt(pts, prog); ctx.lineTo(p[0], p[1]); }
}
function drawTubesOutside(ctx, S) {
  const b = S.tubes || 0; if (b <= 0) return;
  TUBES.forEach((tb, i) => {
    const p = clamp(b * 1.6 - i * 0.15);
    if (p <= 0) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    tubePathDraw(ctx, tb.outPath, p);
    ctx.strokeStyle = C.brassLo; ctx.lineWidth = 15; ctx.stroke();
    ctx.strokeStyle = C.brass; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(241,208,137,.8)'; ctx.lineWidth = 2.5; ctx.save(); ctx.translate(0, -2.5); ctx.stroke(); ctx.restore();
    const gl = (S.tubeGlow && S.tubeGlow[tb.id]) || 0;
    if (gl > 0) { ctx.strokeStyle = `rgba(255,236,170,${0.55 * gl})`; ctx.lineWidth = 5; ctx.stroke(); }
    // brackets
    for (let k = 0.2; k < p; k += 0.2) { const q = polyAt(tb.outPath, k); ctx.fillStyle = C.brassLo; ctx.fillRect(q[0] - 3, q[1] - 9, 6, 18); }
  });
}
function drawTubesInside(ctx, S) {
  const b = S.tubes || 0; if (b <= 0) return;
  TUBES.forEach((tb, i) => {
    const p = clamp(b * 1.6 - i * 0.15); if (p <= 0) return;
    const e = outBack(clamp(p * 2));
    const x = G.IX0, y = tb.y;
    ctx.save(); ctx.translate(x, y); ctx.scale(e, e);
    // funnel mouth
    ctx.fillStyle = C.brassLo; ctx.fillRect(0, -9, 22, 18);
    ctx.fillStyle = C.brass;
    ctx.beginPath(); ctx.moveTo(18, -9); ctx.lineTo(38, -18); ctx.lineTo(38, 18); ctx.lineTo(18, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2E2440'; ctx.beginPath(); ctx.ellipse(38, 0, 5, 17, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = C.brassHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(37, -16); ctx.stroke();
    // label plate
    ctx.fillStyle = '#3D2A5C'; rr(ctx, 46, -17, 140, 34, 6); ctx.fill();
    ctx.fillStyle = '#F4EAD8'; ctx.textAlign = 'left';
    ctx.font = `700 19px ${F.zh}`; ctx.fillText(tb.zh, 55, 7);
    ctx.fillStyle = '#F4EAD8'; ctx.font = `600 18px ${F.en}`; ctx.fillText(tb.en[0] + tb.en.slice(1).toLowerCase(), 98, 6);
    const gl = (S.tubeGlow && S.tubeGlow[tb.id]) || 0;
    if (gl > 0) glow(ctx, 38, 0, 50, 'rgba(255,230,160,A)', .6 * gl);
    ctx.restore();
    // padlock on PAY
    if (tb.id === 'pay' && (S.lock || 0) > 0) drawLock(ctx, x + 30, y + 30, S.lock, S.lockOpen || 0, S.lockShake || 0);
  });
}
function drawLock(ctx, x, y, a, open, shake) {
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(x + Math.sin(shake * 40) * 4 * shake, y);
  const s = outBack(clamp(a));
  ctx.scale(s, s);
  ctx.strokeStyle = '#8C8C9C'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, -8 - open * 12, 11, Math.PI, 0); ctx.lineTo(11, 2 - open * 12); ctx.stroke();
  ctx.fillStyle = C.gold; rr(ctx, -16, -6, 32, 26, 5); ctx.fill();
  ctx.fillStyle = C.ink; circle(ctx, 0, 5, 3.5); ctx.fill(); ctx.fillRect(-1.5, 5, 3, 8);
  ctx.restore();
}
function drawKey(ctx, x, y, rot, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  glow(ctx, 0, 0, 40, 'rgba(255,215,120,A)', .45);
  ctx.strokeStyle = C.gold; ctx.fillStyle = C.gold; ctx.lineWidth = 6;
  circle(ctx, -14, 0, 11); ctx.stroke();
  ctx.fillRect(-3, -3, 34, 6); ctx.fillRect(22, 3, 5, 9); ctx.fillRect(14, 3, 5, 6);
  ctx.restore();
}

// ---------------- the room ----------------
function drawRoomShell(ctx, S) {
  const { RX0, RY0, RX1, RY1, IX0, IY0, IX1, IY1 } = G;
  // roof
  ctx.fillStyle = C.purple;
  ctx.beginPath(); ctx.moveTo(RX0 - 30, RY0 + 6); ctx.lineTo((RX0 + RX1) / 2, RY0 - 92); ctx.lineTo(RX1 + 30, RY0 + 6); ctx.closePath(); ctx.fill();
  ctx.fillRect(RX0, RY0, RX1 - RX0, RY1 - RY0);
  // interior wall
  const lamp = S.lamp ?? 1;
  ctx.fillStyle = C.wall; ctx.fillRect(IX0, IY0, IX1 - IX0, IY1 - IY0);
  // wallpaper stripes
  ctx.fillStyle = 'rgba(200,170,130,0.13)';
  for (let x = IX0 + 20; x < IX1; x += 44) ctx.fillRect(x, IY0, 14, IY1 - IY0);
  // floor
  ctx.fillStyle = C.floor; ctx.fillRect(IX0, 800, IX1 - IX0, IY1 - 800);
  ctx.strokeStyle = C.floorLine; ctx.lineWidth = 2;
  for (let x = IX0 + 60; x < IX1; x += 90) { ctx.beginPath(); ctx.moveTo(x, 800); ctx.lineTo(x - 20, IY1); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(IX0, 800, IX1 - IX0, 5);
}
function drawRoomLight(ctx, S) {
  // darkness when the lamp is off, warm pool when on
  const lamp = S.lamp ?? 1;
  const { IX0, IY0, IX1, IY1 } = G;
  ctx.save();
  ctx.beginPath(); ctx.rect(IX0, IY0, IX1 - IX0, IY1 - IY0); ctx.clip();
  const g = ctx.createRadialGradient(1300, 620, 40, 1300, 620, 700);
  g.addColorStop(0, `rgba(30,20,50,${0.05 + 0.9 * (1 - lamp)})`);
  g.addColorStop(1, `rgba(30,20,50,${0.45 + 0.55 * (1 - lamp)})`);
  ctx.fillStyle = g; ctx.fillRect(IX0, IY0, IX1 - IX0, IY1 - IY0);
  ctx.restore();
}

function drawShelves(ctx, S) {
  const fill = S.books ?? 1;
  // tall bookcase
  const x0 = 1100, x1 = 1232, y0 = 334, rows = 6, rowH = 58;
  ctx.fillStyle = '#6B4427'; ctx.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, rows * rowH + 16);
  ctx.fillStyle = '#4E301A'; ctx.fillRect(x0, y0, x1 - x0, rows * rowH);
  for (let r = 0; r < rows; r++) {
    const y = y0 + (r + 1) * rowH;
    const books = bookList('tall' + r, x0 + 3, x1 - 3, y, rowH - 8, 11 + r * 7);
    books.forEach((bk, i) => {
      const k = clamp(fill * (books.length * rows) - (r * books.length + i) * 0.55);
      if (k <= 0) return;
      const drop = (1 - out3(clamp(k * 3))) * 60;
      drawBook(ctx, bk, y - drop, clamp(k * 3));
    });
    ctx.fillStyle = '#6B4427'; ctx.fillRect(x0 - 8, y - 4, x1 - x0 + 16, 8);
  }
  // low shelf on the right
  const lx0 = 1530, lx1 = 1690, ly0 = 718;
  ctx.fillStyle = '#6B4427'; ctx.fillRect(lx0 - 6, ly0 - 6, lx1 - lx0 + 12, 88);
  ctx.fillStyle = '#4E301A'; ctx.fillRect(lx0, ly0, lx1 - lx0, 76);
  const lb = bookList('low', lx0 + 3, lx1 - 3, 796, 70, 99);
  lb.forEach((bk, i) => { const k = clamp(fill * 24 - 12 - i * .5); if (k > 0) drawBook(ctx, bk, 796 - (1 - out3(clamp(k * 3))) * 50, clamp(k * 3)); });
  // piles of books on the floor (the "read everything" overflow)
  const piles = S.piles ?? fill;
  if (piles > 0 && (S.cabinet || 0) < 1) {
    const r = rng(5);
    for (let p = 0; p < 2; p++) {
      const px = 1110 + p * 66; let y = 838;
      for (let i = 0; i < 8; i++) {
        const k = clamp(piles * 10 - i - p * 3); if (k <= 0) break;
        const w = 46 + r() * 16, h = 12 + r() * 5;
        ctx.globalAlpha = (1 - (S.cabinet || 0)) * clamp(k * 2);
        ctx.fillStyle = BOOKC[Math.floor(r() * BOOKC.length)];
        ctx.fillRect(px - w / 2 + (r() - .5) * 8, y - h - (1 - out3(clamp(k))) * 40, w, h);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px - w / 2 + 3, y - h + 3, w - 6, 2);
        y -= h;
      }
    }
    ctx.globalAlpha = 1;
  }
}
function drawBook(ctx, bk, baseY, a) {
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(bk.x + bk.w / 2, baseY); ctx.rotate(bk.lean);
  ctx.fillStyle = bk.c; ctx.fillRect(-bk.w / 2, -bk.h, bk.w, bk.h);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-bk.w / 2 + 1.5, -bk.h + 2, 2, bk.h - 4);
  if (bk.band) { ctx.fillStyle = 'rgba(241,208,137,.7)'; ctx.fillRect(-bk.w / 2, -bk.h + 8, bk.w, 3); ctx.fillRect(-bk.w / 2, -14, bk.w, 3); }
  ctx.restore();
}

function drawClock(ctx, S) {
  const [x, y] = G.CLOCK;
  const hl = S.clockHL || 0;
  ctx.save();
  if (hl > 0) glow(ctx, x, y, 90, 'rgba(200,65,47,A)', .25 * hl);
  ctx.fillStyle = '#FFF9EE'; circle(ctx, x, y, 34); ctx.fill();
  ctx.strokeStyle = C.purple; ctx.lineWidth = 4; ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = C.purple; circle(ctx, x + 26 * Math.sin(a), y - 26 * Math.cos(a), 2); ctx.fill(); }
  // no hands — just a question mark
  ctx.fillStyle = `rgba(61,42,92,${0.25 + 0.75 * hl})`; ctx.textAlign = 'center';
  ctx.font = `600 34px ${F.en}`; ctx.fillText('?', x, y + 12);
  ctx.restore();
}
function drawNoWindow(ctx, S) {
  const a = S.ghostWindow || 0; if (a <= 0) return;
  // a dashed outline where a window would be, then it fades
  ctx.save(); ctx.globalAlpha = a;
  ctx.setLineDash([8, 8]); ctx.strokeStyle = C.red; ctx.lineWidth = 3;
  rr(ctx, 1290, 350, 170, 120, 8); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(1300, 360); ctx.lineTo(1450, 460); ctx.moveTo(1450, 360); ctx.lineTo(1300, 460); ctx.stroke();
  ctx.restore();
}
function drawNoDoor(ctx, S) {
  const a = S.ghostDoor || 0; if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.setLineDash([8, 8]); ctx.strokeStyle = C.red; ctx.lineWidth = 3;
  rr(ctx, 1532, 560, 110, 150, 6); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(1540, 570); ctx.lineTo(1634, 700); ctx.moveTo(1634, 570); ctx.lineTo(1540, 700); ctx.stroke();
  ctx.restore();
}

function drawBoard(ctx, S) {
  const a = S.board || 0; if (a <= 0) return;
  const { x0, y0, x1, y1 } = G.BOARD;
  const e = outBack(clamp(a));
  ctx.save();
  ctx.translate((x0 + x1) / 2, y0); ctx.scale(1, e); ctx.translate(-(x0 + x1) / 2, -y0);
  ctx.fillStyle = '#7A4E2D'; rr(ctx, x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16, 6); ctx.fill();
  ctx.fillStyle = C.cork; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const r = rng(3); ctx.fillStyle = 'rgba(120,80,40,.25)';
  for (let i = 0; i < 90; i++) { ctx.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 2, 2); }
  // label
  ctx.fillStyle = C.purple; rr(ctx, x0 + 8, y0 - 22, 124, 26, 5); ctx.fill();
  ctx.fillStyle = '#F4EAD8'; ctx.font = `700 15px ${F.zh}`; ctx.textAlign = 'left'; ctx.fillText('眼前', x0 + 16, y0 - 3);
  ctx.fillStyle = '#F4EAD8'; ctx.font = `600 15px ${F.en}`; ctx.fillText('Context', x0 + 54, y0 - 3);
  // items
  (S.boardItems || []).forEach((it, i) => {
    if (it.a <= 0) return;
    const col = i % 2, row = Math.floor(i / 2);
    const bx = x0 + 10 + col * 142, by = y0 + 12 + row * 64;
    ctx.save(); ctx.globalAlpha *= clamp(it.a);
    ctx.translate(bx + 67, by + 26); ctx.rotate((i % 2 ? 1 : -1) * 0.025); ctx.scale(outBack(clamp(it.a)), outBack(clamp(it.a))); ctx.translate(-67, -26);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(3, 3, 134, 54);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, 134, 54);
    ctx.fillStyle = C.red; circle(ctx, 67, 3, 4); ctx.fill();
    // checkbox
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(8, 13, 15, 15);
    if (it.tick > 0) {
      ctx.strokeStyle = C.green; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); const k = clamp(it.tick);
      ctx.moveTo(9, 20); const mx = lerp(9, 15, clamp(k * 2)), my = lerp(20, 27, clamp(k * 2)); ctx.lineTo(mx, my);
      if (k > .5) ctx.lineTo(lerp(15, 28, (k - .5) * 2), lerp(27, 8, (k - .5) * 2)); ctx.stroke();
    }
    ctx.fillStyle = C.ink; ctx.textAlign = 'left';
    ctx.font = `700 17px ${F.kai}`; ctx.fillText(it.zh, 29, 26);
    ctx.fillStyle = C.ink; ctx.font = `700 20px ${F.hand}`; ctx.fillText(it.en, 29, 47);
    ctx.restore();
  });
  ctx.restore();
}

function drawCounter(ctx, S) {
  const a = S.counter || 0; if (a <= 0) return;
  const [x, y] = G.COUNTER;
  const n = S.loopN || 0, fl = S.loopFlip || 0;
  ctx.save(); ctx.globalAlpha *= clamp(a);
  const s = outBack(clamp(a)); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = C.brassLo; rr(ctx, -62, -24, 124, 50, 8); ctx.fill();
  ctx.fillStyle = C.brass; rr(ctx, -59, -21, 118, 44, 6); ctx.fill();
  // ring arrow icon
  ctx.save(); ctx.translate(-36, 1); ctx.rotate(-(S.loopSpin || 0) * Math.PI * 2);
  ctx.strokeStyle = C.purple; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 11, 0.4, Math.PI * 2 - 0.2); ctx.stroke();
  ctx.fillStyle = C.purple; ctx.beginPath(); ctx.moveTo(11, -4); ctx.lineTo(17, 4); ctx.lineTo(5, 4); ctx.closePath(); ctx.rotate(0); ctx.fill();
  ctx.restore();
  // digits
  ctx.fillStyle = '#2E2440'; rr(ctx, -14, -15, 64, 32, 4); ctx.fill();
  const txt = String(n).padStart(n >= 100 ? 3 : 2, '0');
  ctx.fillStyle = '#FFE7B5'; ctx.font = `700 ${n >= 100 ? 20 : 24}px ${F.mono}`; ctx.textAlign = 'center';
  ctx.save(); ctx.beginPath(); ctx.rect(-14, -15, 64, 32); ctx.clip();
  const off = (1 - out3(fl)) * 30;
  ctx.fillText(txt, 18, 9 - off);
  ctx.restore();
  ctx.fillStyle = C.purple; ctx.font = `700 14px ${F.zh}`; ctx.fillText('循环 · Loop', 0, 42);
  ctx.restore();
}

function drawCabinet(ctx, S) {
  const a = S.cabinet || 0; if (a <= 0) return;
  const { x0, y0, x1, y1 } = G.CAB;
  const rise = (1 - outBack(clamp(a))) * 160;
  ctx.save(); ctx.translate(0, rise);
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 30, 0, x1 - x0 + 60 + 120, y1 - rise); ctx.clip();
  ctx.fillStyle = '#6E7F8C'; rr(ctx, x0, y0, x1 - x0, y1 - y0, 4); ctx.fill();
  ctx.fillStyle = '#5A6A76'; ctx.fillRect(x0, y0, 6, y1 - y0);
  // bottom drawer
  ctx.fillStyle = '#7F919F'; rr(ctx, x0 + 10, y0 + 82, x1 - x0 - 20, 58, 3); ctx.fill();
  ctx.fillStyle = '#C9D2D9'; rr(ctx, (x0 + x1) / 2 - 16, y0 + 106, 32, 8, 3); ctx.fill();
  // top drawer (opens toward the right)
  const op = (S.drawer || 0) * 78;
  if (op > 0) {
    ctx.fillStyle = '#4A5863'; ctx.fillRect(x0 + 10, y0 + 36, x1 - x0 - 20, 40);
    // cards peeking
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#FFF6E0' : '#F4EAD8'; ctx.fillRect(x0 + 18 + op + i * 12, y0 + 22 - (i % 3) * 3, 9, 30); }
  }
  ctx.fillStyle = '#8C9DAA'; rr(ctx, x0 + 10 + op, y0 + 36, x1 - x0 - 20, 40, 3); ctx.fill();
  ctx.fillStyle = '#C9D2D9'; rr(ctx, (x0 + x1) / 2 - 16 + op, y0 + 52, 32, 8, 3); ctx.fill();
  ctx.restore();
  // label plate on top
  ctx.fillStyle = C.purple; rr(ctx, x0 + 4, y0 - 30, x1 - x0 - 8, 28, 5); ctx.fill();
  ctx.fillStyle = '#F4EAD8'; ctx.font = `700 16px ${F.zh}`; ctx.textAlign = 'left'; ctx.fillText('记忆', x0 + 12, y0 - 10);
  ctx.fillStyle = '#F4EAD8'; ctx.font = `600 15px ${F.en}`; ctx.fillText('Memory', x0 + 52, y0 - 10);
  ctx.restore();
}

function drawDesk(ctx, S) {
  const { x0, x1, y } = G.DESK;
  ctx.fillStyle = C.deskDark; ctx.fillRect(x0 + 14, y + 10, 14, 830 - y); ctx.fillRect(x1 - 28, y + 10, 14, 830 - y);
  ctx.fillStyle = C.desk; rr(ctx, x0, y, x1 - x0, 18, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x0 + 6, y + 3, x1 - x0 - 12, 3);
  // drawer front
  ctx.fillStyle = '#6A4226'; ctx.fillRect(x0 + 40, y + 18, x1 - x0 - 80, 34);
  ctx.fillStyle = C.brass; rr(ctx, (x0 + x1) / 2 - 12, y + 31, 24, 7, 3); ctx.fill();
}
function drawLamp(ctx, S) {
  const on = S.lamp ?? 1;
  const bx = 1276, by = G.DESK.y;
  if (on > 0) {
    ctx.save(); ctx.globalAlpha = on * .9;
    const g = ctx.createRadialGradient(1300, 610, 10, 1330, 690, 330);
    g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(1290, 600); ctx.lineTo(1530, 800); ctx.lineTo(1150, 800); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = C.purple; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.lineTo(bx - 14, by - 70); ctx.lineTo(bx + 4, by - 108); ctx.stroke();
  ctx.fillStyle = C.purple; rr(ctx, bx - 20, by - 8, 40, 9, 4); ctx.fill();
  ctx.save(); ctx.translate(bx + 8, by - 110); ctx.rotate(0.55);
  ctx.fillStyle = '#C8412F'; ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(16, -6); ctx.lineTo(26, 18); ctx.lineTo(-26, 18); ctx.closePath(); ctx.fill();
  if (on > 0) { ctx.fillStyle = `rgba(255,236,180,${on})`; ctx.beginPath(); ctx.ellipse(0, 18, 24, 5, 0, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawSlot(ctx, S) {
  const y = G.SLOT_Y, x = G.RX1;
  const hl = S.slotHL || 0;
  // opening through the wall
  ctx.fillStyle = '#120D1C'; ctx.fillRect(G.IX1 - 2, y - 8, G.RX1 - G.IX1 + 4, 16);
  // outside brass plate
  ctx.fillStyle = C.brass; rr(ctx, x - 2, y - 30, 30, 60, 5); ctx.fill();
  ctx.fillStyle = C.brassHi; ctx.fillRect(x + 2, y - 26, 3, 52);
  ctx.fillStyle = '#120D1C'; ctx.fillRect(x - 2, y - 7, 26, 14);
  // inside brass lip
  ctx.fillStyle = C.brass; rr(ctx, G.IX1 - 16, y - 20, 18, 40, 4); ctx.fill();
  ctx.fillStyle = '#120D1C'; ctx.fillRect(G.IX1 - 16, y - 7, 18, 14);
  if (hl > 0) {
    glow(ctx, x + 10, y, 110, 'rgba(255,220,140,A)', .6 * hl);
    // sparkle
    const s = 14 * hl;
    ctx.save(); ctx.translate(x + 22, y - 30); ctx.rotate(S.t * 2);
    ctx.fillStyle = `rgba(255,248,220,${hl})`;
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .3 : s; const a = i / 8 * Math.PI * 2; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); } ctx.fill();
    ctx.restore();
  }
  // label
  const la = S.slotLabel || 0;
  if (la > 0) {
    ctx.save(); ctx.globalAlpha = la;
    ctx.fillStyle = '#F4EAD8'; ctx.textAlign = 'left'; ctx.font = `600 18px ${F.zh}`; ctx.fillText('投信口', x + 36, y - 6);
    ctx.fillStyle = '#F4EAD8'; ctx.font = `500 18px ${F.en}`; ctx.fillText('the slot', x + 36, y + 16);
    ctx.restore();
  }
}

// ---------------- the mind ----------------
function drawMind(ctx, M, t) {
  if (!M || M.a === 0) return;
  const r = M.r || G.MR;
  const bob = Math.sin(t * 2.1) * 2.5 + (M.hop || 0) * -34;
  const squash = 1 + (M.squash || 0);
  const x = M.x, y = M.y + bob + (M.slump || 0) * 10;
  ctx.save(); ctx.globalAlpha *= (M.a ?? 1);
  ctx.translate(x, y); ctx.scale(1 / squash * (1 + (M.slump || 0) * .06), squash * (1 - (M.slump || 0) * .06));
  // sprout
  const sw = Math.sin(t * 2.6) * 0.12 + (M.sproutKick || 0) * Math.sin(t * 18) * .4;
  ctx.save(); ctx.translate(0, -r + 4); ctx.rotate(sw - (M.slump || 0) * .5);
  ctx.strokeStyle = C.leaf; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -14, 2, -26); ctx.stroke();
  ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.ellipse(12, -28, 12, 6, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#8DBE85'; ctx.beginPath(); ctx.ellipse(-8, -22, 8, 4, 0.6, 0, 7); ctx.fill();
  ctx.restore();
  // body
  const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r * 1.1);
  g.addColorStop(0, '#FFFDF7'); g.addColorStop(1, '#F1E2C8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.06, r, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = C.purple; ctx.lineWidth = 4; ctx.stroke();
  // face
  const lk = M.look || [0, 0];
  const lx = clamp(lk[0], -1, 1) * r * .12, ly = clamp(lk[1], -1, 1) * r * .08;
  const cheeks = M.cheeks ?? .5;
  if (cheeks > 0) { ctx.fillStyle = `rgba(242,167,160,${.55 * cheeks})`; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * .56 + lx * .5, r * .2 + ly, r * .15, r * .09, 0, 0, 7); ctx.fill(); } }
  const mood = M.mood || 'smile';
  const blink = M.blink || 0;
  for (const s of [-1, 1]) {
    const ex = s * r * .31 + lx, ey = -r * .1 + ly;
    ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
    if (mood === 'squint' || mood === 'happy') {
      ctx.beginPath();
      if (mood === 'happy') ctx.arc(ex, ey + 4, r * .11, Math.PI * 1.1, Math.PI * 1.9);
      else { ctx.moveTo(ex - r * .12, ey); ctx.lineTo(ex + r * .12, ey); }
      ctx.stroke();
    } else {
      const big = mood === 'o' ? 1.25 : 1;
      const eh = r * .19 * big * (1 - blink * .9), ew = r * .12 * big;
      ctx.beginPath(); ctx.ellipse(ex, ey, ew, Math.max(1.5, eh), 0, 0, 7); ctx.fill();
      if (blink < .5) { ctx.fillStyle = '#fff'; circle(ctx, ex + ew * .35, ey - eh * .4, r * .045); ctx.fill(); }
      if (mood === 'flat') { ctx.fillStyle = '#FFF6E6'; ctx.fillRect(ex - ew - 2, ey - eh - 2, ew * 2 + 4, eh * .9); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - ew - 1, ey - eh * .1); ctx.lineTo(ex + ew + 1, ey - eh * .1); ctx.stroke(); }
    }
  }
  // mouth
  const mx = lx * .6, my = r * .32 + ly;
  ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'smile' || mood === 'squint') { ctx.arc(mx, my - r * .1, r * .16, Math.PI * .2, Math.PI * .8); ctx.stroke(); }
  else if (mood === 'happy' || mood === 'grin') { ctx.moveTo(mx - r * .2, my - r * .04); ctx.quadraticCurveTo(mx, my + r * .26, mx + r * .2, my - r * .04); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#E47B7B'; ctx.beginPath(); ctx.ellipse(mx, my + r * .09, r * .08, r * .04, 0, 0, 7); ctx.fill(); }
  else if (mood === 'o') { ctx.ellipse(mx, my, r * .08, r * .11, 0, 0, 7); ctx.fill(); }
  else if (mood === 'flat' || mood === 'neutral') { ctx.moveTo(mx - r * .12, my); ctx.lineTo(mx + r * .12, my); ctx.stroke(); }
  else if (mood === 'frown') { ctx.arc(mx, my + r * .16, r * .15, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
  else if (mood === 'wobbly') { ctx.moveTo(mx - r * .15, my); for (let i = 1; i <= 6; i++) ctx.lineTo(mx - r * .15 + i * r * .05, my + (i % 2 ? -3 : 3)); ctx.stroke(); }
  ctx.restore();
  // thinking dots
  if ((M.think || 0) > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(M.think);
    const bx = x - r * .75, by = y - r * 1.25;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 3 - i * .6); const s = 5 + i * 3 + Math.max(0, Math.sin(ph)) * 2;
      ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = C.purple; ctx.lineWidth = 2;
      circle(ctx, bx - i * 16, by - i * 18, s); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  // floating pencil (it has no hands)
  if ((M.pencil || 0) > 0) {
    const [px, py] = M.pencilAt || [x + r * 1.4, y - r * .4];
    ctx.save(); ctx.globalAlpha *= clamp(M.pencil);
    ctx.translate(px + Math.sin(t * 22) * 7 * (M.scribble ?? 1), py + Math.cos(t * 15) * 4 * (M.scribble ?? 1));
    ctx.rotate(-0.8);
    ctx.fillStyle = '#E8B84A'; ctx.fillRect(-4, -30, 8, 26);
    ctx.fillStyle = '#F2A7A0'; ctx.fillRect(-4, -36, 8, 6);
    ctx.fillStyle = '#E9D2B0'; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-1.5, 3); ctx.lineTo(1.5, 3); ctx.lineTo(0, 7); ctx.fill();
    ctx.restore();
  }
}

// ---------------- notes & capsules ----------------
const _layout = new Map();
function noteLayout(ctx, N) {
  const key = N.key || (N.key = Math.random().toString(36));
  if (_layout.has(key)) return _layout.get(key);
  const w = N.w || 250, pad = 16;
  const blocks = [];
  let h = pad + (N.tag ? 26 : 0);
  const add = (text, font, size, color, lh) => {
    ctx.font = `${font}`; const lines = wrap(ctx, text, w - pad * 2);
    blocks.push({ lines, font, color, lh, y: h }); h += lines.length * lh;
  };
  if (N.rows) {
    for (const r of N.rows) {
      const y0 = h;
      if (r.zh) add(r.zh, `700 ${N.zs || 22}px ${F.kai}`, N.zs || 22, C.ink, (N.zs || 22) * 1.3);
      if (r.en) { const e = Math.round((N.es || 22) * 1.15); add(r.en, `700 ${e}px ${F.hand}`, e, C.ink, e * 1.02); }
      r.y0 = y0; r.y1 = h; h += 8;
    }
  } else {
    if (N.zh) add(N.zh, `${N.zw || 700} ${N.zs || 24}px ${N.zf || F.kai}`, N.zs || 24, C.ink, (N.zs || 24) * 1.32);
    if (N.zh && N.en) h += 4;
    if (N.en) { const e = N.ef ? (N.es || 25) : Math.round((N.es || 25) * 1.15); add(N.en, `${N.ew || 700} ${e}px ${N.ef || F.hand}`, e, N.ec || C.ink, e * (N.elh || 1.04)); }
  }
  h += pad - 4;
  const L = { w, h: Math.max(h + (N.extraH || 0), N.minH || 0), blocks, total: blocks.reduce((s, b) => s + b.lines.join('').length, 0) };
  _layout.set(key, L); return L;
}
function drawNote(ctx, N, P, t) {
  // P: {x, y, s, rot, fold, a, reveal(0..1)}
  if (!P || P.a <= 0) return;
  const L = noteLayout(ctx, N);
  ctx.save();
  ctx.globalAlpha *= clamp(P.a ?? 1);
  ctx.translate(P.x, P.y); ctx.rotate(P.rot || 0);
  const s = P.s ?? 1, fold = P.fold || 0;
  ctx.scale(s * (1 - fold * .05), s * (1 - fold * .9));
  ctx.translate(-L.w / 2, N.grow ? 0 : -L.h / 2);
  // shadow + paper
  const paper = N.kind === 'human' ? C.human : N.kind === 'world' ? C.world : N.kind === 'dict' ? '#FBF8F1' : N.kind === 'card' ? '#E9F3E3' : C.paper;
  let ph = L.h;
  if (N.grow) { // paper grows as lines are typed
    let bud = (P.reveal ?? 1) * L.total, yEnd = 20;
    for (const b of L.blocks) b.lines.forEach((ln, i) => { if (bud > 0) { yEnd = b.y + b.lh * (i + 1); bud -= ln.length; } });
    ph = Math.min(L.h, yEnd + 14);
  }
  ctx.fillStyle = 'rgba(20,10,30,.28)'; rr(ctx, 5, 7, L.w, ph, 5); ctx.fill();
  ctx.fillStyle = paper; rr(ctx, 0, 0, L.w, ph, 5); ctx.fill();
  if (N.kind === 'mind') { ctx.strokeStyle = 'rgba(120,150,200,.18)'; ctx.lineWidth = 1.5; for (let y = 34; y < L.h - 6; y += 28) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(L.w - 10, y); ctx.stroke(); } }
  if (N.kind === 'world') { ctx.strokeStyle = 'rgba(80,100,140,.35)'; ctx.lineWidth = 2; rr(ctx, 4, 4, L.w - 8, L.h - 8, 4); ctx.stroke(); }
  if (N.kind === 'human' && !N.noHeart) { // heart
    ctx.save(); ctx.translate(L.w - 20, 18); ctx.fillStyle = C.gold; ctx.beginPath();
    ctx.moveTo(0, 5); ctx.bezierCurveTo(-11, -3, -6, -12, 0, -6); ctx.bezierCurveTo(6, -12, 11, -3, 0, 5); ctx.fill(); ctx.restore();
  }
  if (N.tag) {
    ctx.font = `700 13px ${F.mono}`; const tw = ctx.measureText(N.tag).width + 16;
    ctx.fillStyle = N.kind === 'world' ? '#3F5D8A' : N.kind === 'mind' ? '#8C6420' : C.purple; rr(ctx, 12, 10, tw, 20, 4); ctx.fill();
    ctx.fillStyle = '#FFFDF6'; ctx.textAlign = 'left'; ctx.fillText(N.tag, 20, 25);
  }
  // text with reveal
  const rev = P.reveal ?? 1; let budget = rev * L.total;
  ctx.textAlign = N.center ? 'center' : 'left';
  for (const b of L.blocks) {
    ctx.font = b.font; ctx.fillStyle = b.color;
    b.lines.forEach((ln, i) => {
      if (budget <= 0) return;
      const tx = N.center ? L.w / 2 : 16;
      textReveal(ctx, ln, tx, b.y + b.lh * (i + 0.78), budget);
      budget -= ln.length;
    });
  }
  if (N.overlay) N.overlay(ctx, L, P, t);
  ctx.restore();
}
function drawCapsule(ctx, x, y, a, ang = 0, gl = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(ang);
  glow(ctx, 0, 0, 44, 'rgba(255,225,150,A)', .55 * gl);
  ctx.fillStyle = C.brassLo; rr(ctx, -20, -9, 40, 18, 9); ctx.fill();
  ctx.fillStyle = C.brass; rr(ctx, -19, -8, 38, 13, 7); ctx.fill();
  ctx.fillStyle = '#FFF0C0'; ctx.fillRect(-4, -8, 8, 16);
  ctx.restore();
}

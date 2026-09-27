// =====================================================================
//  STORY: timeline builder, state, camera, captions, render
// =====================================================================
const VERT = /[?&]v=1/.test(location.search);
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080, FPS = 30;
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');

// ---------- event stores ----------
const PARAMS = {};   // name -> [[t, v, ease]]
const NOTES = [];    // {N, keys:[{t,...}], layer}
const CAPS = [];     // {segs:[{t0,t1,pts}], a0, a1}
const CAPTIONS = []; // {t0,t1,zh,en}
const CAMS = [];     // {t, d, box, vbox}
const MOODS = [], LOOKS = [], HOPS = [], THINKS = [], PENCILS = [], CUES = [], THOUGHTS = [];
const BOARD = [];    // {zh,en,tA,tTick}
let FINAL_LOOPS = 101;          // real tool-call count, patched before final render

function P(name, t, v, ease) { (PARAMS[name] || (PARAMS[name] = [])).push([t, v, ease]); }
function ramp(name, t0, t1, v0, v1, ease) { P(name, t0, v0); P(name, t1, v1, ease); }
function pv(name, t, def = 0) {
  const k = PARAMS[name]; if (!k) return def;
  if (t <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    if (t < k[i + 1][0]) {
      const [t0, v0] = k[i], [t1, v1, e] = k[i + 1];
      if (typeof v0 !== 'number') return v0;
      return lerp(v0, v1, (e || smooth)(seg(t, t0, t1)));
    }
  }
  return k[k.length - 1][1];
}
function cue(t, type, o = {}) { CUES.push({ t: +t.toFixed(3), type, ...o }); }
function cap(t0, t1, zh, en, o = {}) { CAPTIONS.push({ t0, t1, zh, en, ...o }); }
window.__CAPS = CAPTIONS;
function cam(t, box, d = 1.2, vbox) { CAMS.push({ t, d, box, vbox }); }
function mood(t, m) { MOODS.push([t, m]); }
function look(t, v) { LOOKS.push([t, v]); }
function hop(t, s = 1) { HOPS.push([t, s]); cue(t, 'hop'); }
function think(t0, t1) { THINKS.push([t0, t1]); cue(t0, 'think', { d: t1 - t0 }); }
function pencil(t0, t1) { PENCILS.push([t0, t1]); cue(t0, 'scribble', { d: t1 - t0 }); }
function thought(t0, t1, x, y, zh, en) { THOUGHTS.push({ t0, t1, x, y, N: { zh, en, kind: 'thought', w: 230, zs: 22, es: 22, center: true } }); cue(t0, 'pop'); }

// ---------- note choreography ----------
const SY = G.SLOT_Y, READ = G.READ;
const OUT_R = 2150, SLOT_OUT = 1800, SLOT_IN = 1650;
function note(N, keys) { const o = { N, keys }; NOTES.push(o); return o; }
// fill in missing props so every key is complete
function norm(keys) {
  let prev = { x: 0, y: 0, s: 1, rot: 0, fold: 0, a: 1, reveal: 1 };
  return keys.map(k => (prev = { ...prev, ...k }));
}
// incoming note: from the right edge, through the slot, up to the reading spot
function incoming(N, t, to = READ, extra = []) {
  const k = [
    { t, x: OUT_R, y: SY, s: .8, rot: -.1, fold: 0 },
    { t: t + .75, x: SLOT_OUT, y: SY, s: .8, rot: 0, fold: 0 },
    { t: t + 1.0, x: 1712, y: SY, fold: 1 },
    { t: t + 1.15, x: SLOT_IN, y: SY, fold: 1 },
    { t: t + 1.6, x: to[0], y: to[1], s: 1, fold: 0, rot: -.02 },
  ];
  cue(t + .15, 'slide'); cue(t + 1.0, 'slot');
  return note(N, norm(k.concat(extra)));
}
// outgoing note: written at the reading spot then posted through the slot
function written(N, t, dur, at = READ, sc = 1) {
  pencil(t, t + dur);
  return { N, k: [{ t, x: at[0], y: at[1], s: sc, rot: .015, fold: 0, a: 1, reveal: 0 }, { t: t + dur, reveal: 1 }] };
}
function postOut(w, t) {
  const k = w.k.concat([
    { t, x: w.k[0].x, y: w.k[0].y, reveal: 1 },
    { t: t + .45, x: SLOT_IN, y: SY, s: .8, fold: 1 },
    { t: t + .6, x: 1712, y: SY, fold: 1 },
    { t: t + .8, x: SLOT_OUT, y: SY, fold: 0 },
    { t: t + 1.4, x: OUT_R, y: SY, rot: .08, a: 1 },
  ]);
  cue(t + .45, 'slot'); cue(t + .8, 'slide');
  return note(w.N, norm(k));
}
function vanish(o, t, to = null, d = .5) {  // fly to a spot (e.g. the board) and fade
  const last = o.keys[o.keys.length - 1];
  const tgt = to || [last.x, last.y - 40];
  o.keys.push({ ...last, t, });
  o.keys.push({ ...last, t: t + d, x: tgt[0], y: tgt[1], s: to ? .25 : last.s, a: 0 });
}
function hold(o, t) { const last = o.keys[o.keys.length - 1]; o.keys.push({ ...last, t }); }
function moveNote(o, t, d, props) { const last = o.keys[o.keys.length - 1]; o.keys.push({ ...last, t }); o.keys.push({ ...last, ...props, t: t + d }); }

// ---------- capsule trips ----------
const TUBE = Object.fromEntries(TUBES.map(tb => [tb.id, tb]));
const DESKP = [1478, 600];
const BIGP = [1560, 520];
function capsule(segs) { CAPS.push({ segs }); }
function trip(id, t, sp = 1, opts = {}) {
  const tb = TUBE[id];
  const inPts = [DESKP, [tb.mouth[0] + 30, tb.mouth[1]], [G.RX0, tb.y]];
  const out = [...inPts, ...tb.outPath.slice(1)];
  const back = [...out].reverse();
  const d1 = 1.25 * sp, dw = .55 * sp, d2 = 1.25 * sp;
  capsule([{ t0: t, t1: t + d1, pts: out, ease: inOut }, { t0: t + d1 + dw, t1: t + d1 + dw + d2, pts: back, ease: inOut }]);
  P('glow_' + id, t, 0); P('glow_' + id, t + d1 * .9, 1); P('glow_' + id, t + d1 + dw + .3, 1); P('glow_' + id, t + d1 + dw + 1.0, 0);
  cue(t, 'whoosh', { d: d1 }); cue(t + d1, 'ding', { tool: id }); cue(t + d1 + dw, 'whoosh', { d: d2, back: 1 }); cue(t + d1 + dw + d2, 'pop');
  return t + d1 + dw + d2;           // arrival back at the desk
}
// the note being rolled into a capsule
function rollIn(w, t) {
  const k = w.k.concat([{ t, x: w.k[0].x, y: w.k[0].y, reveal: 1 }, { t: t + .3, x: DESKP[0], y: DESKP[1], s: .12, a: 0 }]);
  return note(w.N, norm(k));
}
function popOut(N, t, at = READ, s = 1) {
  if (at === 'BIG') { at = BIGP; s = 1.6; }
  return note(N, norm([{ t, x: DESKP[0], y: DESKP[1], s: .12, a: 0, rot: 0, fold: 0, reveal: 1 }, { t: t + .35, x: at[0], y: at[1], s, a: 1, rot: -.015 }]));
}

// ---------- camera boxes ----------
const BX = {
  cold: [2600, 150, 3600, 850],
  house: [860, 190, 1800, 900],
  room: [900, 280, 1760, 880],
  desk: [1210, 400, 1800, 780],
  read: [1420, 400, 1790, 700],
  slot: [1520, 540, 1940, 770],
  wide: [-40, 190, 1990, 905],
  toolwall: [860, 330, 1300, 740],
  board: [1180, 290, 1700, 560],
  right: [1180, 360, 1990, 800],
  city: [-20, 200, 940, 920],
  rest: [330, 560, 640, 800],
  far: [-3200, -300, 5800, 1250],
};

// =====================================================================
//  THE SCRIPT
// =====================================================================
const Q = (zh, en, o = {}) => ({ zh, en, kind: 'human', ...o });
const M = (zh, en, o = {}) => ({ zh, en, kind: 'mind', ...o });
const Wd = (zh, en, o = {}) => ({ zh, en, kind: 'world', ...o });
let T;

// ---- S0: cold open (dictionary) ----
function S0(t) {
  P('fade', 0, 1); P('fade', t + .8, 0);
  P('lamp', 0, 0); P('city', 0, 0); P('stars', 0, .5); P('books', 0, 0); P('piles', 0, 0); P('myRoom', 0, 0);
  cam(t, BX.cold, 0);
  const q = note(Q('什么是 AI Agent？', 'What is an AI agent?', { w: 360, zs: 38, es: 40, center: true, noHeart: 1 }), norm([
    { t: t + .8, x: 3900, y: 470, s: 1, rot: .1, a: 1 }, { t: t + 1.9, x: 3100, y: 470, rot: -.02 },
    { t: t + 3.4, x: 3100, y: 470 }, { t: t + 4.0, x: 2350, y: 470, rot: -.1 }]));
  cue(t + 1, 'slide'); cue(t + 3.5, 'slide');
  const dz = 'AI 智能体（AI Agent）是一种能够感知其所处环境、基于内部表征进行推理，并通过执行器作用于环境、以实现目标导向行为的自主计算实体；其行为受效用函数、策略优化、有限理性、部分可观测性……';
  const de = 'An AI agent is an autonomous computational entity that perceives its environment through sensors, reasons over internal representations, and acts upon that environment through actuators in pursuit of goal-directed behavior, subject to utility functions, policy optimization, bounded rationality, partial observability, stochastic transition dynamics, reward shaping, and…';
  const D = { zh: dz, en: de, kind: 'dict', w: 560, zs: 21, zf: F.zh, zw: 500, es: 21, ef: F.en, ew: 400, ec: '#3D3350', elh: 1.35, grow: 1 };
  note(D, norm([
    { t: t + 4.3, x: 2300, y: 300, s: 1, rot: .08, reveal: 0, a: 1 }, { t: t + 5.0, x: 3100, y: 300, rot: 0, reveal: .03 },
    { t: t + 9.6, x: 3100, y: 300, reveal: 1 },
    { t: t + 10.1, x: 3100, y: 360, s: .9, rot: .05 },
    { t: t + 10.9, x: 3950, y: 80, s: .15, rot: 5 }]));
  cue(t + 4.4, 'slide'); cue(t + 5.0, 'typing', { d: 4.6 }); cue(t + 10.1, 'crumple'); cue(t + 10.5, 'toss');
  cap(t + 7.4, t + 10.2, '这是词典的答案。', 'That’s the dictionary answer.');
  cap(t + 10.5, t + 13.4, '换个方式——我画给你看。', 'Let me draw it for you instead.');
  P('fade', t + 13.0, 0); P('fade', t + 13.8, 1);
  return t + 13.8;
}
// ---- S1: title ----
function S1(t) {
  P('title', t, 0); P('title', t + 1.2, 1); P('title', t + 4.9, 1); P('title', t + 5.8, 0);
  cue(t + .2, 'title');
  return t + 5.9;
}
// ---- S2: the room ----
function S2(t) {
  P('fade', t, 1); P('fade', t + 1.2, 0);
  cam(t, BX.house, 0); cam(t + 1, [880, 240, 1780, 890], 8);
  P('stars', t, .6);
  // lamp flicker on
  P('lamp', t + .6, 0); P('lamp', t + .75, .7); P('lamp', t + .85, .1); P('lamp', t + 1.05, .9); P('lamp', t + 1.2, .4); P('lamp', t + 1.5, 1);
  cue(t + .7, 'click');
  mood(t, 'happy'); look(t, [0, 0]);
  // books fill up
  ramp('books', t + 1.4, t + 6.4, 0, 1, x => x); ramp('piles', t + 1.4, t + 6.4, 0, 1, x => x);
  cue(t + 1.5, 'books', { d: 5 });
  look(t + 1.6, [-1, -1]); look(t + 4, [.4, -1]); mood(t + 2, 'o'); mood(t + 5.5, 'happy');
  cap(t + 1.6, t + 6.4, '想象一个头脑，读过几乎所有写下来的文字。', 'Imagine a mind that has read almost everything ever written.');
  // no window, no clock, no door
  const t2 = t + 6.6;
  cap(t2, t2 + 5.6, '但它住在一个房间里：没有窗，没有钟，没有门。', 'But it lives in a room with no window, no clock, no door.');
  mood(t2, 'smile');
  P('ghostWindow', t2 + .4, 0); P('ghostWindow', t2 + .8, 1); P('ghostWindow', t2 + 2.2, 1); P('ghostWindow', t2 + 2.8, 0); look(t2 + .4, [-.2, -1]); cue(t2 + .8, 'nope');
  P('clockHL', t2 + 2.2, 0); P('clockHL', t2 + 2.6, 1); P('clockHL', t2 + 3.8, 1); P('clockHL', t2 + 4.4, 0); look(t2 + 2.3, [1, -1]); cue(t2 + 2.6, 'nope');
  P('ghostDoor', t2 + 3.8, 0); P('ghostDoor', t2 + 4.2, 1); P('ghostDoor', t2 + 5.3, 1); P('ghostDoor', t2 + 5.8, 0); look(t2 + 3.9, [1, .3]); cue(t2 + 4.2, 'nope');
  // just one slot
  const t3 = t2 + 6.0;
  cam(t3, BX.slot, 1.4);
  P('slotHL', t3 + .6, 0); P('slotHL', t3 + 1.1, 1); P('slotHL', t3 + 2.6, 1); P('slotHL', t3 + 3.2, 0);
  P('slotLabel', t3 + .8, 0); P('slotLabel', t3 + 1.3, 1);
  cue(t3 + 1.1, 'sparkle');
  cap(t3 + .4, t3 + 3.4, '只有一个投信口。', 'Just one slot.');
  // note in, note out
  const t4 = t3 + 3.4;
  cam(t4, BX.desk, 1.2);
  const q1 = incoming(Q('天为什么是蓝的？', 'Why is the sky blue?', { noHeart: 1, w: 230 }), t4);
  look(t4 + .5, [1, .2]); mood(t4 + 1.4, 'smile');
  think(t4 + 1.8, t4 + 2.6); vanish(q1, t4 + 2.6);
  const r1 = written(M('阳光被空气散射，蓝光散得最多。', 'Sunlight scatters in air — blue scatters most.', { w: 240 }), t4 + 2.7, 1.3);
  postOut(r1, t4 + 4.2);
  look(t4 + 4.3, [1, .4]); mood(t4 + 4.6, 'happy'); hop(t4 + 5.1);
  cap(t4 + 3.4, t4 + 7.6, '纸条进，纸条出。在这件事上，它好得惊人。', 'Note in, note out. It is astonishingly good at this.');
  // montage
  const t5 = t4 + 6.2;
  cam(t5, BX.room, 1.5);
  const ex = [
    [Q('写一句关于月亮的诗', 'A line of poetry about the moon', { noHeart: 1 }), M('月亮是一枚旧硬币，被夜投进了天空。', 'The moon: an old coin, dropped into the sky by the night.')],
    [Q('“谢谢”用法语怎么说？', 'How do you say “thank you” in French?', { noHeart: 1 }), M('Merci !', 'Merci ! 🙂', { w: 170 })],
    [Q('一句话解释引力', 'Explain gravity in one line', { noHeart: 1 }), M('质量让时空弯曲，万物顺着弯走。', 'Mass bends spacetime; things roll along the bend.')],
  ];
  let tt = t5;
  ex.forEach(([qq, rr_], i) => {
    const d = [2.3, 1.9, 1.7][i];
    const a = incoming({ ...qq, w: 270 }, tt, [READ[0], READ[1] - 20]);
    vanish(a, tt + 1.7, null, .3);
    const w = written({ ...rr_, w: rr_.w || 240 }, tt + 1.8, .55 * (d / 2));
    postOut(w, tt + 1.8 + .6 * (d / 2));
    think(tt + 1.5, tt + 1.8); hop(tt + 2.6 + i * .05);
    tt += d;
  });
  mood(tt, 'happy');
  cap(tt + .2, tt + 5.4, '这就是大语言模型（LLM）——聊天机器人里住的，就是它。', 'This is a large language model — the mind inside a chatbot.');
  look(tt + .5, [0, 0]);
  return tt + 5.6;
}
// ---- S3: the errand ----
function S3(t) {
  cam(t, BX.desk, 1.2);
  const B1 = Q('这周五，给妈妈订个生日晚餐。我们 3 个人。', 'Book Mom’s birthday dinner this Friday. 3 of us.', { w: 280 });
  const b = incoming(B1, t); cue(t + 1.6, 'belinda');
  look(t + .5, [1, .2]); mood(t + 1.8, 'o'); mood(t + 2.6, 'happy'); hop(t + 2.8);
  vanish(b, t + 3.0);
  const r = written(M('生日快乐！🎂 订餐只需四步：① 选一家她爱的餐厅 ② 查查有没有空位 ③ 打电话预订 ④ 记得说是生日！',
    'Happy birthday to her! 🎂 Four easy steps: ① pick a place she loves ② check for a table ③ call to book ④ mention the birthday!', { w: 300, zs: 21, es: 22 }), t + 3.2, 3.2);
  postOut(r, t + 6.6);
  mood(t + 6.8, 'happy'); look(t + 6.8, [1, .5]);
  // the silence
  P('music', t + 7.8, 1); P('music', t + 8.0, 0);
  const t2 = t + 9.4;
  mood(t2 - .6, 'smile');
  const b2 = incoming(Q('……我知道怎么订。', '…I know HOW.', { w: 230 }), t2, [READ[0], READ[1] - 60]);
  mood(t2 + 1.7, 'o');
  const b3 = incoming(Q('我是想让它被订好。', 'I wanted it DONE.', { w: 230 }), t2 + 2.2, [READ[0], READ[1] + 60]);
  mood(t2 + 4.0, 'flat'); cue(t2 + 4.0, 'womp');
  vanish(b2, t2 + 6.4); vanish(b3, t2 + 6.6);
  const t3 = t2 + 5.2;
  look(t3, [1, -1]); P('clockHL', t3, 0); P('clockHL', t3 + .4, 1); P('clockHL', t3 + 2.4, 1); P('clockHL', t3 + 3, 0);
  thought(t3 + .3, t3 + 5.6, 1590, 470, '今天几号？', 'What’s today?');
  look(t3 + 1.3, [-1, -.6]); thought(t3 + 1.3, t3 + 5.6, 1170, 430, '妈妈是谁？', 'Who is Mom?');
  look(t3 + 2.3, [-1, .4]); thought(t3 + 2.3, t3 + 5.6, 1160, 590, '电话在哪？', 'Where’s a phone?');
  mood(t3 + 1.3, 'o');
  cam(t3 - .4, BX.room, 1.6);
  cap(t3 + 3.4, t3 + 9.6, '它知道晚餐怎么订，却订不了。它甚至不知道今天几号。', 'It knows how dinner gets booked. It can’t book one. It doesn’t even know what day it is.');
  const t4 = t3 + 9.8;
  mood(t4, 'flat'); ramp('slump', t4, t4 + 1, 0, 1); look(t4, [0, .6]);
  cam(t4, BX.house, 3);
  cap(t4 + .2, t4 + 5, '它会回答，却不会行动。', 'It can answer. It can’t act.', { big: 1 });
  cue(t4 + .2, 'sting');
  return t4 + 5.6;
}
// ---- S4: a better room ----
function S4(t) {
  ramp('slump', t, t + .6, 1, 0); mood(t, 'smile'); look(t, [-.5, -.5]);
  cap(t + .2, t + 3.4, '办法，不只是一个更聪明的头脑——', 'The fix wasn’t only a smarter mind —');
  cap(t + 3.5, t + 6.8, '——还有一个更好的房间。', '— it was a better room.');
  cam(t + 3.0, BX.wide, 3.2);
  ramp('city', t + 3.8, t + 6.8, 0, 1); ramp('stars', t + 3.8, t + 6.8, .6, 1);
  cue(t + 3.6, 'reveal');
  mood(t + 4.5, 'o'); look(t + 4.5, [-1, 0]);
  // tubes
  const t2 = t + 7.0;
  ramp('tubes', t2, t2 + 4.2, 0, 1, x => x);
  for (let i = 0; i < 5; i++) cue(t2 + .15 + i * .5, 'clank', { i });
  cap(t2 + .6, t2 + 6.2, '工具：通向外面世界的管道。', 'Tools: tubes to the outside world.');
  cam(t2 + 3.6, BX.toolwall, 1.4);
  mood(t2 + 1, 'happy');
  // board
  const t3 = t2 + 6.4;
  cam(t3, BX.board, 1.2);
  ramp('board', t3 + .4, t3 + 1.3, 0, 1, x => x); cue(t3 + .5, 'thunk');
  look(t3 + .4, [-.3, -1]);
  cap(t3 + .6, t3 + 5.2, '一块板：此刻它能看见的一切。', 'A board: everything it can see right now.');
  // drawer
  const t4 = t3 + 5.4;
  cam(t4, BX.room, 1.2);
  ramp('cabinet', t4 + .3, t4 + 1.2, 0, 1, x => x); cue(t4 + .4, 'rise');
  ramp('piles', t4, t4 + .4, 1, 0);
  P('drawer', t4 + 1.8, 0); P('drawer', t4 + 2.3, 1, outBack); P('drawer', t4 + 3.6, 1); P('drawer', t4 + 4.0, 0);
  cue(t4 + 1.8, 'drawer'); cue(t4 + 3.6, 'drawerShut');
  look(t4 + .4, [-1, .8]);
  cap(t4 + .6, t4 + 5.2, '一个抽屉：下次还该记得的事。', 'A drawer: what’s worth remembering next time.');
  // lock and key
  const t5 = t4 + 5.4;
  cam(t5, [860, 240, 1990, 900], 1.4);
  ramp('lock', t5 + .4, t5 + 1.1, 0, 1, x => x); cue(t5 + .5, 'lock');
  ramp('keyVis', t5 + 1.4, t5 + 2.2, 0, 1); cue(t5 + 1.6, 'jingle');
  look(t5 + .4, [-1, .3]);
  cap(t5 + .6, t5 + 5.6, '一把锁：有些事，得先问过你。', 'A lock: some things need your say-so first.');
  // loop counter
  const t6 = t5 + 5.8;
  cam(t6, BX.room, 1.2);
  ramp('counter', t6 + .3, t6 + 1.0, 0, 1, x => x); cue(t6 + .4, 'thunk');
  ramp('loopSpin', t6 + 1.2, t6 + 4.2, 0, 3, inOut); for (let i = 0; i < 3; i++) cue(t6 + 1.6 + i, 'tick');
  look(t6 + .4, [1, -1]); mood(t6 + .5, 'o');
  cap(t6 + .6, t6 + 6.0, '最关键的一件：允许它一轮一轮做下去——一个循环。', 'And the key piece: permission to keep going, round after round. A loop.');
  const t7 = t6 + 6.2;
  cam(t7, BX.wide, 2);
  mood(t7 + .5, 'happy'); hop(t7 + 1.2); hop(t7 + 1.8, .6);
  cap(t7 + .3, t7 + 5.6, '头脑还是那个头脑。这个新房间，工程师叫它 harness。', 'Same mind. Engineers call the new room a harness.');
  return t7 + 5.8;
}
// ---- S5: the loop ----
let LOOPN = [];
function loopTick(t) { LOOPN.push(t); cue(t, 'tick'); }
function S5(t) {
  cam(t, BX.desk, 1.2);
  const B1 = Q('这周五，给妈妈订个生日晚餐。我们 3 个人。', 'Book Mom’s birthday dinner this Friday. 3 of us.', { w: 280 });
  const b = incoming(B1, t); cue(t + 1.6, 'belinda');
  look(t + .5, [1, .2]); mood(t + 1.6, 'smile');
  cap(t + .3, t + 3.4, '同一张纸条，再来一次。', 'Same note. One more time.');
  // think: plan onto the board
  const tp = t + 3.2;
  cam(tp, [1180, 300, 1800, 740], 1.2);
  think(tp, tp + 2.2); vanish(b, tp + .2, [1380, 400], .6);
  const items = [['周五是几号？', 'Which Friday?'], ['找餐厅', 'Find a place'], ['订位', 'Book it'], ['核对', 'Double-check']];
  items.forEach(([zh, en], i) => { BOARD.push({ zh, en, tA: tp + .8 + i * .45, tTick: 1e9 }); cue(tp + .8 + i * .45, 'pin'); });
  look(tp + .4, [-.3, -1]);
  cap(tp + .2, tp + 4.4, '先想：目标是什么？下一步做什么？', 'Think: what’s the goal? What’s the next step?');
  // L1 clock
  let c = tp + 4.4;
  cam(c, BX.desk, 1.0);
  look(c, [1, 0]); mood(c, 'smile');
  let w = written(M('今天几号？', 'What’s today’s date?', { tag: '→ 时钟 CLOCK', w: 220 }), c, 1.0);
  rollIn(w, c + 1.1);
  cam(c + 1.1, BX.wide, .9);
  let back = trip('clock', c + 1.3);
  cam(back - .9, BX.desk, .9);
  let r = popOut(Wd('9月27日，星期日', 'Sunday, Sep 27', { tag: '时钟 CLOCK →', w: 220 }), back);
  loopTick(back); look(back, [1, .2]); mood(back + .4, 'happy');
  cap(c + .2, c + 3.6, '第一步：先问问今天几号。', 'First move: ask what day it is.');
  cap(back + .2, back + 3.8, '想 → 做 → 看。这是一轮。', 'Think → act → look. That’s one loop.');
  BOARD[0].tTick = back + 1.4; cue(back + 1.4, 'check');
  vanish(r, back + 2.8, [1320, 380]);
  // L2 memory
  c = back + 3.9;
  cam(c, BX.room, 1.0);
  look(c, [-1, .9]); P('drawer', c + .2, 0); P('drawer', c + .7, 1, outBack); P('drawer', c + 2.2, 1); P('drawer', c + 2.6, 0);
  cue(c + .2, 'drawer'); cue(c + 2.2, 'drawerShut');
  const mem = { zh: '妈妈：爱吃清蒸鱼。膝盖不好，不爬楼梯。', en: 'Mom: loves steamed fish. Bad knee — no stairs.', kind: 'card', tag: '记忆 MEMORY', w: 250 };
  const mn = note(mem, norm([{ t: c + .7, x: 1230, y: 720, s: .2, a: 0 }, { t: c + 1.3, x: READ[0], y: READ[1], s: 1, a: 1 }]));
  cue(c + .8, 'pop');
  loopTick(c + 1.3); look(c + 1.2, [1, 0]); mood(c + 1.6, 'smile');
  cap(c + .3, c + 4.6, '再翻翻它记得的事。', 'Then it checks what it remembers.');
  vanish(mn, c + 4.0, [1450, 380]);
  // L3 search
  c = c + 4.7;
  cam(c, BX.desk, 1.0);
  w = written(M('清蒸鱼 · 无台阶 · 周五 18:00 · 3 位', 'steamed fish · step-free · Fri 6pm · 3 people', { tag: '→ 搜索 SEARCH', w: 250 }), c, 1.1);
  rollIn(w, c + 1.2);
  cam(c + 1.2, BX.wide, .9);
  back = trip('search', c + 1.4);
  cam(back - .9, [1300, 380, 1800, 760], .9);
  const res = Wd(null, null, {
    tag: '搜索 SEARCH →', w: 300, zs: 20, es: 20,
    rows: [{ zh: '海港楼：在二楼，没电梯', en: 'Harbor House — 2nd floor, no lift' }, { zh: '莲：周五不营业', en: 'Lotus — closed Fridays' }, { zh: '翠园：一楼，招牌清蒸鱼', en: 'Jade Garden — ground floor, steamed fish' }],
  });
  const tm = back + .9;
  res.overlay = (cx, L, Pp, tt) => {
    const rows = res.rows;
    cx.lineCap = 'round';
    [[0, tm], [1, tm + .6]].forEach(([i, t0]) => {
      const k = seg(tt, t0, t0 + .35); if (k <= 0) return; const R = rows[i];
      cx.strokeStyle = C.red; cx.lineWidth = 3.5; cx.beginPath();
      const ym = (R.y0 + R.y1) / 2; cx.moveTo(10, ym); cx.lineTo(10 + (L.w - 20) * k, ym + 4); cx.stroke();
    });
    const k = seg(tt, tm + 1.3, tm + 1.9); if (k > 0) {
      const R = rows[2]; cx.strokeStyle = C.green; cx.lineWidth = 3.5; cx.beginPath();
      cx.ellipse(L.w / 2, (R.y0 + R.y1) / 2, L.w / 2 - 4, (R.y1 - R.y0) / 2 + 6, -0.02, -1.6, -1.6 + k * 6.4); cx.stroke();
    }
  };
  r = popOut(res, back, [READ[0] - 20, READ[1] + 10]);
  cue(tm, 'strike'); cue(tm + .6, 'strike'); cue(tm + 1.3, 'circle');
  loopTick(back); mood(back + .3, 'squint'); mood(tm + 1.4, 'happy');
  cap(back + .6, back + 4.6, '小事，它自己拿主意。', 'Small choices, it makes by itself.');
  BOARD[1].tTick = tm + 2.2; cue(tm + 2.2, 'check');
  vanish(r, back + 4.4, [1450, 440]);
  // L4 phone
  c = back + 4.6;
  cam(c, BX.desk, 1.0);
  w = written(M('翠园 · 周五 18:00 · 3 位 · 过生日', 'Jade Garden · Fri 6pm · 3 people · birthday', { tag: '→ 电话 PHONE', w: 250 }), c, 1.0);
  rollIn(w, c + 1.1);
  cam(c + 1.1, BX.wide, .9);
  back = trip('phone', c + 1.3);
  cam(back - .9, BX.desk, .9);
  r = popOut(Wd('✓ 预订成功！', '✓ Success!', { tag: '电话 PHONE →', w: 230, zs: 30, es: 32, center: true }), back);
  loopTick(back); mood(back + .3, 'happy'); hop(back + .5);
  mood(back + 1.6, 'squint'); look(back + 1.6, [1, 0]);
  cap(back + 1.2, back + 4.6, '但“成功”，只是一句话。', 'But “success” is just a word.');
  vanish(r, back + 3.8);
  // L5 email (verify)
  c = back + 4.4;
  w = written(M('把确认函给我看看。', 'Show me the confirmation.', { tag: '→ 邮件 EMAIL', w: 230 }), c, .9);
  rollIn(w, c + 1.0);
  cam(c + 1.0, BX.wide, .9);
  back = trip('email', c + 1.2);
  cam(back - .6, BX.read, 1.0);
  const conf = Wd(null, null, { tag: '邮件 EMAIL →', w: 330, zs: 22, es: 23, extraH: 40, rows: [{ zh: '翠园 · 10月2日（周五）18:00', en: 'Jade Garden · Fri Oct 2 · 6:00 pm' }, { zh: '人数：2 位', en: 'Party of: 2' }] });
  const tc = back + 1.2;
  conf.overlay = (cx, L, Pp, tt) => {
    const k = seg(tt, tc, tc + .5); if (k <= 0) return;
    const R = conf.rows[1]; cx.strokeStyle = C.red; cx.lineWidth = 4;
    cx.beginPath(); cx.ellipse(116, (R.y0 + R.y1) / 2 - 12, 32, 22, 0, -1.6, -1.6 + k * 6.4); cx.stroke();
    if (tt > tc + .5) { cx.globalAlpha *= clamp((tt - tc - .5) * 3); cx.fillStyle = C.red; cx.font = `700 26px ${F.hand}`; cx.textAlign = 'left'; cx.fillText('应该是 3！ / should be 3!', 16, R.y1 + 30); }
  };
  r = popOut(conf, back);
  cue(tc, 'circle'); cue(tc + .2, 'uhoh');
  loopTick(back); mood(back + .5, 'squint'); mood(tc + .1, 'o');
  cap(back + .4, back + 4.6, '所以它去核对真实世界。', 'So it checks the real world.');
  // 37% insert
  const t37 = back + 4.8;
  P('p37', t37, 0); P('p37', t37 + .6, 1); P('p37', t37 + 9.6, 1); P('p37', t37 + 10.2, 0);
  P('p37k', t37 + .8, 0); P('p37k', t37 + 5.0, 1, x => x);
  cue(t37 + .8, 'steps', { d: 4.2 });
  P('p37t', t37, t37);
  cap(t37 + 5.6, t37 + 10.0, '所以，好的 agent 不是从不出错，而是会检查、会改。', 'So a good agent isn’t one that never slips. It checks — and fixes.');
  hold(r, t37 + 10.2);
  // L6/L7 fix + recheck
  c = t37 + 10.4;
  cam(c - .4, BX.wide, 1.0);
  vanish(r, c, [1400, 440]);
  mood(c, 'smile');
  w = written(M('改成 3 位。', 'Make it 3 people.', { tag: '→ 电话 PHONE', w: 210 }), c + .2, .6, BIGP, 1.6); rollIn(w, c + .9);
  back = trip('phone', c + 1.0, .7);
  r = popOut(Wd('已改为 3 位。需付定金 $40，不可退。', 'Updated to 3. A $40 deposit is required — non-refundable.', { tag: '电话 PHONE →', w: 260 }), back, 'BIG');
  loopTick(back);
  vanish(r, back + 2.0, [1400, 440]);
  w = written(M('确认函，再看一次。', 'Confirmation, once more.', { tag: '→ 邮件 EMAIL', w: 220 }), back + 2.1, .6, BIGP, 1.6); rollIn(w, back + 2.8);
  let back2 = trip('email', back + 2.9, .7);
  r = popOut(Wd('人数：3 位 ✓ · 定金待付', 'Party of 3 ✓ · deposit pending', { tag: '邮件 EMAIL →', w: 240 }), back2, 'BIG');
  loopTick(back2); mood(back2 + .3, 'happy');
  BOARD[2].tTick = back2 + .8; cue(back2 + .8, 'check');
  cap(c + .4, back2 + .2, '改正，再核对。', 'Fix it. Check again.');
  vanish(r, back2 + 1.8, [1400, 440]);
  // L8 the lock
  c = back2 + 2.0;
  w = written(M('付定金 $40', 'Pay the $40 deposit', { tag: '→ 付款 PAY', w: 210 }), c, .7);
  const cr = rollIn(w, c + .8);
  const tb = TUBE.pay;
  capsule([{ t0: c + .9, t1: c + 1.4, pts: [DESKP, [tb.mouth[0] + 40, tb.mouth[1]]], ease: in2 }, { t0: c + 1.45, t1: c + 1.9, pts: [[tb.mouth[0] + 40, tb.mouth[1]], DESKP], ease: out3 }]);
  cue(c + .9, 'whoosh', { d: .5 }); cue(c + 1.4, 'rattle');
  P('lockShake', c + 1.35, 0); P('lockShake', c + 1.4, 1); P('lockShake', c + 2.1, 0);
  const again = popOut(M('付定金 $40', 'Pay the $40 deposit', { tag: '→ 付款 PAY', w: 210 }), c + 1.9);
  mood(c + 1.5, 'o'); look(c + 1.4, [-1, .3]);
  vanish(again, c + 2.8);
  const ta = c + 3.0;
  cam(ta, [1360, 380, 1810, 720], 1.0);
  const ask = written(M('找到了：翠园，一楼，有清蒸鱼。周五 18:00，3 位。要付 $40 定金，不可退。可以付吗？', 'Found it: Jade Garden, ground floor, steamed fish. Fri 6pm, 3 people. $40 deposit, non-refundable. OK to pay?', { w: 330, zs: 21, es: 22 }), ta, 2.4, [READ[0] - 30, READ[1]]);
  look(ta, [1, 0]); mood(ta, 'smile');
  cap(ta + .2, ta + 5.0, '大事、难撤回的事——它停下来，问你。', 'Big, hard-to-undo choices — it stops and asks you.');
  postOut(ask, ta + 2.8);
  loopTick(ta + 2.8);
  cam(ta + 2.8, BX.right, 1.2);
  // waiting
  P('wait', ta + 3.6, 0); P('wait', ta + 3.8, 1); P('wait', ta + 6.0, 1); P('wait', ta + 6.2, 0);
  look(ta + 3.6, [1, .3]); mood(ta + 4.4, 'neutral'); mood(ta + 5.4, 'smile');
  const ty = ta + 6.0;
  const yes = incoming(Q('好！💛', 'Yes! 💛', { w: 170, zs: 30, es: 32, center: true }), ty, [READ[0], READ[1] - 20]);
  cue(ty + 1.6, 'belinda');
  // key rides in beside the note, then flies to the lock
  P('keyFly', ty, 0); P('keyFly', ty + 1.6, 1, x => x); P('keyFly', ty + 2.6, 2); P('keyFly', ty + 3.4, 3, inOut);
  cue(ty + 3.4, 'unlock');
  ramp('lockOpen', ty + 3.4, ty + 3.8, 0, 1, outBack);
  mood(ty + 1.8, 'happy'); hop(ty + 2);
  cap(ty + .4, ty + 4.6, '你说“行”，它才去做。', 'You say yes. Then it acts.');
  cam(ty + 2.4, BX.wide, 1.2);
  vanish(yes, ty + 2.4);
  const w8 = written(M('付定金 $40', 'Pay the $40 deposit', { tag: '→ 付款 PAY', w: 210 }), ty + 3.6, .5, BIGP, 1.6); rollIn(w8, ty + 4.1);
  back = trip('pay', ty + 4.2, .8);
  r = popOut(Wd('已付 $40 ✓', 'Paid $40 ✓', { tag: '付款 PAY →', w: 200, zs: 28, es: 30, center: true }), back, 'BIG');
  loopTick(back); BOARD[3].tTick = back + .6; cue(back + .6, 'check');
  vanish(r, back + 1.8, [1450, 440]);
  // L9 remember
  c = back + 2.0;
  cam(c, BX.room, 1.0);
  const m2 = written({ zh: '妈妈生日：翠园很合适。明年再订？', en: 'Mom’s birthday: Jade Garden worked. Book again next year?', kind: 'card', tag: '→ 记忆 MEMORY', w: 250 }, c, 1.3);
  P('drawer', c + 1.4, 0); P('drawer', c + 1.9, 1, outBack); P('drawer', c + 3.0, 1); P('drawer', c + 3.4, 0);
  cue(c + 1.4, 'drawer'); cue(c + 3.0, 'drawerShut');
  note(m2.N, norm(m2.k.concat([{ t: c + 1.9, x: READ[0], y: READ[1] }, { t: c + 2.6, x: 1240, y: 715, s: .2, a: 0 }])));
  loopTick(c + 2.6); look(c + 1.9, [-1, .9]);
  cap(c + .2, c + 4.6, '最后，把值得记住的，放进抽屉。', 'Last, it files away what’s worth remembering.');
  // done
  c = c + 4.8;
  cam(c, BX.desk, 1.0);
  look(c, [1, 0]);
  const done = written(M('订好了！周五 18:00，翠园，3 位。🎂', 'Done! Fri 6pm, Jade Garden, table for 3. 🎂', { w: 250, zs: 23, es: 25 }), c, 1.3);
  postOut(done, c + 1.6); loopTick(c + 2.2);
  mood(c + 2.2, 'happy'); hop(c + 2.6); hop(c + 3.1, .6);
  cam(c + 2.6, BX.wide, 1.6);
  cam(c + 4.4, BX.rest, 2.2);
  ramp('cake', c + 5.2, c + 6.4, 0, 1); cue(c + 5.4, 'cake');
  cap(c + 4.6, c + 9.0, '这一次，事情真的办成了。', 'This time, it actually got done.');
  return c + 9.4;
}
// ---- S6: the click (split screen) ----
function S6(t) {
  P('split', t, 0); P('split', t + 1.0, 1); P('split', t + 21.6, 1); P('split', t + 22.4, 0);
  P('splitFocus', t, 0); P('splitFocus', t + 1.4, -1); P('splitFocus', t + 5.2, -1); P('splitFocus', t + 5.8, 1); P('splitFocus', t + 9.4, 1); P('splitFocus', t + 10.0, 0);
  P('splitT0', t, t);
  cue(t + 1.4, 'answer'); cue(t + 5.8, 'act');
  cap(t + 1.2, t + 5.2, 'LLM 会回答。', 'An LLM answers.', { big: 1 });
  cap(t + 5.6, t + 9.6, 'Agent 会行动。', 'An agent acts.', { big: 1 });
  cap(t + 10.0, t + 15.2, '同一个头脑。一个新房间。再加一个循环。', 'Same mind. A new room. And a loop.');
  cap(t + 15.4, t + 21.4, '想，做，看——直到完成，或者直到该问你。', 'Think, act, look — until it’s done, or until it should ask you.');
  return t + 22.4;
}
// ---- S7: many rooms ----
function S7(t) {
  cam(t, BX.wide, 0);
  cam(t + .3, BX.far, 6.5);
  ramp('others', t + 1.2, t + 5.5, 0, 1, x => x);
  cue(t + 1.4, 'many', { d: 11 });
  cap(t + 1.0, t + 6.0, '活儿太大？房间可以呼叫别的房间。', 'Job too big? Rooms can call other rooms.');
  cap(t + 6.2, t + 11.4, '这就叫“多智能体”（multi-agent）。', 'That’s what “multi-agent” means.');
  P('fade', t + 11.2, 0); P('fade', t + 12.0, 1);
  return t + 12.0;
}
// ---- S8: the surprise ----
const LOG = [
  ['读', 'READ', 'start-here.md'],
  ['读', 'READ', 'agent-architecture.md'],
  ['读', 'READ', 'model-vs-agent-capability.md'],
  ['读', 'READ', 'memory-system-guide.md'],
  ['读', 'READ', 'harness-architecture-patterns.md'],
  ['读', 'READ', 'personal-agents-agent-economy.md'],
  ['读', 'READ', 'first-agent-test-muse-spark.md'],
  ['读', 'READ', 'hello-human-36 · 上次：「字太小」'],
  ['想', 'THINK', '一个没有窗的房间？'],
  ['写', 'WRITE', 'lib.js · world.js · story.js'],
  ['看', 'LOOK', '标题被黑幕盖住了 → fix'],
  ['看', 'LOOK', '🎂 被切成半个字 → fix'],
  ['看', 'LOOK', '竖屏空了一大块 → fix'],
  ['看', 'LOOK', 'English 太小太淡 → 中英一样大'],
  ['写', 'WRITE', 'music.py · 小德 = C'],
  ['核', 'CHECK', '0.99¹⁰⁰ = 0.366 ✓'],
  ['渲', 'RENDER', '8,959 帧 × 横竖两版'],
];
function S8(t) {
  P('fade', t, 1); P('fade', t + .8, 0);
  P('myRoom', t - .01, 0); P('myRoom', t, 1); P('lockOpen', t - .01, 1); P('lockOpen', t, 0);
  cam(t, BX.desk, 0);
  mood(t, 'smile'); look(t, [1, .2]);
  const B = Q('你的下一部电影：《什么是 AI Agent？》别让我选。读，想，决定，把它做出来。还有——给我个惊喜。',
    'Your next film: “What Is an AI Agent?” Don’t ask me to choose. Read. Think. Decide. Make the film. And — surprise me.', { w: 340, zs: 21, es: 23 });
  const b = incoming(B, t + .6, [READ[0] - 40, READ[1] - 10]); cue(t + 2.2, 'belinda');
  cam(t + 1.8, [1360, 360, 1810, 740], 1.2);
  mood(t + 2.6, 'o'); hop(t + 5.4);
  cap(t + 3.0, t + 6.2, '还有一件事。', 'One more thing.');
  vanish(b, t + 6.4, [1380, 400]);
  // relabel the tubes: my tools
  P('relabel', t + 6.6, 0); P('relabel', t + 7.2, 1);
  cue(t + 6.7, 'flip');
  const tl = t + 7.4;
  cam(t + 6.4, BX.room, 1.2);
  P('logK', tl, 0); P('logK', tl + 10, 1, x => x);
  P('loopRun', tl, 0); P('loopRun', tl + 10.5, 1, x => x);
  cue(tl, 'montage', { d: 10.5 });
  const ids = ['clock', 'search', 'phone', 'email'];
  for (let i = 0; i < 16; i++) { trip(ids[i % 4], tl + i * .62, .38); }
  mood(tl, 'happy');
  cap(tl + .6, tl + 5.4, '这部片子，就是用片子里的这个循环做出来的。', 'This film was made by the very loop it shows.');
  cap(tl + 5.6, tl + 10.6, '你说：别问我。所以我没问——这叫“授权”。', 'You said: don’t ask me. So I didn’t. That’s called delegation.');
  const tk = tl + 11.0;
  cam(tk, [860, 250, 1990, 900], 1.4);
  P('keyGlow', tk + .4, 0); P('keyGlow', tk + 1.0, 1);
  look(tk + .5, [1, .3]);
  cap(tk + .5, tk + 5.8, '但要不要发布——钥匙在你手里。', 'But whether to publish it — that key is yours.');
  const tf = tk + 6.0;
  cam(tf, BX.desk, 1.2);
  const fin = written(M('好了，等你。 ——小德', 'Ready when you are. — Xiao De', { w: 240, zs: 26, es: 28, center: true }), tf + .2, 1.4);
  postOut(fin, tf + 2.0);
  mood(tf + 2.4, 'happy'); hop(tf + 2.8);
  cam(tf + 2.6, BX.house, 3.5);
  P('fade', tf + 5.0, 0); P('fade', tf + 6.0, 1);
  P('endcard', tf + 6.0, 0); P('endcard', tf + 7.2, 1); P('endcard', tf + 13.0, 1); P('endcard', tf + 14.2, 0);
  cue(tf + 6.0, 'end');
  return tf + 14.6;
}

// ---- build ----
(function build() {
  let t = 0;
  const marks = {};
  marks.S0 = t; t = S0(t);
  marks.S1 = t; t = S1(t);
  marks.S2 = t; t = S2(t);
  marks.S3 = t; t = S3(t);
  marks.S4 = t; t = S4(t);
  marks.S5 = t; t = S5(t);
  marks.S6 = t; t = S6(t);
  marks.S7 = t; t = S7(t);
  marks.S8 = t; t = S8(t);
  T = { ...marks, end: t };
  for (const k in PARAMS) PARAMS[k].sort((a, b) => a[0] - b[0]);
  CAMS.sort((a, b) => a.t - b.t); MOODS.sort((a, b) => a[0] - b[0]); LOOKS.sort((a, b) => a[0] - b[0]);
  CUES.sort((a, b) => a.t - b.t); LOOPN.sort((a, b) => a - b);
})();
const DURATION = T.end;
chainCams();

// =====================================================================
//  STATE at time t
// =====================================================================
function stepVal(list, t, def) { let v = def; for (const [tt, m] of list) { if (tt <= t) v = m; else break; } return v; }
function lookVal(t) {
  let prev = [0, 0], cur = [0, 0], tc = -1;
  for (const [tt, v] of LOOKS) { if (tt <= t) { prev = cur; cur = v; tc = tt; } else break; }
  const k = smooth(seg(t, tc, tc + .35));
  return [lerp(prev[0], cur[0], k), lerp(prev[1], cur[1], k)];
}
function mindState(t) {
  let hopv = 0; for (const [ht, s] of HOPS) { const k = seg(t, ht, ht + .45); if (k > 0 && k < 1) hopv += Math.sin(k * Math.PI) * s; }
  let th = 0; for (const [a, b] of THINKS) th = Math.max(th, win(t, a, b, .2, .2));
  let pc = 0; for (const [a, b] of PENCILS) pc = Math.max(pc, win(t, a - .1, b + .15, .15, .2));
  const bl = (t % 3.7) < .13 ? 1 : 0;
  const m = stepVal(MOODS, t, 'smile');
  return {
    x: G.MIND[0], y: G.MIND[1], r: G.MR, a: 1, mood: m, look: lookVal(t), blink: (m === 'happy' || m === 'squint') ? 0 : bl,
    hop: hopv, think: th, pencil: pc, pencilAt: [READ[0] + 60, READ[1] + 10], slump: pv('slump', t), cheeks: m === 'happy' ? 1 : .5,
    sproutKick: hopv,
  };
}
function noteP(o, t) {
  const k = o.keys; if (t < k[0].t || t > k[k.length - 1].t) return null;
  for (let i = 0; i < k.length - 1; i++) {
    if (t <= k[i + 1].t) {
      const a = k[i], b = k[i + 1], e = inOut(seg(t, a.t, b.t));
      const r = {};
      for (const p of ['x', 'y', 's', 'rot', 'fold', 'a', 'reveal']) r[p] = lerp(a[p], b[p], p === 'reveal' ? seg(t, a.t, b.t) : e);
      return r;
    }
  }
  return k[k.length - 1];
}
function capsuleP(o, t) {
  for (const sg of o.segs) if (t >= sg.t0 && t <= sg.t1) {
    const f = (sg.ease || inOut)(seg(t, sg.t0, sg.t1));
    const p = polyAt(sg.pts, f), p2 = polyAt(sg.pts, Math.min(1, f + .01));
    return { x: p[0], y: p[1], ang: Math.atan2(p2[1] - p[1], p2[0] - p[0]), a: 1 };
  }
  return null;
}
function worldState(t) {
  const S = {
    t, lamp: pv('lamp', t, 1), city: pv('city', t), stars: pv('stars', t, 1), books: pv('books', t, 1), piles: pv('piles', t, pv('books', t, 1)),
    tubes: pv('tubes', t), board: pv('board', t), cabinet: pv('cabinet', t), lock: pv('lock', t), counter: pv('counter', t),
    drawer: pv('drawer', t), lockOpen: pv('lockOpen', t), lockShake: pv('lockShake', t),
    ghostWindow: pv('ghostWindow', t), ghostDoor: pv('ghostDoor', t), clockHL: pv('clockHL', t), slotHL: pv('slotHL', t), slotLabel: pv('slotLabel', t),
    loopSpin: pv('loopSpin', t), cake: pv('cake', t), relabel: pv('relabel', t), keyVis: pv('keyVis', t),
    tubeGlow: {}, labels: 1,
  };
  for (const tb of TUBES) S.tubeGlow[tb.id] = pv('glow_' + tb.id, t);
  // loop counter
  let n = 0, last = -9; for (const lt of LOOPN) if (lt <= t) { n++; last = lt; }
  S.loopN = n; S.loopFlip = seg(t, last, last + .25);
  S.loopSpin += n + seg(t, last, last + .5) - 1;
  const run = pv('loopRun', t);
  if (run > 0) { S.loopN = Math.round(lerp(n, FINAL_LOOPS, run)); S.loopFlip = (S.loopN !== n && run < 1) ? .6 : 1; S.loopSpin += run * 30; }
  S.boardItems = BOARD.map(b => ({ zh: b.zh, en: b.en, a: seg(t, b.tA, b.tA + .35), tick: seg(t, b.tTick, b.tTick + .4) }));
  S.mind = mindState(t);
  return S;
}

// =====================================================================
//  DRAW WORLD with a given state
// =====================================================================
function drawAll(ctx, S, opts = {}) {
  drawSky(ctx, S);
  // city + tubes (behind the house)
  if (opts.others) drawOthers(ctx, S, opts.others);
  for (const b of BUILDINGS) drawBuilding(ctx, b, S);
  drawGround(ctx, S);
  drawTubesOutside(ctx, S);
  drawRoomShell(ctx, S);
  drawShelves(ctx, S);
  drawBoard(ctx, S);
  drawClock(ctx, S);
  drawCounter(ctx, S);
  drawNoWindow(ctx, S);
  drawNoDoor(ctx, S);
  drawCabinet(ctx, S);
  drawTubesInside(ctx, S);
  if (S.relabel > 0) drawRelabel(ctx, S);
  drawMind(ctx, S.mind, S.t);
  drawDesk(ctx, S);
  drawLamp(ctx, S);
  drawRoomLight(ctx, S);
  drawSlot(ctx, S);
  // key
  drawTheKey(ctx, S);
  if (opts.noNotes) return;
  // capsules
  for (const o of CAPS) { const p = capsuleP(o, S.t); if (p) drawCapsule(ctx, p.x, p.y, 1, p.ang); }
  // thoughts
  for (const th of THOUGHTS) {
    const a = win(S.t, th.t0, th.t1, .3, .4); if (a <= 0) continue;
    drawThought(ctx, th, a, S.t);
  }
  for (const o of NOTES) { const p = noteP(o, S.t); if (p) drawNote(ctx, o.N, p, S.t); }
}
function drawThought(ctx, th, a, t) {
  const L = noteLayout(ctx, th.N);
  ctx.save(); ctx.globalAlpha *= a;
  const s = outBack(clamp(a * 1.2));
  ctx.translate(th.x, th.y + Math.sin(t * 2 + th.x) * 3); ctx.scale(s, s);
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = C.purple; ctx.lineWidth = 3;
  rr(ctx, -L.w / 2, -L.h / 2, L.w, L.h, L.h / 2); ctx.fill(); ctx.stroke();
  // little trail bubbles toward the mind
  const dx = G.MIND[0] - th.x, dy = G.MIND[1] - 70 - th.y, d = Math.hypot(dx, dy);
  for (let i = 1; i <= 2; i++) { const f = (L.h / 2 + 14 * i) / d; circle(ctx, dx * f, dy * f, 8 - i * 2.5); ctx.fill(); ctx.stroke(); }
  ctx.translate(-L.w / 2, -L.h / 2);
  ctx.textAlign = 'center';
  for (const b of L.blocks) { ctx.font = b.font; ctx.fillStyle = b.color; b.lines.forEach((ln, i) => ctx.fillText(ln, L.w / 2, b.y + b.lh * (i + .78))); }
  ctx.restore();
}
function drawTheKey(ctx, S) {
  const kv = S.keyVis; if (kv <= 0) return;
  const hook = [1845, 560];
  const kf_ = pv('keyFly', S.t);
  const kg = pv('keyGlow', S.t);
  // hook
  ctx.strokeStyle = '#8C8C9C'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hook[0], hook[1] - 40); ctx.lineTo(hook[0], hook[1] - 18); ctx.arc(hook[0] - 7, hook[1] - 18, 7, 0, Math.PI); ctx.stroke();
  ctx.save(); ctx.globalAlpha = kv;
  let x = hook[0], y = hook[1] + 6, rot = Math.PI / 2 + Math.sin(S.t * 1.6) * .08, s = 1;
  if (kf_ > 0 && kf_ < 3.001 && pv('myRoom', S.t) < 1) {
    const tb = TUBE.pay;
    const pts = [[hook[0], hook[1] + 6], [SLOT_OUT, SY], [SLOT_IN, SY], [READ[0] + 110, READ[1] + 40], [READ[0] + 110, READ[1] + 40], [tb.mouth[0] + 30, tb.mouth[1] + 30]];
    let p;
    if (kf_ <= 1) p = polyAt(pts.slice(0, 4), kf_);
    else if (kf_ <= 2) p = pts[3];
    else p = polyAt([pts[4], pts[5]], inOut(kf_ - 2));
    [x, y] = p; rot = kf_ >= 2 ? lerp(0, -Math.PI / 2, kf_ - 2) : 0; s = .9;
    if (kf_ >= 2.999) { ctx.globalAlpha = 1 - clamp((pv('lockOpen', S.t) - .6) * 3); }
  }
  if (kg > 0) glow(ctx, x, y, 120, 'rgba(255,215,120,A)', .5 * kg * (0.7 + 0.3 * Math.sin(S.t * 4)));
  drawKey(ctx, x, y, rot, s);
  if (kg > 0 && pv('myRoom', S.t)) {
    ctx.globalAlpha = kg;
    ctx.fillStyle = '#F4EAD8'; ctx.textAlign = 'center'; ctx.font = `600 20px ${F.zh}`; ctx.fillText('Belinda 的钥匙', x, y - 92);
    ctx.fillStyle = '#F4EAD8'; ctx.font = `500 20px ${F.en}`; ctx.fillText('Belinda’s key', x, y - 68);
  }
  ctx.restore();
}
function drawRelabel(ctx, S) {
  // in "my room" the tubes carry my tools
  const labs = [['读', 'READ'], ['写', 'WRITE'], ['渲染', 'RENDER'], ['看', 'LOOK'], ['发布', 'PUBLISH']];
  TUBES.forEach((tb, i) => {
    const k = clamp(S.relabel * 1.5 - i * .1);
    ctx.save(); ctx.translate(G.IX0 + 46 + 54, tb.y); ctx.scale(1, Math.abs(Math.cos(k * Math.PI)) || .02);
    if (k > .5) {
      ctx.fillStyle = i === 4 ? '#6B1F2A' : '#2F4858'; rr(ctx, -54, -17, 140, 34, 6); ctx.fill();
      ctx.fillStyle = '#F4EAD8'; ctx.textAlign = 'left'; ctx.font = `700 19px ${F.zh}`; ctx.fillText(labs[i][0], -46, 7);
      ctx.fillStyle = '#F4EAD8'; ctx.font = `600 18px ${F.en}`; ctx.fillText(labs[i][1][0] + labs[i][1].slice(1).toLowerCase(), labs[i][0].length > 1 ? 0 : -18, 6);
    }
    ctx.restore();
  });
}
// other rooms for the multi-agent shot
function drawOthers(ctx, S, a) {
  const r = rng(21);
  const spots = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, ring = Math.floor(i / 2);
    spots.push([1310 + side * (1500 + ring * 520 + r() * 200), 860 - (ring % 3) * 0 + (r() - .5) * 60, .55 + r() * .35, r()]);
  }
  _othersSpots = spots;
  spots.forEach(([x, y, s, ph], i) => {
    const k = clamp(a * 16 - i * .9); if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = k; ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-1310, -860);
    const mini = { ...S, city: 0, stars: 0, board: 1, counter: 1, cabinet: 1, tubes: 0, lock: 0, keyVis: 0, loopN: (i * 7) % 60, mind: { ...S.mind, mood: ['happy', 'smile', 'squint', 'o'][i % 4], look: [Math.sin(S.t + i), Math.cos(S.t * .7 + i) * .5], think: (Math.sin(S.t * 1.5 + i) > .6) ? 1 : 0 } };
    drawRoomShell(ctx, mini); drawShelves(ctx, mini); drawBoard(ctx, mini); drawClock(ctx, mini); drawCounter(ctx, mini); drawCabinet(ctx, mini);
    drawMind(ctx, mini.mind, S.t + i); drawDesk(ctx, mini); drawLamp(ctx, mini); drawRoomLight(ctx, mini);
    ctx.restore();
  });
}
let _othersSpots = [];
function drawOtherMessages(ctx, S, a) {
  if (a <= 0 || !_othersSpots.length) return;
  const all = [[1310, 500, 1, 0], ..._othersSpots.map(([x, y, s]) => [x, y - 360 * s, s])];
  const r = rng(99);
  for (let i = 0; i < 40; i++) {
    const A = all[Math.floor(r() * all.length)], B = all[Math.floor(r() * all.length)]; if (A === B) continue;
    const period = 1.6 + r() * 1.8, ph = r() * period;
    const f = ((S.t + ph) % period) / period;
    const k = clamp(a * 16 - i * .3); if (k <= 0) continue;
    const mx = (A[0] + B[0]) / 2, my = Math.min(A[1], B[1]) - 300 - Math.abs(A[0] - B[0]) * .15;
    const p = bez([A[0], A[1]], [lerp(A[0], mx, .6), my], [lerp(B[0], mx, .6), my], [B[0], B[1]], smooth(f));
    ctx.globalAlpha = k * Math.sin(f * Math.PI);
    glow(ctx, p[0], p[1], 70, 'rgba(255,225,150,A)', .5);
    ctx.fillStyle = '#FFF6E0'; ctx.fillRect(p[0] - 14, p[1] - 9, 28, 18);
    ctx.globalAlpha = 1;
  }
}

// =====================================================================
//  CAMERA
// =====================================================================
function viewRect() { return VERT ? { x: 0, y: 70, w: W, h: 1420 } : { x: 0, y: 0, w: W, h: 905 }; }
function fit(box) {
  const v = viewRect();
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const z = Math.min(v.w / bw, v.h / bh);
  return { cx: (box[0] + box[2]) / 2, cy: (box[1] + box[3]) / 2, z };
}
function vboxFor(k) {
  if (!VERT) return k.box;
  if (k.vbox) return k.vbox;
  const b = k.box, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, bw = b[2] - b[0], bh = b[3] - b[1];
  if (b === BX.far) return b;
  if (bw > 1300) return [700, cy - 420, 1820, cy + 420];     // wide: room + nearest tool buildings
  if (bw > 700) {                                                                   // room shots: crop to the action
    const w = 580, c = clamp(cx, G.RX0 + 290 + 90, G.RX1 + 40 - 290);
    return [c - w / 2, cy - bh / 2, c + w / 2, cy + bh / 2];
  }
  return b;
}
// each key moves from wherever the camera actually was when the key starts
function camEval(i, t) {
  const k = CAMS[i], B = fit(vboxFor(k));
  const A = i === 0 ? B : k._from;
  const e = inOut(k.d ? seg(t, k.t, k.t + k.d) : 1);
  return { cx: lerp(A.cx, B.cx, e), cy: lerp(A.cy, B.cy, e), z: Math.exp(lerp(Math.log(A.z), Math.log(B.z), e)) };
}
function chainCams() { for (let i = 1; i < CAMS.length; i++) CAMS[i]._from = camEval(i - 1, CAMS[i].t); }
function camAt(t) {
  let i = 0; for (let j = 0; j < CAMS.length; j++) if (CAMS[j].t <= t) i = j;
  const c = camEval(i, t);
  return { cx: c.cx + Math.sin(t * .31) * 3 / c.z, cy: c.cy + Math.sin(t * .23 + 1) * 2 / c.z, z: c.z };
}

function applyCam(ctx, c, vr = viewRect()) {
  ctx.translate(vr.x + vr.w / 2, vr.y + vr.h / 2); ctx.scale(c.z, c.z); ctx.translate(-c.cx, -c.cy);
}

// =====================================================================
//  OVERLAYS: captions, title, 37%, end card
// =====================================================================
function drawCaptions(ctx, t) {
  for (const c of CAPTIONS) {
    const a = win(t, c.t0, c.t1, .35, .35); if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = a;
    const zs = VERT ? (c.big ? 60 : 46) : (c.big ? 54 : 42), es = zs;
    const maxW = VERT ? 990 : 1640;
    ctx.font = `${c.big ? 700 : 500} ${zs}px ${F.zh}`; const zl = wrapBalanced(ctx, c.zh, maxW);
    ctx.font = `${c.big ? 600 : 500} ${es}px ${F.en}`; const el = wrapBalanced(ctx, c.en, maxW);
    const blockH = zl.length * zs * 1.3 + 12 + el.length * es * 1.3;
    const baseY = VERT ? 1500 + Math.max(0, (330 - blockH) / 2) : (H - 32 - blockH);
    // soft backing
    const g = ctx.createLinearGradient(0, baseY - 60, 0, baseY + blockH + 40);
    g.addColorStop(0, 'rgba(12,8,22,0)'); g.addColorStop(.35, 'rgba(12,8,22,.55)'); g.addColorStop(1, 'rgba(12,8,22,.7)');
    ctx.fillStyle = g; ctx.fillRect(0, baseY - 60, W, blockH + 120);
    ctx.textAlign = 'center';
    const rise = (1 - out3(seg(t, c.t0, c.t0 + .5))) * 10;
    let y = baseY + rise;
    ctx.font = `${c.big ? 700 : 500} ${zs}px ${F.zh}`; ctx.fillStyle = '#FAF4EA';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12;
    for (const l of zl) { y += zs * 1.1; ctx.fillText(l, W / 2, y); y += zs * .2; }
    y += 12;
    ctx.font = `${c.big ? 600 : 500} ${es}px ${F.en}`; ctx.fillStyle = '#FAF4EA';
    for (const l of el) { y += es * 1.1; ctx.fillText(l, W / 2, y); y += es * .2; }
    ctx.restore();
  }
}
function drawTitle(ctx, t) {
  const a = pv('title', t); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = '#0E0B1E'; ctx.fillRect(0, 0, W, H);
  // a tiny slot of light, the whole film in one image
  const cy = H / 2 - (VERT ? 60 : 30);
  glow(ctx, W / 2, cy - 150, 260, 'rgba(255,214,140,A)', .12 * a);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FAF4EA'; ctx.font = `700 ${VERT ? 96 : 104}px ${F.zh}`; ctx.fillText('什么是 AI Agent？', W / 2, cy);
  ctx.fillStyle = '#FAF4EA'; ctx.font = `600 ${VERT ? 84 : 96}px ${F.en}`; ctx.fillText('What Is an AI Agent?', W / 2, cy + 112);
  // the slot
  const sw = 150 * clamp(a * 1.2);
  ctx.fillStyle = C.brass; rr(ctx, W / 2 - sw / 2 - 14, cy - 250, sw + 28, 40, 8); ctx.fill();
  ctx.fillStyle = '#120D1C'; ctx.fillRect(W / 2 - sw / 2, cy - 236, sw, 12);
  glow(ctx, W / 2, cy - 230, 120, 'rgba(255,220,150,A)', .35 * a);
  ctx.fillStyle = '#B7A6D6'; ctx.font = `400 ${VERT ? 30 : 28}px ${F.zh}`;
  ctx.fillText('一部关于纸条、管道和一个循环的小电影', W / 2, cy + 200);
  ctx.font = `400 ${VERT ? 30 : 28}px ${F.en}`; ctx.fillText('a small film about notes, tubes, and a loop', W / 2, cy + 246);
  ctx.fillStyle = '#B7A6D6'; ctx.font = `400 ${VERT ? 26 : 24}px ${F.zh}`; ctx.fillText('小德 · 为 Belinda 而作', W / 2, cy + 320);
  ctx.font = `400 ${VERT ? 26 : 24}px ${F.en}`; ctx.fillText('by Xiao De, for Belinda', W / 2, cy + 356);
  ctx.restore();
}
function draw37(ctx, t) {
  const a = pv('p37', t); if (a <= 0) return;
  const k = pv('p37k', t);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(14,11,30,.86)'; ctx.fillRect(0, 0, W, H);
  const gw = VERT ? 700 : 560, cell = gw / 10;
  const gx = W / 2 - gw / 2, gy = VERT ? 330 : 150;
  const n = Math.floor(k * 100);
  for (let i = 0; i < 100; i++) {
    const x = gx + (i % 10) * cell + cell / 2, y = gy + Math.floor(i / 10) * cell + cell / 2;
    const on = i < n;
    if (on) glow(ctx, x, y, cell * .9, 'rgba(255,214,140,A)', .35);
    ctx.fillStyle = on ? '#FFD98C' : 'rgba(210,195,238,.18)';
    circle(ctx, x, y, cell * .26); ctx.fill();
  }
  const steps = Math.max(0, Math.min(100, Math.round(k * 100)));
  const pct = Math.pow(0.99, steps) * 100;
  const by = gy + gw + (VERT ? 80 : 50), bw = gw;
  ctx.fillStyle = 'rgba(210,195,238,.2)'; rr(ctx, gx, by, bw, 26, 13); ctx.fill();
  ctx.fillStyle = pct > 60 ? '#8FD1A0' : pct > 45 ? '#FFD98C' : '#F08A76'; rr(ctx, gx, by, bw * pct / 100, 26, 13); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = '#FAF4EA';
  ctx.font = `700 ${VERT ? 64 : 56}px ${F.mono}`; ctx.fillText(pct.toFixed(0) + '%', gx + bw + 24 - (VERT ? bw + 24 - bw + 150 : 0), by + 24);
  ctx.textAlign = 'center';
  ctx.font = `500 ${VERT ? 36 : 32}px ${F.zh}`; ctx.fillStyle = '#FAF4EA';
  const l1 = steps < 100 ? `每一步 99% 正确……第 ${steps} 步` : '一百步之后，全部做对的机会：37%';
  const l1e = steps < 100 ? `Each step is 99% right… step ${steps}` : 'After 100 steps, the chance of getting all of them right: 37%';
  ctx.fillText(l1, W / 2, by + (VERT ? 150 : 100));
  ctx.font = `500 ${VERT ? 36 : 32}px ${F.en}`; ctx.fillStyle = '#FAF4EA'; ctx.fillText(l1e, W / 2, by + (VERT ? 200 : 146));
  ctx.restore();
}
function drawEnd(ctx, t) {
  const a = pv('endcard', t); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#0E0B1E'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; const cy = H / 2 - 110;
  ctx.fillStyle = '#FAF4EA'; ctx.font = `700 ${VERT ? 72 : 70}px ${F.zh}`; ctx.fillText('LLM 会回答。Agent 会行动。', W / 2, cy);
  ctx.fillStyle = '#FAF4EA'; ctx.font = `600 ${VERT ? 60 : 66}px ${F.en}`; ctx.fillText('An LLM answers. An agent acts.', W / 2, cy + 84);
  ctx.fillStyle = '#B7A6D6'; ctx.font = `400 ${VERT ? 28 : 26}px ${F.zh}`;
  ctx.fillText('取材自 Belinda 的 Learning Wiki', W / 2, cy + 200);
  ctx.font = `400 ${VERT ? 28 : 26}px ${F.en}`; ctx.fillText('drawn from Belinda’s Learning Wiki', W / 2, cy + 238);
  ctx.font = `400 ${VERT ? 28 : 26}px ${F.zh}`; ctx.fillText('画面与音乐：代码逐帧生成 · 小德', W / 2, cy + 304);
  ctx.font = `400 ${VERT ? 28 : 26}px ${F.en}`; ctx.fillText('picture & music made in code, frame by frame · Xiao De', W / 2, cy + 342);
  ctx.restore();
}
function drawLogPaper(ctx, t) {
  const k = pv('logK', t); if (k <= 0) return;
  const lines = LOG.concat([['∞', 'LOOP', `${FINAL_LOOPS} 次工具调用 · tool calls`]]);
  const n = k * lines.length;
  const x = VERT ? 60 : 70, w = VERT ? 960 : 700, y0 = VERT ? 90 : 56, lh = VERT ? 52 : 40;
  const shown = Math.min(lines.length, Math.ceil(n));
  const h = 40 + shown * lh + 20;
  ctx.save();
  ctx.globalAlpha = clamp(k * 8) * (1 - seg(t, T.S8 + 17.8, T.S8 + 18.6));
  ctx.fillStyle = 'rgba(20,10,30,.35)'; rr(ctx, x + 6, y0 + 8, w, h, 6); ctx.fill();
  ctx.fillStyle = '#FFFDF6'; rr(ctx, x, y0, w, h, 6); ctx.fill();
  ctx.fillStyle = C.purple; ctx.font = `700 ${VERT ? 22 : 18}px ${F.mono}`; ctx.textAlign = 'left';
  ctx.fillText('~/film/what-is-an-agent — 小德的循环 · my loop', x + 20, y0 + 30);
  for (let i = 0; i < shown; i++) {
    const [zh, en, what] = lines[i];
    const a = clamp(n - i);
    const y = y0 + 40 + (i + 1) * lh - 12;
    ctx.globalAlpha = clamp(k * 8) * a * (1 - seg(t, T.S8 + 17.8, T.S8 + 18.6));
    ctx.fillStyle = C.brassLo; ctx.font = `700 ${VERT ? 26 : 22}px ${F.zh}`; ctx.fillText(zh, x + 20, y);
    ctx.fillStyle = '#3F5D8A'; ctx.font = `700 ${VERT ? 22 : 19}px ${F.mono}`; ctx.fillText(en.padEnd(7), x + 70, y);
    ctx.fillStyle = C.ink; ctx.font = `400 ${VERT ? 24 : 20}px ${F.mono}`; ctx.fillText(what, x + (VERT ? 190 : 170), y);
  }
  ctx.restore();
}

// =====================================================================
//  SPLIT SCREEN (S6)
// =====================================================================
function drawSplit(ctx, t, amt) {
  const S = worldState(t);
  const t0 = pv('splitT0', t), lt = t - t0;
  const focus = pv('splitFocus', t);
  const halves = VERT
    ? [{ x: 0, y: 70, w: W, h: 700 }, { x: 0, y: 790, w: W, h: 700 }]
    : [{ x: 0, y: 0, w: W / 2 - 4, h: 905 }, { x: W / 2 + 4, y: 0, w: W / 2 - 4, h: 905 }];
  // BEFORE: bare room, note in / note out
  const old = { ...S, tubes: 0, board: 0, cabinet: 0, lock: 0, counter: 0, city: 0, keyVis: 0, relabel: 0, piles: 1, cake: 0, tubeGlow: {}, mind: { ...S.mind, mood: 'smile', think: 0, pencil: 0, hop: 0 } };
  const NEW = { ...S, tubes: 1, board: 1, cabinet: 1, lock: 1, lockOpen: 1, counter: 1, city: 1, keyVis: 0, cake: 1, loopN: 10 + Math.floor(lt / .8), loopFlip: (lt % .8) / .8 * 3, loopSpin: lt * 1.2, tubeGlow: {}, mind: { ...S.mind, mood: 'happy', think: 0, pencil: 0, hop: 0 } };
  const ids = ['clock', 'search', 'phone', 'email', 'pay'];
  const per = 1.6;
  const ci = Math.floor(lt / per) % 5, cf = (lt % per) / per;
  NEW.tubeGlow[ids[ci]] = Math.sin(cf * Math.PI);
  ctx.save(); ctx.globalAlpha = amt;
  ctx.fillStyle = '#0E0B1E'; ctx.fillRect(0, 0, W, H);
  [[old, halves[0], [880, 250, 1960, 890], -1, 'LLM', '回答 · answers'], [NEW, halves[1], [-40, 200, 1990, 900], 1, 'Agent', '行动 · acts']].forEach(([St, vr, box, side, big, small]) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(vr.x, vr.y, vr.w, vr.h); ctx.clip();
    const bw = box[2] - box[0], bh = box[3] - box[1], z = Math.min(vr.w / bw, vr.h / bh);
    ctx.translate(vr.x + vr.w / 2, vr.y + vr.h / 2 + (VERT ? 20 : 40)); ctx.scale(z, z); ctx.translate(-(box[0] + box[2]) / 2, -(box[1] + box[3]) / 2);
    drawAll(ctx, St, { noNotes: true });
    if (side < 0) {
      // note ping-pong
      const pp = (lt % 3) / 3;
      const inN = { zh: '问题？', en: 'Question?', kind: 'human', w: 150, key: 'pp-in', noHeart: 1 }, outN = { zh: '答案。', en: 'Answer.', kind: 'mind', w: 150, key: 'pp-out' };
      if (pp < .5) { const f = inOut(pp * 2); drawNote(ctx, inN, { x: lerp(2000, READ[0], f), y: lerp(SY, READ[1], f), s: 1, rot: 0, fold: f > .35 && f < .6 ? 1 : 0, a: 1 }, t); }
      else { const f = inOut((pp - .5) * 2); drawNote(ctx, outN, { x: lerp(READ[0], 2000, f), y: lerp(READ[1], SY, f), s: 1, rot: 0, fold: f > .4 && f < .65 ? 1 : 0, a: 1 }, t); }
    } else {
      for (let j = 0; j < 3; j++) {
        const q = (lt + j * per / 3 * 5) % (per * 5), id = ids[Math.floor(q / per)], f = (q % per) / per;
        const tb = TUBE[id], pts = [DESKP, [tb.mouth[0] + 30, tb.mouth[1]], [G.RX0, tb.y], ...tb.outPath.slice(1)];
        const p = polyAt(pts, f < .5 ? inOut(f * 2) : inOut((1 - f) * 2));
        drawCapsule(ctx, p[0], p[1], 1, 0);
      }
    }
    ctx.restore();
    // dim the unfocused side
    const dim = focus === 0 ? 0 : (Math.sign(focus) !== side ? Math.abs(focus) * .6 : 0);
    if (dim > 0) { ctx.fillStyle = `rgba(14,11,30,${dim})`; ctx.fillRect(vr.x, vr.y, vr.w, vr.h); }
    // headline label
    ctx.save(); ctx.textAlign = 'center';
    ctx.globalAlpha = amt * (1 - dim * .7);
    ctx.fillStyle = '#FAF4EA'; ctx.font = `700 ${VERT ? 64 : 64}px ${F.en}`; ctx.fillText(big, vr.x + vr.w / 2, vr.y + (VERT ? 80 : 90));
    ctx.fillStyle = '#FAF4EA'; ctx.font = `500 ${VERT ? 30 : 30}px ${F.zh}`; ctx.fillText(small, vr.x + vr.w / 2, vr.y + (VERT ? 124 : 134));
    ctx.restore();
  });
  // divider
  ctx.fillStyle = 'rgba(244,234,216,.25)';
  if (VERT) ctx.fillRect(60, 780, W - 120, 2); else ctx.fillRect(W / 2 - 1, 60, 2, 800);
  ctx.restore();
}

// =====================================================================
//  RENDER
// =====================================================================
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0E0B1E'; ctx.fillRect(0, 0, W, H);
  const split = pv('split', t);
  if (split < 1) {
    const S = worldState(t);
    const c = camAt(t);
    ctx.save(); applyCam(ctx, c);
    const others = pv('others', t);
    drawAll(ctx, S, { others: others > 0 ? others : 0 });
    if (others > 0) drawOtherMessages(ctx, S, others);
    ctx.restore();
  }
  if (split > 0) drawSplit(ctx, t, split);
  drawLogPaper(ctx, t);
  draw37(ctx, t);
  const f = pv('fade', t);
  if (f > 0) { ctx.fillStyle = `rgba(8,5,16,${f})`; ctx.fillRect(0, 0, W, H); }
  drawTitle(ctx, t);
  drawEnd(ctx, t);
  drawCaptions(ctx, t);
}

// preload every glyph we will draw, so web-font subsets are in memory before frame 1
async function init() {
  const txt = new Set();
  const add = s => { if (s) for (const ch of String(s)) txt.add(ch); };
  CAPTIONS.forEach(c => { add(c.zh); add(c.en); });
  NOTES.forEach(o => { add(o.N.zh); add(o.N.en); add(o.N.tag); (o.N.rows || []).forEach(r => { add(r.zh); add(r.en); }); });
  THOUGHTS.forEach(o => { add(o.N.zh); add(o.N.en); });
  LOG.forEach(l => l.forEach(add));
  BOARD.forEach(b => { add(b.zh); add(b.en); });
  TUBES.forEach(tb => { add(tb.zh); add(tb.en); }); BUILDINGS.forEach(b => { add(b.zh); add(b.en); });
  add('什么是 AI Agent？What Is an AI Agent?一部关于纸条、管道和一个循环的小电影 a small film about notes, tubes, and a loop 小德 · 为 Belinda 而作 by Xiao De, for Belinda');
  add('LLM 会回答。Agent 会行动。An LLM answers. An agent acts. 取材自 Belinda 的 Learning Wiki drawn from Belinda’s Learning Wiki 画面与音乐：代码逐帧生成 · 小德 picture & music made in code, frame by frame · Xiao De');
  add('每一步 99% 正确……第 步 一百步之后，全部做对的机会：37% Each step is 99% right… step After 100 steps, the chance of getting all of them right: 0123456789%');
  add('Context Memory Loop Clock Search Phone Email Pay Read Write Render Look Publish 眼前 CONTEXT 记忆 MEMORY LOOP · 循环 投信口 the slot ? 应该是 3！ / should be 3! 读写渲染看发布 READ WRITE RENDER LOOK PUBLISH Belinda 的钥匙 Belinda’s key 回答 · answers 行动 · acts 问题？答案。Question? Answer. ~/film/what-is-an-agent — 小德的循环 · my loop 次工具调用 · tool calls ∞');
  const s = [...txt].join('');
  const fams = [[F.zh, '500'], [F.zh, '700'], [F.en, '400'], [F.en, '500'], [F.en, 'italic 400'], [F.en, '600'], [F.en, '700'], [F.hand, '500'], [F.hand, '700'], [F.kai, '400'], [F.kai, '700'], [F.mono, '400'], [F.mono, '700']];
  await Promise.all(fams.map(([f, w]) => document.fonts.load(`${w} 40px ${f}`, s).catch(() => {})));
  await document.fonts.ready;
  render(0);
}
window.FILM = {
  W, H, FPS, DURATION, T, CUES, PARAMS, LOOPN, init, render,
  frame: (i, q = .92) => { render(i / FPS); return canvas.toDataURL('image/jpeg', q); },
  png: (t) => { render(t); return canvas.toDataURL('image/png'); },
  setLoops: n => { FINAL_LOOPS = n; },
};

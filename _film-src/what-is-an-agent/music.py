"""Score + sound effects for "What Is an AI Agent?" — synthesized from scratch.
Reads cues.json (exported from the animation) so every sound lands on its frame.
Motifs: Belinda = F, Lao Jia = A, Xiao De = C, Xiao Miu = E  (from the previous film)."""
import json, sys, numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
D = json.load(open('cues.json'))
T, DUR = D['T'], D['D']
N = int((DUR + 3) * SR)
music = np.zeros((2, N)); sfx = np.zeros((2, N))
rs = np.random.RandomState(7)

def hz(n):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    b = names[n[0]]; i = 1
    if n[i:i+1] == 'b': b -= 1; i += 1
    elif n[i:i+1] == '#': b += 1; i += 1
    return 440 * 2 ** ((b + 12 * (int(n[i:]) + 1) - 69) / 12)

def put(buf, t, sig, pan=0.0, g=1.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[:N - i] * g
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i+len(sig)] += sig * l * 1.41; buf[1, i:i+len(sig)] += sig * r * 1.41

def env(n, a=0.005, rel=0.05):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(rel * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e

def tt(d): return np.arange(int(d * SR)) / SR

# ---------------- instruments ----------------
def piano(f, d=1.6, v=1.0):
    t = tt(d + 0.8); s = np.zeros_like(t)
    for k, a in enumerate([1, .55, .3, .18, .1, .06], 1):
        fk = f * k * (1 + 0.0004 * k * k)
        s += a * np.sin(2 * np.pi * fk * t) * np.exp(-t * (1.1 + 0.9 * k) * (f / 400) ** 0.3)
    s *= env(len(t), .003, .3)
    return s * v * 0.22

def musicbox(f, d=1.4, v=1.0):
    t = tt(d + 1.0)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + .35 * np.sin(2 * np.pi * f * 4.02 * t) * np.exp(-t * 7) + .12 * np.sin(2 * np.pi * f * 6.9 * t) * np.exp(-t * 12)
    return s * env(len(t), .002, .2) * v * 0.16

def marimba(f, d=.6, v=1.0):
    t = tt(d + .3)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 5) + .25 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 18)
    return s * env(len(t), .002, .1) * v * 0.2

def pizz(f, d=.5, v=1.0):
    t = tt(d + .2); s = np.zeros_like(t)
    for k, a in enumerate([1, .5, .33, .2, .12], 1): s += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (6 + 3 * k))
    return s * env(len(t), .003, .08) * v * 0.16

def bass(f, d=1.0, v=1.0):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3)
    return s * env(len(t), .01, .15) * np.exp(-t * .8) * v * 0.26

def pad(fs, d, v=1.0, a=1.0, r=1.2, bright=1.0):
    t = tt(d); s = np.zeros_like(t)
    for f in fs:
        for det in (-0.25, 0.25):
            ff = f * 2 ** (det / 100 * 6)
            for k, amp in enumerate([1, .4 * bright, .18 * bright, .08 * bright], 1):
                s += amp * np.sin(2 * np.pi * ff * k * t + rs.rand() * 6)
    e = np.minimum(1, t / a) * np.minimum(1, (d - t) / r).clip(0)
    return s * e * v * 0.035 / max(1, len(fs) ** .5)

def bell(f, d=2.5, v=1.0):
    t = tt(d); s = np.zeros_like(t)
    for ratio, a, dec in [(1, 1, 1.2), (2.76, .5, 2.5), (5.4, .25, 4), (8.93, .12, 6)]:
        s += a * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return s * env(len(t), .002, .3) * v * 0.12

def noise(d): return rs.randn(int(d * SR))
def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype='band', fs=SR, output='sos'); return sosfilt(sos, x)
def lp(x, fc):
    sos = butter(2, fc, btype='low', fs=SR, output='sos'); return sosfilt(sos, x)
def hp(x, fc):
    sos = butter(2, fc, btype='high', fs=SR, output='sos'); return sosfilt(sos, x)

CH = {  # chord tones
    'F': ['F3', 'A3', 'C4'], 'Dm': ['D3', 'F3', 'A3'], 'Bb': ['Bb2', 'D3', 'F3'], 'C': ['C3', 'E3', 'G3'], 'Am': ['A2', 'C3', 'E3'],
    'Gm': ['G2', 'Bb2', 'D3'], 'C/E': ['E3', 'G3', 'C4'], 'Bbsus2': ['Bb2', 'C3', 'F3'], 'Fmaj7': ['F3', 'A3', 'C4', 'E4'],
}
ROOT = {'F': 'F2', 'Dm': 'D2', 'Bb': 'Bb1', 'C': 'C2', 'Am': 'A1', 'Gm': 'G1', 'C/E': 'E2', 'Bbsus2': 'Bb1', 'Fmaj7': 'F2'}

# melody as bars of 3 beats; '.' holds
THEME = [
    ('F', 'C5 . A4'), ('F', 'F4 G4 A4'), ('Bb', 'Bb4 . A4'), ('C', 'G4 . .'),
    ('Dm', 'A4 . F4'), ('Bb', 'D4 E4 F4'), ('C', 'G4 . E4'), ('C', 'C4 . .'),
    ('F', 'C5 . A4'), ('F', 'F4 G4 A4'), ('Bb', 'D5 . C5'), ('F', 'A4 . .'),
    ('Bb', 'Bb4 A4 G4'), ('F', 'A4 . F4'), ('C', 'G4 . E4'), ('F', 'F4 . .'),
]
def melody(buf, t0, bars, beat, inst, v=1.0, pan=0.0, t_end=1e9, octave=0):
    t = t0
    for ch, line in bars:
        toks = line.split()
        for i, n in enumerate(toks):
            if n in ('.', 'r'): continue
            j = i + 1
            while j < len(toks) and toks[j] == '.': j += 1
            if t + i * beat < t_end:
                put(buf, t + i * beat, inst(hz(n) * 2 ** octave, (j - i) * beat, v), pan)
        t += len(toks) * beat
    return t

def waltz_acc(buf, t0, bars, beat, v=1.0, t_end=1e9):
    t = t0
    for ch, _ in bars:
        if t >= t_end: break
        put(buf, t, bass(hz(ROOT[ch]), beat * 1.8, v), -.1)
        for b in (1, 2):
            if t + b * beat < t_end:
                for n in CH[ch]: put(buf, t + b * beat, piano(hz(n) * 2, beat * .8, v * .45), .15)
        t += 3 * beat
    return t

def pad_prog(buf, t0, chords, bar, v=1.0, t_end=1e9, bright=1.0):
    t = t0
    for ch in chords:
        if t >= t_end: break
        d = min(bar + .6, t_end - t + .6)
        put(buf, t, pad([hz(n) for n in CH[ch]], d, v, a=.5, r=.6, bright=bright))
        t += bar
    return t

# =====================================================================
#  SCORE
# =====================================================================
S0, S1, S2, S3, S4, S5, S6, S7, S8, END = (T[k] for k in ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'end'])
def pkeys(name): return D['P'].get(name) or []

# S0 cold open: a low, curious drone
put(music, 0.8, pad([hz('F2'), hz('C3')], 12.6, .9, a=3, r=2.5, bright=.5))
for i, n in enumerate(['C5', 'r', 'A4', 'r', 'F4']):
    if n != 'r': put(music, 1.2 + i * 1.0, musicbox(hz(n), 1, .5), .3)

# S1 title: the theme's first phrase on music box (Xiao De = C starts it)
beat = 60 / 84
melody(music, S1 + .3, THEME[:4], beat, musicbox, .9, .1)
put(music, S1 + .3, pad([hz(n) for n in CH['F']], 5.8, .7, a=1.5, r=2))

# S2 room: the waltz
t2 = S2 + 1.4
bars = THEME + THEME[:4]
end_waltz = S3 + 7.8                       # the silence
melody(music, t2, bars, beat, musicbox, .9, .15, t_end=end_waltz)
waltz_acc(music, t2, bars, beat, .8, t_end=end_waltz)
# the melody continues in S3 at the same tempo
t3 = t2 + len(bars) * 3 * beat
if t3 < end_waltz:
    melody(music, t3, THEME[4:8], beat, pizz, 1.0, -.2, t_end=end_waltz)
    waltz_acc(music, t3, THEME[4:8], beat, .7, t_end=end_waltz)

# S3 realization: low minor pad under the thought bubbles
put(music, S3 + 14.0, pad([hz('D3'), hz('F3'), hz('A3')], 16, .8, a=3, r=3, bright=.6))
for i, n in enumerate(['A4', 'r', 'F4', 'r', 'D4', 'r', 'E4', 'r', 'D4']):
    if n != 'r': put(music, S3 + 15 + i * .9, piano(hz(n), 1.4, .6), -.2)

put(music, S4 - 1.5, pad([hz(n) for n in CH['F']], 6, .7, a=3, r=1.5, bright=.6))
# S4 building: marimba ostinato at 112 bpm, layers join as each piece is installed
b4 = 60 / 112
t4 = S4 + 3.4
prog4 = ['F', 'C/E', 'Dm', 'Bb']
layer_t = {k: (pkeys(k)[0][0] if pkeys(k) else 1e9) for k in ['tubes', 'board', 'cabinet', 'lock', 'counter']}
t = t4; bi = 0
while t < S5 - .3:
    ch = prog4[(bi // 2) % 4]
    tones = [hz(n) * 2 for n in CH[ch]]
    arp = [tones[0], tones[1], tones[2], tones[1]] * 2
    vol = min(1, (t - t4) / 4 + .3)
    for k in range(8):
        tk = t + k * b4 / 2
        if tk < S5 - .3: put(music, tk, marimba(arp[k], .3, .7 * vol), .25 if k % 2 else -.25)
    if t >= layer_t['tubes']: put(music, t, bass(hz(ROOT[ch]), b4 * 3.6, .9), 0)
    if t >= layer_t['board']:
        for k in (1, 3): put(music, t + k * b4, pizz(tones[2] * 2, .3, .7), .4)
    if t >= layer_t['cabinet'] and bi % 2 == 0: put(music, t, musicbox(tones[2] * 2, b4 * 3, .6), -.3)
    if t >= layer_t['lock'] and bi % 2 == 0: put(music, t, pad([f / 2 for f in tones], b4 * 8 + .5, .7, a=.4, r=.5))
    if t >= layer_t['counter']:
        for k in range(8):
            h = hp(noise(.04), 6000) * np.exp(-np.arange(int(.04 * SR)) / SR * 90)
            put(music, t + k * b4 / 2, h * .05 * (1.4 if k % 2 == 0 else .7), .3)
    t += 4 * b4; bi += 1

# S5 the loop: a two-bar ostinato; each finished loop adds an instrument
b5 = 60 / 100
loopn = D['LOOPN']
waitk = pkeys('wait'); wait0, wait1 = (waitk[1][0], waitk[2][0]) if len(waitk) >= 3 else (1e9, 1e9)
p37 = pkeys('p37'); m0, m1 = (p37[0][0], p37[-1][0]) if p37 else (1e9, 1e9)
err0 = next((c['t'] for c in D['CUES'] if c['type'] == 'uhoh'), 1e9)
cake0 = pkeys('cake')[0][0] if pkeys('cake') else 1e9
t = S5 + .4; bi = 0
while t < S6 - .2:
    n_done = sum(1 for x in loopn if x <= t)
    minor = err0 - .3 <= t < m1 + .2
    waiting = wait0 - .2 <= t < wait1 + 1.2
    ch = (['Dm', 'Bb', 'Gm', 'Am'] if minor else ['F', 'Dm', 'Bb', 'C'])[bi % 4]
    tones = [hz(n) * 2 for n in CH[ch]]
    if waiting:
        if bi % 2 == 0 or t < wait0 + .2:
            put(music, t, pad([hz(n) for n in CH['Bbsus2']], b5 * 8 + .6, .9, a=.6, r=.6))
        for k in range(4): put(music, t + k * b5, musicbox(hz('C6'), .3, .35), .5)   # a waiting "tick" on C (Xiao De)
        t += 4 * b5; bi += 1; continue
    if m0 <= t < m1:        # during the 37% insert: sparse and quiet
        put(music, t, piano(tones[0], b5 * 4, .5), -.1); put(music, t + 2 * b5, piano(tones[2], b5 * 2, .4), .1)
        put(music, t, pad([f / 2 for f in tones], b5 * 4 + .5, .5, a=.4, r=.5, bright=.5))
        t += 4 * b5; bi += 1; continue
    celebrate = t >= cake0 - 5
    arp = [tones[0], tones[2], tones[1], tones[2]] * 2
    for k in range(8): put(music, t + k * b5 / 2, marimba(arp[k], .3, .7), .2 if k % 2 else -.2)
    if n_done >= 1: put(music, t, bass(hz(ROOT[ch]), b5 * 3.6, .9))
    if n_done >= 2: put(music, t, pad([f / 2 for f in tones], b5 * 4 + .4, .6, a=.3, r=.4))
    if n_done >= 3:
        for k in (1, 3): put(music, t + k * b5, pizz(tones[1] * 2, .3, .6), .45)
    if n_done >= 4:
        for k in range(8):
            h = hp(noise(.035), 6000) * np.exp(-np.arange(int(.035 * SR)) / SR * 100)
            put(music, t + k * b5 / 2, h * .045 * (1.3 if k % 2 == 0 else .6), -.3)
    if n_done >= 5 and not minor:
        put(music, t, musicbox(tones[2] * 2, b5 * 2, .55), -.35); put(music, t + 2 * b5, musicbox(tones[1] * 2, b5 * 2, .5), -.35)
    if celebrate:
        for n in CH[ch]: put(music, t, piano(hz(n) * 2, b5 * 3, .5), .1)
    t += 4 * b5; bi += 1
# the "yes" resolution swell
put(music, wait1 + .2, pad([hz(n) for n in CH['F']] + [hz('F4')], 3.5, 1.4, a=.2, r=2))

# S6 the click: theme on piano, slow and warm
b6 = 60 / 72
melody(music, S6 + 1.2, THEME[:4] + THEME[12:16], b6, piano, .9, 0)
pad_prog(music, S6 + 1.2, [c for c, _ in THEME[:4] + THEME[12:16]], 3 * b6, .8, t_end=S7 - .3)
for i, (c, _) in enumerate(THEME[:4] + THEME[12:16]): put(music, S6 + 1.2 + i * 3 * b6, bass(hz(ROOT[c]), 3 * b6, .7))

# S7 many rooms: arpeggio voices multiply across the stereo field
b7 = 60 / 120
prog7 = ['F', 'Am', 'Bb', 'C', 'F', 'Am', 'Bb', 'C']
for v in range(6):
    tv = S7 + .8 + v * 1.4
    r2 = np.random.RandomState(v)
    pan = r2.uniform(-.9, .9); octv = [1, 2, 1, 2, 2, 1][v]
    t = tv
    while t < S8 - .6:
        ch = prog7[int((t - S7) / (4 * b7)) % 8]
        tones = [hz(n) * 2 ** octv for n in CH[ch]]
        k = int((t - tv) / (b7 / 2))
        put(music, t, musicbox(tones[(k + v) % 3], .4, .35), pan)
        t += b7 / 2 * (1 + (v % 2))
for i, ch in enumerate(prog7):
    put(music, S7 + i * 4 * b7, pad([hz(n) for n in CH[ch]], 4 * b7 + .5, .8, a=.4, r=.5))

# S8 surprise
tl = pkeys('logK')[0][0] if pkeys('logK') else S8 + 7.4
put(music, S8 + .5, pad([hz(n) for n in CH['F']], tl - S8, .6, a=2, r=1))
b8 = 60 / 132
t = tl; bi = 0
while t < tl + 10.5:
    ch = ['F', 'C/E', 'Dm', 'Bb'][(bi // 2) % 4]
    tones = [hz(n) * 2 for n in CH[ch]]
    arp = [tones[0], tones[1], tones[2], tones[1] * 2] * 2
    for k in range(8): put(music, t + k * b8 / 2, marimba(arp[k], .25, .7), .2 if k % 2 else -.2)
    put(music, t, bass(hz(ROOT[ch]), b8 * 3.6, .9))
    for k in range(8):
        h = hp(noise(.03), 6500) * np.exp(-np.arange(int(.03 * SR)) / SR * 110)
        put(music, t + k * b8 / 2, h * .05, .3)
    t += 4 * b8; bi += 1
tk = pkeys('keyGlow')[0][0] if pkeys('keyGlow') else tl + 11
put(music, tk - .4, pad([hz(n) for n in CH['Bbsus2']], 6.4, .8, a=1, r=1.2))
tf = tk + 6.0 - .4
melody(music, tf, THEME[12:16], beat, musicbox, .9, .1)
put(music, tf, pad([hz(n) for n in CH['F']], 7, .6, a=1.5, r=2))
# end card: F A C E — Belinda, Lao Jia, Xiao De, Xiao Miu
te = pkeys('endcard')[0][0] if pkeys('endcard') else END - 8.6
for i, n in enumerate(['F3', 'A3', 'C4', 'E4', 'F4', 'A4', 'C5', 'E5']):
    put(music, te + .3 + i * .22, piano(hz(n), 6, .8 - i * .04), -.4 + i * .11)
put(music, te + .3, pad([hz(n) for n in ['F2', 'C3', 'A3', 'E4']], END - te + 1, .9, a=1, r=4))
put(music, te + 2.4, bell(hz('C6'), 5, .6), .2)

# =====================================================================
#  SFX
# =====================================================================
def swish(d=.25, lo=1500, hi=6000, v=1.0):
    x = bp(noise(d), lo, hi); n = len(x); e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return x * e * v * .12
def click(v=1.0, f=2500):
    d = .03; x = bp(noise(d), f * .6, min(f * 1.6, 20000)) * np.exp(-tt(d) * 200)
    return x * v * .5
def thud(f=90, v=1.0, d=.25):
    t = tt(d); return np.sin(2 * np.pi * f * t * (1 - t * .6)) * np.exp(-t * 18) * v * .5
def boing(v=1.0):
    t = tt(.25); f = 300 + 500 * t / .25; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12) * v * .12
def popsnd(v=1.0):
    t = tt(.07); f = 900 - 5000 * t; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 60) * v * .25
def metal(f=520, v=1.0, d=.6):
    t = tt(d); s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dc) for r, a, dc in [(1, 1, 7), (2.32, .6, 9), (4.25, .4, 13), (6.8, .3, 17)])
    return (s + bp(noise(d), 2000, 8000) * np.exp(-t * 60) * .6) * v * .12
def whoosh(d, up=True, v=1.0):
    n = int(d * SR); x = noise(d); f = np.linspace(0, 1, n)
    if not up: f = 1 - f
    out = bp(x, 250, 900) * (1 - f) + bp(x, 1400, 4200) * f
    return out * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * v * .11
TOOLN = {'clock': 'C6', 'search': 'D6', 'phone': 'F6', 'email': 'G6', 'pay': 'A6'}

for c in D['CUES']:
    t, ty = c['t'], c['type']
    if ty == 'slide': put(sfx, t, swish(.3, 1200, 5000, .8), .3)
    elif ty == 'slot': put(sfx, t, click(.6, 1800), .5); put(sfx, t + .02, thud(160, .25, .1), .5)
    elif ty == 'typing':
        tt_ = t
        while tt_ < t + c['d']: put(sfx, tt_, click(.35, 3500), rs.uniform(-.2, .2)); tt_ += rs.uniform(.05, .11)
    elif ty == 'crumple':
        for k in range(14): put(sfx, t + k * .025 + rs.rand() * .02, bp(noise(.04), 1500, 9000) * np.exp(-tt(.04) * 80) * .25)
    elif ty == 'toss': put(sfx, t, swish(.4, 600, 3000, .9), .6)
    elif ty == 'click': put(sfx, t, click(1.0, 1500), -.2)
    elif ty == 'books':
        for k in range(int(c['d'] / .09)): put(sfx, t + k * .09 * (1 - k * .002), thud(rs.uniform(110, 190), .18, .12), rs.uniform(-.4, .1))
    elif ty == 'nope': put(sfx, t, marimba(hz('F2'), .4, .9)); put(sfx, t + .12, marimba(hz('E2'), .4, .9))
    elif ty == 'sparkle':
        for k in range(6): put(sfx, t + k * .06, musicbox(hz(['C6', 'E6', 'G6', 'A6', 'C7', 'E7'][k]), .3, .35), .5)
    elif ty == 'think':
        for k in range(3): put(sfx, t + k * .18, popsnd(.25), -.3)
    elif ty == 'scribble':
        d = c['d']; x = bp(noise(d), 2500, 7000) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * tt(d)) ** 2) * env(int(d * SR), .05, .1)
        put(sfx, t, x * .05, .35)
    elif ty == 'hop': put(sfx, t, boing(.8))
    elif ty == 'pop': put(sfx, t, popsnd(.7), .2)
    elif ty == 'belinda': put(sfx, t, bell(hz('F5'), 2.5, .8), .4)
    elif ty == 'womp':
        tw = tt(1.1); f = hz('Bb3') * 2 ** (-np.floor(tw / .28) / 12 * 1.0) * (1 - .06 * (tw > .84) * (tw - .84) / .26)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) + .4 * np.sin(4 * np.pi * np.cumsum(f) / SR)
        put(sfx, t, s * env(len(tw), .01, .2) * .09)
    elif ty == 'sting':
        for n in ['D2', 'A2', 'F3', 'E4']: put(sfx, t, piano(hz(n), 3, .7))
    elif ty == 'reveal': put(sfx, t, swish(3.0, 300, 3000, .5)); put(sfx, t + .5, bell(hz('C6'), 3, .4), -.3)
    elif ty == 'clank': put(sfx, t, metal(rs.uniform(380, 620), .9), -.5)
    elif ty == 'thunk': put(sfx, t, thud(120, .8, .3), .1)
    elif ty == 'rise': put(sfx, t, whoosh(.8, True, .8), -.3); put(sfx, t + .8, thud(90, .7), -.3)
    elif ty == 'drawer': put(sfx, t, lp(noise(.35), 900) * env(int(.35 * SR), .05, .1) * .15, -.3)
    elif ty == 'drawerShut': put(sfx, t, thud(140, .7, .2), -.3)
    elif ty == 'lock': put(sfx, t, metal(900, .8, .3), -.5)
    elif ty == 'jingle':
        for k in range(5): put(sfx, t + k * .07, metal(rs.uniform(2000, 3200), .35, .25), .7)
    elif ty == 'tick': put(sfx, t, click(.8, 3000), .45); put(sfx, t + .005, marimba(hz('C6'), .1, .25), .45)
    elif ty == 'pin': put(sfx, t, click(.7, 2000), 0)
    elif ty == 'whoosh': put(sfx, t, whoosh(c['d'], not c.get('back'), .9), -.4)
    elif ty == 'ding': put(sfx, t, bell(hz(TOOLN.get(c.get('tool'), 'C6')), 2, .55), -.6)
    elif ty == 'check': put(sfx, t, musicbox(hz('C6'), .2, .6), 0); put(sfx, t + .1, musicbox(hz('F6'), .4, .6), 0)
    elif ty == 'strike': put(sfx, t, swish(.3, 2500, 8000, .6), .3)
    elif ty == 'circle': put(sfx, t, swish(.5, 2500, 8000, .6), .3)
    elif ty == 'uhoh': put(sfx, t, marimba(hz('A4'), .3, .8)); put(sfx, t + .22, marimba(hz('F4'), .5, .8))
    elif ty == 'steps':
        for k in range(100):
            tk_ = t + c['d'] * (k / 100) ** .9
            put(sfx, tk_, click(.25, 4000), -.5 + k / 100)
            if k % 10 == 9: put(sfx, tk_, musicbox(hz('C6') * 2 ** (-(k // 10) / 24), .2, .3))
    elif ty == 'rattle':
        for k in range(8): put(sfx, t + k * .07, metal(rs.uniform(700, 1100), .5, .15), -.6)
    elif ty == 'unlock': put(sfx, t, metal(1200, .7, .3), -.5); put(sfx, t + .15, bell(hz('F6'), 2, .5), -.5)
    elif ty == 'cake':
        for k in range(8): put(sfx, t + k * .09, musicbox(hz(['F5', 'A5', 'C6', 'E6', 'F6', 'A6', 'C7', 'E7'][k]), .4, .3), -.6 + k * .15)
    elif ty == 'answer': put(sfx, t, bell(hz('C5'), 2.5, .5), -.5)
    elif ty == 'act':
        for k, n in enumerate(['F5', 'A5', 'C6']): put(sfx, t + k * .08, bell(hz(n), 2.5, .45), .5)
    elif ty == 'flip':
        for k in range(5): put(sfx, t + k * .09, click(.6, 1500), -.5)
    elif ty == 'title': put(sfx, t, thud(70, .5, .6))

# =====================================================================
#  MIX: global silence in S3, reverb, master
# =====================================================================
mk = pkeys('music')
if mk:
    a, b = int(mk[0][0] * SR), int(mk[1][0] * SR)
    fade = np.linspace(1, 0, max(1, b - a)); music[:, a:b] *= fade; music[:, b:int((S3 + 14.0) * SR)] = 0

def reverb(x, secs=2.2, wet=.22):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = np.stack([rs.randn(n) * np.exp(-t * 3.2), rs.randn(n) * np.exp(-t * 3.2)])
    ir[:, :int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR))
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    out = np.stack([fftconvolve(x[i], ir[i])[:x.shape[1]] for i in range(2)])
    return x * (1 - wet) + out * wet
music = reverb(lp(music, 9000) if False else music, 2.6, .28)
sfx = reverb(sfx, 1.2, .15)
mix = music * 0.85 + sfx * 0.9
# fade in/out and soft limit
mix[:, :int(.3 * SR)] *= np.linspace(0, 1, int(.3 * SR))
endi = int(DUR * SR); mix[:, endi - int(2.5 * SR):endi] *= np.linspace(1, 0, int(2.5 * SR)); mix[:, endi:] = 0
peak = np.abs(mix).max(); print('peak', peak)
mix = mix / max(peak, 1e-9) * 0.9
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix = mix[:, :endi]
from scipy.io import wavfile
wavfile.write('score.wav', SR, (mix.T * 32000).astype(np.int16))
print('wrote score.wav', mix.shape[1] / SR, 's')

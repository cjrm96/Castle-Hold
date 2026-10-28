"""Castle Siege sound effects: physical-ish synthesis in numpy, plus a few voices rendered from the FluidR3 soundfont (MIT)."""
import numpy as np, os, subprocess, mido, random
from scipy.signal import butter, sosfilt
SR = 44100
rng = np.random.default_rng(11)
OUT = 'sfxwav'; os.makedirs(OUT, exist_ok=True)

def t_(d): return np.arange(int(SR*d))/SR
def env_exp(d, tau): return np.exp(-t_(d)/tau)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)
def noise(d): return rng.uniform(-1, 1, int(SR*d))
def brown(d):
    w = rng.normal(0, 1, int(SR*d)); b = np.cumsum(w); b = b - np.convolve(b, np.ones(2000)/2000, 'same'); return b/np.max(np.abs(b)+1e-9)
def pad(x, d):
    n = int(SR*d); return np.pad(x, (0, max(0, n-len(x))))[:max(n, len(x))]
def mix(*parts):
    n = max(len(p) for p, _ in parts); out = np.zeros(n)
    for p, off in parts:
        o = int(SR*off); m = min(len(p), n-o)
        if m > 0: out[o:o+m] += p[:m]
    return out
def reverb(x, wet=.18, d=.5, tau=.12):
    ir = noise(d)*env_exp(d, tau); ir = lp(ir, 6000); ir /= np.sqrt(np.sum(ir**2))
    y = np.convolve(x, ir)[:len(x)+int(SR*d)]
    return pad(x, len(y)/SR)*(1-wet) + y*wet
def save(name, x, peak=.89):
    x = x/ (np.max(np.abs(x))+1e-9) * peak
    fade = min(len(x), int(SR*.01)); x[-fade:] *= np.linspace(1, 0, fade)
    import scipy.io.wavfile as wf
    wf.write(f'{OUT}/{name}.wav', SR, (x*32767).astype(np.int16))

def modal(f0, ratios, decays, amps, d):
    t = t_(d); y = np.zeros_like(t)
    for r, tau, a in zip(ratios, decays, amps):
        y += a*np.sin(2*np.pi*f0*r*t + rng.uniform(0, 6.28))*np.exp(-t/tau)
    return y
def ks(f, d, damp=.996, bright=.5):
    """Karplus-Strong pluck"""
    n = int(SR/f); buf = rng.uniform(-1, 1, n)*bright + lp(rng.uniform(-1, 1, n), 2000)*(1-bright)
    out = np.zeros(int(SR*d))
    for i in range(len(out)):
        out[i] = buf[i % n]; buf[i % n] = damp*.5*(buf[i % n] + buf[(i+1) % n])
    return out

# ---- swords and shields
for v in range(3):
    f0 = [720, 860, 640][v]
    ring = modal(f0, [1, 2.76, 5.40, 8.93, 13.3], [.22, .12, .08, .05, .03], [1, .7, .5, .35, .2], .6)
    click = hp(noise(.02), 2500)*env_exp(.02, .004)*2
    thud = lp(noise(.08), 600)*env_exp(.08, .02)*1.2
    save(f'hit{v}', reverb(mix((ring*.6, 0), (click, 0), (thud, 0)), .16, .4, .08))
# ---- bow release and arrow flight
for v in range(3):
    twang = lp(ks(98+v*9, .35, .992, .2), 1400)*env_exp(.35, .09)
    d = .32; t = t_(d); n = noise(d)
    sweep = np.zeros_like(t)
    for i, c in enumerate(np.linspace(3600, 1700, 8)):
        a = int(i*len(t)/8); b = int((i+1)*len(t)/8); sweep[a:b] = bp(n, c*.8, c*1.25)[a:b]
    shape = np.sin(np.pi*np.clip(t/d, 0, 1))**2
    save(f'arrow{v}', mix((twang*.9, 0), (sweep*shape*1.4, .02)))
# ---- arrow strikes flesh or wood
for v in range(2):
    save(f'thunk{v}', mix((lp(noise(.06), 900)*env_exp(.06, .012), 0), (modal(210+v*40, [1, 1.6], [.05, .03], [1, .4], .12)*.8, 0)))
# ---- catapult stone hits wall or ground
for v in range(2):
    d = 1.1; t = t_(d)
    boom = np.sin(2*np.pi*(55+v*8)*t*(1-.25*t))*np.exp(-t/.25)
    crash = lp(noise(d), 2500)*np.exp(-t/.18)
    debris = np.zeros_like(t)
    for k in range(18):
        o = rng.uniform(.05, .9); a = int(o*SR); L = int(.03*SR)
        if a+L < len(t): debris[a:a+L] += bp(noise(.03), 1500, 5000)*env_exp(.03, .006)*rng.uniform(.1, .5)*np.exp(-o/.4)
    save(f'smash{v}', reverb(boom*1.2 + crash*.8 + debris, .2, .7, .2))
# ---- wall or building collapse
d = 2.4; t = t_(d)
rumble = lp(brown(d), 180)*np.minimum(1, t/.05)*np.exp(-t/.9)
crack = lp(noise(d), 3000)*np.exp(-t/.35)*.6
debris = np.zeros_like(t)
for k in range(60):
    o = rng.uniform(.05, 2.0); a = int(o*SR); L = int(.05*SR)
    if a+L < len(t): debris[a:a+L] += bp(noise(.05), 600, 4000)*env_exp(.05, .01)*rng.uniform(.1, .6)*np.exp(-o/.8)
save('collapse', reverb(rumble*1.4 + crack + debris, .25, 1.0, .3))
# ---- ram on a gate: a deep wooden boom
for v in range(2):
    d = .8; t = t_(d)
    body = np.sin(2*np.pi*(68+v*6)*t*(1-.2*t))*np.exp(-t/.22)
    wood = modal(180+v*20, [1, 2.1, 3.3], [.12, .07, .04], [1, .6, .3], d)*.5
    knock = lp(noise(.05), 1200)*env_exp(.05, .01)*1.5
    save(f'thump{v}', reverb(mix((body*1.3+wood, 0), (knock, 0)), .15, .5, .15))
# ---- boiling oil
d = 1.4; t = t_(d)
sizzle = hp(noise(d), 3000)*np.minimum(1, t/.08)*np.exp(-t/.6)*.5
splash = bp(noise(.4), 300, 1800)*env_exp(.4, .1)
pops = np.zeros_like(t)
for k in range(40):
    a = int(rng.uniform(0, d-.02)*SR); pops[a:a+60] += hp(rng.uniform(-1,1,60), 2000)*rng.uniform(.2, .8)
save('oil', mix((splash, 0), (sizzle + pops*np.exp(-t/.7), .02)))
# ---- coins
for v in range(2):
    c1 = modal(2400+v*300, [1, 2.4, 3.9], [.08, .05, .03], [1, .6, .4], .25)
    c2 = modal(3100+v*200, [1, 2.2, 3.6], [.07, .05, .03], [1, .6, .3], .25)
    save(f'coin{v}', mix((c1, 0), (c2*.8, .07), (c1*.5, .13)))
# ---- hammer on timber
for v in range(3):
    def knock(f):
        return mix((modal(f, [1, 2.3, 4.1], [.05, .03, .02], [1, .5, .3], .12), 0), (hp(noise(.01), 2000)*env_exp(.01, .002)*1.5, 0))
    f = [820, 940, 760][v]
    save(f'build{v}', reverb(mix((knock(f), 0), (knock(f*1.04)*.8, .19)), .12, .3, .06))
# ---- drawbridge chain
d = 1.3; x = np.zeros(int(SR*d))
for k in range(26):
    o = k*.045 + rng.uniform(0, .015); a = int(o*SR); m = modal(rng.uniform(2200, 3600), [1, 2.7], [.03, .02], [1, .4], .06)*rng.uniform(.4, 1)
    x[a:a+len(m)] += m[:max(0, min(len(m), len(x)-a))]
grind = lp(brown(d), 250)*.6
save('chain', reverb(x + grind, .2, .5, .12))
# ---- spike trap
save('trap', mix((modal(1500, [1, 2.8, 5.2], [.06, .04, .02], [1, .6, .3], .2), 0), (lp(noise(.08), 1500)*env_exp(.08, .02), .01)))
# ---- stone throw: creak and whoosh
d = .9; t = t_(d)
creak = bp(noise(.3), 300, 900)*np.sin(2*np.pi*14*t_(.3))**2*.8
whoosh = bp(noise(.6), 200, 1200)*np.sin(np.pi*t_(.6)/.6)**2
release = lp(noise(.06), 800)*env_exp(.06, .015)*2
save('launch', mix((creak, 0), (release, .25), (whoosh, .27)))

# ---- voices from the soundfont: war horn, drums, wood blocks, birds and wind
def render(name, build, bpm=100):
    mf = mido.MidiFile(ticks_per_beat=480); tr = mido.MidiTrack(); mf.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)))
    ev = build()
    ev.sort(key=lambda e: e[0]); last = 0
    for t, m in ev:
        tick = int(t*480); tr.append(m.copy(time=tick-last)); last = tick
    mf.save(f'/tmp/{name}.mid')
    subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.7', '-r', str(SR), '-o', 'synth.reverb.room-size=0.7', '-o', 'synth.reverb.level=0.6',
                    '-F', f'{OUT}/{name}.wav', '/usr/share/sounds/sf2/FluidR3_GM.sf2', f'/tmp/{name}.mid'], check=True)
def N(t, ch, n, v, d): return [(t, mido.Message('note_on', channel=ch, note=n, velocity=v)), (t+d, mido.Message('note_off', channel=ch, note=n, velocity=0))]
def P(ch, prog): return (0, mido.Message('program_change', channel=ch, program=prog))
render('horn', lambda: [P(0, 60), P(1, 61), (0, mido.Message('control_change', channel=0, control=91, value=110))] + N(0, 0, 50, 112, 1.1) + N(0, 1, 38, 80, 1.1) + N(1.15, 0, 57, 118, 2.2) + N(1.15, 1, 45, 84, 2.2) + [(4.5, mido.Message('note_off', channel=0, note=0, velocity=0))])
render('recruit', lambda: N(0, 9, 38, 90, .1) + N(.18, 9, 38, 70, .1) + N(.25, 9, 38, 90, .1) + N(.5, 9, 41, 110, .3) + [(1.4, mido.Message('note_off', channel=9, note=0))], bpm=120)
render('deny', lambda: N(0, 9, 77, 90, .1) + N(.22, 9, 77, 80, .1) + [(.8, mido.Message('note_off', channel=9, note=0))], bpm=120)
render('cheer', lambda: [P(0, 126)] + N(0, 0, 60, 100, 2.6) + [(3.6, mido.Message('note_off', channel=0, note=0))], bpm=60)
def birds():
    ev = [P(0, 123), P(1, 122), (0, mido.Message('control_change', channel=1, control=7, value=46)), (0, mido.Message('control_change', channel=0, control=7, value=70))]
    ev += N(0, 1, 40, 60, 28)
    t = .6
    while t < 26:
        n = random.choice([72, 76, 79, 84, 81]); ev += N(t, 0, n, random.randint(40, 80), random.uniform(.3, 1.2))
        t += random.uniform(.8, 3.5)
    ev.append((29, mido.Message('note_off', channel=0, note=0)))
    return ev
random.seed(5)
render('ambient', birds, bpm=60)

for f in sorted(os.listdir(OUT)): print(f)

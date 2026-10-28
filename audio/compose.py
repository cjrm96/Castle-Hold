"""Castle Siege soundtrack: written note by note, rendered with the FluidR3 General MIDI soundfont (MIT license)."""
import mido, random, re, os, sys
random.seed(7)
TPB = 480
NOTE = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}

def pitch(tok):
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', tok)
    n = NOTE[m.group(1)] + (1 if m.group(2)=='#' else -1 if m.group(2)=='b' else 0)
    return 12*(int(m.group(3))+1) + n

def octv(text, n):
    return re.sub(r'([A-G][#b]?)(-?\d)(?=[,:\]])', lambda m: f'{m.group(1)}{int(m.group(2))+n}', text)

def seq(text):
    """'D5:1 A4:.5 r:1 [D4,F4,A4]:2' -> list of (pitches, beats)"""
    out = []
    for tok in text.split():
        p, d = tok.rsplit(':',1)
        d = float(d)
        if p == 'r': out.append(([], d)); continue
        if p.startswith('['): out.append(([pitch(x) for x in p[1:-1].split(',')], d))
        else: out.append(([pitch(p)], d))
    return out

class Song:
    def __init__(self, bpm, bar=4):
        self.bpm, self.bar, self.parts = bpm, bar, {}
    def part(self, name, ch, prog, vol=100, pan=64, rev=70, cho=10):
        self.parts[name] = dict(ch=ch, prog=prog, vol=vol, pan=pan, rev=rev, cho=cho, ev=[])
    def put(self, name, beat, text, vel=80, legato=.92, swing=0.0, human=.012, vj=8):
        P = self.parts[name]; t = beat
        for ps, d in seq(text):
            for p in ps:
                v = max(20, min(127, vel + random.randint(-vj, vj)))
                st = t + random.uniform(-human, human)
                P['ev'].append((max(0, st), p, v, d*legato))
            t += d
        return t
    def hit(self, beat, notes_beats, vel=90):
        """drums on channel 10: list of (note, beat offset, vel scale)"""
        P = self.parts['drums']
        for n, off, sc in notes_beats:
            P['ev'].append((max(0,beat+off+random.uniform(-.01,.01)), n, max(20,min(127,int(vel*sc)+random.randint(-6,6))), .2))
    def save(self, path):
        mf = mido.MidiFile(ticks_per_beat=TPB)
        meta = mido.MidiTrack(); mf.tracks.append(meta)
        meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm), time=0))
        for name, P in self.parts.items():
            tr = mido.MidiTrack(); mf.tracks.append(tr); ch = P['ch']
            msgs = [(0, mido.Message('control_change', channel=ch, control=7, value=P['vol'])),
                    (0, mido.Message('control_change', channel=ch, control=10, value=P['pan'])),
                    (0, mido.Message('control_change', channel=ch, control=91, value=P['rev'])),
                    (0, mido.Message('control_change', channel=ch, control=93, value=P['cho']))]
            if ch != 9: msgs.append((0, mido.Message('program_change', channel=ch, program=P['prog'])))
            for st, p, v, d in P['ev']:
                a = int(round(st*TPB)); b = int(round((st+d)*TPB))
                msgs.append((a, mido.Message('note_on', channel=ch, note=p, velocity=v)))
                msgs.append((max(a+1,b), mido.Message('note_off', channel=ch, note=p, velocity=0)))
            msgs.sort(key=lambda m: (m[0], 0 if m[1].type=='note_off' else 1))
            last = 0
            for t, m in msgs:
                tr.append(m.copy(time=t-last)); last = t
        mf.save(path)

CH = {'Dm':['D','F','A'],'C':['C','E','G'],'F':['F','A','C'],'Am':['A','C','E'],'G':['G','B','D'],'Gm':['G','Bb','D'],
      'Bb':['Bb','D','F'],'A':['A','C#','E'],'Em':['E','G','B'],'D':['D','F#','A'],'E':['E','G#','B'],'B':['B','D#','F#'],'Bm':['B','D','F#']}
def tone(n, o): return f'{n}{o}'

def arp(song, part, beat, chord, bars=1, oct_=3, pat=(0,1,2,1,3,1,2,1), step=.5, vel=62):
    c = CH[chord]; notes = [tone(c[0],oct_), tone(c[1],oct_), tone(c[2],oct_), tone(c[0],oct_+1)]
    for b in range(bars):
        txt = ' '.join(f'{notes[i]}:{step}' for i in pat)
        song.put(part, beat + b*song.bar, txt, vel=vel, legato=1.6)

def pad(song, part, beat, chord, beats, oct_=3, vel=50):
    c = CH[chord]
    song.put(part, beat, f'[{tone(c[0],oct_)},{tone(c[1],oct_)},{tone(c[2],oct_)}]:{beats}', vel=vel, legato=1.0, human=0)

# General MIDI programs
NYLON, HARP, DULCIMER, RECORDER, FLUTE, PANFLUTE, FIDDLE, CELLO, STRINGS, SLOWSTR, CHOIR, HORN, TRUMPET, BRASS, TIMPANI, TAIKO, BAGPIPE, CONTRA, PIZZ = 24, 46, 15, 74, 73, 75, 110, 42, 48, 49, 52, 60, 56, 61, 47, 116, 109, 43, 45
KICK, LTOM, LFTOM, TAMB, SHAKER, CLAP, SNARE, CRASH, RIDE = 35, 45, 41, 54, 82, 39, 38, 49, 51

def frame_drum(song, beat, bars, vel=80):
    for b in range(bars):
        s = beat + b*song.bar
        song.hit(s, [(LTOM,0,1),(LTOM,1.5,.6),(LTOM,2,.9),(TAMB,1,.45),(TAMB,3,.45),(LTOM,3.5,.5)], vel)

# ---------------------------------------------------------------- title
def title():
    s = Song(92); s.part('lute',0,NYLON,96,52,60); s.part('rec',1,RECORDER,104,74,80); s.part('fid',2,FIDDLE,92,40,80)
    s.part('drone',3,SLOWSTR,70,64,90); s.part('horn',4,HORN,70,80,90); s.part('drums',9,0,88,64,40)
    A = 'D5:1 A4:.5 B4:.5 C5:1 A4:1 G4:1.5 F4:.5 E4:1 D4:1 F4:1 G4:.5 A4:.5 C5:1 B4:.5 A4:.5 A4:3 r:1 D5:1 E5:.5 F5:.5 E5:1 D5:1 C5:1.5 A4:.5 G4:1 A4:1 F4:.5 G4:.5 A4:1 G4:.5 F4:.5 E4:1 D4:3 r:1'
    B = 'A4:1 D5:1 F5:1 E5:.5 D5:.5 C5:1 E5:1 D5:2 B4:1 C5:.5 D5:.5 A4:1 G4:1 A4:4 F5:1 E5:1 D5:1 C5:1 B4:.5 C5:.5 D5:1 A4:2 G4:1 F4:.5 G4:.5 E4:1 C4:.5 E4:.5 D4:4'
    hA = 'Dm Am F Am Dm C G Dm'.split(); hB = 'Dm C G Am Dm G C Dm'.split()
    t = 0
    for c in 'Dm Dm C Dm'.split(): arp(s,'lute',t,c,1,3,vel=58); t += 4
    s.put('drone',0,'[D3,A3]:16',vel=48,legato=1)
    def section(t, h, mel, lead, extra=None):
        for i,c in enumerate(h): arp(s,'lute',t+i*4,c,1,3,vel=64)
        s.put('drone',t,f'[D3,A3]:{len(h)*4}',vel=52,legato=1)
        s.put(lead,t,mel,vel=86)
        if extra: extra(t)
        frame_drum(s,t,len(h),76)
        return t+len(h)*4
    t = section(t,hA,A,'rec')
    t = section(t,hB,B,'fid')
    t = section(t,hA,A,'rec',lambda t0: s.put('fid',t0,octv(A,-1),vel=58))
    def full(t0):
        s.put('rec',t0,B,vel=70)
        for i,c in enumerate(hB): pad(s,'horn',t0+i*4,c,4,3,vel=44)
    t = section(t,hB,B,'fid',full)
    for c in ['Dm','C']: arp(s,'lute',t,c,1,3,vel=56); t += 4
    s.put('lute',t,'[D3,A3,D4,F4]:4',vel=70,legato=1)
    s.put('drone',t-8,'[D3,A3]:12',vel=46,legato=1)
    s.put('rec',t-8,'A4:2 F4:1 E4:1 D4:4',vel=70)
    s.hit(t,[(LTOM,0,1)],80)
    return s, t+5

# ---------------------------------------------------------------- market day (6/8 jig, beat = eighth)
def market():
    s = Song(300, bar=6); s.part('lute',0,NYLON,96,50,55); s.part('rec',1,RECORDER,106,76,70); s.part('fid',2,FIDDLE,92,36,70)
    s.part('dulc',3,DULCIMER,80,90,70); s.part('drums',9,0,84,64,35)
    A = 'G4:1 B4:1 D5:1 G5:2 F5:1 E5:1 D5:1 C5:1 B4:2 A4:1 G4:1 A4:1 B4:1 C5:1 D5:1 E5:1 F5:2 E5:1 D5:2 r:1 G4:1 B4:1 D5:1 G5:2 A5:1 G5:1 F5:1 D5:1 C5:2 A4:1 B4:1 C5:1 D5:1 A4:1 F4:1 A4:1 G4:3 G4:2 r:1'
    B = 'D5:2 E5:1 F5:2 D5:1 C5:2 D5:1 E5:2 C5:1 B4:2 C5:1 D5:1 C5:1 B4:1 A4:3 D4:3 D5:2 E5:1 F5:2 A5:1 G5:1 F5:1 E5:1 D5:2 C5:1 B4:1 A4:1 B4:1 C5:1 A4:1 F4:1 G4:3 r:3'
    hA = 'G C G F G F D G'.split(); hB = 'F C G D F C D G'.split()
    def bass(t, h):
        for i,c in enumerate(h):
            r = CH[c][0]; f = CH[c][2]
            s.put('lute', t+i*6, f'{r}3:1 [{CH[c][1]}3,{f}3]:1 [{CH[c][1]}3,{f}3]:1 {f}2:1 [{CH[c][1]}3,{f}3]:1 [{CH[c][1]}3,{f}3]:1', vel=58, legato=1.3)
            s.hit(t+i*6, [(LTOM,0,1),(TAMB,1,.4),(TAMB,2,.4),(LTOM,3,.75),(TAMB,4,.4),(TAMB,5,.5)], 78)
    t = 0
    bass(t,['G','G']); t += 12
    for lead, mel, h, extra in [('rec',A,hA,None),('rec',B,hB,None),('fid',A,hA,'dulcA'),('fid',B,hB,'recB'),('rec',A,hA,'fidA')]:
        bass(t,h); s.put(lead,t,mel,vel=84,legato=.85)
        if extra=='dulcA': s.put('dulc',t,A,vel=52)
        if extra=='recB': s.put('rec',t,octv(B,-1),vel=56)
        if extra=='fidA': s.put('fid',t,A,vel=62,legato=.85)
        t += len(h)*6
    # gentle interlude on dulcimer
    C = 'B4:3 A4:3 G4:3 D4:3 E4:2 F4:1 G4:2 A4:1 B4:6 C5:3 B4:3 A4:3 F4:3 G4:6 G4:6'
    for i,c in enumerate('G G C G F F G G'.split()):
        s.put('lute', t+i*6, f'{CH[c][0]}3:3 {CH[c][2]}3:3', vel=50, legato=1.2)
    s.put('dulc',t,C,vel=74,legato=1.2); t += 48
    bass(t,hA); s.put('rec',t,A,vel=88,legato=.85); s.put('fid',t,A,vel=66,legato=.85); t += 48
    s.put('lute',t,'[G2,D3,G3,B3]:6',vel=70,legato=1); s.hit(t,[(LTOM,0,1),(TAMB,0,.6)],80)
    return s, t+8

# ---------------------------------------------------------------- dusk (3/4 pastoral)
def dusk():
    s = Song(76, bar=3); s.part('harp',0,HARP,96,50,85); s.part('flute',1,FLUTE,100,76,90); s.part('str',2,SLOWSTR,76,64,95)
    s.part('cello',3,CELLO,80,44,85)
    M = 'A4:2 C5:1 B4:1 A4:1 G4:1 E4:3 E4:1 G4:1 A4:1 C5:2 D5:1 E5:1 D5:1 C5:1 B4:3 B4:2 r:1 A4:2 C5:1 B4:1 A4:1 G4:1 F4:2 A4:1 G4:2 E4:1 A4:1 B4:1 C5:1 D5:1 B4:1 G4:1 A4:3 A4:3'
    H = 'Am G Em Em Am C G G Am G F C Am G Am Am'.split()
    def harp(t):
        for i,c in enumerate(H):
            n = CH[c]; s.put('harp', t+i*3, f'{n[0]}2:.5 {n[2]}2:.5 {n[0]}3:.5 {n[1]}3:.5 {n[2]}3:.5 {n[1]}3:.5', vel=56, legato=2.2)
            s.put('cello', t+i*3, f'{n[0]}2:3', vel=48, legato=1)
    t = 0
    harp(t); s.put('flute',t,M,vel=78); s.put('str',t+24,'[A3,C4,E4]:6 [G3,B3,D4]:6 [A3,C4,E4]:6 [A3,C4,E4]:6',vel=40,legato=1); t += 48
    harp(t); s.put('str',t,octv(M,-1),vel=64); s.put('flute',t+24,'E5:3 D5:3 C5:3 B4:3 A4:6 A4:6',vel=60); t += 48
    harp(t); s.put('flute',t,M,vel=74); s.put('str',t,'A3:6 G3:6 E3:6 E3:6 A3:6 G3:6 A3:6 A3:6',vel=46,legato=1); t += 48
    s.put('harp',t,'A2:.5 E3:.5 A3:.5 C4:.5 E4:.5 A4:4',vel=60,legato=2.5); s.put('str',t,'[A2,E3,A3,C4]:6',vel=44,legato=1)
    return s, t+7

# ---------------------------------------------------------------- battle one: storm the walls
def battle1():
    s = Song(138); s.part('ost',0,STRINGS,104,54,50); s.part('lo',1,CONTRA,100,64,50); s.part('horn',2,HORN,110,70,70)
    s.part('tpt',3,TRUMPET,92,86,70); s.part('choir',4,CHOIR,78,64,90); s.part('timp',5,TIMPANI,100,64,60); s.part('drums',9,0,100,64,40)
    s.part('taiko',6,TAIKO,104,64,50)
    OST = {'Dm':'D3 D3 D3 F3 D3 D3 C3 D3','Bb':'Bb2 Bb2 Bb2 D3 Bb2 Bb2 A2 Bb2','C':'C3 C3 C3 E3 C3 C3 Bb2 C3','F':'F3 F3 F3 A3 F3 F3 E3 F3',
           'Gm':'G2 G2 G2 Bb2 G2 G2 F2 G2','A':'A2 A2 A2 C#3 A2 A2 G2 A2'}
    def drive(t, h, taiko=True, choir=False):
        for i,c in enumerate(h):
            b = t+i*4
            s.put('ost', b, ' '.join(f'{n}:.5' for n in OST[c].split()), vel=84, legato=.6, vj=12)
            s.put('lo', b, f'{CH[c][0]}2:2 {CH[c][0]}2:2', vel=78, legato=.9)
            if taiko: s.put('taiko', b, 'D2:1 D2:.5 D2:1.5 D2:.5 D2:.5', vel=96, legato=.5)
            s.hit(b, [(KICK,0,1),(KICK,2,.8),(SNARE,1,.35),(SNARE,3,.4),(SNARE,3.5,.25)], 96)
            if choir: pad(s,'choir',b,c,4,4,vel=56)
    hA = 'Dm Bb Dm C F Bb C Dm'.split(); hB = 'Dm Gm Bb A F Gm C A'.split()
    A = 'D4:2 A3:1 D4:1 F4:1.5 E4:.5 D4:1 C4:1 D4:2 A3:2 r:4 F4:2 G4:1 A4:1 Bb4:1.5 A4:.5 G4:1 F4:1 E4:1 F4:1 G4:1 E4:1 D4:4'
    B = 'A4:1 A4:.5 A4:.5 Bb4:1 A4:1 G4:1 G4:.5 G4:.5 A4:1 G4:1 F4:1 E4:1 D4:1 F4:1 E4:4 A4:1 C5:1 D5:2 C5:1 Bb4:1 A4:2 G4:1 Bb4:1 A4:1 G4:1 A4:4'
    t = 0
    drive(t, ['Dm']*4, taiko=True); s.put('timp',t+14,'D2:.25 D2:.25 D2:.25 D2:.25 A1:1',vel=90); t += 16
    drive(t, hA); s.put('horn',t,A,vel=96); t += 32
    drive(t, hB); s.put('tpt',t,B,vel=88); s.put('horn',t,octv(B,-1),vel=70); t += 32
    for i in range(4):
        s.put('taiko', t+i*4, 'D2:.5 D2:.5 D2:.5 D2:.5 D2:1 D2:.5 D2:.5', vel=100, legato=.5)
        s.hit(t+i*4, [(KICK,0,1),(LFTOM,1,.8),(LFTOM,1.5,.8),(KICK,2,1),(LTOM,3,.8),(LTOM,3.5,.9)], 100)
    s.put('timp',t,'D2:1 D2:1 A1:1 D2:1 D2:1 D2:1 A1:1 D2:1 D2:.5 D2:.5 D2:.5 D2:.5 A1:2 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 A1:2',vel=96); t += 16
    drive(t, hA, choir=True); s.put('horn',t,A,vel=104); s.put('tpt',t,octv(A,1),vel=70); t += 32
    drive(t, hB, choir=True); s.put('tpt',t,B,vel=96); s.put('horn',t,B,vel=80); t += 32
    s.put('ost',t,'[D3,A3,D4]:4',vel=96,legato=1); s.put('lo',t,'D2:4',vel=96,legato=1); s.put('horn',t,'[D4,F4,A4]:4',vel=100,legato=1)
    s.put('timp',t,'D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:2',vel=100); s.hit(t,[(KICK,0,1),(CRASH,0,.6)],100)
    return s, t+6

# ---------------------------------------------------------------- battle two: the war dance
def battle2():
    s = Song(152); s.part('fid',0,FIDDLE,108,60,60); s.part('pipe',1,BAGPIPE,82,80,60); s.part('cello',2,CELLO,104,46,50)
    s.part('drums',9,0,100,64,40); s.part('taiko',3,TAIKO,96,64,50); s.part('str',4,STRINGS,84,64,70)
    A = 'E4:.5 G4:.5 B4:.5 E5:.5 D5:.5 B4:.5 A4:.5 B4:.5 G4:.5 A4:.5 B4:.5 G4:.5 E4:1 E4:1 D4:.5 E4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 A4:.5 G4:.5 F#4:.5 D4:.5 E4:.5 F#4:.5 D4:1 D4:1 E4:.5 G4:.5 B4:.5 E5:.5 D5:.5 B4:.5 A4:.5 B4:.5 G4:.5 A4:.5 B4:.5 D5:.5 E5:1 E5:1 D5:.5 B4:.5 A4:.5 G4:.5 F#4:.5 D4:.5 E4:.5 F#4:.5 G4:.5 F#4:.5 E4:.5 D4:.5 E4:2'
    B = 'B4:1 E5:1 E5:.5 F#5:.5 G5:1 F#5:.5 E5:.5 D5:.5 B4:.5 A4:1 D5:1 D5:1 D5:.5 E5:.5 F#5:1 E5:.5 D5:.5 B4:.5 A4:.5 B4:1 E5:1 E5:.5 F#5:.5 G5:1 A5:.5 G5:.5 F#5:.5 E5:.5 D5:1 B4:.5 A4:.5 G4:.5 F#4:.5 E4:2'
    H = 'Em Em D D Em Em D Em'.split()
    def groove(t, h, pipe=False):
        for i,c in enumerate(h):
            b = t+i*4; r = CH[c][0]
            s.put('cello', b, f'{r}2:.5 {r}3:.5 {r}2:.5 {CH[c][2]}2:.5 {r}2:.5 {r}3:.5 {CH[c][2]}2:.5 {r}3:.5', vel=86, legato=.55)
            s.put('taiko', b, 'D2:1 D2:1 D2:.5 D2:.5 D2:1', vel=94, legato=.5)
            s.hit(b, [(KICK,0,1),(SNARE,1,.5),(KICK,2,.9),(SNARE,3,.55),(TAMB,.5,.3),(TAMB,1.5,.3),(TAMB,2.5,.3),(TAMB,3.5,.35)], 96)
            if pipe: s.put('pipe', b, '[E3,B3]:4', vel=56, legato=1)
    t = 0
    groove(t, ['Em','Em']); t += 8
    groove(t, H); s.put('fid', t, A, vel=90, legato=.8); t += 32
    groove(t, H, pipe=True); s.put('fid', t, B, vel=94, legato=.8); t += 32
    groove(t, H, pipe=True); s.put('pipe', t, A, vel=78, legato=.85); s.put('fid', t, A, vel=72, legato=.8)
    for i,c in enumerate(H): pad(s,'str',t+i*4,c,4,3,vel=50)
    t += 32
    groove(t, H, pipe=True); s.put('fid', t, B, vel=100, legato=.8); s.put('pipe', t, B, vel=70, legato=.85); t += 32
    s.put('cello',t,'E2:4',vel=96,legato=1); s.put('fid',t,'[E4,B4,E5]:4',vel=96,legato=1); s.hit(t,[(KICK,0,1),(CRASH,0,.7)],100)
    return s, t+5

# ---------------------------------------------------------------- stings
def victory():
    s = Song(100); s.part('brass',0,BRASS,112,64,80); s.part('tpt',1,TRUMPET,100,80,80); s.part('timp',2,TIMPANI,100,64,70); s.part('str',3,STRINGS,90,50,90); s.part('drums',9,0,100,64,50)
    s.put('tpt',0,'D4:.33 F#4:.33 A4:.34 D5:1 A4:.5 D5:.5 F#5:3',vel=100,legato=.95)
    s.put('brass',0,'r:1 [D3,A3,D4]:1 [D3,A3]:1 [D3,F#3,A3,D4]:3',vel=96,legato=1)
    s.put('str',1,'[D3,F#3,A3,D4,F#4]:4',vel=80,legato=1)
    s.put('timp',0,'r:1 D2:1 A1:1 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:.25 D2:1',vel=100)
    s.hit(3,[(CRASH,0,.7)],100)
    return s, 7
def defeat():
    s = Song(66); s.part('str',0,SLOWSTR,100,64,95); s.part('cello',1,CELLO,100,44,90); s.part('choir',2,CHOIR,80,70,100); s.part('timp',3,TIMPANI,90,64,80)
    s.put('cello',0,'D3:1 C3:1 Bb2:1 A2:3',vel=84,legato=1)
    s.put('str',0,'[D3,F3,A3]:2 [Bb2,D3,F3]:1 [A2,C#3,E3]:3',vel=70,legato=1)
    s.put('choir',1,'[D4,F4]:2 [C#4,E4]:3',vel=60,legato=1)
    s.put('timp',3,'A1:.25 A1:.25 A1:.25 A1:.25 D2:2',vel=80)
    return s, 6.5

SONGS = {'title':title,'market':market,'dusk':dusk,'battle1':battle1,'battle2':battle2,'victory':victory,'defeat':defeat}
if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'mid'
    os.makedirs(out, exist_ok=True)
    for name, fn in SONGS.items():
        s, end = fn(); s.save(f'{out}/{name}.mid')
        print(name, 'beats', round(end,1), 'seconds', round(end*60/s.bpm,1))

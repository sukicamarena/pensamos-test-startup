import sys, os
BASE = os.path.dirname(os.path.abspath(__file__))
_lib = open(os.path.join(BASE, 'ep_common.py')).read().replace("/home/claude/eplib.py", os.path.join(BASE, 'eplib.py'))
exec(_lib)
OUTNAME = 'lopez_mateos.mp4'
CLIPS = sys.argv[3] if len(sys.argv) > 3 else os.path.join(BASE, 'clips8')

# (speaker, subtitle, shot)
LINES = [
    ('brayan', 'Te digo, güey, en López Mateos siempre chocan a alguien. Es ley.', 'b_close'),
    ('kevin', 'Sí, sí, ya voy llegando, nomás contesto este mensaje...', 'k_close'),
    ('brayan', '¡Chinga la madre! ¿¡Quién me chocó!?', 'b_mad'),
    ('kevin', 'Perdón, carnal. Estaba viendo un video de cómo manejar mejor.', 'k_sorry'),
    ('chuy', '¡Jajaja! ¡Eso te pasa por andar en López Mateos en quincena!', 'c_laugh'),
    ('chuy', '¡No manches! ¿¡Y a mí por qué!?', 'c_mad'),
    ('rigo', 'Ay, mijo, es que me dio risa y se me fue el pie.', 'r_close'),
    ('itzel', '¡Jajaja! ¡Señor, ni frenos trae su vocho!', 'i_laugh'),
    ('presi', 'Tranquilos, ciudadanos. Este choque ya estaba en el plan de obras.', 'p_close'),
    ('buro', 'Reportamos una carambola de cuarenta coches en López Mateos, a la altura de Plaza del Sol. O sea... un martes normal.', 'heli'),
    ('brayan', 'Te dije, güey. Siempre chocan a alguien.', 'b_end'),
]
# crash moments: (line index that ends right before the crash, crash shot)
TITLE_DUR, GAP, END_DUR = 3.4, 0.35, 3.0
CRASH_SHOTS = {2: 'crash1', 5: 'crash2', 7: 'crash3_pre', 8: 'crash3'}  # inserted before these lines
CRASH_DUR = 1.6

def clip_path(i): return os.path.join(CLIPS, f'line_{i:02d}.wav')
def read_wav_any(p):
    with wave.open(p) as w:
        sr = w.getframerate(); n = w.getnframes(); ch = w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
        if ch > 1: a = a.reshape(-1, ch).mean(1)
    if sr != 44100:
        a = np.interp(np.arange(int(len(a) * 44100 / sr)) * sr / 44100, np.arange(len(a)), a)
    return a
AUD = []
for i, (sp, txt, shot) in enumerate(LINES):
    p = clip_path(i)
    if os.path.exists(p): AUD.append(read_wav_any(p))
    else:
        dur = max(1.4, len(txt) * 0.058); tt = np.arange(int(dur * 44100)) / 44100
        AUD.append((np.sin(2 * np.pi * 180 * tt) * (np.sin(2 * np.pi * 4 * tt) > 0) * 0.2).astype(np.float32))
T = []; CR = []; cur = TITLE_DUR
for i, a in enumerate(AUD):
    if i in (2, 5, 8):
        CR.append((cur, cur + CRASH_DUR, {2: 1, 5: 2, 8: 3}[i])); cur += CRASH_DUR
    d = len(a) / 44100; T.append((cur, cur + d)); cur += d + GAP
    if i == 9:
        pass
FINAL_CRASH = cur + 0.1
cur += 1.4
DUR = cur + END_DUR
END_START = cur
NF = int(DUR * FPS)
ENVS = []
for a in AUD:
    hop = 44100 // FPS
    e = np.array([np.sqrt(np.mean(a[k*hop:(k+1)*hop] ** 2) + 1e-9) if len(a[k*hop:(k+1)*hop]) else 0 for k in range(len(a) // hop + 1)])
    ENVS.append(e / (e.max() + 1e-9))
def mouth_of(name, t):
    for i, (a, b) in enumerate(T):
        if LINES[i][0] == name and a <= t < b:
            k = int((t - a) * FPS); e = ENVS[i]
            if k < len(e) and e[k] > 0.15: return 2 if e[k] > 0.8 else 1
            return 0
    return 0

# ===================== ART =====================
def grad(im, top, bot, y1, y0=0):
    d = ImageDraw.Draw(im)
    for y in range(y0, y1, 8):
        k = (y - y0) / max(1, y1 - y0)
        d.rectangle([0, y, W, y + 8], fill=tuple(int(top[j] + (bot[j] - top[j]) * k) for j in range(3)))

def jacaranda(d, x, y, s=1.0):
    d.line([(x, y), (x, y - 220 * s)], fill=(100, 70, 50), width=int(18 * s))
    for k in range(7):
        a = k / 7 * math.pi * 2
        cx, cy = x + math.cos(a) * 90 * s, y - 260 * s + math.sin(a) * 60 * s
        d.ellipse([cx - 70 * s, cy - 55 * s, cx + 70 * s, cy + 55 * s], fill=(160, 110, 200), outline=(120, 80, 160), width=3)

def palm(d, x, y, s=1.0):
    d.line([(x, y), (x + 15 * s, y - 380 * s)], fill=(130, 95, 60), width=int(16 * s))
    for a in range(0, 360, 50):
        ra = math.radians(a)
        d.ellipse([x + 15 * s + 100 * s * math.cos(ra) - 70 * s, y - 380 * s + 40 * s * math.sin(ra) - 18 * s,
                   x + 15 * s + 100 * s * math.cos(ra) + 70 * s, y - 380 * s + 40 * s * math.sin(ra) + 18 * s], fill=(60, 150, 70), outline=OUT, width=2)

def road_sign(d, x, y, l1, l2):
    d.rectangle([x + 140, y + 150, x + 160, y + 520], fill=(120, 120, 130), outline=OUT, width=3)
    d.rounded_rectangle([x, y, x + 300, y + 160], radius=12, fill=(20, 110, 60), outline=(255, 255, 255), width=6)
    d.text((x + 150, y + 55), l1, font=font(34), fill=(255, 255, 255), anchor='mm')
    d.text((x + 150, y + 110), l2, font=font(30), fill=(255, 255, 255), anchor='mm')

def mk_avenida():
    im = Image.new('RGB', (W, H)); grad(im, (120, 190, 245), (210, 235, 250), 1000)
    d = ImageDraw.Draw(im)
    d.ellipse([820, 110, 970, 260], fill=(255, 225, 100))
    r = random.Random(4)
    x = -30
    while x < W:
        w = r.randint(140, 230); h = r.randint(250, 520)
        c = r.choice([(225, 200, 160), (200, 180, 170), (180, 200, 210), (230, 215, 180)])
        d.rectangle([x, 1000 - h, x + w, 1000], fill=c, outline=OUT, width=3)
        for wy in range(1000 - h + 25, 980, 55):
            for wx in range(x + 15, x + w - 25, 45): d.rectangle([wx, wy, wx + 25, wy + 30], fill=(170, 215, 240))
        x += w - 5
    d.rounded_rectangle([600, 760, 960, 840], radius=12, fill=(255, 210, 60), outline=OUT, width=4)
    d.text((780, 800), 'PLAZA DEL SOL', font=font(38), fill=(200, 60, 30), anchor='mm')
    for k, xx in enumerate((80, 330, 590, 860)):
        (jacaranda if k % 2 == 0 else palm)(d, xx, 1040, 0.8)
    d.rectangle([0, 1000, W, 1060], fill=(200, 200, 205), outline=OUT, width=3)
    d.rectangle([0, 1060, W, H], fill=(75, 75, 82))
    for y in (1330, 1600):
        for x in range(20, W, 200): d.rectangle([x, y, x + 110, y + 16], fill=(255, 255, 255))
    road_sign(d, 40, 520, 'AV. LÓPEZ', 'MATEOS')
    return im
AVENIDA = mk_avenida()

def mk_aerial():
    im = Image.new('RGB', (W, H), (110, 150, 100)); d = ImageDraw.Draw(im)
    r = random.Random(12)
    for x in range(0, W, 120):
        for y in range(0, H, 120):
            if 360 < x < 700: continue
            d.rectangle([x + 8, y + 8, x + 112, y + 112], fill=r.choice([(200, 180, 150), (170, 170, 180), (215, 200, 160), (160, 110, 190)]), outline=OUT, width=2)
    d.rectangle([380, 0, 700, H], fill=(70, 70, 78))
    for y in range(0, H, 90): d.rectangle([536, y, 544, y + 50], fill=(255, 230, 90))
    # glorieta
    d.ellipse([370, 760, 710, 1100], fill=(70, 70, 78)); d.ellipse([440, 830, 640, 1030], fill=(80, 160, 90), outline=OUT, width=4)
    d.ellipse([520, 910, 560, 950], fill=(220, 200, 150), outline=OUT, width=3)
    return im
AERIAL = mk_aerial()

def car(im, x, by, col, kind='sedan', driver=None, dkw=None, s=1.0, crumple=0, tilt=0):
    w, h = 600, 330
    lay = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    if kind == 'vocho':
        d.chord([60, 60, 540, 420], 180, 360, fill=col, outline=OUT, width=5)
        d.rectangle([60, 230, 540, 260], fill=col, outline=OUT, width=4)
        win = (150, 110, 300, 220)
    elif kind == 'suv':
        d.rounded_rectangle([20, 40, 580, 270], radius=30, fill=col, outline=OUT, width=5)
        win = (70, 70, 280, 170)
        d.rectangle([300, 70, 540, 170], fill=(40, 40, 50), outline=OUT, width=3)
    else:
        d.rounded_rectangle([10, 140, 590, 270], radius=30, fill=col, outline=OUT, width=5)
        d.polygon([(110, 140), (170, 60), (420, 60), (480, 140)], fill=col, outline=OUT)
        win = (140, 72, 300, 140)
        d.polygon([(320, 140), (320, 72), (410, 72), (460, 140)], fill=(150, 210, 240), outline=OUT)
    if driver:
        hi = spr(driver, **(dkw or {})).crop((60, 40, 540, 540)).resize((int((win[2] - win[0]) * 1.05), int((win[2] - win[0]) * 1.1)))
        box = Image.new('RGBA', (win[2] - win[0], win[3] - win[1]), (150, 210, 240, 255))
        box.paste(hi, (-4, 4), hi)
        lay.paste(box, (win[0], win[1]))
    d.rectangle(win, outline=OUT, width=4)
    d.ellipse([18, 175, 50, 205], fill=(255, 250, 200), outline=OUT, width=3)
    d.rectangle([570, 180, 592, 215], fill=(255, 70, 50), outline=OUT, width=3)
    for wx in (130, 470):
        d.ellipse([wx - 55, 215, wx + 55, 325], fill=(25, 25, 28), outline=OUT, width=4)
        d.ellipse([wx - 25, 245, wx + 25, 295], fill=(180, 180, 190))
    if crumple:
        for side in (0, 1):
            x0 = 10 if side == 0 else 560
            for k in range(4):
                d.line([(x0 + k * 8, 150 + k * 25), (x0 + 22 - k * 6, 165 + k * 25)], fill=OUT, width=4)
    if s != 1.0: lay = lay.resize((int(w * s), int(h * s)), Image.BILINEAR)
    if tilt: lay = lay.rotate(tilt, expand=True, resample=Image.BICUBIC)
    im.paste(lay, (int(x - lay.width / 2), int(by - lay.height)), lay)

def stars(im, x, y, t, n=6, r=90):
    d = ImageDraw.Draw(im)
    for k in range(n):
        a = t * 4 + k * 2 * math.pi / n
        px, py = x + math.cos(a) * r, y + math.sin(a) * r * 0.4
        d.polygon([(px, py - 18), (px + 6, py - 6), (px + 18, py), (px + 6, py + 6), (px, py + 18), (px - 6, py + 6), (px - 18, py), (px - 6, py - 6)], fill=(255, 235, 90), outline=OUT)

def interior(im, name, kw, t, col=(60, 60, 70), phone=False, shake=0):
    # windshield view: traffic ahead, driver at wheel
    d = ImageDraw.Draw(im)
    put(im, name, 540, 1800, 1.25, shake=shake, **kw)
    d.rectangle([0, 1560, W, H], fill=col, outline=OUT, width=6)
    d.ellipse([300, 1450, 780, 1700], outline=(30, 30, 35), width=36)
    d.rectangle([0, 0, 70, H], fill=col); d.rectangle([W - 70, 0, W, H], fill=col)
    d.rectangle([0, 0, W, 80], fill=col)
    d.rectangle([420, 80, 660, 150], fill=(30, 30, 35), outline=OUT, width=3)
    if phone:
        d.rounded_rectangle([760, 1150, 880, 1380], radius=16, fill=(25, 25, 30), outline=OUT, width=4)
        d.rounded_rectangle([772, 1166, 868, 1364], radius=10, fill=(120, 200, 255))

def blink(t, seed): return 'closed' if (t + seed * 1.37) % 3.3 < 0.12 else 'open'

def subtitle(im, txt):
    d = ImageDraw.Draw(im); f = font(46)
    lines = wrap(txt, f, 960)
    y = H - 40 - len(lines) * 60
    lay = Image.new('RGBA', (W, len(lines) * 60 + 50), (0, 0, 0, 150)); im.paste(lay, (0, y - 55), lay)
    for k, ln in enumerate(lines):
        d.text((540, y + k * 60), ln, font=f, fill=(255, 255, 255), anchor='mm', stroke_width=7, stroke_fill=OUT)

LANE1, LANE2 = 1480, 1810
CARS = {  # name: (color, kind)
    'brayan': ((220, 40, 40), 'sedan'), 'kevin': ((60, 110, 200), 'sedan'), 'chuy': ((70, 160, 80), 'sedan'),
    'rigo': ((240, 200, 60), 'vocho'), 'itzel': ((150, 60, 170), 'sedan'), 'presi': ((30, 30, 35), 'suv'),
}

def crash_scene(im, t, which, lt):
    # wide street chain: front car(s) stopped, new car slides in from right and hits
    dur = CRASH_DUR
    d = ImageDraw.Draw(im)
    if which == 1:
        car(im, 360, LANE1, CARS['brayan'][0], driver='brayan', dkw=dict(eyes='wide' if lt > 0.7 else 'open'), crumple=lt > 0.7)
        x = 1300 - min(1, lt / 0.7) * 700
        car(im, x, LANE1, CARS['kevin'][0], driver='kevin', dkw=dict(eyes='closed', look=1), crumple=lt > 0.7)
    elif which == 2:
        car(im, 300, LANE1, CARS['brayan'][0], driver='brayan', dkw=dict(angry=True), crumple=True, s=0.8)
        car(im, 700, LANE1, CARS['kevin'][0], driver='kevin', dkw=dict(), crumple=True, s=0.8)
        car(im, 360, LANE2, CARS['chuy'][0], driver='chuy', dkw=dict(eyes='squeeze' if lt < 0.7 else 'wide', mouth=1 if lt < 0.7 else 2), crumple=lt > 0.7)
        x = 1300 - min(1, lt / 0.7) * 700
        car(im, x, LANE2, CARS['rigo'][0], kind='vocho', driver='rigo', dkw=dict(eyes='squeeze', mouth=1), crumple=lt > 0.7)
    else:
        for k, n in enumerate(['brayan', 'kevin', 'chuy', 'rigo']):
            car(im, 170 + k * 250, LANE1, CARS[n][0], kind=CARS[n][1], driver=n, dkw=dict(eyes='wide'), crumple=True, s=0.5)
        car(im, 360, LANE2, CARS['itzel'][0], driver='itzel', dkw=dict(eyes='squeeze' if lt < 0.7 else 'wide', mouth=1 if lt < 0.7 else 2), crumple=lt > 0.7)
        x = 1350 - min(1, lt / 0.7) * 700
        car(im, x, LANE2, CARS['presi'][0], kind='suv', driver='presi', dkw=dict(eyes='open'), crumple=lt > 0.7)
    if lt > 0.7:
        k = ease_back((lt - 0.7) / 0.25)
        cy = LANE1 - 200 if which == 1 else LANE2 - 200
        cx = 660
        r = 160 * k
        pts = [(cx + (r if j % 2 == 0 else r * 0.6) * math.cos(math.radians(j * 22.5)), cy + (r if j % 2 == 0 else r * 0.6) * math.sin(math.radians(j * 22.5))) for j in range(16)]
        if r > 5: d.polygon(pts, fill=(255, 220, 60), outline=OUT, width=6)
        pop_text(im, '¡PUM!', (cx, cy), t, 0, 110 * k + 1, (230, 40, 40))
        stars(im, cx - 200, cy - 120, t, 5, 70)

def frame(i):
    t = i / FPS; random.seed(i)
    if t < TITLE_DUR:
        im = AVENIDA.copy()
        for k, n in enumerate(['brayan', 'kevin', 'chuy', 'rigo']):
            car(im, 170 + k * 250 + math.sin(t * 2 + k) * 4, LANE1, CARS[n][0], kind=CARS[n][1], driver=n, dkw=dict(eyes='closed'), s=0.5)
        im = Image.blend(im, Image.new('RGB', im.size, (0, 0, 0)), 0.3)
        pop_text(im, 'LÓPEZ MATEOS', (540, 520), t, 0.2, 98, (255, 220, 60), rot=-4)
        pop_text(im, 'El que se ríe... ¡también choca!', (540, 660), t, 0.8, 52, (255, 255, 255))
        pop_text(im, 'Guadalajara, Jalisco', (540, 760), t, 1.3, 44, (200, 255, 200))
        return im
    if t >= END_START:
        lt = t - END_START
        im = AERIAL.copy()
        r = random.Random(1)
        for k in range(30):
            y = 1800 - k * 60
            car(im, 470 if k % 2 else 610, y, r.choice([(220, 40, 40), (60, 110, 200), (240, 200, 60), (70, 160, 80), (150, 60, 170)]), s=0.2, tilt=90 + r.randint(-15, 15))
        pop_text(im, 'López Mateos:', (540, 260), t, END_START + 0.2, 70, (255, 255, 255))
        pop_text(im, 'donde el que se ríe...', (540, 360), t, END_START + 0.5, 58, (255, 255, 255))
        pop_text(im, '¡también choca!', (540, 460), t, END_START + 0.9, 84, (255, 220, 60), rot=-4)
        if lt > END_DUR - 0.6: im = Image.blend(im, Image.new('RGB', im.size, (0, 0, 0)), min(1, (lt - (END_DUR - 0.6)) / 0.6))
        return im
    for (a, b, which) in CR:
        if a <= t < b:
            im = AVENIDA.copy(); crash_scene(im, t, which, t - a)
            if t - a > 0.7 and t - a < 1.1:
                dx, dy = random.randint(-22, 22), random.randint(-22, 22)
                im2 = Image.new('RGB', im.size, (0, 0, 0)); im2.paste(im, (dx, dy)); im = im2
            return im
    if FINAL_CRASH <= t < END_START:
        lt = t - FINAL_CRASH
        im = AVENIDA.copy()
        interior(im, 'brayan', dict(eyes='wide', mouth=2, angry=True), t, col=(170, 30, 30), shake=16 if lt < 0.6 else 4)
        pop_text(im, '¡PUM!', (540, 600), t, FINAL_CRASH, 160, (230, 40, 40), rot=-8)
        pop_text(im, '¡¡OTRA VEZ!!', (540, 800), t, FINAL_CRASH + 0.4, 90, (255, 220, 60), rot=5)
        stars(im, 540, 900, t, 6, 120)
        subtitle(im, '¡¡OTRA VEZ!!')
        return im
    li = 0
    for k, (a, b) in enumerate(T):
        if t >= a - 0.05: li = k
    sp, txt, shot = LINES[li]; a, b = T[li]; lt = t - a
    im = AVENIDA.copy()
    m = mouth_of(sp, t)
    if shot == 'b_close':
        interior(im, 'brayan', dict(eyes=blink(t, 1), mouth=m), t, col=(170, 30, 30), phone=True)
    elif shot == 'k_close':
        interior(im, 'kevin', dict(eyes='open', look=1, mouth=m), t, col=(40, 80, 160), phone=True)
        pop_text(im, '*escribiendo...*', (820, 1080), t, a + 0.4, 40, (255, 255, 255))
    elif shot == 'b_mad':
        im = burst_bg(t, (170, 20, 20), (210, 40, 30))
        interior(im, 'brayan', dict(eyes='open', mouth=m or 2, angry=True, tint='red'), t, col=(170, 30, 30), shake=10)
    elif shot == 'k_sorry':
        interior(im, 'kevin', dict(eyes='open', look=-1, mouth=m), t, col=(40, 80, 160), phone=True)
    elif shot == 'c_laugh':
        interior(im, 'chuy', dict(eyes='squeeze', mouth=m or 1), t, col=(40, 110, 50))
        pop_text(im, 'JAJAJA', (820, 700), t, a + 0.2, 80, (255, 255, 255), rot=8)
    elif shot == 'c_mad':
        im = burst_bg(t, (40, 110, 50), (60, 140, 70))
        interior(im, 'chuy', dict(eyes='open', mouth=m or 2, angry=True), t, col=(40, 110, 50), shake=8)
    elif shot == 'r_close':
        interior(im, 'rigo', dict(eyes=blink(t, 4), mouth=m), t, col=(220, 180, 40))
        pop_text(im, '*se le fue el pie*', (540, 600), t, a + 1.0, 48, (255, 255, 255))
    elif shot == 'i_laugh':
        interior(im, 'itzel', dict(eyes='squeeze', mouth=m or 1), t, col=(120, 40, 140))
        pop_text(im, 'JAJAJA', (820, 700), t, a + 0.2, 80, (255, 255, 255), rot=8)
    elif shot == 'p_close':
        interior(im, 'presi', dict(eyes='open', mouth=m or 3), t, col=(30, 30, 35))
        d = ImageDraw.Draw(im)
        for k, x in enumerate((140, 940)):
            put(im, 'maton', x, 1500, 0.5, shades=True, angry=True)
    elif shot == 'heli':
        im = AERIAL.copy()
        r = random.Random(1)
        for k in range(26):
            y = 1800 - k * 62
            car(im, 470 if k % 2 else 610, y, r.choice([(220, 40, 40), (60, 110, 200), (240, 200, 60), (70, 160, 80), (150, 60, 170)]), s=0.2, tilt=90 + r.randint(-15, 15))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([60, 150, 1020, 760], radius=30, fill=(240, 240, 245), outline=OUT, width=6)
        d.ellipse([100, 190, 980, 720], fill=(150, 210, 240), outline=OUT, width=5)
        put(im, 'buro', 540, 760, 0.62, eyes=blink(t, 2), mouth=m)
        rot = (t * 1500) % 360
        d.line([(540 - 500 * math.cos(math.radians(rot)), 120), (540 + 500 * math.cos(math.radians(rot)), 120)], fill=(40, 40, 45), width=14)
        d.rectangle([0, 790, W, 870], fill=(200, 30, 40)); d.text((540, 830), 'EN VIVO · TRÁFICO GDL', font=font(42), fill=(255, 255, 255), anchor='mm')
        pop_text(im, '40', (860, 1100), t, a + 1.5, 160, (255, 220, 60), rot=-8)
    elif shot == 'b_end':
        interior(im, 'brayan', dict(eyes='open', mouth=m or 3), t, col=(170, 30, 30))
    subtitle(im, txt)
    if 0 <= t - a < 0.07:
        im = Image.blend(im, Image.new('RGB', im.size, (255, 255, 255)), 0.5)
    return im

def audio():
    sr = 44100; n = int(sr * DUR)
    mus = np.zeros(n); sfx = np.zeros(n); vo = np.zeros(n)
    rng = np.random.default_rng(61)
    def note(f, dur, kind='saw', vib=0.0):
        tt = np.arange(int(sr * dur)) / sr
        ph = 2 * np.pi * f * tt + (vib * np.sin(2 * np.pi * 5.5 * tt) / 5.5 if vib else 0)
        if kind == 'saw': s = sum(np.sin(k * ph) / k for k in range(1, 9))
        elif kind == 'pluck': s = sum(np.sin(k * ph) * (0.6 ** k) for k in range(1, 6))
        else: s = np.sin(ph)
        return s * np.minimum(1, tt / 0.012)
    def add(buf, sig, t0, g):
        a = int(t0 * sr); b = min(n, a + len(sig))
        if 0 <= a < n: buf[a:b] += sig[:b - a] * g
    def dec(dur, rate): return np.exp(-np.arange(int(sr * dur)) / sr * rate)
    N = lambda m: 440 * 2 ** ((m - 69) / 12)
    # banda/tamborazo jalisciense feel
    D_, A7, G_ = [62, 66, 69], [57, 61, 64, 67], [55, 59, 62]
    prog = [D_, D_, A7, A7, D_, D_, G_, A7]
    mel = [[74, 78, 81, 78], [76, 74, 78, 74], [73, 76, 79, 76], [81, 79, 76, 73], [74, 78, 81, 86], [83, 81, 78, 74], [79, 83, 86, 83], [81, 79, 76, 73]]
    beat = 60 / 128
    for b in range(int(DUR / (4 * beat)) + 1):
        ch = prog[b % 8]
        for q in range(4):
            tq = (b * 4 + q) * beat
            add(mus, note(N((ch[0] if q % 2 == 0 else ch[2]) - 24), beat * .5, 'saw') * dec(beat * .5, 6), tq, 0.12)
            if q % 2 == 1:
                for mm in ch: add(mus, note(N(mm), beat * .3, 'saw') * dec(beat * .3, 12), tq, 0.02)
            add(mus, note(N(mel[b % 8][q]), beat * .9, 'saw', 3) * dec(beat * .9, 2), tq, 0.035)
            tt = np.arange(int(0.2 * sr)) / sr
            add(sfx, np.sin(2*np.pi*np.cumsum(140*np.exp(-tt*25) + 50)/sr) * np.exp(-tt*12), tq, 0.18 if q % 2 == 0 else 0.08)
    k_ = np.exp(-2 * np.pi * 3800 / sr); mus = lfilter([1 - k_], [1, -k_], mus)
    for i, a in enumerate(AUD): add(vo, a, T[i][0], 1.0)
    duck = np.convolve((np.abs(vo) > 0.02).astype(float), np.ones(4410) / 4410, mode='same')
    mus *= (1 - 0.7 * np.clip(duck * 3, 0, 1))
    def horn(t0, f1=420, f2=530, dur=0.5, g=0.12):
        tt = np.arange(int(dur * sr)) / sr
        add(sfx, (np.sign(np.sin(2*np.pi*f1*tt)) + np.sign(np.sin(2*np.pi*f2*tt))) * 0.3 * np.minimum(1, (dur - tt) * 10), t0, g)
    def screech(t0, dur=0.6):
        L_ = int(dur * sr); x = rng.standard_normal(L_); x = x - lfilter([0.08], [1, -0.92], x)
        tt = np.arange(L_) / sr
        add(sfx, (x * 0.4 + np.sin(2*np.pi*(2400 + 300*np.sin(2*np.pi*30*tt))*tt) * 0.5) * np.exp(-tt * 2), t0, 0.14)
    def crash(t0):
        L_ = int(1.0 * sr); tt = np.arange(L_) / sr
        x = rng.standard_normal(L_) * np.exp(-tt * 4)
        boom = np.sin(2*np.pi*np.cumsum(80*np.exp(-tt*5) + 35)/sr) * np.exp(-tt*5)
        glass = sum(np.sin(2*np.pi*f*tt) for f in (3100, 4200, 5300)) * np.exp(-tt*8) * 0.2
        add(sfx, x * 0.6 + boom + glass, t0, 0.8)
    def boing(t0, g=0.25):
        tt = np.arange(int(0.5 * sr)) / sr
        f = 180 + 120 * np.sin(2*np.pi*12*tt) * np.exp(-tt*4) + 250*tt
        add(sfx, np.sin(2*np.pi*np.cumsum(f)/sr) * np.exp(-tt*5), t0, g)
    def heli(t0, dur):
        tt = np.arange(int(dur * sr)) / sr
        x = lfilter([0.05], [1, -0.95], rng.standard_normal(len(tt))) * (0.5 + 0.5 * (np.sin(2*np.pi*14*tt) > 0.3))
        add(sfx, x * np.minimum(1, tt / 0.3) * np.minimum(1, (dur - tt) / 0.3), t0, 0.8)
    def ding(t0):
        tt = np.arange(int(0.3 * sr)) / sr; add(sfx, np.sin(2*np.pi*1800*tt) * np.exp(-tt*10), t0, 0.08)
    for k in range(6): horn(0.3 + k * 0.45, 400 + k * 30, 520 + k * 25, 0.3, 0.06)
    for (a, b, w) in CR:
        screech(a + 0.1); crash(a + 0.7); boing(a + 0.95)
    for i in range(len(LINES)):
        ding(T[i][0] - 0.05) if LINES[i][2] in ('k_close',) else None
    heli(T[9][0] - 0.3, T[9][1] - T[9][0] + 0.6)
    screech(FINAL_CRASH - 0.5); crash(FINAL_CRASH); boing(FINAL_CRASH + 0.3)
    out = mus * 0.9 + sfx + vo * 1.15
    out[-int(0.6*sr):] *= np.linspace(1, 0, int(0.6*sr))
    out = out / (np.abs(out).max() + 1e-9) * 0.92
    with wave.open('ep8_mix.wav', 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((out * 32767).astype(np.int16).tobytes())

if MODE == 'test':
    ts = [float(x) for x in sys.argv[2].split(',')]
    ims = [frame(int(tt * FPS)).resize((360, 640)) for tt in ts]
    sheet = Image.new('RGB', (360 * min(6, len(ims)), 640 * ((len(ims) + 5) // 6)))
    for k, im in enumerate(ims): sheet.paste(im, ((k % 6) * 360, (k // 6) * 640))
    sheet.save('sheet.jpg', quality=78)
    print('DUR', round(DUR, 2), 'T', [(round(a, 1), round(b, 1)) for a, b in T], 'CR', [(round(a, 1), w) for a, b, w in CR], 'FINAL', round(FINAL_CRASH, 1)); sys.exit()

audio()
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-i', 'ep8_mix.wav', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                      '-shortest', '-movflags', '+faststart', 'tmp_ep8.mp4'], stdin=subprocess.PIPE)
for i in range(NF):
    p.stdin.write(frame(i).convert('RGB').tobytes())
    if i % 300 == 0: print('frame', i, '/', NF, flush=True)
p.stdin.close(); p.wait()
if p.returncode == 0: os.replace('tmp_ep8.mp4', OUTNAME); print('DONE')

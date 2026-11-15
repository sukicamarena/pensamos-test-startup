import os, sys, math, random, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 60.0
NF = int(DUR * FPS)
D = sys.argv[1] if len(sys.argv) > 1 else '.'
MODE = sys.argv[2] if len(sys.argv) > 2 else 'full'
S = 2  # supersample for sprites

def font(sz, kind='bold'):
    for p in ['/usr/share/fonts/truetype/montserrat/Montserrat-ExtraBold.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(p) and (kind == 'bold' or 'DejaVu' in p):
            return ImageFont.truetype(p, sz)
    import glob
    c = glob.glob('/usr/share/fonts/**/Montserrat*ExtraBold*.ttf', recursive=True) + glob.glob('/usr/share/fonts/**/DejaVuSans-Bold.ttf', recursive=True)
    return ImageFont.truetype(c[0], sz)

OUT = (35, 22, 30)

CH = {
    'suki':   dict(skin=(214, 160, 120), shirt=(230, 51, 122), hair=(29, 26, 46), col=(230, 51, 122), col2=(255, 196, 61)),
    'carlos': dict(skin=(196, 134, 88), shirt=(46, 150, 98), hair=(45, 30, 22), col=(46, 150, 98), col2=(255, 220, 90)),
    'jp':     dict(skin=(226, 176, 135), shirt=(40, 120, 214), hair=(92, 56, 32), col=(40, 120, 214), col2=(255, 120, 60)),
    'chaba':  dict(skin=(180, 118, 76), shirt=(160, 97, 46), hair=(40, 40, 44), col=(200, 90, 40), col2=(255, 210, 120)),
}

def sc(v): return int(v * S)
def E(d, cx, cy, rx, ry, fill=None, w=5, outline=OUT):
    d.ellipse([sc(cx-rx), sc(cy-ry), sc(cx+rx), sc(cy+ry)], fill=fill, outline=outline if w else None, width=sc(w) if w else 0)
def R(d, x0, y0, x1, y1, r, fill, w=5):
    d.rounded_rectangle([sc(x0), sc(y0), sc(x1), sc(y1)], radius=sc(r), fill=fill, outline=OUT, width=sc(w))
def P(d, pts, fill, w=5):
    d.polygon([(sc(x), sc(y)) for x, y in pts], fill=fill, outline=OUT, width=sc(w))
def L(d, pts, fill=OUT, w=6):
    d.line([(sc(x), sc(y)) for x, y in pts], fill=fill, width=sc(w), joint='curve')
def A(d, box, a0, a1, fill=OUT, w=6):
    d.arc([sc(v) for v in box], a0, a1, fill=fill, width=sc(w))

def darker(c, f=0.8): return tuple(int(v*f) for v in c)

def papel_picado():
    im = Image.new('RGBA', (W + 200, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cols = [(230, 51, 122), (255, 196, 61), (46, 170, 220), (120, 210, 80), (255, 120, 40), (150, 80, 220)]
    d.line([(0, 30), (W + 200, 30)], fill=(60, 40, 40), width=4)
    for i in range(12):
        x = i * 110; c = cols[i % len(cols)]
        d.polygon([(x, 30), (x + 100, 30), (x + 100, 150), (x + 90, 165), (x + 75, 150), (x + 60, 165), (x + 45, 150), (x + 30, 165), (x + 15, 150), (x, 165)], fill=c)
        for (a, b) in [(30, 70), (70, 70), (50, 105), (30, 130), (70, 130)]:
            d.ellipse([x + a - 9, b - 9, x + a + 9, b + 9], fill=(0, 0, 0, 0))
        d.rectangle([x + 42, 50, x + 58, 60], fill=(0, 0, 0, 0))
    return im
PP = papel_picado()

def bg(t, c1, c2, cx=540, cy=1050, rows=2):
    im = Image.new('RGB', (W, H), c1); d = ImageDraw.Draw(im)
    rot = t * 12
    for i in range(18):
        a0 = math.radians(rot + i * 20); a1 = math.radians(rot + i * 20 + 10)
        d.polygon([(cx, cy), (cx + 2600*math.cos(a0), cy + 2600*math.sin(a0)), (cx + 2600*math.cos(a1), cy + 2600*math.sin(a1))], fill=c2)
    sw = int(math.sin(t * 2) * 30) - 100
    im.paste(PP, (sw, 0), PP)
    if rows > 1: im.paste(PP, (sw - 55, 120), PP)
    return im

def ease_back(x):
    x = max(0, min(1, x)); c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1)**3 + c1 * (x - 1)**2

def text_c(d, xy, s, f, fill=(255, 255, 255), stroke=8, sfill=OUT, anchor='mm'):
    d.text(xy, s, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill, anchor=anchor)

def wrap(s, f, maxw):
    words = s.split(); lines = []; cur = ''
    for w_ in words:
        tst = (cur + ' ' + w_).strip()
        if f.getlength(tst) <= maxw: cur = tst
        else: lines.append(cur); cur = w_
    if cur: lines.append(cur)
    return lines

def logo(im, cx, cy, sc_=1.0, t=0, drop=None):
    d = ImageDraw.Draw(im)
    f1 = font(int(132*sc_)); f2 = font(int(96*sc_)); f3 = font(int(110*sc_))
    lines = [('MIÉRCOLES', f1, (255, 196, 61), -1.15), ('DE INDUSTRIA', f2, (255, 255, 255), 0), ('con Suki', f3, (255, 90, 160), 1.1)]
    for i, (s, f, col, off) in enumerate(lines):
        y = cy + off * 115 * sc_
        if drop is not None:
            k = ease_back((drop - i * 0.35) / 0.5)
            if drop - i*0.35 <= 0: continue
            y = y - (1 - k) * 500
        text_c(d, (cx, y), s, f, col, stroke=int(12*sc_))


import sys
sys.argv = sys.argv[:1] + sys.argv[1:]
exec(open('/home/claude/eplib.py').read())
CH['taquero'] = dict(skin=(200, 140, 95), shirt=(245, 245, 240), hair=(30, 25, 25), col=(210, 40, 40), col2=(255, 255, 255))
CH['lupita'] = dict(skin=(210, 150, 110), shirt=(255, 130, 30), hair=(50, 30, 25), col=(255, 130, 30), col2=(255, 255, 255))
CH['paco'] = dict(skin=(190, 130, 85), shirt=(255, 130, 30), hair=(30, 25, 25), col=(255, 130, 30), col2=(255, 255, 255))
CH['tdc'] = dict(skin=(205, 150, 105), shirt=(120, 40, 150), hair=(30, 25, 25), col=(120, 40, 150), col2=(255, 210, 60))
CH['maton'] = dict(skin=(185, 130, 95), shirt=(25, 25, 30), hair=(25, 25, 30), col=(25, 25, 30), col2=(255, 255, 255))
CH['ricardo'] = dict(skin=(232, 188, 150), shirt=(255, 170, 200), hair=(70, 45, 30), col=(230, 90, 40), col2=(255, 255, 255))
CH['brayan'] = dict(skin=(200, 140, 95), shirt=(240, 240, 245), hair=(30, 25, 25), col=(220, 40, 40), col2=(255, 255, 255))
CH['kevin'] = dict(skin=(225, 180, 140), shirt=(60, 110, 200), hair=(60, 40, 25), col=(60, 110, 200), col2=(255, 255, 255))
CH['itzel'] = dict(skin=(195, 135, 95), shirt=(150, 60, 170), hair=(25, 20, 20), col=(150, 60, 170), col2=(255, 255, 255))
CH['chuy'] = dict(skin=(175, 120, 80), shirt=(70, 150, 80), hair=(30, 25, 25), col=(70, 150, 80), col2=(255, 255, 255))
CH['rigo'] = dict(skin=(190, 135, 95), shirt=(235, 225, 200), hair=(200, 200, 205), col=(120, 80, 40), col2=(255, 255, 255))
CH['presi'] = dict(skin=(215, 165, 120), shirt=(40, 40, 50), hair=(20, 20, 25), col=(40, 40, 50), col2=(255, 255, 255))
CH['buro'] = dict(skin=(215, 165, 125), shirt=(170, 120, 160), hair=(120, 70, 40), col=(170, 120, 160), col2=(255, 255, 255))
CH['sebas'] = dict(skin=(222, 172, 130), shirt=(70, 75, 85), hair=(40, 30, 25), col=(70, 75, 85), col2=(255, 255, 255))
from scipy.signal import lfilter

MODE = sys.argv[1] if len(sys.argv) > 1 else 'full'
LW = 3

# ===================== CHARACTERS (cut-out style) =====================
def cantarito_draw(d, cx, by, w, sc_=None):
    # w = jar width in unit coords; uses sc() scaling
    h = w * 1.05
    x0, x1 = cx - w / 2, cx + w / 2
    y0 = by - h
    d.rounded_rectangle([sc(x0), sc(y0 + h * 0.12), sc(x1), sc(by)], radius=sc(w * 0.38), fill=(222, 82, 38), outline=OUT, width=sc(3))
    d.rounded_rectangle([sc(cx - w * 0.36), sc(y0), sc(cx + w * 0.36), sc(y0 + h * 0.2)], radius=sc(w * 0.08), fill=(232, 95, 45), outline=OUT, width=sc(3))
    d.ellipse([sc(cx - w * 0.3), sc(y0 - h * 0.04), sc(cx + w * 0.3), sc(y0 + h * 0.07)], fill=(245, 235, 210), outline=OUT, width=sc(2))
    for k in range(5):
        fx = x0 + w * 0.15 + k * w * 0.175; fy = y0 + h * 0.3
        d.ellipse([sc(fx - w * 0.05), sc(fy - w * 0.05), sc(fx + w * 0.05), sc(fy + w * 0.05)], fill=(250, 225, 160))
        d.ellipse([sc(fx - w * 0.02), sc(fy - w * 0.02), sc(fx + w * 0.02), sc(fy + w * 0.02)], fill=(90, 150, 70))
    if w >= 60:
        d.text((sc(cx), sc(y0 + h * 0.58)), 'CANTADRINK', font=font(max(8, sc(w * 0.17))), fill=(250, 225, 160), anchor='mm')
        d.text((sc(cx), sc(y0 + h * 0.78)), 'CANTARITO', font=font(max(6, sc(w * 0.11))), fill=(250, 235, 200), anchor='mm')

def draw_char(name, eyes='open', mouth=0, tint=None, look=None, angry=False, nopot=False, emptypot=False, shades=False):
    c = CH[name]
    skin = {'red': (240, 90, 75), 'green': (150, 200, 90)}.get(tint, c['skin'])
    img = Image.new('RGBA', (600*S, 820*S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    hx, hy = 300, 345
    E(d, 235, 795, 62, 20, (30, 30, 34), LW); E(d, 365, 795, 62, 20, (30, 30, 34), LW)
    if name == 'chaba':
        E(d, 300, 660, 215, 150, c['shirt'], LW)
        for x in (180, 240, 300, 360, 420):
            L(d, [(x, 525 + abs(300-x)*0.25), (x, 795 - abs(300-x)*0.25)], darker(c['shirt'], .65), 3)
        for yy in (590, 730):
            d.rectangle([sc(92), sc(yy-10), sc(508), sc(yy+10)], fill=(80, 80, 88))
        E(d, 300, 660, 215, 150, None, LW)
    else:
        P(d, [(175, 500), (425, 500), (465, 790), (135, 790)], c['shirt'], LW)
        L(d, [(300, 520), (300, 785)], darker(c['shirt'], .7), 3)
        if name == 'carlos':
            pts1, pts2 = [], []
            for i in range(0, 31):
                y = 560 + i * 6.5
                xo = math.sin(i / 30 * 2 * math.pi * 1.25) * 38
                pts1.append((300 + xo, y)); pts2.append((300 - xo, y))
                if i % 4 == 0:
                    L(d, [(300 + xo, y), (300 - xo, y)], (255, 255, 255), 3)
            L(d, pts1, (255, 230, 90), 6); L(d, pts2, (255, 255, 255), 6)
        if name == 'jp':
            P(d, [(240, 500), (300, 555), (275, 500)], (245, 245, 245), LW)
            P(d, [(360, 500), (300, 555), (325, 500)], (245, 245, 245), LW)
        if name == 'brayan':
            d.text((sc(300), sc(650)), '10', font=font(sc(80)), fill=(220, 40, 40), anchor='mm')
        if name == 'kevin':
            P(d, [(250, 500), (300, 545), (350, 500)], (255, 255, 255), 2)
            P(d, [(290, 520), (310, 520), (316, 620), (300, 640), (284, 620)], (200, 30, 40), 2)
        if name == 'itzel':
            for k in range(4): E(d, 200 + k * 65, 700, 14, 14, (255, 220, 90), 0)
        if name == 'chuy':
            R(d, 220, 640, 380, 720, 20, darker(c['shirt'], .8), 3)
        if name == 'rigo':
            R(d, 190, 540, 410, 790, 20, (60, 110, 180), LW)
            L(d, [(190, 545), (250, 500)], (60, 110, 180), 8); L(d, [(410, 545), (350, 500)], (60, 110, 180), 8)
        if name == 'presi':
            P(d, [(255, 500), (345, 500), (300, 600)], (250, 250, 250), 2)
            P(d, [(292, 515), (308, 515), (314, 600), (300, 620), (286, 600)], (150, 20, 30), 2)
            for k, cc in enumerate([(0, 120, 70), (255, 255, 255), (200, 30, 40)]):
                L(d, [(180 + k * 22, 510), (390 + k * 22, 780)], cc, 20)
        if name == 'ricardo':
            P(d, [(240, 500), (300, 545), (270, 520)], (255, 255, 255), 2)
            P(d, [(360, 500), (300, 545), (330, 520)], (255, 255, 255), 2)
            for k in range(3): E(d, 300, 560 + k * 26, 6, 6, (255, 255, 255), 2)
            P(d, [(165, 505), (435, 505), (440, 545), (360, 560), (320, 610), (300, 600), (280, 610), (240, 560), (160, 545)], (140, 200, 240), 3)
            L(d, [(300, 600), (285, 690)], (140, 200, 240), 18); L(d, [(300, 600), (318, 680)], (140, 200, 240), 18)
            E(d, 300, 598, 18, 14, (120, 180, 225), 2)
        if name == 'tdc':
            for k in range(14):
                yy = 510 + k * 20
                E(d, 175 - k * 3, yy, 22, 22, (250, 245, 240), 2); E(d, 425 + k * 3, yy, 22, 22, (250, 245, 240), 2)
            for k in range(9):
                a = math.radians(15 + k * 18.75)
                E(d, 300 + 100 * math.cos(a), 520 + 95 * math.sin(a), 12, 12, (255, 205, 50), 2)
            E(d, 300, 650, 32, 32, (255, 205, 50), LW)
            d.text((sc(300), sc(652)), '$', font=font(sc(40)), fill=OUT, anchor='mm')
            P(d, [(380, 560), (395, 575), (380, 595), (365, 575)], (230, 30, 60), 2)
        if name == 'maton':
            P(d, [(255, 500), (345, 500), (300, 610)], (250, 250, 250), 2)
            P(d, [(292, 515), (308, 515), (314, 600), (300, 620), (286, 600)], (30, 30, 30), 2)
        if name in ('lupita', 'paco'):
            for yy in (600, 690):
                d.rectangle([sc(150), sc(yy), sc(450), sc(yy+22)], fill=(230, 235, 240))
        if name == 'taquero':
            R(d, 205, 560, 395, 785, 20, (210, 40, 40), LW)
            d.text((sc(300), sc(640)), 'ES UN', font=font(sc(34)), fill=(255, 255, 255), anchor='mm')
            d.text((sc(300), sc(690)), 'CRETINO', font=font(sc(34)), fill=(255, 255, 255), anchor='mm')
        if name == 'sebas':
            P(d, [(250, 500), (300, 560), (350, 500)], (50, 55, 62), LW)
            L(d, [(270, 520), (265, 600)], (240, 240, 240), 4); L(d, [(330, 520), (335, 600)], (240, 240, 240), 4)
        if name == 'suki':
            for i, cc in enumerate([(255, 196, 61), (60, 200, 220), (120, 220, 90)]):
                L(d, [(160, 690 + i*24), (440, 690 + i*24)], cc, 8)
    E(d, hx, hy, 205, 178, skin, LW)
    if name == 'suki':
        P(d, [(hx-185, hy-75), (hx-150, hy-185), (hx-95, hy-140), (hx-50, hy-215), (hx+5, hy-155), (hx+60, hy-220), (hx+100, hy-150), (hx+160, hy-190), (hx+190, hy-75)], c['hair'], LW)
        d.chord([sc(hx-195), sc(hy-178), sc(hx+195), sc(hy+20)], 180, 360, fill=c['hair'])
        d.chord([sc(hx-190), sc(hy-60), sc(hx+190), sc(hy+178)], 10, 170, fill=(95, 70, 60))
    elif name == 'carlos':
        E(d, hx, hy-120, 250, 38, (150, 98, 48), LW)
        R(d, hx-130, hy-260, hx+130, hy-115, 60, (138, 90, 43), LW)
        d.rectangle([sc(hx-128), sc(hy-155), sc(hx+128), sc(hy-128)], fill=(70, 40, 20))
    elif name == 'jp':
        d.chord([sc(hx-205), sc(hy-178), sc(hx+205), sc(hy+40)], 180, 360, fill=c['hair'], outline=OUT, width=sc(LW))
        E(d, hx+70, hy-150, 120, 45, c['hair'], LW)
    elif name == 'taquero':
        d.chord([sc(hx-190), sc(hy-200), sc(hx+190), sc(hy+40)], 180, 360, fill=(210, 40, 40), outline=OUT, width=sc(LW))
        E(d, hx+150, hy-85, 110, 26, (180, 30, 30), LW)
        d.text((sc(hx), sc(hy-130)), 'TACOS', font=font(sc(40)), fill=(255, 255, 255), anchor='mm')
    elif name == 'buro':
        E(d, hx, hy-200, 90, 70, c['hair'], LW)
        d.chord([sc(hx-205), sc(hy-180), sc(hx+205), sc(hy+20)], 180, 360, fill=c['hair'], outline=OUT, width=sc(LW))
        A(d, (hx-120, hy-70, hx-10, hy+40), 0, 360, (150, 60, 120), 6); A(d, (hx+10, hy-70, hx+120, hy+40), 0, 360, (150, 60, 120), 6)
        L(d, [(hx-10, hy-20), (hx+10, hy-20)], (150, 60, 120), 6)
    elif name == 'brayan':
        d.chord([sc(hx-195), sc(hy-190), sc(hx+195), sc(hy+20)], 180, 360, fill=(220, 40, 40), outline=OUT, width=sc(LW))
        E(d, hx-200, hy-80, 80, 22, (190, 30, 30), LW)
        d.text((sc(hx), sc(hy-120)), 'B', font=font(sc(60)), fill=(255, 255, 255), anchor='mm')
    elif name == 'kevin':
        d.chord([sc(hx-200), sc(hy-182), sc(hx+200), sc(hy-20)], 180, 360, fill=c['hair'], outline=OUT, width=sc(LW))
        for k in range(5):
            P(d, [(hx-150 + k*70, hy-150), (hx-120 + k*70, hy-215), (hx-90 + k*70, hy-150)], c['hair'], 2)
    elif name == 'itzel':
        E(d, hx-215, hy+60, 32, 110, c['hair'], LW); E(d, hx+215, hy+60, 32, 110, c['hair'], LW)
        E(d, hx-215, hy+165, 20, 14, (255, 80, 120), 2); E(d, hx+215, hy+165, 20, 14, (255, 80, 120), 2)
        d.chord([sc(hx-205), sc(hy-180), sc(hx+205), sc(hy+40)], 180, 360, fill=c['hair'], outline=OUT, width=sc(LW))
        L(d, [(hx, hy-178), (hx, hy-110)], (60, 50, 50), 3)
    elif name == 'chuy':
        d.chord([sc(hx-215), sc(hy-200), sc(hx+215), sc(hy+120)], 180, 360, fill=c['shirt'], outline=OUT, width=sc(LW))
        E(d, hx-200, hy+20, 26, 60, c['shirt'], LW); E(d, hx+200, hy+20, 26, 60, c['shirt'], LW)
    elif name == 'rigo':
        E(d, hx-170, hy-60, 40, 50, c['hair'], LW); E(d, hx+170, hy-60, 40, 50, c['hair'], LW)
        A(d, (hx-80, hy-210, hx+80, hy-150), 200, 340, (150, 150, 155), 4)
    elif name == 'presi':
        d.chord([sc(hx-200), sc(hy-180), sc(hx+200), sc(hy+10)], 180, 360, fill=c['hair'], outline=OUT, width=sc(LW))
        L(d, [(hx-140, hy-130), (hx+120, hy-160)], (90, 90, 100), 5)
    elif name == 'ricardo':
        d.chord([sc(hx-200), sc(hy-182), sc(hx+200), sc(hy+10)], 180, 360, fill=c['hair'], outline=OUT, width=sc(LW))
        E(d, hx-40, hy-170, 150, 50, c['hair'], LW)
        E(d, hx+60, hy-150, 110, 40, c['hair'], 0)
        L(d, [(hx-120, hy-150), (hx+40, hy-190)], (110, 75, 50), 4)
        if not shades:
            R(d, hx-150, hy-150, hx-20, hy-105, 20, (40, 50, 60), LW)
            R(d, hx+20, hy-150, hx+150, hy-105, 20, (40, 50, 60), LW)
            L(d, [(hx-20, hy-135), (hx+20, hy-135)], (200, 170, 60), 4)
    elif name == 'tdc':
        E(d, hx, hy-120, 280, 46, (120, 40, 150), LW)
        R(d, hx-140, hy-280, hx+140, hy-110, 60, (140, 50, 170), LW)
        d.rectangle([sc(hx-138), sc(hy-160), sc(hx+138), sc(hy-128)], fill=(255, 210, 60))
        E(d, hx+150, hy-250, 30, 110, (255, 230, 80), LW)
        L(d, [(hx+130, hy-150), (hx+170, hy-350)], (230, 180, 40), 4)
    elif name == 'maton':
        E(d, hx-205, hy+10, 18, 24, OUT, 0)
        L(d, [(hx-205, hy+30), (hx-215, hy+160)], (40, 40, 40), 3)
    elif name == 'lupita':
        E(d, hx+175, hy-60, 45, 110, c['hair'], LW)
        d.chord([sc(hx-200), sc(hy-178), sc(hx+200), sc(hy+30)], 180, 360, fill=c['hair'], outline=OUT, width=sc(LW))
        E(d, hx+190, hy-95, 18, 18, (255, 90, 140), LW)
    elif name == 'paco':
        d.chord([sc(hx-195), sc(hy-230), sc(hx+195), sc(hy+20)], 180, 360, fill=(255, 210, 40), outline=OUT, width=sc(LW))
        R(d, hx-225, hy-110, hx+225, hy-82, 12, (240, 190, 30), LW)
    elif name == 'sebas':
        d.chord([sc(hx-190), sc(hy-200), sc(hx+190), sc(hy+40)], 180, 360, fill=(25, 25, 30), outline=OUT, width=sc(LW))
        E(d, hx-170, hy-85, 90, 22, (25, 25, 30), LW)
        d.chord([sc(hx-185), sc(hy-40), sc(hx+185), sc(hy+176)], 15, 165, fill=(150, 115, 90))
    elif name == 'chaba':
        for x0 in (270, 300, 330):
            A(d, (x0-30, hy-215, x0+30, hy-165), 200, 340, OUT, 4)
        R(d, hx-200, hy-120, hx+200, hy-80, 16, (210, 40, 40), LW)
        for x0 in range(hx-170, hx+190, 40):
            E(d, x0, hy-100, 6, 6, (255, 255, 255), 0)
    # eyes
    for ex, side, which in ((hx-46, 1, 'L'), (hx+46, -1, 'R')):
        closed = eyes == 'closed' or (eyes == 'wink' and which == 'R') or (eyes == 'twitchL' and which == 'L')
        if eyes == 'squeeze':
            L(d, [(ex-40, hy-35), (ex+side*30, hy-10), (ex-40, hy+15)] if side == 1 else [(ex+40, hy-35), (ex-30, hy-10), (ex+40, hy+15)], OUT, 6)
        elif not closed:
            big = 1.15 if eyes == 'wide' else 1.0
            E(d, ex, hy-10, 50*big, 60*big, (255, 255, 255), LW)
            px = ex + (side*14 if look is None else look*18)
            E(d, px, hy-6, 9 if eyes != 'wide' else 6, 9 if eyes != 'wide' else 6, OUT, 0)
        else:
            E(d, ex, hy-10, 50, 60, skin, LW)
            L(d, [(ex-44, hy-8), (ex+44, hy-8)], OUT, 4)
    if shades and name == 'ricardo':
        for sx_ in (-1, 1):
            d.polygon([(sc(hx + sx_*2), sc(hy-80)), (sc(hx + sx_*160), sc(hy-84)), (sc(hx + sx_*146), sc(hy+32)), (sc(hx + sx_*70), sc(hy+60)), (sc(hx + sx_*2), sc(hy+34))], fill=(60, 110, 140), outline=(200, 170, 60), width=sc(4))
        L(d, [(hx-12, hy-60), (hx+12, hy-60)], (200, 170, 60), 6)
        L(d, [(hx-120, hy-50), (hx-80, hy-55)], (255, 255, 255), 6)
    elif shades:
        d.rounded_rectangle([sc(hx-158), sc(hy-80), sc(hx-2), sc(hy+56)], radius=sc(30), fill=(20, 20, 25), outline=OUT, width=sc(LW))
        d.rounded_rectangle([sc(hx+2), sc(hy-80), sc(hx+158), sc(hy+56)], radius=sc(30), fill=(20, 20, 25), outline=OUT, width=sc(LW))
        L(d, [(hx-8, hy-30), (hx+8, hy-30)], OUT, 8)
        L(d, [(hx-120, hy-35), (hx-80, hy-45)], (255, 255, 255), 6)
    if name == 'jp':
        A(d, (hx-110, hy-80, hx+4, hy+62), 0, 360, OUT, 7)
        A(d, (hx-4, hy-80, hx+110, hy+62), 0, 360, OUT, 7)
    bw = 7 if name in ('carlos', 'chaba') else 4
    if angry:
        L(d, [(hx-95, hy-100), (hx-15, hy-65)], OUT, bw + 3)
        L(d, [(hx+15, hy-65), (hx+95, hy-100)], OUT, bw + 3)
    else:
        L(d, [(hx-90, hy-82), (hx-20, hy-78)], OUT, bw)
        L(d, [(hx+20, hy-78), (hx+90, hy-82)], OUT, bw)
    if tint:
        cc = (255, 60, 50) if tint == 'red' else (110, 160, 60)
        E(d, hx-125, hy+55, 26, 14, cc, 0); E(d, hx+125, hy+55, 26, 14, cc, 0)
    my = hy + 95
    if name in ('carlos', 'chaba', 'taquero', 'rigo', 'presi'):
        big = 1.4 if name in ('chaba', 'rigo') else 1.0
        col = {'carlos': (35, 25, 20), 'rigo': (210, 210, 215), 'presi': (25, 20, 20)}.get(name, (60, 58, 62))
        E(d, hx-36*big, hy+68, 42*big, 15*big, col, 0); E(d, hx+36*big, hy+68, 42*big, 15*big, col, 0)
        my = hy + 100 + (10 if name == 'chaba' else 0)
    if mouth == 1:
        d.polygon([(sc(hx-48), sc(my-6)), (sc(hx+48), sc(my-6)), (sc(hx+38), sc(my+42)), (sc(hx-38), sc(my+42))], fill=(60, 15, 25), outline=OUT, width=sc(LW))
        E(d, hx, my+32, 22, 8, (220, 90, 110), 0)
    elif mouth == 2:  # huge scream
        E(d, hx, my+25, 62, 48, (60, 15, 25), LW)
        E(d, hx, my+52, 30, 12, (220, 90, 110), 0)
    elif mouth == 3:  # evil grin
        d.chord([sc(hx-70), sc(my-30), sc(hx+70), sc(my+40)], 0, 180, fill=(255, 255, 255), outline=OUT, width=sc(LW))
        for k in range(-3, 4):
            L(d, [(hx + k*18, my+5), (hx + k*18, my+30)], OUT, 2)
    elif mouth == 4:  # wavy sick
        L(d, [(hx-40, my+6), (hx-20, my-6), (hx, my+6), (hx+20, my-6), (hx+40, my+6)], OUT, 4)
    else:
        L(d, [(hx-34, my), (hx+34, my)], OUT, 4)
    # props
    if name == 'suki':
        R(d, 420, 520, 442, 615, 8, (40, 40, 48), LW)
        E(d, 431, 500, 28, 28, (170, 170, 185), LW)
        E(d, 431, 615, 34, 30, (250, 210, 60), LW)
        E(d, 140, 680, 34, 30, (250, 210, 60), LW)
    elif name == 'carlos':
        P(d, [(445, 560), (505, 560), (497, 640), (453, 640)], (250, 250, 255), LW)
        d.polygon([(sc(450), sc(585)), (sc(500), sc(585)), (sc(496), sc(637)), (sc(454), sc(637))], fill=(240, 180, 60))
        E(d, 475, 645, 36, 28, (60, 60, 64), LW)
        E(d, 140, 680, 34, 30, (60, 60, 64), LW)
    elif name == 'jp':
        d.chord([sc(390), sc(530), sc(540), sc(680)], 180, 360, fill=(242, 193, 78), outline=OUT, width=sc(LW))
        for k in range(5):
            E(d, 405 + k*30, 603 - (k % 2)*6, 13, 8, (90, 190, 70) if k % 2 else (220, 50, 40), 0)
        E(d, 465, 645, 34, 28, (200, 40, 40), LW)
        E(d, 135, 680, 34, 30, (200, 40, 40), LW)
    elif name == 'taquero':
        R(d, 470, 500, 490, 640, 6, (120, 120, 130), LW)
        R(d, 440, 450, 520, 510, 8, (180, 180, 190), LW)
        E(d, 480, 650, 34, 30, skin, LW); E(d, 120, 680, 34, 30, skin, LW)
    elif name == 'sebas':
        E(d, 120, 690, 34, 30, skin, LW); E(d, 480, 690, 34, 30, skin, LW)
    elif name == 'chuy':
        R(d, 430, 520, 520, 650, 10, (230, 50, 40), LW)
        d.text((sc(475), sc(585)), 'CHI', font=font(sc(26)), fill=(255, 230, 80), anchor='mm')
        E(d, 470, 655, 34, 28, skin, LW); E(d, 125, 690, 34, 30, skin, LW)
    elif name == 'buro':
        R(d, 420, 560, 520, 620, 8, (240, 240, 230), 3)
        E(d, 470, 650, 34, 28, skin, LW); E(d, 125, 690, 34, 30, skin, LW)
    elif name in ('brayan', 'kevin', 'itzel', 'rigo', 'presi'):
        E(d, 120, 690, 34, 30, skin, LW); E(d, 480, 690, 34, 30, skin, LW)
    elif name == 'ricardo':
        cantarito_draw(d, 470, 640, 74)
        E(d, 470, 655, 34, 28, skin, LW); E(d, 125, 690, 34, 30, skin, LW)
    elif name == 'tdc':
        R(d, 470, 470, 488, 790, 6, (30, 30, 35), LW)
        E(d, 479, 462, 26, 26, (255, 205, 50), LW)
        E(d, 479, 640, 34, 30, skin, LW); E(d, 120, 690, 34, 30, skin, LW)
        for k in range(3): E(d, 465 + k * 9, 615, 6, 6, (255, 205, 50), 0)
    elif name == 'maton':
        E(d, 110, 690, 40, 36, skin, LW); E(d, 490, 690, 40, 36, skin, LW)
    elif name == 'lupita':
        R(d, 400, 520, 500, 650, 10, (40, 40, 48), LW); R(d, 412, 534, 488, 636, 6, (120, 200, 255), 0)
        E(d, 450, 655, 32, 26, skin, LW); E(d, 125, 690, 34, 30, skin, LW)
    elif name == 'paco':
        E(d, 120, 690, 34, 30, (90, 90, 95), LW); E(d, 480, 690, 34, 30, (90, 90, 95), LW)
    elif name == 'chaba':
        if nopot:
            E(d, 110, 690, 34, 30, skin, LW); E(d, 490, 690, 34, 30, skin, LW)
        else:
            E(d, 300, 720, 160, 85, (192, 88, 45), LW)
            E(d, 300, 650, 146, 28, (150, 60, 30), LW)
            if emptypot:
                E(d, 300, 652, 124, 18, (60, 30, 20), 0)
                R(d, 270, 640, 330, 652, 6, (245, 240, 225), 2)
                E(d, 268, 646, 9, 9, (245, 240, 225), 2); E(d, 332, 646, 9, 9, (245, 240, 225), 2)
            else:
                E(d, 300, 652, 124, 18, (170, 40, 25), 0)
                for x0 in (250, 300, 350):
                    E(d, x0, 650, 10, 6, (240, 200, 90), 0)
            E(d, 135, 700, 34, 30, skin, LW); E(d, 465, 700, 34, 30, skin, LW)
    return img.resize((600, 820), Image.LANCZOS)

_SPR = {}
def spr(name, **kw):
    key = (name,) + tuple(sorted(kw.items()))
    if key not in _SPR:
        _SPR[key] = draw_char(name, **kw)
    return _SPR[key]

def put(im, name, cx, by, scale, dy=0, shake=0, pop=1.0, **kw):
    sp = spr(name, **kw)
    sw_, sh_ = int(600 * scale * pop), int(820 * scale * pop)
    sp = sp.resize((sw_, sh_), Image.BILINEAR)
    dx = random.uniform(-shake, shake); dyy = random.uniform(-shake, shake)
    im.paste(sp, (int(cx - sw_/2 + dx), int(by - sh_ + dy + dyy)), sp)
    return (cx, by - sh_ + (345 + 95) * scale * pop + dy)  # mouth pos

def head_pos(cx, by, scale):
    return (cx, by - 820*scale + 345*scale)

# ===================== BACKGROUNDS =====================
def cantina_bg():
    im = Image.new('RGB', (W, H), (236, 150, 70)); d = ImageDraw.Draw(im)
    for y in range(0, H, 6):
        k = y / H
        d.rectangle([0, y, W, y + 6], fill=(int(236 - 40*k), int(150 - 50*k), int(70 - 20*k)))
    # tiles stripe
    for x in range(0, W, 60):
        d.rectangle([x, 1180, x + 58, 1238], fill=(40, 120, 170) if (x // 60) % 2 else (245, 235, 210), outline=OUT, width=2)
    d.rectangle([0, 1240, W, H], fill=(150, 85, 40))
    for x in range(0, W, 90):
        d.line([(x, 1240), (x, H)], fill=(120, 65, 30), width=4)
    # window
    d.rounded_rectangle([90, 560, 420, 940], radius=160, fill=(120, 200, 240), outline=OUT, width=8)
    d.ellipse([280, 620, 360, 700], fill=(255, 220, 90))
    d.polygon([(90, 900), (200, 800), (300, 880), (420, 790), (420, 940), (90, 940)], fill=(90, 160, 120))
    d.line([(255, 560), (255, 940)], fill=OUT, width=6); d.line([(90, 760), (420, 760)], fill=OUT, width=6)
    # shelf with bottles
    d.rectangle([560, 760, 1020, 790], fill=(110, 60, 30), outline=OUT, width=4)
    d.rectangle([560, 980, 1020, 1010], fill=(110, 60, 30), outline=OUT, width=4)
    cols = [(240, 175, 60), (250, 250, 240), (180, 110, 40), (240, 200, 90), (200, 230, 240), (170, 90, 30)]
    for row, ybase in enumerate((760, 980)):
        for k in range(6):
            x = 600 + k * 70; c = cols[(k + row * 2) % 6]; h = 130 + (k * 17 % 40)
            d.rounded_rectangle([x - 22, ybase - h, x + 22, ybase], radius=10, fill=c, outline=OUT, width=3)
            d.rectangle([x - 8, ybase - h - 35, x + 8, ybase - h + 5], fill=c, outline=OUT, width=3)
            d.rectangle([x - 16, ybase - h*0.6, x + 16, ybase - h*0.3], fill=(255, 250, 235))
    # sign
    d.rounded_rectangle([600, 450, 1000, 640], radius=20, fill=(255, 245, 225), outline=OUT, width=6)
    text_c(d, (800, 510), 'CANTINA', font(56), (200, 50, 60), 0)
    text_c(d, (800, 585), 'LA INDUSTRIA', font(48), OUT, 0)
    im.paste(PP, (-60, 160), PP)
    im.paste(PP, (-120, 290), PP)
    return im
CANTINA = cantina_bg()

def burst_bg(t, c1, c2, cy=1000):
    im = Image.new('RGB', (W, H), c1); d = ImageDraw.Draw(im)
    rot = t * 30
    for i in range(18):
        a0 = math.radians(rot + i * 20); a1 = math.radians(rot + i * 20 + 10)
        d.polygon([(540, cy), (540 + 2600*math.cos(a0), cy + 2600*math.sin(a0)), (540 + 2600*math.cos(a1), cy + 2600*math.sin(a1))], fill=c2)
    return im

def table(im, y=1440, close=False):
    d = ImageDraw.Draw(im)
    d.rectangle([0, y, W, H], fill=(150, 90, 45), outline=OUT, width=6)
    for k, c in enumerate([(230, 51, 122), (255, 196, 61), (46, 170, 220), (120, 210, 80), (255, 120, 40)]):
        d.rectangle([0, y + 20 + k * 26, W, y + 20 + k * 26 + 18], fill=c)

def pot(im, cx, cy, level=1.0, s=1.0):
    d = ImageDraw.Draw(im)
    d.ellipse([cx - 120*s, cy - 70*s, cx + 120*s, cy + 80*s], fill=(192, 88, 45), outline=OUT, width=5)
    d.ellipse([cx - 110*s, cy - 90*s, cx + 110*s, cy - 50*s], fill=(150, 60, 30), outline=OUT, width=5)
    if level > 0.05:
        d.ellipse([cx - 95*s, cy - 84*s, cx + 95*s, cy - 56*s], fill=(170, 40, 25))
        for k in range(int(4 * level)):
            d.ellipse([cx - 60*s + k*35*s, cy - 76*s, cx - 45*s + k*35*s, cy - 66*s], fill=(240, 200, 90))
    else:
        d.ellipse([cx - 95*s, cy - 84*s, cx + 95*s, cy - 56*s], fill=(60, 30, 20))
    # steam
    if level > 0.05:
        for k in range(3):
            ph = (time_now * 0.8 + k / 3) % 1
            x = cx - 50*s + k * 50*s + math.sin(ph * 6) * 10; y = cy - 100*s - ph * 120*s
            r = (12 + ph * 20) * s
            d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255), width=4)

def bottle(im, cx, by, label, col, lcol=(255, 255, 255), skull=False, tilt=0):
    b = Image.new('RGBA', (200, 420), (0, 0, 0, 0)); d = ImageDraw.Draw(b)
    d.rounded_rectangle([40, 120, 160, 410], radius=26, fill=col, outline=OUT, width=6)
    d.rectangle([80, 20, 120, 130], fill=col, outline=OUT, width=6)
    d.rectangle([74, 0, 126, 30], fill=(60, 60, 60), outline=OUT, width=5)
    d.rounded_rectangle([50, 200, 150, 340], radius=10, fill=lcol, outline=OUT, width=4)
    if skull:
        d.ellipse([72, 218, 128, 270], fill=(255, 255, 255), outline=OUT, width=3)
        d.ellipse([84, 235, 97, 248], fill=OUT); d.ellipse([103, 235, 116, 248], fill=OUT)
        d.rectangle([88, 266, 112, 280], fill=(255, 255, 255), outline=OUT, width=2)
    f = font(22 if len(label) > 6 else 26)
    d.text((100, 312), label, font=f, fill=OUT, anchor='mm')
    if tilt:
        b = b.rotate(tilt, expand=True, resample=Image.BICUBIC)
    im.paste(b, (int(cx - b.width/2), int(by - b.height)), b)

def caballito(im, cx, by, fill=1.0, col=(240, 180, 60)):
    d = ImageDraw.Draw(im)
    d.polygon([(cx - 40, by - 100), (cx + 40, by - 100), (cx + 32, by), (cx - 32, by)], fill=(250, 250, 255), outline=OUT, width=4)
    top = by - 100 + (1 - fill) * 90
    if fill > 0:
        d.polygon([(cx - 37 + (1-fill)*7, top), (cx + 37 - (1-fill)*7, top), (cx + 31, by - 4), (cx - 31, by - 4)], fill=col)

# ===================== TEXT =====================
F_B = font(54)
def bubble(im, text, frac, tail, y0=280, x0=60, x1=1020, shout=False):
    d = ImageDraw.Draw(im)
    f = font(66) if shout else F_B
    lines = wrap(text, f, x1 - x0 - (220 if shout else 80))
    lh = int(f.size * 1.25)
    y1 = y0 + len(lines) * lh + 56
    fillc = (255, 255, 255)
    if shout:
        pts = []
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rx, ry = (x1 - x0) / 2 + 30, (y1 - y0) / 2 + 40
        for a in range(0, 360, 12):
            r = 1.0 if (a // 12) % 2 == 0 else 0.86
            pts.append((cx + rx * r * math.cos(math.radians(a)), cy + ry * r * math.sin(math.radians(a))))
        d.polygon(pts, fill=(255, 235, 90), outline=OUT, width=7)
    else:
        tx = max(x0 + 60, min(x1 - 60, tail[0]))
        d.polygon([(tx - 38, y1 - 4), (tx + 38, y1 - 4), tail], fill=fillc, outline=OUT, width=7)
        d.rounded_rectangle([x0, y0, x1, y1], radius=46, fill=fillc, outline=OUT, width=7)
        d.polygon([(tx - 32, y1 - 8), (tx + 32, y1 - 8), (tx + (tail[0] - tx) * 0.2, y1 + 18)], fill=fillc)
    n = int(len(text) * max(0, min(1, frac)))
    shown = 0
    for i, ln in enumerate(lines):
        part = ln[:max(0, n - shown)]; shown += len(ln) + 1
        if part:
            if shout:
                d.text(((x0 + x1) / 2, y0 + 28 + i * lh + lh / 2), ln, font=f, fill=(200, 30, 40), anchor='mm', stroke_width=3, stroke_fill=OUT)
            else:
                d.text((x0 + 36, y0 + 28 + i * lh), part, font=f, fill=OUT)

def caption(im, text, t, t0):
    d = ImageDraw.Draw(im)
    k = ease_back((t - t0) / 0.35)
    f = font(50)
    w_ = f.getlength(text) + 80
    x0 = 540 - w_ / 2; y = 120 - (1 - k) * 200
    d.rounded_rectangle([x0, y, x0 + w_, y + 90], radius=14, fill=(255, 220, 60), outline=OUT, width=6)
    d.text((540, y + 45), text, font=f, fill=OUT, anchor='mm')

def pop_text(im, text, xy, t, t0, size=90, col=(255, 230, 60), rot=0):
    k = ease_back((t - t0) / 0.3)
    if k <= 0.02: return
    f = font(max(10, int(size * k)))
    lay = Image.new('RGBA', (900, 300), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.text((450, 150), text, font=f, fill=col, stroke_width=max(2, int(9*k)), stroke_fill=OUT, anchor='mm')
    if rot: lay = lay.rotate(rot, resample=Image.BICUBIC)
    im.paste(lay, (int(xy[0] - 450), int(xy[1] - 150)), lay)


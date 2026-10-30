"""Draw the favicon, touch icon and social image of the Global Relational Model from the real network layout."""
import json, math
from PIL import Image, ImageDraw, ImageFont

import pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = str(ROOT / "site") + "/"
# Fonts (SIL Open Font License) from github.com/google/fonts, placed in fonts/
SERIF = str(ROOT / "fonts" / "Newsreader.ttf")
SANS = str(ROOT / "fonts" / "IBMPlexSans.ttf")
GRAPH = ROOT / "build" / "graph_export.json"
GRAPH.parent.mkdir(exist_ok=True)
subprocess.run(["node", "-e", f"""
const M=require('{ROOT}/src/model.js');const L=require('{ROOT}/data/layout.json');
const measured=[...new Set(M.MEASUREMENTS.map(m=>m.node))];
const rels=M.RELATIONS.map(r=>({{id:r.id,kind:r.kind,type:r.type,nodes:r.nodes,ch:r.ch}}));
require('fs').writeFileSync('{GRAPH}',JSON.stringify({{L,measured,rels,nodes:M.NODES.map(n=>({{id:n.id,ch:n.ch}}))}}));"""], check=True)

PAPER = (244, 243, 239)
CARD = (253, 252, 249)
INK = (31, 35, 38)
MUTED = (108, 116, 121)
LINE = (220, 217, 209)
REGION = (236, 234, 228)
KIND = {"identity": (123, 135, 144), "standard": (47, 104, 163), "zero": (106, 79, 163),
        "claim": (185, 98, 27), "failure": (178, 57, 47)}

data = json.load(open(GRAPH))
pos = data["L"]["positions"]
measured = set(data["measured"])
base = set(data["L"]["base"])


def font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight, min(72, size)] if "Newsreader" in path else [weight, 100])
        except Exception:
            pass
    return f


def draw_network(img, box, scale_nodes=1.0, show_regions=True):
    x0, y0, w, h = box
    W, H = data["L"]["W"], data["L"]["H"]
    s = min(w / W, h / H)
    ox, oy = x0 + (w - W * s) / 2, y0 + (h - H * s) / 2
    P = lambda p: (ox + p[0] * s, oy + p[1] * s)
    d = ImageDraw.Draw(img, "RGBA")
    if show_regions:
        for rg in data["L"]["regions"]:
            a = P((rg["x"], rg["y"])); b = P((rg["x"] + rg["w"], rg["y"] + rg["h"]))
            d.rounded_rectangle([a, b], radius=int(10 * s), fill=REGION + (255,))
    for r in data["rels"]:
        for nid in r["nodes"]:
            if nid in base:
                continue
            a, b = P(pos["r:" + r["id"]]), P(pos["q:" + nid])
            d.line([a, b], fill=KIND[r["kind"]] + (95,), width=max(1, int(1.4 * scale_nodes)))
    rn = 6.5 * s * scale_nodes
    for r in data["rels"]:
        cx, cy = P(pos["r:" + r["id"]])
        col = KIND[r["kind"]] + (255,)
        if r["type"] == "prod":
            d.polygon([(cx, cy - rn), (cx + rn, cy), (cx, cy + rn), (cx - rn, cy)], fill=col)
        elif r["type"] == "sum":
            d.ellipse([cx - rn * 0.9, cy - rn * 0.9, cx + rn * 0.9, cy + rn * 0.9], fill=col)
        else:
            pts = [(cx + rn * math.cos(math.pi / 6 + k * math.pi / 3), cy + rn * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
            d.polygon(pts, fill=col)
    qn = 8 * s * scale_nodes
    for n in data["nodes"]:
        cx, cy = P(pos["q:" + n["id"]])
        if n["id"] in measured:
            d.ellipse([cx - qn, cy - qn, cx + qn, cy + qn], fill=INK + (255,))
        else:
            d.ellipse([cx - qn, cy - qn, cx + qn, cy + qn], fill=CARD + (255,), outline=INK + (255,), width=max(1, int(1.6 * scale_nodes)))


def social_image():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([560, 40, 1160, 590], radius=16, fill=CARD, outline=LINE, width=2)
    draw_network(img, (580, 60, 560, 510), scale_nodes=1.15)
    d = ImageDraw.Draw(img)
    d.text((64, 70), "GRM · MISE EN RELATION DES OPPOSÉS", font=font(SANS, 20, 500), fill=MUTED)
    title = font(SERIF, 76, 500)
    d.text((60, 108), "Global", font=title, fill=INK)
    d.text((60, 186), "Relational", font=title, fill=INK)
    d.text((60, 264), "Model", font=title, fill=INK)
    sub = font(SERIF, 34, 400)
    d.text((64, 370), "Un essai de modèle de l'univers", font=sub, fill=KIND["claim"])
    d.text((64, 412), "fondé sur les relations.", font=sub, fill=KIND["claim"])
    small = font(SANS, 21, 400)
    d.text((64, 486), "140 grandeurs · 113 relations · chaque mesure", font=small, fill=INK)
    d.text((64, 516), "cachée puis retrouvée", font=small, fill=INK)
    d.text((64, 560), "grm.anthony-charretier.fr", font=font(SANS, 21, 500), fill=MUTED)
    img.save(OUT + "og-image.png", optimize=True)


def icon(size):
    """A small mark: two filled measured nodes and one computed node, tied by a claim diamond."""
    S = 512
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=112, fill=PAPER + (255,))
    c = (256, 262)
    nodes = [(128, 150), (388, 150), (256, 410)]
    for p in nodes:
        d.line([c, p], fill=KIND["claim"] + (255,), width=26)
    r = 62
    d.polygon([(c[0], c[1] - r), (c[0] + r, c[1]), (c[0], c[1] + r), (c[0] - r, c[1])], fill=KIND["claim"] + (255,))
    for i, (x, y) in enumerate(nodes):
        rr = 60
        if i < 2:
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=INK + (255,))
        else:
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=PAPER + (255,), outline=INK + (255,), width=24)
    return img.resize((size, size), Image.LANCZOS)


social_image()
big = icon(512)
big.save(OUT + "icon-512.png")
icon(180).convert("RGB").save(OUT + "apple-touch-icon.png")
icon(256).save(OUT + "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("images written")

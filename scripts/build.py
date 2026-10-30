"""Build site/index.html from src/ and data/ (one self-contained file, with SEO metadata)."""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, DATA, SITE_DIR = ROOT / "src", ROOT / "data", ROOT / "site"
SITE = "https://grm.anthony-charretier.fr/"


def svg_var_attributes_to_style(t):
    """Move fill/stroke var() attributes into style, for browsers that ignore var() in attributes."""
    def fix(m):
        tag, styles = m.group(0), []
        def grab(mm):
            styles.append(f"{mm.group(1)}:{mm.group(2)}")
            return ""
        tag2 = re.sub(r'\s(fill|stroke)="(var\([^)]+\))"', grab, tag)
        if styles:
            name = tag2[1:].split(" ")[0]
            tag2 = tag2.replace("<" + name, "<" + name + f' style="{";".join(styles)}"', 1)
        return tag2
    return re.sub(r"<(circle|rect|line|path|polygon)\b[^>]*>", fix, t)


def page():
    t = svg_var_attributes_to_style((SRC / "template.html").read_text())
    data = "const LAYOUT = " + (DATA / "layout.json").read_text() + ";\n"
    data += "const CARNET = " + (DATA / "carnet.json").read_text() + ";\n"
    data += (SRC / "carnet_map.js").read_text() + "\n" + (SRC / "sources.js").read_text()
    return (t.replace("/*MODEL*/", (SRC / "model.js").read_text())
             .replace("/*DATA*/", data)
             .replace("/*UI*/", (SRC / "ui.js").read_text()))


def standalone(body_page):
    i = body_page.index('<a class="skip"')
    head, body = body_page[:i], body_page[i:]
    head = "\n".join(l for l in head.split("\n")
                     if not l.startswith(('<meta name="description"', '<meta name="claude:', "<title>")))
    title = "Global Relational Model (GRM) : un modèle de l'univers fondé sur les relations"
    desc = ("Un essai de modèle de l'univers fondé sur les relations : 140 grandeurs de la physique reliées par 113 relations, "
            "du grain de Planck aux trous noirs. Chaque mesure est cachée puis retrouvée par le reste du réseau.")
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Global Relational Model (GRM)", "headline": title,
          "description": desc, "url": SITE, "inLanguage": "fr", "datePublished": "2026-10-30", "dateModified": "2026-10-30",
          "image": SITE + "og-image.png",
          "about": ["cosmologie", "physique théorique", "modèle relationnel", "constantes fondamentales", "trous noirs", "neutrinos"],
          "author": {"@type": "Person", "name": "Anthony Charretier", "url": "https://anthony-charretier.fr", "email": "mailto:anthony.charretier@etik.com"},
          "isPartOf": {"@type": "WebSite", "name": "Anthony Charretier", "url": "https://anthony-charretier.fr"}}
    seo = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="author" content="Anthony Charretier">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="keywords" content="Global Relational Model, GRM, modèle relationnel, univers, cosmologie, relations, paires d'opposés, 10^122, constante de Hubble, neutrinos, trous noirs, Anthony Charretier">
<link rel="canonical" href="{SITE}">
<meta name="theme-color" content="#f4f3ef" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15191c" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Global Relational Model">
<meta property="og:title" content="Global Relational Model (GRM)">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{SITE}">
<meta property="og:image" content="{SITE}og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Global Relational Model : la carte du réseau des relations, regroupées en neuf chapitres.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Global Relational Model (GRM)">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{SITE}og-image.png">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
"""
    return seo + head + "</head>\n<body>\n" + body + "\n</body>\n</html>\n"


if __name__ == "__main__":
    SITE_DIR.mkdir(exist_ok=True)
    (SITE_DIR / "index.html").write_text(standalone(page()))
    print("site/index.html written")

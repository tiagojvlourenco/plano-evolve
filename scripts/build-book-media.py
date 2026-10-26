#!/usr/bin/env python3
"""Gera as imagens dos exercícios do livro do estúdio (pasta exercises/) a partir do Excel «Livro de Exercícios».

Uso: python3 scripts/build-book-media.py LIVRO.xlsx   (precisa de Pillow)
Cada exercício tem as imagens por baixo do nome, na mesma coluna de blocos (B, H, N, T). Uma imagem dá um WebP estático; duas ou mais dão um WebP animado de 2 fotogramas
(as duas primeiras). Largura máxima de 360 px. O nome do ficheiro é slug(nome) em minúsculas com hífens, igual a slug() na app. Os exercícios que já tinham animação
(Free Exercise DB) não são tocados. Escreve também scripts/book-media.json com os nomes que ficaram com imagem (a app lê a lista de EXERCISE_BOOK, ver build-book-list).
"""
import sys, re, zipfile, html, json, io, os, unicodedata, collections
from PIL import Image

def slug(s):
    s = unicodedata.normalize("NFD", s.lower()); s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", s))
def colnum(c):
    n = 0
    for ch in c: n = n * 26 + ord(ch) - 64
    return n - 1
def fold(s): return re.sub(r"\s+", " ", "".join(c for c in unicodedata.normalize("NFD", s.lower()) if not unicodedata.combining(c))).strip()

xlsx, out_dir = sys.argv[1], os.path.join(os.path.dirname(__file__), "..", "exercises")
z = zipfile.ZipFile(xlsx)
wb = z.read("xl/workbook.xml").decode(); rels = z.read("xl/_rels/workbook.xml.rels").decode()
sheets = re.findall(r'<sheet name="([^"]+)" sheetId="\d+"[^>]*r:id="([^"]+)"', wb)
rmap = {re.search(r'Id="([^"]+)"', m.group(1)).group(1): re.search(r'Target="([^"]+)"', m.group(1)).group(1) for m in re.finditer(r"<Relationship ([^>]*)/>", rels)}
ss = [html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))) for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S)]
existing = set(f[:-5] for f in os.listdir(out_dir) if f.endswith(".webp"))
found = collections.OrderedDict()
for n, r in sheets:
    base = rmap[r].split("/")[-1]; d = z.read("xl/worksheets/" + base).decode(); names = []
    for cm in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', d, re.S):
        col, row, attrs, body = cm.groups()
        if not body or 't="s"' not in attrs: continue
        v = re.search(r"<v>(.*?)</v>", body)
        t = ss[int(v.group(1))].strip() if v else ""
        if t: names.append((colnum(col), int(row) - 1, re.sub(r"\s+", " ", t)))
    rr = z.read("xl/worksheets/_rels/%s.rels" % base).decode(); dr = re.search(r'Target="\.\./drawings/(drawing\d+\.xml)"', rr).group(1)
    dx = z.read("xl/drawings/" + dr).decode(); drel = z.read("xl/drawings/_rels/%s.rels" % dr).decode()
    em = {re.search(r'Id="([^"]+)"', m.group(1)).group(1): re.search(r'Target="\.\./media/([^"]+)"', m.group(1)).group(1) for m in re.finditer(r"<Relationship ([^>]*)/>", drel)}
    assign = collections.defaultdict(list)
    for a in re.finditer(r"<xdr:(?:two|one)CellAnchor.*?</xdr:(?:two|one)CellAnchor>", dx, re.S):
        t = a.group(0); fm = re.search(r"<xdr:from><xdr:col>(\d+)</xdr:col>.*?<xdr:row>(\d+)</xdr:row>", t, re.S); e = re.search(r'r:embed="([^"]+)"', t)
        if not (fm and e): continue
        c0, r0 = int(fm.group(1)), int(fm.group(2)); blk = (c0 - 1) // 6
        c = [x for x in names if (x[0] - 1) // 6 == blk and x[1] <= r0]
        if c: assign[max(c, key=lambda x: x[1])].append((r0, c0, em[e.group(1)]))
    for nm in names:
        k = fold(nm[2])
        if k in found or slug(nm[2]) in existing or not assign.get(nm): continue
        found[k] = (nm[2], [i for _, _, i in sorted(assign[nm])])

def fit(img, box=360):
    img = img.convert("RGB"); img.thumbnail((box, box), Image.LANCZOS); return img
written = 0; names_ok = []
for k, (name, imgs) in found.items():
    try:
        frames = [fit(Image.open(io.BytesIO(z.read("xl/media/" + i)))) for i in imgs[:2]]
        if len(frames) == 2:   # mesma tela para os dois fotogramas
            W, H = max(f.width for f in frames), max(f.height for f in frames); canvas = []
            for f in frames:
                c = Image.new("RGB", (W, H), f.getpixel((0, 0))); c.paste(f, ((W - f.width) // 2, (H - f.height) // 2)); canvas.append(c)
            canvas[0].save(os.path.join(out_dir, slug(name) + ".webp"), save_all=True, append_images=canvas[1:], duration=900, loop=0, quality=65, method=6)
        else:
            frames[0].save(os.path.join(out_dir, slug(name) + ".webp"), quality=70, method=6)
        written += 1; names_ok.append(name)
    except Exception as ex:
        print("falhou", name, ex)
json.dump(names_ok, open(os.path.join(os.path.dirname(__file__), "book-media.json"), "w"), ensure_ascii=False, indent=0)
print(written, "imagens escritas;", sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir)) // 1024, "KB na pasta")

"""Gera o site da Pousada Engenho do Vô.

    python build.py           -> atualiza as notícias e gera index.html
    python build.py --midia   -> também (re)gera fotos e logos em assets/

O site final é estático (index.html + assets/), pronto para o GitHub Pages.
"""
import argparse
import email.utils
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).parent
ASSETS = RAIZ / "assets"
CACHE_NOTICIAS = RAIZ / "dados" / "noticias.json"

# Originais (só usados com --midia)
PASTA_POUSADA = Path(r"C:\Users\Pichau\Documents\POUSADA ENGENHO DO VO")
FOTOS_ORIGINAIS = PASTA_POUSADA / "Editadas-20251103T211832Z-1-001" / "Editadas"
LOGO_ORIGINAL = PASTA_POUSADA / "LOGO ATUALIZADO.png"
REGIAO_ORIGINAIS = RAIZ / "fontes" / "regiao"

SITE = "https://www.pousadaengenhodovo.com.br"
WHATSAPP = "5535988773223"
ENDERECO = "Rua Artur Silva Bernardes, 14, Centro, Camanducaia - MG"
BOOKING = "https://www.booking.com/hotel/br/hostel-engenho-do-vo-camanducaia.pt-br.html"

# (número do arquivo original, nome no site, legenda, categoria)
FOTOS = [
    (13, "fachada", "Fachada da pousada, no centro de Camanducaia", "Pousada"),
    (15, "portal", "Bem na entrada da cidade, ao lado do portal", "Pousada"),
    (14, "varanda", "Varanda coberta com vista para a serra", "Pousada"),
    (8, "recepcao", "Recepção", "Pousada"),
    (9, "refeitorio", "Refeitório", "Áreas comuns"),
    (6, "copa", "Copa compartilhada: geladeira, micro-ondas e bebedouro", "Áreas comuns"),
    (7, "copa-detalhe", "Copa compartilhada", "Áreas comuns"),
    (4, "quarto-casal", "Quarto de casal", "Quartos"),
    (16, "quarto-casal-2", "Quarto de casal com banheiro", "Quartos"),
    (11, "quarto-familia", "Quarto com cama de casal e de solteiro", "Quartos"),
    (10, "quarto-beliche", "Quarto com beliche e banheiro", "Quartos"),
    (5, "quarto-beliche-2", "Quarto com beliche, cama de solteiro e TV", "Quartos"),
    (2, "quarto-duplo", "Quarto com duas camas de solteiro e TV", "Quartos"),
    (12, "quarto-duplo-2", "Quarto com duas camas de solteiro", "Quartos"),
    (3, "quarto-triplo", "Quarto com três camas de solteiro", "Quartos"),
    (17, "quarto-individual", "Quarto individual", "Quartos"),
    (18, "quarto-tv", "Quarto com TV e mesa de apoio", "Quartos"),
    (19, "banheiro", "Banheiro", "Quartos"),
]
FOTOS_HERO = ["fachada", "varanda", "quarto-casal-2", "portal"]

# (arquivo em fontes/regiao, nome, título, texto, crédito, licença, página)
REGIAO = [
    ("r5.jpg", "monte-verde", "Monte Verde", "Distrito de Camanducaia, a uns 30 km da pousada. Tem chalés, restaurantes de fondue, lojas de chocolate e muita araucária.",
     "Rafael Vianna Croffi", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Monte_Verde_-_MG_(31640041985).jpg"),
    ("r3.jpg", "pedra-redonda", "Pedra Redonda", "Trilha de mais ou menos uma hora, de nível moderado. Lá de cima se vê boa parte da serra.",
     "Rafael Vianna Croffi", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Pedra_Redonda_(31573907961).jpg"),
    ("r4.jpg", "pico-do-selado", "Pico do Selado", "Com 2.082 m, é o ponto mais alto da região.",
     "Igorh84", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Pico_do_Selado_-_Vista_01.jpg"),
    ("r6.jpg", "serra", "Serra da Mantiqueira", "Mata atlântica e araucárias. Nas manhãs frias, a neblina fica parada nos vales.",
     "Rafael Vianna Croffi", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Do_topo_da_Pedra_Redonda_(31712520681).jpg"),
    ("r1.jpg", "camanducaia", "Camanducaia", "A cidade da pousada, no Sul de Minas, à beira da Fernão Dias.",
     "Felipe Guimarães", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Camanducaia_(Minas_Gerais)_-_Panorama.jpg"),
    ("r2.jpg", "por-do-sol", "Pôr do sol", "Fim de tarde visto de Camanducaia.",
     "Felipe Guimarães", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:P%C3%B4r_do_Sol_em_Camanducaia_(10185821415).jpg"),
]

# Notas públicas (conferidas em 28/10/2026). Atualize à mão quando mudarem.
NOTAS = {
    "google": {"nota": 4.7, "max": 5, "total": 102, "rotulo": "estrelas no Google",
               "link": "https://www.google.com/maps?cid=5705025642227360171"},
    "booking": {"nota": 9.3, "max": 10, "total": 48, "rotulo": "Fantástico no Booking", "link": BOOKING + "#tab-reviews"},
}

# Trechos de avaliações reais, sem alterar o texto (… marca corte)
AVALIACOES = [
    ("Google", "Giovani A.", "Era tarde da noite, estava chovendo bastante e fazendo muito frio. Havíamos chegado de uma viagem "
     "longa e cansativa de São Paulo e procurávamos um lugar. O chuveiro e os quartos são tão bem aquecidos, que ficamos muito tranquilos."),
    ("Booking", "Uiliade", "Acomodação bem pertinho do centro, em frente ao portal da cidade! A hospitalidade da equipe é fora de série "
     "e nos deixaram muito a vontade!"),
    ("Google", "Samuel F.", "Os proprietários, pessoas agradáveis e de boa índole, interagem e contam histórias da cidade e o convívio "
     "fica ainda mais harmonioso."),
    ("Google", "Vanessa K.", "Fiquei na suíte 8 e estava tudo muito limpo e aconchegante. … A pousada fica muito bem localizada na entrada "
     "da cidade, de frente ao portal. Em breve vou voltar à Camanducaia e já sei onde ficar."),
    ("Booking", "Souza", "Ótima recepção, quartos aconchegantes, cama limpinha e organizada. Tudo preparado para o frio. Café da manhã caprichado."),
    ("Google", "Sebastian M.", "… uma excelente base para visitar Monte Verde. Muito central, barata e confortável."),
    ("Google", "Renan A.", "… café da manhã tudo fresquinho e feito na hora, pão de queijo, pão de sal tudo quentinho, preço justo."),
    ("Google", "Leonardo", "A Gislaine proprietária e seu filho o Nikolas são pessoas fantásticas que cuidam dos hóspedes como se fossem família …"),
    ("Booking", "Rosemeri", "A simpatia e acolhimento da proprietária. A localização. A limpeza."),
]

VIDEOS = [
    ("Z_5SYZI0c_Y", "Conheça Camanducaia (4K)", "CurioCidades"),
    ("x2fnsIbJ_vY", "Monte Verde visto de drone (4K)", "Fernando Franchi"),
    ("24_D0Bt7crE", "Camanducaia, um destino na Serra da Mantiqueira", "De fora em Juiz de Fora"),
]

# Notícias: só o que interessa ao turista (o feed traz política e crime também)
FEEDS = ['"Monte Verde" Camanducaia', '"Monte Verde" MG turismo', "Camanducaia"]
BLOQUEIO = re.compile(
    r"elei|vot[oa]|\bturno|candidat|prefeit[oa] eleit|bolsonaro|lula|morre|mort[oe]|tiro|políc|polic|crime|feminic|assassin|"
    r"pres[oa]\b|prisão|esquartej|assalt|vítima|desaparec|balead|facad|estupr|agress|golpe|fraude|acidente|tráfico|droga|roubo|furto|homic|velório|licitaç|concurso|imóve|venda|santa bárbara",
    re.IGNORECASE,
)


def noticia_ok(titulo):
    return bool(re.search(r"camanducaia|monte verde", titulo, re.I)) and not BLOQUEIO.search(titulo)


def buscar_noticias(limite=6):
    itens = {}
    for consulta in FEEDS:
        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode(
            {"q": consulta, "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"})
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (engenhodovo-site)"})
        with urllib.request.urlopen(req, timeout=20) as r:
            raiz = ET.fromstring(r.read())
        for it in raiz.iter("item"):
            titulo_completo = it.findtext("title", "")
            titulo, _, fonte = titulo_completo.rpartition(" - ")
            titulo = titulo or titulo_completo
            if not noticia_ok(titulo) or titulo in itens:
                continue
            data = email.utils.parsedate_to_datetime(it.findtext("pubDate"))
            itens[titulo] = {"titulo": titulo, "fonte": fonte or it.findtext("source", ""),
                             "link": it.findtext("link"), "data": data.isoformat()}
    return sorted(itens.values(), key=lambda n: n["data"], reverse=True)[:limite]


def carregar_noticias():
    try:
        noticias = buscar_noticias()
        if noticias:
            CACHE_NOTICIAS.parent.mkdir(exist_ok=True)
            CACHE_NOTICIAS.write_text(json.dumps(noticias, ensure_ascii=False, indent=1), encoding="utf-8")
            return noticias
    except Exception as e:  # sem internet: usa as últimas notícias salvas
        print(f"aviso: notícias não atualizadas ({e})", file=sys.stderr)
    return json.loads(CACHE_NOTICIAS.read_text(encoding="utf-8")) if CACHE_NOTICIAS.exists() else []


# ---------- mídia ----------

def gerar_midia():
    from PIL import Image, ImageOps

    def salvar(im, destino, largura, qualidade=78):
        im = im.copy()
        im.thumbnail((largura, largura * 2))
        im.save(destino, "WEBP", quality=qualidade, method=6)

    pasta = ASSETS / "fotos"
    pasta.mkdir(parents=True, exist_ok=True)
    originais = {int(p.stem.split("-")[-1]): p for p in FOTOS_ORIGINAIS.iterdir()}
    for num, nome, *_ in FOTOS:
        im = Image.open(originais[num])
        im.draft("RGB", (2400, 2400))
        im = ImageOps.exif_transpose(im).convert("RGB")
        salvar(im, pasta / f"{nome}-800.webp", 800)
        salvar(im, pasta / f"{nome}-1600.webp", 1600, 72)
        if nome == "fachada":  # imagem de compartilhamento (WhatsApp, Facebook)
            og = ImageOps.fit(im, (1200, 630))
            og.save(ASSETS / "og.jpg", quality=82)
        print("foto", nome)

    pasta = ASSETS / "regiao"
    pasta.mkdir(exist_ok=True)
    for arq, nome, *_ in REGIAO:
        salvar(Image.open(REGIAO_ORIGINAIS / arq).convert("RGB"), pasta / f"{nome}.webp", 1000)

    # Logo: fundo creme vira transparência, em duas cores (escuro e claro)
    pasta = ASSETS / "logo"
    pasta.mkdir(exist_ok=True)
    cinza = Image.open(LOGO_ORIGINAL).convert("L")
    # o creme do fundo tem ruído: abaixo de 50 vira transparente
    alfa = ImageOps.invert(cinza).point(lambda v: 0 if v < 50 else min(255, (v - 50) * 255 // 150))
    partes = {"logo": (0, 0, 1024, 1024), "emblema": (110, 55, 914, 562), "nome": (150, 565, 874, 965)}
    for cor, rgb in (("escuro", (31, 27, 22)), ("claro", (245, 239, 227))):
        cheio = Image.new("RGBA", cinza.size, rgb + (0,))
        cheio.putalpha(alfa)
        for parte, caixa in partes.items():
            recorte = cheio.crop(caixa)
            recorte.thumbnail((640, 640))
            recorte.save(pasta / f"{parte}-{cor}.webp", "WEBP", quality=90, method=6)
    fundo = Image.new("RGB", (512, 512), (245, 239, 227))
    emb = Image.open(pasta / "emblema-escuro.webp")
    emb.thumbnail((440, 440))
    fundo.paste(emb, ((512 - emb.width) // 2, (512 - emb.height) // 2), emb)
    fundo.resize((180, 180), Image.LANCZOS).save(pasta / "apple-touch-icon.png")
    fundo.resize((64, 64), Image.LANCZOS).save(pasta / "favicon.png")
    print("logos ok")


# ---------- HTML ----------

def e(texto):
    return html.escape(str(texto), quote=True)


def html_galeria():
    partes = []
    for i, (_, nome, legenda, cat) in enumerate(FOTOS):
        partes.append(
            f'<figure class="foto" data-cat="{e(cat)}"><button type="button" data-i="{i}" '
            f'data-full="assets/fotos/{nome}-1600.webp" aria-label="Ampliar: {e(legenda)}">'
            f'<img src="assets/fotos/{nome}-800.webp" alt="{e(legenda)}" loading="lazy" decoding="async" width="800" height="533">'
            f'</button><figcaption>{e(legenda)}</figcaption></figure>')
    return "\n".join(partes)


def html_hero():
    return "\n".join(
        f'<img src="assets/fotos/{n}-1600.webp" alt="" {"fetchpriority=high" if i == 0 else "loading=lazy"}>'
        for i, n in enumerate(FOTOS_HERO))


def html_regiao():
    return "\n".join(
        f'<article class="lugar reveal"><img src="assets/regiao/{nome}.webp" alt="{e(titulo)}" loading="lazy" decoding="async">'
        f'<div><h3>{e(titulo)}</h3><p>{e(texto)}</p>'
        f'<small>Foto: <a href="{e(pag)}" target="_blank" rel="noopener">{e(cred)}</a>, {e(lic)}</small></div></article>'
        for _, nome, titulo, texto, cred, lic, pag in REGIAO)


def html_videos():
    return "\n".join(
        f'<div class="video reveal"><button type="button" class="yt" data-id="{vid}" aria-label="Assistir: {e(t)}">'
        f'<img src="https://i.ytimg.com/vi/{vid}/hqdefault.jpg" alt="" loading="lazy"><span class="play" aria-hidden="true"></span></button>'
        f'<p><strong>{e(t)}</strong><br><small>{e(canal)} · YouTube</small></p></div>'
        for vid, t, canal in VIDEOS)


MESES = "jan fev mar abr mai jun jul ago set out nov dez".split()


def html_noticias(noticias):
    if not noticias:
        return '<p class="vazio">Sem notícias no momento.</p>'
    itens = []
    for n in noticias:
        d = datetime.fromisoformat(n["data"]).astimezone(timezone.utc)
        itens.append(
            f'<li class="reveal"><a href="{e(n["link"])}" target="_blank" rel="noopener">'
            f'<time datetime="{e(n["data"])}">{d.day} {MESES[d.month - 1]} {d.year}</time>'
            f'<span>{e(n["titulo"])}</span><small>{e(n["fonte"])}</small></a></li>')
    return "\n".join(itens)


def num(x):
    return f"{x:.1f}".replace(".", ",")


def html_notas():
    partes = []
    for fonte, n in NOTAS.items():
        pct = round(n["nota"] / n["max"] * 100)
        selo = (f'<span class="estrelas" style="--p:{pct}%" aria-hidden="true"></span>' if fonte == "google"
                else '<span class="selo-booking" aria-hidden="true">B.</span>')
        partes.append(
            f'<a class="nota nota-{fonte}" href="{e(n["link"])}" target="_blank" rel="noopener" '
            f'aria-label="{num(n["nota"])} de {n["max"]}, {n["rotulo"]}, {n["total"]} avaliações">'
            f'{selo}<b class="nota-valor" data-alvo="{n["nota"]}">{num(n["nota"])}</b>'
            f'<span class="nota-texto">{e(n["rotulo"])}<small>{n["total"]} avaliações</small></span></a>')
    return "\n".join(partes)


def html_avaliacoes():
    return "\n".join(
        f'<figure class="avaliacao reveal"><blockquote>{e(texto)}</blockquote>'
        f'<figcaption>{e(nome)} <span class="fonte fonte-{fonte.lower()}">{fonte}</span></figcaption></figure>'
        for fonte, nome, texto in AVALIACOES)


def gerar_html(noticias):
    hero_video = (ASSETS / "video" / "hero.mp4").exists()
    trocas = {
        "NOTAS": html_notas(),
        "AVALIACOES": html_avaliacoes(),
        "MAPA_ILUSTRADO": (ASSETS / "mapa.svg").read_text(encoding="utf-8"),
        "HERO_FOTOS": html_hero(),
        "HERO_VIDEO": '<video src="assets/video/hero.mp4" autoplay muted loop playsinline aria-hidden="true"></video>' if hero_video else "",
        "GALERIA": html_galeria(),
        "REGIAO": html_regiao(),
        "VIDEOS": html_videos(),
        "NOTICIAS": html_noticias(noticias),
        "WHATSAPP": WHATSAPP,
        "BOOKING": BOOKING,
        "ENDERECO": e(ENDERECO),
        "ENDERECO_URL": e(urllib.parse.quote(ENDERECO)),
        "MAPA": e("https://maps.google.com/maps?q=" + urllib.parse.quote(ENDERECO) + "&z=16&output=embed"),
        "ANO": str(datetime.now().year),
    }
    modelo = (RAIZ / "template.html").read_text(encoding="utf-8")
    saida = re.sub(r"\{\{(\w+)\}\}", lambda m: trocas[m.group(1)], modelo)
    (RAIZ / "index.html").write_text(saida, encoding="utf-8")
    (RAIZ / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{SITE}/</loc><lastmod>{datetime.now():%Y-%m-%d}</lastmod></url>\n'
        '</urlset>\n', encoding="utf-8")
    print(f"index.html e sitemap.xml gerados ({len(noticias)} notícias)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--midia", action="store_true", help="regera fotos e logos a partir dos originais")
    args = ap.parse_args()
    if args.midia:
        gerar_midia()
    gerar_html(carregar_noticias())

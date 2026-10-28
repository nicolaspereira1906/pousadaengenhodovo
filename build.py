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
    ("google/g92.jpg", "cafe-da-manha", "Café da manhã", "Áreas comuns"),
    ("google/g84.jpg", "jipe-portal", "O jipe na frente da pousada", "Pousada"),
]
FOTOS_HERO = ["fachada", "varanda", "quarto-casal-2", "portal"]

# Fotos antigas da fazenda do vô (PDF do iCloud, fontes/antigas). (arquivo, nome, legenda, preto e branco?)
ANTIGAS = [
    ("a04.jpg", "engenho-na-fazenda", "O engenho, ainda na fazenda", False),
    ("a00.jpg", "sede-da-fazenda", "A sede da fazenda", False),
    ("a01.jpg", "casa-da-fazenda", "A casa da fazenda", False),
    ("a02.jpg", "porta-da-casa", "Na porta da casa, agosto de 1980", False),
    ("a03.jpg", "a-cavalo-no-paiol", "A cavalo, em frente ao paiol", False),
    ("a05.jpg", "lida-com-o-gado", "Na lida com o gado, 1980", False),
    ("a06.jpg", "entre-araucarias", "A cavalo entre as araucárias, 1980", False),
    ("a07.jpg", "retrato-antigo", "Retrato antigo da família", True),
    ("a08.jpg", "na-fazenda-pb", "Na fazenda, em preto e branco", True),
]

# Fotos de turmas publicadas pela própria pousada no Google (conta JUAREZ B PEREIRA)
TURMAS = [
    ("g125.jpg", "turma-bikes", "Bicicletas guardadas na varanda"),
    ("g123.jpg", "turma-varanda", "Turma reunida na varanda"),
    ("g130.jpg", "turma-motos", "Grupo de motociclistas na saída"),
    ("g131.jpg", "turma-bagagem", "Bagagem de grupo na varanda"),
    ("g132.jpg", "turma-motos-2", "Motos guardadas na varanda"),
    ("g111.jpg", "turma-jipes", "Jipeiros chegando à noite"),
]

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
# Google: quantas avaliações de cada nota. Booking: notas por categoria.
ESTRELAS_GOOGLE = {5: 84, 4: 10, 3: 6, 2: 1, 1: 1}
CATEGORIAS_BOOKING = [("Funcionários", 9.9), ("Localização", 9.7), ("Custo-benefício", 9.6),
                      ("Limpeza", 9.5), ("Conforto", 9.4), ("Comodidades", 9.2)]

# Trechos de avaliações reais, sem alterar o texto (… marca corte); estrelas só onde o Google mostra a nota
AVALIACOES = [
    ("Google", "Giovani A.", 5, "Era tarde da noite, estava chovendo bastante e fazendo muito frio. Havíamos chegado de uma viagem "
     "longa e cansativa de São Paulo e procurávamos um lugar. O chuveiro e os quartos são tão bem aquecidos, que ficamos muito tranquilos."),
    ("Booking", "Uiliade", None, "Acomodação bem pertinho do centro, em frente ao portal da cidade! A hospitalidade da equipe é fora de série "
     "e nos deixaram muito a vontade!"),
    ("Google", "Samuel F.", 5, "Os proprietários, pessoas agradáveis e de boa índole, interagem e contam histórias da cidade e o convívio "
     "fica ainda mais harmonioso."),
    ("Google", "Vanessa K.", 5, "Fiquei na suíte 8 e estava tudo muito limpo e aconchegante. … A pousada fica muito bem localizada na entrada "
     "da cidade, de frente ao portal. Em breve vou voltar à Camanducaia e já sei onde ficar."),
    ("Booking", "Souza", None, "Ótima recepção, quartos aconchegantes, cama limpinha e organizada. Tudo preparado para o frio. Café da manhã caprichado."),
    ("Google", "Sebastian M.", 5, "… uma excelente base para visitar Monte Verde. Muito central, barata e confortável."),
    ("Google", "Renan A.", 4, "… café da manhã tudo fresquinho e feito na hora, pão de queijo, pão de sal tudo quentinho, preço justo."),
    ("Google", "Leonardo", 5, "A Gislaine proprietária e seu filho o Nikolas são pessoas fantásticas que cuidam dos hóspedes como se fossem família …"),
    ("Booking", "Rosemeri", None, "A simpatia e acolhimento da proprietária. A localização. A limpeza."),
]

FAQ = [
    ("Qual o horário de check-in e check-out?",
     "Entrada e saída ao meio-dia. A porta da rua fecha às 22h, e você recebe a chave na chegada para entrar e sair quando quiser."),
    ("O café da manhã está incluído?",
     "Nas suítes, sim. Nos quartos com banheiro compartilhado, o café da manhã custa R$ 20 por pessoa."),
    ("Tem estacionamento?",
     "Na frente da pousada há um pátio com vagas livres para carro. Bicicletas e motos podem ficar na varanda."),
    ("Qual a distância até Monte Verde?",
     "São 29 km pela serra, mais ou menos 55 minutos de carro. Também há ônibus saindo da praça do Banco Santander, no centro de Camanducaia."),
    ("Vocês recebem grupos e romarias?",
     "Sim. Temos quartos com beliche para romeiros, excursões, trilheiros e jipeiros. Combine as datas e o número de pessoas pelo WhatsApp."),
    ("Criança paga?",
     "Crianças até 5 anos não pagam. A partir dos 6 anos, pagam a diária."),
    ("Como faço a reserva?",
     "Escolha as datas no site e toque em Quero alugar!: a mensagem vai pronta para o nosso WhatsApp. Se preferir garantir com cartão de crédito, reserve pelo Booking.com."),
    ("Tem Wi-Fi?", "Sim, Wi-Fi grátis em toda a pousada."),
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

def restaurar(im, pb):
    """Tratamento leve de foto escaneada: corta a borda branca, tira o tom amarelado e acerta o contraste."""
    from PIL import Image, ImageFilter, ImageOps
    im = ImageOps.exif_transpose(im).convert("RGB")
    cinza = im.convert("L").filter(ImageFilter.MedianFilter(9))
    caixa = cinza.point(lambda v: 255 if v < 225 else 0).getbbox() or (0, 0, *im.size)
    w, h = caixa[2] - caixa[0], caixa[3] - caixa[1]
    m = int(min(w, h) * 0.03)  # some com os cantos arredondados do papel
    im = im.crop((caixa[0] + m, caixa[1] + m, caixa[2] - m, caixa[3] - m))
    if pb:
        im = ImageOps.colorize(ImageOps.autocontrast(im.convert("L"), cutoff=1), black="#241c14", white="#f6eedf")
    else:
        canais = [ImageOps.autocontrast(c, cutoff=1.5) for c in im.split()]
        corrigida = Image.merge("RGB", canais)
        im = Image.blend(im, corrigida, 0.7)  # 70%: corrige sem deixar com cara de filtro
    return im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=3))


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
        im = Image.open(originais[num] if isinstance(num, int) else RAIZ / "fontes" / num)
        im.draft("RGB", (2400, 2400))
        im = ImageOps.exif_transpose(im).convert("RGB")
        salvar(im, pasta / f"{nome}-800.webp", 800)
        salvar(im, pasta / f"{nome}-1600.webp", 1600, 72)
        if nome == "fachada":  # imagem de compartilhamento (WhatsApp, Facebook)
            og = ImageOps.fit(im, (1200, 630))
            og.save(ASSETS / "og.jpg", quality=82)
        print("foto", nome)

    pasta = ASSETS / "antigas"
    pasta.mkdir(exist_ok=True)
    for arq, nome, _, pb in ANTIGAS:
        salvar(restaurar(Image.open(RAIZ / "fontes" / "antigas" / arq), pb), pasta / f"{nome}.webp", 1000, 80)
        print("antiga", nome)

    pasta = ASSETS / "turmas"
    pasta.mkdir(exist_ok=True)
    for arq, nome, _ in TURMAS:
        im = ImageOps.exif_transpose(Image.open(RAIZ / "fontes" / "google" / arq)).convert("RGB")
        salvar(ImageOps.fit(im, (900, 1125)), pasta / f"{nome}.webp", 900)

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


def tamanho(caminho, padrao=(800, 533)):
    try:
        from PIL import Image
        with Image.open(caminho) as im:
            return im.size
    except Exception:  # sem Pillow (ex.: no GitHub Actions) usa a proporção padrão
        return padrao


def html_galeria():
    partes = []
    for i, (_, nome, legenda, cat) in enumerate(FOTOS):
        w, h = tamanho(ASSETS / "fotos" / f"{nome}-800.webp")
        partes.append(
            f'<figure class="foto" data-cat="{e(cat)}"><button type="button" data-i="{i}" '
            f'data-full="assets/fotos/{nome}-1600.webp" aria-label="Ampliar: {e(legenda)}">'
            f'<img src="assets/fotos/{nome}-800.webp" alt="{e(legenda)}" loading="lazy" decoding="async" width="{w}" height="{h}">'
            f'</button><figcaption>{e(legenda)}</figcaption></figure>')
    return "\n".join(partes)


def html_hero():
    return "\n".join(
        f'<img src="assets/fotos/{n}-1600.webp" srcset="assets/fotos/{n}-800.webp 800w, assets/fotos/{n}-1600.webp 1600w" '
        f'sizes="100vw" alt="" {"fetchpriority=high" if i == 0 else "loading=lazy"}>'
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
        f'<figcaption>{e(nome)} <span class="fonte fonte-{fonte.lower()}">{fonte}</span>'
        + (f'<span class="estrelinhas" aria-label="{n} de 5 estrelas">{"★" * n}{"☆" * (5 - n)}</span>' if n else "")
        + '</figcaption></figure>'
        for fonte, nome, n, texto in AVALIACOES)


def html_resumo_notas():
    g, total = NOTAS["google"], NOTAS["google"]["total"]
    barras = "".join(
        f'<li><span>{n} ★</span><i style="--p:{q / total:.0%}"></i><b>{q}</b></li>'
        for n, q in ESTRELAS_GOOGLE.items())
    cats = "".join(
        f'<li><span>{e(nome)}</span><i style="--p:{nota * 10:.0f}%"></i><b>{num(nota)}</b></li>'
        for nome, nota in CATEGORIAS_BOOKING)
    bons = ESTRELAS_GOOGLE[5] + ESTRELAS_GOOGLE[4]
    return (
        f'<div class="resumo-nota reveal"><p class="resumo-grande">{num(g["nota"])}<small>de 5</small></p>'
        f'<p><span class="estrelas" style="--p:{round(g["nota"] / 5 * 100)}%" aria-hidden="true"></span><br>'
        f'<b>{ESTRELAS_GOOGLE[5]} avaliações de 5 estrelas</b> no Google. {bons} das {total} têm 4 ou 5 estrelas.</p>'
        f'<ul class="barras">{barras}</ul></div>'
        f'<div class="resumo-nota reveal"><p class="resumo-grande">{num(NOTAS["booking"]["nota"])}<small>de 10</small></p>'
        f'<p><b>Fantástico no Booking.com</b>, em {NOTAS["booking"]["total"]} avaliações.</p>'
        f'<ul class="barras">{cats}</ul></div>')


def html_antigas():
    return "\n".join(
        f'<figure class="foto antiga"><button type="button" data-full="assets/antigas/{nome}.webp" aria-label="Ampliar: {e(legenda)}">'
        f'<img src="assets/antigas/{nome}.webp" alt="{e(legenda)}" loading="lazy" decoding="async" width="1000" height="1000">'
        f'</button><figcaption>{e(legenda)}</figcaption></figure>'
        for _, nome, legenda, _ in ANTIGAS)


def html_turmas():
    return "\n".join(
        f'<figure class="turma reveal"><img src="assets/turmas/{nome}.webp" alt="{e(legenda)}" loading="lazy" '
        f'decoding="async" width="900" height="1125"><figcaption>{e(legenda)}</figcaption></figure>'
        for _, nome, legenda in TURMAS)


def html_faq():
    return "\n".join(
        f'<details class="faq reveal"><summary>{e(p)}</summary><p>{e(r)}</p></details>' for p, r in FAQ)


def jsonld():
    fotos = [f"{SITE}/assets/fotos/{n}-1600.webp" for _, n, *_ in FOTOS[:8]]
    mapa = "https://www.google.com/maps?cid=5705025642227360171"
    pousada = {
        "@context": "https://schema.org", "@type": "Hostel", "@id": f"{SITE}/#pousada",
        "name": "Pousada Engenho do Vô", "url": f"{SITE}/", "image": [f"{SITE}/assets/og.jpg", *fotos],
        "logo": f"{SITE}/assets/logo/apple-touch-icon.png",
        "description": "Pousada no centro de Camanducaia (MG), na entrada da cidade e a 29 km de Monte Verde. "
                       "Suítes e quartos com banheiro compartilhado para casal, família, grupos e romarias.",
        "telephone": "+55 35 98877-3223", "checkinTime": "12:00", "checkoutTime": "12:00", "petsAllowed": False,
        "address": {"@type": "PostalAddress", "streetAddress": "Rua Artur Silva Bernardes, 14", "addressLocality": "Camanducaia",
                    "addressRegion": "MG", "postalCode": "37650-000", "addressCountry": "BR"},
        "geo": {"@type": "GeoCoordinates", "latitude": -22.7557, "longitude": -46.1484},
        "hasMap": mapa,
        "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": n, "value": True} for n in
                           ("Wi-Fi grátis", "Café da manhã", "Vagas para carro", "Chuveiro com aquecimento solar", "TV no quarto")],
        "containedInPlace": {"@type": "City", "name": "Camanducaia"},
        "sameAs": ["https://www.instagram.com/pousadaengenhodo.vo", "https://www.facebook.com/profile.php?id=100086007132862",
                   BOOKING, mapa],
    }
    faq = {"@context": "https://schema.org", "@type": "FAQPage",
           "mainEntity": [{"@type": "Question", "name": p, "acceptedAnswer": {"@type": "Answer", "text": r}} for p, r in FAQ]}
    # "</" não pode aparecer dentro de <script>
    return "\n".join(f'<script type="application/ld+json">{json.dumps(d, ensure_ascii=False).replace("</", "<\\/")}</script>'
                     for d in (pousada, faq))


def sitemap():
    imagens = "".join(f"<image:image><image:loc>{SITE}/assets/fotos/{n}-1600.webp</image:loc></image:image>"
                      for _, n, *_ in FOTOS)
    hoje = f"{datetime.now():%Y-%m-%d}"
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
            f'  <url><loc>{SITE}/</loc><lastmod>{hoje}</lastmod>{imagens}</url>\n'
            f'  <url><loc>{SITE}/politica-de-privacidade.html</loc></url>\n'
            '</urlset>\n')


def gerar_html(noticias):
    hero_video = (ASSETS / "video" / "hero.mp4").exists()
    trocas = {
        "NOTAS": html_notas(),
        "FAQ": html_faq(),
        "JSONLD": jsonld(),
        "AVALIACOES": html_avaliacoes(),
        "RESUMO_NOTAS": html_resumo_notas(),
        "TURMAS": html_turmas(),
        "ANTIGAS": html_antigas(),
        "ROMEIRO": (ASSETS / "romeiro.svg").read_text(encoding="utf-8"),
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
    (RAIZ / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    print(f"index.html e sitemap.xml gerados ({len(noticias)} notícias)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--midia", action="store_true", help="regera fotos e logos a partir dos originais")
    args = ap.parse_args()
    if args.midia:
        gerar_midia()
    gerar_html(carregar_noticias())

"""Gera planta-implantacao.svg (terreno trapezoidal com divisa maior reta).
Uso: python3 dados/planta.py  -> grava planta-implantacao.svg na pasta do projeto."""
from pathlib import Path

L, WF, WB = 68.0, 7.5, 4.0          # profundidade, frente (rua), fundo
C, CORE, PASS = 12.19, 3.5, 1.20    # container 40' HC, nucleo de escada, passarela
X_A = L - 4 * C - CORE              # predio encostado no fundo; frente livre para estacionamento
XC = X_A + 2 * C; XB = XC + CORE; XE = XB + 2 * C
w = lambda X: WF + (WB - WF) * X / L
fmt = lambda v: f"{v:.2f}".replace(".", ",")

S, mx, my = 16, 40, 78
P = lambda X, Z: (mx + X * S, my + Z * S)
H = my + 7.5 * S + 110
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {mx*2+L*S:.0f} {H:.0f}" font-family="Inter, Arial, sans-serif">',
     '<rect width="100%" height="100%" fill="#faf8f4"/>',
     '<defs><pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
     '<line x1="0" y1="0" x2="0" y2="6" stroke="#2b2f33" stroke-width="2"/></pattern></defs>',
     f'<text x="{mx}" y="28" font-size="18" font-weight="700" fill="#1d2226">Implantação: térreo (pavimentos 1 e 2 repetem os containers, com passarela de 1,20 m)</text>',
     f'<text x="{mx}" y="50" font-size="13" fill="#555">Escala gráfica aproximada · divisa maior (reta, 68 m) na parte de cima · frente para a rua à esquerda</text>']
pts = [P(0, 0), P(L, 0), P(L, WB), P(0, WF)]
o.append('<polygon points="%s" fill="#dfe9d2" stroke="#1d2226" stroke-width="2"/>' % ' '.join(f'{x},{y}' for x, y in pts))

def rect(X0, X1, Z0, Z1, fill, extra=''):
    x, y = P(X0, Z0)
    o.append(f'<rect x="{x}" y="{y}" width="{(X1-X0)*S}" height="{(Z1-Z0)*S}" fill="{fill}" stroke="#1d2226" stroke-width="1.2" {extra}/>')
def text(X, Z, t, size=12, fill="#1d2226", weight=600, anchor="middle"):
    x, y = P(X, Z)
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}">{t}</text>')

rect(0, X_A, .2, w(X_A) - .2, "#e7e1d4")
VAGA, X0 = 5.5, .8
for i, (z0, z1) in enumerate([(.2, 2.5), (5.0, 6.9)]):
    for k in range(2):
        rect(X0 + k * VAGA, X0 + (k + 1) * VAGA, z0, z1, "#d6d0c2")
        text(X0 + (k + .5) * VAGA, (z0 + z1) / 2 + .3, f"Vaga {i * 2 + k + 1}", 10, "#555", 500)
text(X0 + VAGA, 3.95, "Corredor de manobra 2,5 m", 10, "#6b5a3d", 500)
text(13.6, 6.2, "Motos", 9, "#555", 500)
rect(X_A, XE, 2.44, 2.44 + PASS, "#ece6d8", 'stroke-dasharray="4 3"')
for X in (X_A, X_A + C, XB, XB + C):
    rect(X, X + C, 0, 2.44, "#3b4045"); text(X + C / 2, 1.45, "Unidade tipo · 40' HC", 11, "#fff")
rect(XC, XB, 0, 2.44, "url(#h)"); text(XC + CORE / 2, -.35, "Escada", 11)
text((X_A + XE) / 2, 3.25, "Passarela 1,20 m (pav. 1 e 2) · caminho coberto no térreo", 10, "#6b5a3d")
text(30, 4.7, f"Jardim lateral (faixa livre de {fmt(w(X_A)-2.44)} m na frente a {fmt(w(XE)-2.44)} m nos fundos)", 11, "#3d5a2a")

yb = my + 7.5 * S + 44
o.append(f'<line x1="{mx}" y1="{yb}" x2="{mx+L*S}" y2="{yb}" stroke="#b5643c" stroke-width="1.2"/>')
for X in (0, L):
    o.append(f'<line x1="{mx+X*S}" y1="{yb-6}" x2="{mx+X*S}" y2="{yb+6}" stroke="#b5643c" stroke-width="1.5"/>')
o.append(f'<text x="{mx+L/2*S}" y="{yb+18}" font-size="13" fill="#b5643c" text-anchor="middle" font-weight="700">{fmt(L)} m</text>')
o.append(f'<text x="{mx}" y="{my-8}" font-size="12" fill="#b5643c" font-weight="700">Frente {fmt(WF)} m (rua)</text>')
o.append(f'<text x="{mx+L*S}" y="{my-8}" font-size="12" fill="#b5643c" text-anchor="end" font-weight="700">Fundo {fmt(WB)} m</text>')
for X in (X_A, XC, XB, XE):
    x = mx + X * S
    o.append(f'<line x1="{x}" y1="{P(X, w(X))[1]+3}" x2="{x}" y2="{yb-14}" stroke="#bbb" stroke-dasharray="2 2"/>')
    lab = f"{X:.1f}".replace(".", ",")
    o.append(f'<text x="{x}" y="{yb-18}" font-size="10" fill="#777" text-anchor="middle">{lab} m</text>')
o.append(f'<text x="{mx}" y="{H-14}" font-size="12" fill="#555">12 unidades (4 por pavimento x 3). Containers encostados na divisa maior, sem aberturas para o vizinho (CC art. 1.301); portas e janelas voltadas para o jardim lateral.</text>')
o.append('</svg>')
Path(__file__).resolve().parent.parent.joinpath('planta-implantacao.svg').write_text('\n'.join(o))

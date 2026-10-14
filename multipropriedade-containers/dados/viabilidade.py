"""Modelo simplificado de viabilidade: multipropriedade em containers (12 unidades).
Rode: python3 viabilidade.py  -> imprime premissas, custos e cenarios."""

# ---------- Terreno ----------
FRENTE, FUNDO, PROF = 4.0, 7.5, 68.0
AREA_TERRENO = (FRENTE + FUNDO) / 2 * PROF

# ---------- Produto ----------
C40_C, C40_L = 12.19, 2.44            # container 40' HC (externo)
UNID_POR_PAV, PAVS = 4, 3
UNIDADES = UNID_POR_PAV * PAVS
AREA_UNID = C40_C * C40_L             # area externa por unidade
COTAS_POR_UNID = 13                   # 13 cotas x 4 semanas = 52 semanas
COTAS = UNIDADES * COTAS_POR_UNID

PASSARELA = 1.20 * (2 * 2 * C40_C) * 2      # passarela 1,20 m nos 2 pavimentos superiores, 2 blocos
ESCADA = 3.5 * 2.44 * PAVS
AREA_CONSTR = UNIDADES * AREA_UNID + PASSARELA + ESCADA
PROJECAO = 2 * 2 * C40_C * C40_L + 3.5 * 2.44 + 1.20 * 2 * 2 * C40_C

# ---------- Custos (R$) ----------
custos = {
    "Containers 40' HC (12 un. x R$ 22 mil)": 12 * 22_000,
    "Conversao completa (estrutura, isolamento, instalacoes, acabamento) 12 x R$ 88 mil": 12 * 88_000,
    "Mobiliario e enxoval padrao hoteleiro 12 x R$ 25 mil": 12 * 25_000,
    "Fundacoes (blocos/estacas nos apoios)": 90_000,
    "Escada metalica central + passarelas + guarda-corpos e brises": 235_000,
    "Cobertura termoacustica, calhas e drenagem": 70_000,
    "Infraestrutura (agua, esgoto, entrada eletrica, SPDA, PPCI)": 120_000,
    "Area de lazer (deck, ofuro, fogo de chao, paisagismo)": 150_000,
    "Energia solar (~20 kWp)": 80_000,
    "Transporte e icamento (guindaste)": 60_000,
    "Projetos, aprovacoes, incorporacao, registro e juridico": 120_000,
}
subtotal = sum(custos.values())
CONTING = 0.10
custo_obra = subtotal * (1 + CONTING)
TERRENO = 250_000  # valor de oportunidade (premissa a validar)

# ---------- Deducoes sobre receita ----------
COMISSAO_MKT = 0.20   # vendas de multipropriedade sao intensivas em marketing
IMPOSTOS = 0.04       # RET com patrimonio de afetacao
DISTRATOS = 0.05      # inadimplencia/distratos
ADM_VENDAS = 0.02

def cenario(nome, preco, pct_vendido, fator_custo):
    vgv = COTAS * preco
    receita = vgv * pct_vendido
    liquida = receita * (1 - COMISSAO_MKT - IMPOSTOS - DISTRATOS - ADM_VENDAS)
    custo = custo_obra * fator_custo + TERRENO
    lucro = liquida - custo
    return dict(nome=nome, preco=preco, vgv=vgv, vendido=pct_vendido, receita=receita,
                liquida=liquida, custo=custo, lucro=lucro,
                margem=lucro / receita, roi=lucro / custo)

cenarios = [
    cenario("Pessimista", 29_900, 0.80, 1.15),
    cenario("Base", 36_900, 0.90, 1.00),
    cenario("Otimista", 44_900, 1.00, 0.95),
]

# Ponto de equilibrio (cenario base de custo, 100% vendido)
fator_liq = 1 - COMISSAO_MKT - IMPOSTOS - DISTRATOS - ADM_VENDAS
preco_be = (custo_obra + TERRENO) / (COTAS * fator_liq)
cotas_be = (custo_obra + TERRENO) / (36_900 * fator_liq)

# Alternativa: operar como pousada (sem vender)
DIARIA, OCUP, MARGEM_OP = 380, 0.55, 0.35
receita_pousada = UNIDADES * 365 * OCUP * DIARIA
lucro_pousada = receita_pousada * MARGEM_OP

# Receita recorrente da gestao (pousada como administradora)
TAXA_MANUT_COTA = 1_800
TAXA_ADM = 0.20
condominio = COTAS * TAXA_MANUT_COTA

def brl(v):
    return "R$ " + f"{v:,.0f}".replace(",", ".")

if __name__ == "__main__":
    print(f"Terreno: {AREA_TERRENO:.1f} m2 | Unidades: {UNIDADES} | Cotas: {COTAS}")
    print(f"Area por unidade: {AREA_UNID:.1f} m2 | Area construida: {AREA_CONSTR:.0f} m2")
    print(f"Projecao: {PROJECAO:.0f} m2 -> TO {PROJECAO/AREA_TERRENO:.0%} | CA {AREA_CONSTR/AREA_TERRENO:.2f}")
    for k, v in custos.items():
        print(f"  {brl(v):>14}  {k}")
    print(f"Subtotal {brl(subtotal)} | Contingencia {brl(subtotal*CONTING)} | Obra {brl(custo_obra)}"
          f" | por unidade {brl(custo_obra/UNIDADES)}")
    for c in cenarios:
        print(f"{c['nome']:<11} preco {brl(c['preco'])} VGV {brl(c['vgv'])} vendido {c['vendido']:.0%}"
              f" receita {brl(c['receita'])} liquida {brl(c['liquida'])} custo {brl(c['custo'])}"
              f" lucro {brl(c['lucro'])} margem {c['margem']:.1%} ROI {c['roi']:.1%}")
    print(f"Preco de equilibrio (100% vendido): {brl(preco_be)} | Cotas de equilibrio a R$ 36.900: {cotas_be:.0f} de {COTAS}")
    print(f"Pousada: receita {brl(receita_pousada)}/ano lucro {brl(lucro_pousada)}/ano payback {(custo_obra+TERRENO)/lucro_pousada:.1f} anos")
    print(f"Condominio multipropriedade: {brl(condominio)}/ano | taxa adm 20%: {brl(condominio*TAXA_ADM)}/ano")


# ---------- Sensibilidade: lucro (R$ mil) por preco x % vendido ----------
def sensibilidade():
    precos = [29_900, 34_900, 39_900, 44_900, 49_900]
    vendas = [0.70, 0.80, 0.90, 1.00]
    linhas = []
    for p in precos:
        linhas.append([p] + [round(cenario("", p, v, 1.0)["lucro"] / 1000) for v in vendas])
    return vendas, linhas

# ---------- Fluxo de caixa mensal (cenario base) ----------
def fluxo(preco=36_900, pct=0.90, entrada=0.20, parcelas=36, mes_ini_venda=3, meses_venda=24,
          obra_ini=3, obra_meses=10, horizonte=60):
    caixa, saldo, minimo, mes_min = [], 0.0, 0.0, 0
    cotas_mes = COTAS * pct / meses_venda
    custo_proj = custos["Projetos, aprovacoes, incorporacao, registro e juridico"]
    custo_resto = custo_obra - custo_proj
    for m in range(horizonte):
        ent = sai = 0.0
        if m < 3: sai += custo_proj / 3          # terreno ja pertence ao empreendedor (sem desembolso)
        if obra_ini <= m < obra_ini + obra_meses: sai += custo_resto / obra_meses
        for v in range(mes_ini_venda, min(m, mes_ini_venda + meses_venda - 1) + 1):
            if v >= mes_ini_venda + meses_venda: break
            valor = cotas_mes * preco
            if v == m:
                ent += valor * entrada
                sai += valor * COMISSAO_MKT       # comissao/marketing pagos na venda
            elif 0 < m - v <= parcelas:
                ent += valor * (1 - entrada) / parcelas
        sai += ent * (IMPOSTOS + DISTRATOS + ADM_VENDAS)
        saldo += ent - sai
        caixa.append(saldo)
        if saldo < minimo: minimo, mes_min = saldo, m
    payback = next((m for m in range(mes_min, horizonte) if caixa[m] >= 0), None)
    return minimo, mes_min, payback, caixa

if __name__ == "__main__":
    vendas, linhas = sensibilidade()
    print("Sensibilidade lucro (R$ mil):", vendas)
    for l in linhas: print(l)
    print("Preco p/ margem 20% a 90% vendido:", brl((custo_obra + TERRENO) / (COTAS * .9 * (fator_liq - .20))))
    mn, mm, pb, _ = fluxo()
    print(f"Fluxo base: exposicao maxima {brl(mn)} no mes {mm}; caixa volta a zero no mes {pb}")
    mn, mm, pb, _ = fluxo(entrada=0.30, parcelas=24)
    print(f"Fluxo 30% entrada + 24x: exposicao {brl(mn)} mes {mm}; zera mes {pb}")
    mn, mm, pb, _ = fluxo(obra_ini=8, mes_ini_venda=1)
    print(f"Fluxo vendas na planta antes da obra (obra inicia mes 8): exposicao {brl(mn)} mes {mm}; zera mes {pb}")

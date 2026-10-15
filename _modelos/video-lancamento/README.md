# Modelo: projeto de vídeo de lançamento 3D

Estrutura padrão replicada no início de todo novo projeto. Origem: `multipropriedade-containers/`.

## Criar um novo projeto

```bash
./_modelos/novo-projeto.sh nome-do-projeto
```

Isso copia este modelo para `nome-do-projeto/`, preenche o nome no briefing e instala as dependências do render (use `--sem-npm` para pular).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `BRIEFING.md` | Terreno, produto, números e roteiro de cenas. Preencher primeiro. |
| `README.md` | Estudo de viabilidade do projeto (substituir este texto). |
| `dados/viabilidade.py` | Modelo financeiro: premissas no topo, cenários, sensibilidade e fluxo de caixa. |
| `dados/planta.py` | Gera `planta-implantacao.svg` a partir das medidas do lote (frente, fundo, profundidade). |
| `modelo/apresentacao-3d.html` | Cena 3D (three.js) com linha do tempo, legendas e modo interativo. |
| `modelo/stills.mjs` | Gera quadros de prévia em `previas/` para revisar enquadramentos. |
| `modelo/render-video.mjs` | Renderiza o vídeo final (1080p, 30 fps) com Playwright + ffmpeg. |
| `previas/` | Quadros de revisão (não versionar em excesso). |
| `video/` | Vídeo final em MP4. |

## Fluxo de trabalho

1. Preencher `BRIEFING.md`.
2. Ajustar premissas em `dados/viabilidade.py` e rodar `python3 dados/viabilidade.py > dados/resultado.txt`.
3. Editar a geometria no topo de `modelo/apresentacao-3d.html` (medidas do lote, módulos, recuos) e os textos de legenda/KPIs.
4. `cd modelo && npm run previas` e revisar as imagens em `previas/`.
5. Corrigir câmera (array `keys`) e tempos até as prévias ficarem boas.
6. `npm run video` gera `video/apresentacao-3d.mp4` (≈ 35 min em 4 núcleos sem GPU).
7. Escrever o estudo no `README.md` do projeto com os números de `dados/resultado.txt`.

## Requisitos
- Node 18+, ffmpeg, Python 3.
- Chromium do Playwright (`npx playwright install chromium` se não houver).

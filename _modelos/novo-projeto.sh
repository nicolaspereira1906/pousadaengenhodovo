#!/usr/bin/env bash
# Replica o modelo de projeto de video de lancamento 3D para um novo projeto.
# Uso: ./_modelos/novo-projeto.sh <nome-do-projeto> [--sem-npm]
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
nome="${1:?Informe o nome do projeto. Ex.: ./_modelos/novo-projeto.sh chales-monte-verde}"
destino="$raiz/$nome"
[ -e "$destino" ] && { echo "Ja existe: $destino" >&2; exit 1; }

cp -r "$raiz/_modelos/video-lancamento" "$destino"
sed -i "s/{{PROJETO}}/$nome/g" "$destino/BRIEFING.md"
printf '# %s\n\nEstudo de viabilidade e video de lancamento. Comece pelo BRIEFING.md.\n' "$nome" > "$destino/README.md"

if [ "${2:-}" != "--sem-npm" ]; then
  (cd "$destino/modelo" && npm install --silent --no-audit --no-fund) || echo "Aviso: npm install falhou; rode depois em $destino/modelo"
fi
echo "Projeto criado em $destino"
echo "Proximo passo: preencher $nome/BRIEFING.md"

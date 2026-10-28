# Pousada Engenho do Vô

Site da pousada em Camanducaia, MG: <https://www.pousadaengenhodovo.com.br>

O visitante escolhe as datas no calendário e quantas pessoas vêm (adultos e crianças).
O botão **Quero alugar!** abre o WhatsApp (+55 35 98877-3223) com uma mensagem pronta com esses dados.
Para pagar com cartão, o link do Booking.com já vai com as datas e hóspedes preenchidos.

## Como funciona

- `template.html`: a página, com marcadores `{{...}}`.
- `build.py`: gera o `index.html`. Busca as notícias da região (Google Notícias, só turismo e eventos)
  e monta galeria, região e vídeos a partir das listas no começo do arquivo.
- `assets/`: CSS, JavaScript, fotos e logos já otimizados.
- `dados/noticias.json`: últimas notícias salvas (usado se a busca falhar).
- SEO: `build.py` também gera o `sitemap.xml`; `robots.txt` e `llms.txt` (resumo da pousada para IAs) são fixos.

## Comandos

```bash
python build.py            # atualiza notícias e gera index.html
python build.py --midia    # também refaz fotos e logos a partir dos originais (precisa de Pillow)
python -m http.server 8080 # ver em http://localhost:8080
python tests/test_build.py && node --test tests/reserva.test.mjs
```

Para trocar ou incluir uma foto: coloque o original na pasta de fotos editadas, adicione uma linha em `FOTOS`
no `build.py` e rode `python build.py --midia`.

O GitHub Actions (`.github/workflows/noticias.yml`) atualiza as notícias toda segunda-feira.

Fotos da região: Wikimedia Commons, com autor e licença no próprio site.

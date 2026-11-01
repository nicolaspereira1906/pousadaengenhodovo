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
python tests/test_build.py && node --test tests/reserva.test.mjs tests/gestao.test.mjs
```

Para trocar ou incluir uma foto: coloque o original na pasta de fotos editadas, adicione uma linha em `FOTOS`
no `build.py` e rode `python build.py --midia`.

O GitHub Actions (`.github/workflows/noticias.yml`) atualiza as notícias toda segunda-feira.

Fotos da região: Wikimedia Commons, com autor e licença no próprio site.

## Acesso privado (gestão de quartos)

Link "Acesso privado" no rodapé, abre `gestao/`: login e senha, depois o painel dos 9 quartos
(calendário, check-in/check-out, valor total e forma de pagamento). Tudo é gravado na planilha
Google "Hóspedes e Pagamentos".

- `gestao/`: a página (`index.html`, `gestao.css`, `gestao.js`), regras em `regras.js` (testadas em `tests/gestao.test.mjs`).
- `gestao/config.js`: endereço do Apps Script (termina em `/exec`).
- `apps-script/Codigo.gs`: código que roda na planilha. Valida usuário e senha e só então lê ou grava.
  O usuário e a senha ficam nas Propriedades do script (`USUARIO` e `SENHA`), nunca neste repositório.
- A página é pública, mas sem login ela não mostra nada: os dados só saem do Apps Script com sessão válida
  (6 horas, bloqueio de 15 min após 5 erros).
- Instalável como aplicativo: `gestao/manifest.webmanifest`, `gestao/sw.js` e `gestao/icones/`. Ao adicionar
  `/gestao/` à tela inicial do celular, o ícone abre direto no painel. Botão "Adicionar à tela inicial". O login pode ser salvo no gerenciador de senhas do aparelho.
  Ao mudar `gestao.js`, `gestao.css` ou `regras.js`, troque o número `?v=` em `gestao/index.html` e nos `import` de `gestao.js`.
- Dois acessos no mesmo login: administração (`USUARIO`/`SENHA`) e camareira (`USUARIO_CAMAREIRA`/`SENHA_CAMAREIRA`),
  todos nas Propriedades do script. A camareira só vê, de hoje, quarto livre/ocupado, hóspedes e café. O filtro é feito no
  `apps-script/Codigo.gs` (a resposta dela não traz valor, pagamento nem datas) e ela não consegue lançar nem alterar nada.
- Planilha, coluna H "Café" (Com café / Sem café), preenchida no cadastro da locação.

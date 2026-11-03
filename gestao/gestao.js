import { URL_SCRIPT } from "./config.js?v=28";
import { iso, deIso, br, brl, parseValor, mascaraValor, noites, estadiaEm, saidaEm, conflito, grade, agora, fmtCheckIn, fmtCheckOut, HORA_CHECKOUT, CAFES, rotuloCafe, rotuloCafeCamareira, cafeClasse, precisaLimpeza, RECEBIDOS, rotuloRecebido, recebidoClasse, rotuloPago, pagoClasse } from "./regras.js?v=28";

const QUARTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const PAGAMENTOS = ["PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito"];
const CHAVE_SESSAO = "pousada_sessao"; // vale 6 h; o servidor derruba a sessão depois disso
const CHAVE_PAPEL = "pousada_papel";

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mesNome = (a, m) => new Date(a, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const hoje = new Date();
const s = {
  token: localStorage.getItem(CHAVE_SESSAO) || "",
  papel: localStorage.getItem(CHAVE_PAPEL) || "admin", // admin ou camareira (quem decide é o servidor)
  regs: [],
  sel: iso(hoje), vy: hoje.getFullYear(), vm: hoje.getMonth(),
  quarto: null,
  form: { ci: "", co: "", hosp: 2, valor: "", pag: "", cafe: "", recebido: "" },
  picker: null, py: hoje.getFullYear(), pm: hoje.getMonth(),
  salvando: false,
  calAberto: false,
  aba: "quartos", // camareira: quartos | relatorio
  atualizadoEm: "",
  hoje: "", hora: "", // data e hora do servidor, vêm junto com a lista
  conf: null         // ação aguardando a segunda batida de confirmação ("limpar:3", "encerrar:3:2026-11-01")
};

// ---------- conexão com a planilha ----------
async function api(acao, dados = {}) {
  if (!URL_SCRIPT.startsWith("https://")) throw new Error("A conexão com a planilha ainda não foi configurada (gestao/config.js).");
  let resp;
  try {
    // text/plain evita a checagem prévia (preflight) que o Apps Script não responde
    resp = await fetch(URL_SCRIPT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ acao, token: s.token, ...dados })
    });
  } catch (e) {
    throw new Error("Sem conexão com a planilha. Verifique a internet e tente de novo.");
  }
  const r = await resp.json();
  if (!r.ok) {
    if (r.erro === "sessao") { sair(); throw new Error("Sessão expirada. Entre novamente."); }
    throw new Error(r.erro || "Erro ao falar com a planilha.");
  }
  return r;
}

async function carregar() {
  const r = await api("listar");
  s.papel = r.papel || "admin";
  localStorage.setItem(CHAVE_PAPEL, s.papel);
  // se o script do Google for antigo e não mandar "conta no café de hoje", quem já estava hospedado antes de hoje conta
  s.regs = r.registros.map((x) => (s.papel === "camareira" && x.situacao !== "limpeza" && x.cafeHoje === undefined
    ? { ...x, cafeHoje: x.cafe === "Com café" && !x.chegaHoje } : x));
  s.hoje = r.hoje || iso(new Date()); s.hora = r.hora || "";
  s.atualizadoEm = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (s.papel === "camareira") s.sel = r.hoje || iso(new Date()); // camareira só vê o dia de hoje
  aplicarPapel();
  render();
}

// Camareira: sem calendário, valores, pagamentos nem registros (e o servidor nem envia esses dados).
let tAtualiza;
function aplicarPapel() {
  const cam = s.papel === "camareira";
  document.body.dataset.papel = s.papel;
  $("titulo-app").textContent = cam ? "Quartos de hoje" : "Hóspedes e pagamentos";
  $("sub-app").textContent = cam
    ? deIso(s.sel).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Escolha o dia no calendário e toque em um quarto para registrar a locação.";
  const cam2 = cam;
  $("abas-cam").hidden = !cam2;
  $("corpo").hidden = cam2 && s.aba === "relatorio";
  $("relatorio-cam").hidden = !(cam2 && s.aba === "relatorio");
  document.querySelectorAll(".aba").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.a === s.aba)));
  clearInterval(tAtualiza);
  // a camareira não tem botão de atualizar: a tela se atualiza sozinha (e vira "pronto para limpeza" às 12:00)
  tAtualiza = setInterval(() => { if (s.token && !document.hidden) carregar().catch(() => {}); }, 60000);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && s.token) carregar().catch(() => {});
});
document.body.dataset.papel = s.papel;

// ---------- login ----------
// O app só aparece depois que os dados chegaram e o perfil (admin ou camareira) já foi aplicado:
// assim ninguém vê, nem por um instante, a tela do outro perfil.
function mostrarApp() {
  document.documentElement.classList.remove("tem-sessao");
  $("tela-login").hidden = true;
  $("tela-app").hidden = false;
}
function sair() {
  s.token = ""; s.regs = []; s.papel = "admin"; s.aba = "quartos";
  clearInterval(tAtualiza);
  localStorage.removeItem(CHAVE_PAPEL);
  document.body.dataset.papel = "";
  $("senha").value = "";
  // sair de propósito: o aparelho não deve entrar sozinho de novo até a próxima vez que tocar em Entrar
  if (navigator.credentials?.preventSilentAccess) navigator.credentials.preventSilentAccess().catch(() => {});
  localStorage.removeItem(CHAVE_SESSAO);
  $("tela-app").hidden = true;
  document.documentElement.classList.remove("tem-sessao");
  $("tela-login").hidden = false;
  fecharModal();
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btn-entrar"), erro = $("erro-login");
  erro.hidden = true; btn.disabled = true; btn.textContent = "Entrando...";
  try {
    s.token = "";
    const r = await api("login", { usuario: $("usuario").value, senha: $("senha").value });
    s.token = r.token;
    localStorage.setItem(CHAVE_SESSAO, r.token);
    await guardarSenha($("usuario").value, $("senha").value);
    await carregar();   // primeiro carrega e aplica o perfil...
    mostrarApp();       // ...só então mostra a tela
  } catch (err) {
    erro.textContent = err.message; erro.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "Entrar";
  }
});
$("btn-sair").addEventListener("click", sair);

// Gerenciador de senhas do celular/computador (Chrome, Android, Safari/iCloud): oferece salvar e preencher.
async function guardarSenha(id, senha) {
  if (!window.PasswordCredential || !navigator.credentials?.store) return;
  try { await navigator.credentials.store(new PasswordCredential({ id, password: senha, name: id })); } catch (e) { /* o navegador decide */ }
}
async function entrarComSalva() {
  if (s.token || !window.PasswordCredential || !navigator.credentials?.get) return;
  try {
    const c = await navigator.credentials.get({ password: true, mediation: "silent" });
    if (c && c.password) {
      $("usuario").value = c.id; $("senha").value = c.password;
      $("form-login").requestSubmit();
    }
  } catch (e) { /* sem credencial salva: o preenchimento automático do navegador cuida */ }
}

let tAviso;
function avisar(msg, ruim = false) {
  const el = $("aviso");
  el.textContent = msg; el.className = "aviso" + (ruim ? " ruim" : ""); el.hidden = false;
  clearTimeout(tAviso); tAviso = setTimeout(() => { el.hidden = true; }, 5000);
}

// ---------- tela principal ----------
function renderCalendario() {
  const hojeIso = iso(new Date());
  const tag = s.sel === hojeIso ? "Hoje" : s.sel > hojeIso ? "Data futura" : "Data anterior";
  const rotulo = deIso(s.sel).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dias = grade(s.vy, s.vm).map((c) => {
    if (!c) return "<span></span>";
    const cls = ["dia", c.chave === s.sel && "sel", c.chave === hojeIso && "hoje", s.regs.some((r) => r.data === c.chave) && "tem"].filter(Boolean).join(" ");
    return `<button class="${cls}" data-acao="dia" data-chave="${c.chave}" aria-pressed="${c.chave === s.sel}" aria-label="${c.n} de ${esc(mesNome(s.vy, s.vm).split(" ")[0])}${c.chave === hojeIso ? ", hoje" : ""}">${c.n}</button>`;
  }).join("");
  $("cal").classList.toggle("aberto", s.calAberto);
  $("cal").innerHTML = `
    <div class="cal-topo">
      <button class="seta dia-nav" data-acao="dia-mais" data-d="-1" aria-label="Dia anterior">&#8249;</button>
      <div class="cal-data"><span class="etq">${tag}</span><div class="dia-sel">${esc(rotulo)}</div></div>
      <button class="seta dia-nav" data-acao="dia-mais" data-d="1" aria-label="Próximo dia">&#8250;</button>
    </div>
    <div class="cal-acoes">
      <button class="btn-sec" data-acao="hoje">Ir para hoje</button>
      <button class="btn-sec cal-toggle" data-acao="cal-toggle" aria-expanded="${s.calAberto}">${s.calAberto ? "Fechar calendário" : "Abrir calendário"}</button>
    </div>
    <div class="cal-grade">
      <div class="mes-barra">
        <button class="seta" data-acao="mes" data-d="-1" aria-label="Mês anterior">&#8249;</button>
        <strong>${esc(mesNome(s.vy, s.vm))}</strong>
        <button class="seta" data-acao="mes" data-d="1" aria-label="Próximo mês">&#8250;</button>
      </div>
      <div class="sem"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
      <div class="dias">${dias}</div>
    </div>`;
}

// Admin: o quarto aparece "pronto para limpeza" quando se olha para hoje e há locação pendente com check-out passado
const limpezaPendenteAdmin = (q) => s.sel === s.hoje && s.regs.some((r) => r.quarto === q && precisaLimpeza(r.limpeza, r.checkIn, r.checkOut, s.hoje, s.hora, r.encerrado));

function renderQuartos() {
  let ocupados = 0, hospedados = 0;
  $("quartos").innerHTML = QUARTOS.map((q) => {
    const est = estadiaEm(s.regs, q, s.sel);
    const sai = saidaEm(s.regs, q, s.sel);
    const lp = limpezaPendenteAdmin(q);
    let cls = "quarto", selo = "Livre", seloCls = "selo", principal = "Disponível", sub = "Sem estadia", cta = "Registrar locação", extra = "";
    if (lp) {
      if (est) { ocupados++; hospedados += est.hospedes; }
      cls += " limpeza"; selo = "Limpeza"; seloCls += " limpeza"; principal = "Pronto para limpeza";
      sub = est ? `Novo hóspede hoje · ${est.hospedes} ${est.hospedes === 1 ? "hóspede" : "hóspedes"}` : "Check-out concluído";
      cta = "Marcar como limpo";
    } else if (est) {
      ocupados++; hospedados += est.hospedes;
      cls += " ocupado"; selo = "Ocupado"; seloCls += " ocupado";
      extra = `<div class="sub"><span class="chip ${recebidoClasse(est.recebido)}">${esc(rotuloRecebido(est.recebido))}</span></div>`;
      principal = "Até " + br(est.checkOut).slice(0, 5) + " " + HORA_CHECKOUT;
      sub = `${est.hospedes} ${est.hospedes === 1 ? "hóspede" : "hóspedes"} · ${brl(est.valor)}`;
      cta = "Ver estadia";
    } else if (sai && !(s.sel === s.hoje && s.hora >= HORA_CHECKOUT)) { // depois do meio-dia o quarto já foi liberado
      selo = "Saída hoje"; seloCls += " saida";
      sub = `Check-out até ${HORA_CHECKOUT} · ${sai.hospedes} ${sai.hospedes === 1 ? "hóspede" : "hóspedes"}`;
    }
    return `<button class="${cls}" data-acao="quarto" data-q="${q}" aria-label="Abrir quarto ${q}, ${selo.toLowerCase()}">
      <div class="linha"><span class="nome">Quarto ${q}</span><span class="${seloCls}">${selo}</span></div>
      <div><div class="principal">${esc(principal)}</div><div class="sub">${esc(sub)}</div>${extra}</div>
      <span class="cta">${cta} &rarr;</span></button>`;
  }).join("");

  const doDia = s.regs.filter((r) => r.data === s.sel);
  $("r-total").textContent = brl(doDia.reduce((a, r) => a + r.valor, 0));
  $("r-ocupados").textContent = `${ocupados} de ${QUARTOS.length}`;
  $("r-hospedados").textContent = hospedados;

  $("reg-titulo").textContent = "Registros de " + br(s.sel);
  $("reg-corpo").innerHTML = doDia.length === 0
    ? '<p class="muda">Nenhum registro neste dia. Clique em um quarto para começar.</p>'
    : `<div class="tabela-caixa"><table><thead><tr><th>Quarto</th><th>Check-in</th><th>Check-out</th><th>Hóspedes</th><th>Valor total</th><th>Pagamento</th><th>Café</th><th>Recebido</th></tr></thead><tbody>${
      doDia.slice().reverse().map((r) => `<tr><td data-l="Quarto"><strong>Quarto ${r.quarto}</strong></td><td data-l="Check-in">${esc(fmtCheckIn(r))}</td><td data-l="Check-out">${esc(fmtCheckOut(r))}</td><td data-l="Hóspedes">${r.hospedes}</td><td data-l="Valor total"><strong>${brl(r.valor)}</strong></td><td data-l="Pagamento">${esc(r.pagamento)}</td><td data-l="Café">${esc(rotuloCafe(r.cafe))}</td><td data-l="Recebido">${esc(rotuloRecebido(r.recebido))}</td></tr>`).join("")
    }</tbody></table></div>`;
}

// Estado de um quarto para a camareira, a partir do que o servidor enviou (só hoje, sem valores)
//  limpeza: check-out de hoje já passou do meio-dia | saindo: check-out hoje, ainda antes das 12:00
function estadoQuarto(q) {
  const dele = s.regs.filter((r) => r.quarto === q);
  const estadia = dele.find((r) => r.situacao === "ocupado");
  const saindo = dele.find((r) => r.situacao === "saindo");
  const limpeza = dele.some((r) => r.situacao === "limpeza");
  const noQuarto = saindo || estadia; // quem está (ou está para estar) no quarto; quem sai ainda não saiu
  return { estadia, saindo, limpeza, ocupado: !!noQuarto, hospedes: noQuarto?.hospedes, cafe: noQuarto?.cafe, pago: noQuarto?.pago,
    cafeHoje: !!noQuarto?.cafeHoje, chegaHoje: !!estadia?.chegaHoje };
}
// Para a camareira o café é uma instrução: preparar, não preparar, ou falta confirmar (a regra de horário é do servidor)
const cafeTexto = (r) => (r.cafeHoje ? "Preparar café" : cafeClasse(r.cafe) === "nd" ? "Café a confirmar" : "Não preparar café");
// Camareira: só diz se está pago ou não (nunca valor nem forma de pagamento)
const pagoLinha = (r) => `<div class="sub"><span class="chip ${pagoClasse(r.pago)}">${esc(rotuloPago(r.pago))}</span></div>`;
const hospedesTxt = (n) => `${n} ${n === 1 ? "hóspede" : "hóspedes"}`;

function renderCamareira() {
  $("quartos").innerHTML = QUARTOS.map((q) => {
    const e = estadoQuarto(q);
    let cls = "quarto", selo = "Livre", seloCls = "selo", principal = "Disponível", sub = "Quarto não ocupado", extra = "";
    if (e.limpeza) {
      cls += " limpeza"; selo = "Limpeza"; seloCls += " limpeza"; principal = "Pronto para limpeza";
      sub = e.estadia ? "Novo hóspede chega hoje" : "Quarto liberado";
    } else if (e.saindo) {
      cls += " saindo"; selo = "Saída hoje"; seloCls += " saida"; principal = `Saída até ${HORA_CHECKOUT}`;
      sub = `${hospedesTxt(e.saindo.hospedes)} · ${cafeTexto(e.saindo)}`; extra = pagoLinha(e.saindo);
    } else if (e.estadia) {
      cls += " ocupado"; selo = "Ocupado"; seloCls += " ocupado"; principal = "Ocupado";
      sub = `${hospedesTxt(e.estadia.hospedes)} · ${cafeTexto(e.estadia)}`; extra = pagoLinha(e.estadia);
    }
    return `<button class="${cls}" data-acao="quarto" data-q="${q}" aria-label="Abrir quarto ${q}, ${principal.toLowerCase()}">
      <div class="linha"><span class="nome">Quarto ${q}</span><span class="${seloCls}">${selo}</span></div>
      <div><div class="principal">${principal}</div><div class="sub">${esc(sub)}</div>${extra}</div>
      <span class="cta">${e.limpeza ? "Marcar como limpo" : "Ver detalhes"} &rarr;</span></button>`;
  }).join("");
  renderRelatorioCamareira();
}

// Relatório da camareira: ocupado/livre, pessoas, café a preparar hoje e limpeza
function renderRelatorioCamareira() {
  const chip = (txt, tom) => `<span class="chip ${tom}">${esc(txt)}</span>`;
  let ocupados = 0, aLimpar = 0, pessoasCafe = 0, quartosCafe = 0, aConfirmar = 0;
  const linhas = QUARTOS.map((q) => {
    const e = estadoQuarto(q);
    if (e.ocupado) ocupados++;
    if (e.limpeza) aLimpar++;
    if (e.ocupado && cafeClasse(e.cafe) === "nd") aConfirmar++;
    if (e.ocupado && e.cafeHoje) { pessoasCafe += e.hospedes; quartosCafe++; }
    const pessoas = e.ocupado ? `<span class="pessoas"><strong>${e.hospedes}</strong><small>${e.hospedes === 1 ? "pessoa" : "pessoas"}</small></span>` : '<span class="traco" aria-label="sem hóspede">—</span>';
    let cafe;
    if (!e.ocupado) cafe = '<span class="traco" aria-label="sem hóspede">—</span>';
    else if (e.cafeHoje) cafe = chip("Preparar", "com");
    else if (cafeClasse(e.cafe) === "nd") cafe = chip("A confirmar", "nd");
    else cafe = chip("Não", "neutro");
    const limp = e.limpeza ? chip("Sim", "azul") : e.saindo ? chip(`Às ${HORA_CHECKOUT}`, "ambar") : chip("Não", "neutro");
    // pago: só visualização (Sim / Não / a confirmar), sem valores
    const pago = !e.ocupado ? '<span class="traco" aria-label="sem hóspede">—</span>'
      : e.pago === "sim" ? chip("Sim", "ok") : e.pago === "nao" ? chip("Não", "ambar") : chip("A conf.", "nd");
    return `<div class="rel-linha" role="row">
      <div class="rel-q" role="cell">Quarto ${q}<br>${e.ocupado ? chip("Ocupado", "verm") : chip("Livre", "ok")}</div>
      <div role="cell">${pessoas}</div>
      <div role="cell">${cafe}</div>
      <div role="cell">${pago}</div>
      <div role="cell">${limp}</div>
    </div>`;
  }).join("");
  const nota = aConfirmar ? `<span class="rel-aviso">${aConfirmar} ${aConfirmar === 1 ? "quarto com café a confirmar" : "quartos com café a confirmar"} na recepção</span>` : "";
  $("relatorio-cam").innerHTML = `
    <div class="rel-topo"><h2>Relatório de hoje</h2><span class="muda">Atualizado às ${esc(s.atualizadoEm)}</span></div>
    <div class="rel-cafe"><div class="rel-cafe-hoje"><span>Cafés para preparar hoje</span><strong>${pessoasCafe}</strong><em>${pessoasCafe === 1 ? "pessoa" : "pessoas"} em ${quartosCafe} ${quartosCafe === 1 ? "quarto" : "quartos"}</em></div></div>
    ${nota}
    <div class="rel-resumo">
      <div class="rel-num verm"><strong>${ocupados}</strong><span>Ocupados</span></div>
      <div class="rel-num ok"><strong>${QUARTOS.length - ocupados}</strong><span>Livres</span></div>
      <div class="rel-num azul"><strong>${aLimpar}</strong><span>Para limpar</span></div>
    </div>
    <div class="rel-tabela" role="table" aria-label="Situação de cada quarto">
      <div class="rel-linha rel-cab" role="row"><div role="columnheader">Quarto</div><div role="columnheader">Pessoas</div><div role="columnheader">Preparar café?</div><div role="columnheader">Pago?</div><div role="columnheader"><span class="cab-longo">Pronto para limpeza?</span><span class="cab-curto">Limpeza?</span></div></div>
      ${linhas}
    </div>`;
}

function render() { if (s.papel === "camareira") renderCamareira(); else { renderCalendario(); renderQuartos(); } }

// ---------- ações com confirmação em dois toques: marcar limpo (admin e camareira) e encerrar estadia (admin) ----------
function botaoConf(tipo, q, ci, normal, confirma, cls) {
  return `<button class="${cls}" data-acao="conf" data-tipo="${tipo}" data-quarto="${q}" data-ci="${ci || ""}" data-normal="${esc(normal)}" data-confirma="${esc(confirma)}">${esc(normal)}</button>`;
}
const botaoLimpo = (q) => botaoConf("limpar", q, "", "Marcar como limpo", `Confirmar: quarto ${q} está limpo`, "btn-limpar");
let tConf;
function zerarConf() {
  clearTimeout(tConf); s.conf = null;
  document.querySelectorAll('[data-acao="conf"]').forEach((b) => { b.textContent = b.dataset.normal; b.classList.remove("confirmar"); b.disabled = false; });
}
// primeira batida pede confirmação (evita toque sem querer); a segunda executa
function pedirConf(el) {
  const { tipo, quarto, ci } = el.dataset, q = Number(quarto), chave = `${tipo}:${q}:${ci}`;
  if (s.conf !== chave) {
    s.conf = chave;
    document.querySelectorAll(`[data-acao="conf"][data-tipo="${tipo}"][data-quarto="${q}"][data-ci="${ci}"]`).forEach((b) => { b.textContent = b.dataset.confirma; b.classList.add("confirmar"); });
    clearTimeout(tConf); tConf = setTimeout(zerarConf, 5000);
    return;
  }
  clearTimeout(tConf); s.conf = null;
  marcarLimpo(q);
}
function travarBotoes() { document.querySelectorAll('[data-acao="conf"]').forEach((b) => { b.disabled = true; b.textContent = "Salvando..."; }); }
async function marcarLimpo(q) {
  travarBotoes();
  try {
    await api("limpar", { quarto: q });
    await carregar();
    fecharModal();
    avisar(`Quarto ${q} marcado como limpo. Agora está livre.`);
  } catch (e) { avisar(e.message, true); zerarConf(); }
}
// Admin: marca "Já recebido?" Sim ou Não com um toque, para a estadia indicada pelo check-in
function seletorRecebido(q, ci, atual) {
  const op = (valor, rotulo, cls) => {
    const a = atual === valor;
    const dados = a ? "disabled" : `data-acao="recebido" data-quarto="${q}" data-ci="${ci}" data-valor="${valor}"`;
    return `<button class="estado-op rec-${cls}${a ? " atual" : ""}" aria-pressed="${a}" ${dados}>${rotulo}</button>`;
  };
  return `<div class="estado-quarto" role="group" aria-label="Já recebido?"><span class="rotulo">Já recebido?${atual ? "" : " (não informado)"}</span>
    <div class="estado-opcoes n2">${op("Sim", "Sim, já recebido", "sim")}${op("Não", "Não, a receber", "nao")}</div></div>`;
}
async function mudarRecebido({ quarto, ci, valor }) {
  const q = Number(quarto);
  document.querySelectorAll(".estado-op").forEach((b) => { b.disabled = true; });
  try {
    await api("recebido", { quarto: q, checkIn: ci, recebido: valor });
    await carregar();
    renderModal();
    avisar(valor === "Sim" ? `Quarto ${q}: marcado como recebido.` : `Quarto ${q}: marcado como a receber.`);
  } catch (e) { avisar(e.message, true); renderModal(); }
}

// Admin: troca a situação do quarto com um toque, sem confirmação.
//   ocupado -> pronto para limpeza (encerra a estadia na hora) | ocupado -> livre (encerra e já marca limpo) | pronto para limpeza -> livre
function seletorEstado(q, atual, ci) {
  const defs = [["ocupado", "Ocupado"], ["limpeza", "Pronto para limpeza"], ["livre", "Livre"]]
    .filter(([id]) => !(atual === "limpeza" && id === "ocupado")); // voltar a "ocupado" seria uma nova locação (formulário)
  const botoes = defs.map(([id, rotulo]) => {
    const eAtual = id === atual;
    const dados = eAtual ? "" : `data-acao="estado" data-quarto="${q}" data-ci="${ci}" data-de="${atual}" data-novo="${id}"`;
    return `<button class="estado-op ${id}${eAtual ? " atual" : ""}" aria-pressed="${eAtual}" ${dados} ${eAtual ? "disabled" : ""}>${rotulo}</button>`;
  }).join("");
  return `<div class="estado-quarto" role="group" aria-label="Situação do quarto"><span class="rotulo">Situação do quarto: toque para mudar</span><div class="estado-opcoes n${defs.length}">${botoes}</div></div>`;
}
async function mudarEstado({ quarto, ci, de, novo }) {
  const q = Number(quarto);
  document.querySelectorAll(".estado-op").forEach((b) => { b.disabled = true; });
  try {
    if (de === "limpeza") await api("limpar", { quarto: q });
    else await api("encerrar", { quarto: q, checkIn: ci, limpo: novo === "livre" });
    await carregar();
    fecharModal();
    avisar(novo === "livre" ? `Quarto ${q} agora está livre.` : `Quarto ${q} agora está pronto para limpeza.`);
  } catch (e) { avisar(e.message, true); renderModal(); }
}

// ---------- janela do quarto ----------
function abrirQuarto(q) {
  s.quarto = q;
  s.form = { ci: s.sel, co: "", hosp: 2, valor: "", pag: "", cafe: "", recebido: "" };
  s.picker = null; s.conf = null;
  if (s.papel === "camareira") renderModalCamareira(); else renderModal();
}

// Camareira: só diz se o quarto está livre ou ocupado, quantos hóspedes e se tem café
function renderModalCamareira() {
  const q = s.quarto;
  const e = estadoQuarto(q);
  const cafeSelo = (x) => x.cafeHoje
    ? '<span class="cafe-selo com">Preparar café</span>'
    : cafeClasse(x.cafe) === "nd"
      ? '<span class="cafe-selo nd">Café a confirmar</span><span class="muda">Confirme com a recepção.</span>'
      : '<span class="cafe-selo nao">Não preparar café</span>';
  const chegada = e.estadia && (e.limpeza || e.saindo)
    ? `<div class="ocupado-caixa"><span class="etq">Novo hóspede chega hoje</span><strong>${hospedesTxt(e.estadia.hospedes)}</strong>${cafeSelo(e.estadia)}${pagoLinha(e.estadia)}</div>` : "";
  let corpo;
  if (e.limpeza) {
    corpo = `<div class="limpeza-caixa"><span class="etq">Pronto para limpeza</span><strong>Quarto liberado</strong>
      <span class="muda">Depois de limpar, marque abaixo.</span>${botaoLimpo(q)}</div>${chegada}`;
  } else if (e.saindo) {
    corpo = `<div class="saindo-caixa"><span class="etq">Saída hoje até ${HORA_CHECKOUT}</span>
        <strong>${hospedesTxt(e.saindo.hospedes)}</strong>${cafeSelo(e.saindo)}${pagoLinha(e.saindo)}
        <span class="muda">Ainda não está liberado para limpeza.</span></div>${chegada}`;
  } else if (e.estadia) {
    corpo = `<div class="ocupado-caixa"><span class="etq">Quarto ocupado</span>
        <strong>${hospedesTxt(e.estadia.hospedes)}</strong>${cafeSelo(e.estadia)}${pagoLinha(e.estadia)}</div>`;
  } else {
    corpo = `<div class="livre-caixa"><span class="etq">Quarto disponível</span><strong>Quarto não ocupado</strong></div>`;
  }
  const m = $("modal");
  m.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-label="Quarto ${q}">
    <div class="janela-topo"><div><h2>Quarto ${q}</h2></div><button class="fechar" data-acao="fechar" aria-label="Fechar">&times;</button></div>${corpo}</div>`;
  m.hidden = false;
}

function fecharModal() { s.quarto = null; s.picker = null; $("modal").hidden = true; $("picker").hidden = true; }

function renderModal() {
  const q = s.quarto;
  const est = estadiaEm(s.regs, q, s.sel);
  const topo = `<div class="janela-topo"><div><h2>Quarto ${q}</h2><p class="muda">${esc(deIso(s.sel).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</p></div><button class="fechar" data-acao="fechar" aria-label="Fechar">&times;</button></div>`;
  // encerrar a estadia: só olhando para hoje. Quem está hospedado, ou quem sai hoje e ainda não passou do meio-dia
  const saindoHoje = s.sel === s.hoje && s.hora < HORA_CHECKOUT ? saidaEm(s.regs, q, s.sel) : null;
  const saindoBox = saindoHoje
    ? `<div class="saindo-caixa"><span class="etq">Saída hoje até ${HORA_CHECKOUT}</span>
        <strong>${hospedesTxt(saindoHoje.hospedes)} · ${esc(rotuloCafe(saindoHoje.cafe))}</strong>
        ${seletorRecebido(q, saindoHoje.checkIn, saindoHoje.recebido)}
        ${seletorEstado(q, "ocupado", saindoHoje.checkIn)}</div>` : "";
  const limpezaBox = limpezaPendenteAdmin(q)
    ? `<div class="limpeza-caixa"><span class="etq">Pronto para limpeza</span><strong>Check-out concluído</strong>
        ${seletorEstado(q, "limpeza", "")}</div>` : "";
  let corpo;
  if (est) {
    corpo = `<div class="ocupado-caixa"><span class="etq">Quarto ocupado</span><strong>${esc(fmtCheckIn(est))} até ${esc(fmtCheckOut(est))}</strong>
      <span>${est.hospedes} ${est.hospedes === 1 ? "hóspede" : "hóspedes"} · ${brl(est.valor)} · ${esc(est.pagamento)}</span>
      <span>${esc(rotuloCafe(est.cafe))}</span>
      <span class="muda">Libera automaticamente às ${HORA_CHECKOUT} do dia do check-out.</span></div>
      ${seletorRecebido(q, est.checkIn, est.recebido)}
      ${s.sel === s.hoje ? seletorEstado(q, "ocupado", est.checkIn) : ""}`;
  } else {
    corpo = `
      <div class="datas">
        <div class="campo"><span class="rotulo">Check-in</span><div class="data-btn fixo" id="b-ci"></div></div>
        <div class="campo"><span class="rotulo">Check-out</span><button class="data-btn" data-acao="pick" id="b-co"></button></div>
      </div>
      <p class="noites" id="m-noites" hidden></p>
      <p class="erro" id="m-conflito" role="alert" hidden></p>
      <div class="campo"><span class="rotulo">Quantidade de hóspedes</span>
        <div class="passo"><button data-acao="hosp" data-d="-1" aria-label="Diminuir hóspedes">&minus;</button><input id="m-hosp" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" aria-label="Quantidade de hóspedes"><button data-acao="hosp" data-d="1" aria-label="Aumentar hóspedes">+</button></div></div>
      <div class="campo"><label for="m-valor">Valor total cobrado pela estadia</label>
        <div class="valor"><span>R$</span><input id="m-valor" type="text" inputmode="decimal" autocomplete="off"></div></div>
      <div class="campo"><span class="rotulo">Café da manhã (cobrado à parte)</span>
        <div class="pagamentos">${CAFES.map((c) => `<button class="cafe-op" data-acao="cafe" data-c="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}</div></div>
      <div class="campo"><span class="rotulo">Forma de pagamento</span>
        <div class="pagamentos">${PAGAMENTOS.map((p) => `<button class="pag" data-acao="pag" data-p="${esc(p)}" aria-pressed="false">${esc(p)}</button>`).join("")}</div></div>
      <div class="campo"><span class="rotulo">Já recebido?</span>
        <div class="pagamentos">${RECEBIDOS.map((r) => `<button class="rec-op" data-acao="rec-form" data-r="${r}" aria-pressed="false">${r === "Sim" ? "Sim, já recebido" : "Não, a receber"}</button>`).join("")}</div></div>
      <button class="btn" id="m-salvar" data-acao="salvar">Salvar</button>`;
  }
  const m = $("modal");
  m.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-label="Registro do quarto ${q}">${topo}${limpezaBox}${saindoBox}${corpo}</div>`;
  m.hidden = false;
  if (!est) {
    const v = $("m-valor");
    v.value = "0,00"; s.form.valor = "0,00";
    let ultimo = v.value, recemFocado = false;
    const antesDaVirgula = () => { const n = v.value.indexOf(","); v.setSelectionRange(n, n); };
    // primeiro toque: cursor antes da vírgula, para o que for digitado entrar nos reais
    v.addEventListener("focus", () => { recemFocado = true; setTimeout(antesDaVirgula, 0); });
    v.addEventListener("click", () => { if (recemFocado) { recemFocado = false; antesDaVirgula(); } });
    v.addEventListener("input", (e) => {
      let raw = v.value, pos = v.selectionStart;
      const apagando = (e.inputType || "").startsWith("delete");
      // apagar a vírgula não pode multiplicar o valor: só devolve o cursor para antes dela
      if (apagando && !raw.includes(",")) { v.value = ultimo; antesDaVirgula(); return; }
      const digitouSeparador = e.data === "," || e.data === ".";
      if (digitouSeparador) raw = raw.slice(0, pos - 1) + "," + raw.slice(pos);
      const virgula = raw.indexOf(",");
      const naDecimal = virgula >= 0 && pos > virgula && !digitouSeparador;
      const texto = mascaraValor(raw);
      const novaVirgula = texto.indexOf(",");
      v.value = texto;
      const alvo = digitouSeparador ? novaVirgula + 1
        : naDecimal ? novaVirgula + 1 + Math.min(2, pos - virgula - 1)
        : novaVirgula;
      v.setSelectionRange(alvo, alvo);
      ultimo = texto; s.form.valor = texto; atualizarForm();
    });
    const h = $("m-hosp");
    h.addEventListener("focus", () => h.select());
    h.addEventListener("input", () => {
      h.value = h.value.replace(/\D/g, "").replace(/^0+/, "");
      s.form.hosp = Number(h.value) || 0; atualizarForm();
    });
    h.addEventListener("blur", () => { if (s.form.hosp < 1) { s.form.hosp = 1; } h.value = s.form.hosp; atualizarForm(); });
    atualizarForm();
  }
}

function atualizarForm() {
  const f = s.form;
  const temSaida = f.co !== "" && f.co > f.ci;
  const bCi = $("b-ci"), bCo = $("b-co");
  bCi.innerHTML = `${esc(br(f.ci))}<small>hora do registro</small>`;
  bCo.innerHTML = f.co ? `${esc(br(f.co))}<small>às ${HORA_CHECKOUT}</small>` : "Escolher data";
  bCo.classList.toggle("vazio", !temSaida);
  const n = $("m-noites");
  n.hidden = !temSaida;
  if (temSaida) { const k = noites(f.ci, f.co); n.textContent = `${k} ${k === 1 ? "noite" : "noites"}`; }
  const bate = temSaida ? conflito(s.regs, s.quarto, f.ci, f.co) : null;
  const c = $("m-conflito");
  c.hidden = !bate;
  if (bate) c.textContent = `Este quarto já está ocupado de ${br(bate.checkIn)} até ${br(bate.checkOut)}.`;
  const campoHosp = $("m-hosp");
  if (document.activeElement !== campoHosp) campoHosp.value = f.hosp;
  document.querySelectorAll(".pag").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === f.pag)));
  document.querySelectorAll(".cafe-op").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === f.cafe)));
  document.querySelectorAll(".rec-op").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.r === f.recebido)));
  $("m-salvar").disabled = s.salvando || !(temSaida && !bate && f.hosp >= 1 && parseValor(f.valor) > 0 && f.pag && f.cafe && f.recebido);
}

async function salvar() {
  const f = s.form;
  const reg = { data: s.sel, quarto: s.quarto, hospedes: f.hosp, valor: parseValor(f.valor), pagamento: f.pag, cafe: f.cafe, recebido: f.recebido, checkIn: f.ci, checkInHora: agora(), checkOut: f.co };
  s.salvando = true; atualizarForm();
  $("m-salvar").textContent = "Salvando na planilha...";
  try {
    await api("salvar", reg);
    await carregar().catch(() => { s.regs.push({ ...reg, limpeza: "Pendente" }); render(); }); // servidor é a verdade (evita duplicar com a atualização automática)
    fecharModal();
    avisar(`Locação salva na planilha: quarto ${reg.quarto}, check-in ${fmtCheckIn(reg)}, check-out ${fmtCheckOut(reg)}.`);
  } catch (e) {
    s.salvando = false;
    $("m-salvar").textContent = "Salvar";
    atualizarForm();
    avisar(e.message, true);
  } finally { s.salvando = false; }
}

// ---------- calendário em pop-up (check-in e check-out) ----------
function abrirPicker() {
  s.picker = "out";
  const base = deIso(s.form.co || s.form.ci);
  s.py = base.getFullYear(); s.pm = base.getMonth();
  renderPicker();
}
function renderPicker() {
  const f = s.form;
  // a próxima reserva do quarto (depois do check-in) limita até onde o check-out pode ir
  const proxima = s.regs.filter((r) => r.quarto === s.quarto && r.checkIn > f.ci).map((r) => r.checkIn).sort()[0];
  const dias = grade(s.py, s.pm).map((c) => {
    if (!c) return "<span></span>";
    const sel = c.chave === f.co;
    const faixa = f.co && c.chave > f.ci && c.chave < f.co;
    const antes = c.chave <= f.ci;
    const ocupado = !antes && proxima && c.chave > proxima;
    const bloqueado = antes || ocupado;
    const motivo = antes ? ", indisponível, antes ou no check-in" : ocupado ? ", indisponível, quarto reservado" : "";
    return `<button class="dia${sel ? " sel" : ""}${faixa ? " faixa" : ""}${bloqueado ? " indisp" : ""}" data-acao="escolher" data-chave="${c.chave}" ${bloqueado ? "disabled" : ""} aria-pressed="${sel}" aria-label="${c.n} de ${esc(mesNome(s.py, s.pm).split(" ")[0])}${motivo}">${c.n}</button>`;
  }).join("");
  const titulo = "Escolha o check-out (às " + HORA_CHECKOUT + ")";
  const p = $("picker");
  p.innerHTML = `<div class="janela pequena" role="dialog" aria-modal="true" aria-label="${titulo}">
    <div class="janela-topo"><h2 style="font-size:22px">${titulo}</h2><button class="fechar" data-acao="fechar-picker" aria-label="Fechar calendário">&times;</button></div>
    <div class="mes-barra"><button class="seta" data-acao="pmes" data-d="-1" aria-label="Mês anterior">&#8249;</button><strong>${esc(mesNome(s.py, s.pm))}</strong><button class="seta" data-acao="pmes" data-d="1" aria-label="Próximo mês">&#8250;</button></div>
    <div class="sem"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
    <div class="dias">${dias}</div>
    <p class="legenda"><span class="amostra">12</span> Data indisponível para check-out</p></div>`;
  p.hidden = false;
}
function fecharPicker() { s.picker = null; $("picker").hidden = true; }

// ---------- eventos ----------
document.addEventListener("click", (e) => {
  const fundo = e.target;
  if (fundo.id === "picker") return fecharPicker();
  if (fundo.id === "modal") return fecharModal();
  const el = e.target.closest("[data-acao]");
  if (!el) return;
  const d = el.dataset;
  switch (d.acao) {
    case "dia": s.sel = d.chave; s.calAberto = false; render(); break;
    case "dia-mais": { const x = deIso(s.sel); x.setDate(x.getDate() + Number(d.d)); s.sel = iso(x); s.vy = x.getFullYear(); s.vm = x.getMonth(); render(); break; }
    case "cal-toggle": s.calAberto = !s.calAberto; renderCalendario(); break;
    case "hoje": { const t = new Date(); s.sel = iso(t); s.vy = t.getFullYear(); s.vm = t.getMonth(); s.calAberto = false; render(); break; }
    case "mes": { const x = new Date(s.vy, s.vm + Number(d.d), 1); s.vy = x.getFullYear(); s.vm = x.getMonth(); renderCalendario(); break; }
    case "quarto": abrirQuarto(Number(d.q)); break;
    case "fechar": fecharModal(); break;
    case "pick": abrirPicker(); break;
    case "fechar-picker": fecharPicker(); break;
    case "pmes": { const x = new Date(s.py, s.pm + Number(d.d), 1); s.py = x.getFullYear(); s.pm = x.getMonth(); renderPicker(); break; }
    case "escolher":
      s.form.co = d.chave;
      fecharPicker(); atualizarForm(); break;
    case "hosp": s.form.hosp = Math.min(99, Math.max(1, s.form.hosp + Number(d.d))); atualizarForm(); break;
    case "pag": s.form.pag = d.p; atualizarForm(); break;
    case "cafe": s.form.cafe = d.c; atualizarForm(); break;
    case "rec-form": s.form.recebido = d.r; atualizarForm(); break;
    case "recebido": mudarRecebido(el.dataset); break;
    case "aba": s.aba = d.a; aplicarPapel(); break;
    case "conf": pedirConf(el); break;
    case "estado": mudarEstado(el.dataset); break;
    case "salvar": salvar(); break;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (s.picker) fecharPicker(); else if (s.quarto) fecharModal();
});

// ---------- instalar como aplicativo ----------
const URL_PAGINA = new URL("./", location.href).href;
const modoApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ehIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
let convite = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); convite = e; });
window.addEventListener("appinstalled", () => { convite = null; document.querySelectorAll("[data-instalar]").forEach((b) => { b.hidden = true; }); });
// navegadores embutidos (WhatsApp, Instagram...) não leem o ícone do app: o atalho sai com uma letra
if (/FBAN|FBAV|Instagram|MicroMessenger|; wv\)|GSA\/|Line\//i.test(navigator.userAgent)) $("aviso-navegador").hidden = false;
if (modoApp()) document.querySelectorAll("[data-instalar]").forEach((b) => { b.hidden = true; });

function recado(msg) {
  if (!$("tela-app").hidden) return avisar(msg);
  const d = $("dica"); d.textContent = msg; d.hidden = false;
}
async function instalar() {
  if (modoApp()) return recado("O aplicativo já está instalado neste aparelho.");
  if (convite) {
    convite.prompt();
    try { await convite.userChoice; } catch (e) { /* ignora */ }
    convite = null;
    return;
  }
  recado(ehIos
    ? "No iPhone: toque em Compartilhar (quadrado com seta) e depois em Adicionar à Tela de Início."
    : "No navegador: abra o menu (três pontinhos) e toque em Instalar app ou Adicionar à tela inicial.");
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-acao]")?.dataset.acao;
  if (a === "instalar") instalar();
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});

// ---------- início ----------
// reabrir com a sessão guardada: tela neutra de carregamento até saber o perfil
async function abrirSessao() {
  try { await carregar(); mostrarApp(); }
  catch (e) {
    document.documentElement.classList.remove("tem-sessao");
    $("erro-login").textContent = e.message; $("erro-login").hidden = false;
  }
}
entrarComSalva();
if (s.token) abrirSessao();

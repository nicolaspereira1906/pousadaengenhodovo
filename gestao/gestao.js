import { URL_SCRIPT } from "./config.js";
import { iso, deIso, br, brl, parseValor, noites, estadiaEm, saidaEm, conflito, grade } from "./regras.js";

const QUARTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const PAGAMENTOS = ["PIX", "Cartão de débito", "Cartão de crédito"];
const CHAVE_SESSAO = "pousada_sessao";

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mesNome = (a, m) => new Date(a, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const hoje = new Date();
const s = {
  token: sessionStorage.getItem(CHAVE_SESSAO) || "",
  regs: [],
  sel: iso(hoje), vy: hoje.getFullYear(), vm: hoje.getMonth(),
  quarto: null,
  form: { ci: "", co: "", hosp: 2, valor: "", pag: "" },
  picker: null, py: hoje.getFullYear(), pm: hoje.getMonth(),
  salvando: false,
  calAberto: false
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
  s.regs = r.registros;
  render();
}

// ---------- login ----------
function mostrarApp() {
  $("tela-login").hidden = true;
  $("tela-app").hidden = false;
}
function sair() {
  s.token = ""; s.regs = [];
  sessionStorage.removeItem(CHAVE_SESSAO);
  $("tela-app").hidden = true;
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
    sessionStorage.setItem(CHAVE_SESSAO, r.token);
    $("senha").value = "";
    mostrarApp();
    await carregar();
  } catch (err) {
    erro.textContent = err.message; erro.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "Entrar";
  }
});
$("btn-sair").addEventListener("click", sair);
$("btn-atualizar").addEventListener("click", async () => {
  try { await carregar(); avisar("Dados atualizados da planilha."); } catch (e) { avisar(e.message, true); }
});

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

function renderQuartos() {
  let ocupados = 0, hospedados = 0;
  $("quartos").innerHTML = QUARTOS.map((q) => {
    const est = estadiaEm(s.regs, q, s.sel);
    const sai = saidaEm(s.regs, q, s.sel);
    let cls = "quarto", selo = "Livre", seloCls = "selo", principal = "Disponível", sub = "Sem estadia", cta = "Registrar locação";
    if (est) {
      ocupados++; hospedados += est.hospedes;
      cls += " ocupado"; selo = "Ocupado"; seloCls += " ocupado";
      principal = "Até " + br(est.checkOut).slice(0, 5);
      sub = `${est.hospedes} ${est.hospedes === 1 ? "hóspede" : "hóspedes"} · ${brl(est.valor)}`;
      cta = "Ver estadia";
    } else if (sai) {
      selo = "Saída hoje"; seloCls += " saida";
      sub = `Check-out de ${sai.hospedes} ${sai.hospedes === 1 ? "hóspede" : "hóspedes"}`;
    }
    return `<button class="${cls}" data-acao="quarto" data-q="${q}" aria-label="Abrir quarto ${q}, ${selo.toLowerCase()}">
      <div class="linha"><span class="nome">Quarto ${q}</span><span class="${seloCls}">${selo}</span></div>
      <div><div class="principal">${esc(principal)}</div><div class="sub">${esc(sub)}</div></div>
      <span class="cta">${cta} &rarr;</span></button>`;
  }).join("");

  const doDia = s.regs.filter((r) => r.data === s.sel);
  $("r-total").textContent = brl(doDia.reduce((a, r) => a + r.valor, 0));
  $("r-ocupados").textContent = `${ocupados} de ${QUARTOS.length}`;
  $("r-hospedados").textContent = hospedados;

  $("reg-titulo").textContent = "Registros de " + br(s.sel);
  $("reg-corpo").innerHTML = doDia.length === 0
    ? '<p class="muda">Nenhum registro neste dia. Clique em um quarto para começar.</p>'
    : `<div class="tabela-caixa"><table><thead><tr><th>Quarto</th><th>Check-in</th><th>Check-out</th><th>Hóspedes</th><th>Valor total</th><th>Pagamento</th></tr></thead><tbody>${
      doDia.slice().reverse().map((r) => `<tr><td data-l="Quarto"><strong>Quarto ${r.quarto}</strong></td><td data-l="Check-in">${br(r.checkIn)}</td><td data-l="Check-out">${br(r.checkOut)}</td><td data-l="Hóspedes">${r.hospedes}</td><td data-l="Valor total"><strong>${brl(r.valor)}</strong></td><td data-l="Pagamento">${esc(r.pagamento)}</td></tr>`).join("")
    }</tbody></table></div>`;
}

function render() { renderCalendario(); renderQuartos(); }

// ---------- janela do quarto ----------
function abrirQuarto(q) {
  s.quarto = q;
  s.form = { ci: s.sel, co: "", hosp: 2, valor: "", pag: "" };
  s.picker = null;
  renderModal();
}
function fecharModal() { s.quarto = null; s.picker = null; $("modal").hidden = true; $("picker").hidden = true; }

function renderModal() {
  const q = s.quarto;
  const est = estadiaEm(s.regs, q, s.sel);
  const topo = `<div class="janela-topo"><div><h2>Quarto ${q}</h2><p class="muda">${esc(deIso(s.sel).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</p></div><button class="fechar" data-acao="fechar" aria-label="Fechar">&times;</button></div>`;
  let corpo;
  if (est) {
    corpo = `<div class="ocupado-caixa"><span class="etq">Quarto ocupado</span><strong>${br(est.checkIn)} até ${br(est.checkOut)}</strong>
      <span>${est.hospedes} ${est.hospedes === 1 ? "hóspede" : "hóspedes"} · ${brl(est.valor)} · ${esc(est.pagamento)}</span>
      <span class="muda">Libera automaticamente no dia do check-out.</span></div>
      ${s.sel > est.checkIn ? `<button class="btn-perigo" data-acao="encerrar">Fazer check-out em ${br(s.sel)}</button>` : ""}`;
  } else {
    corpo = `
      <div class="datas">
        <div class="campo"><span class="rotulo">Check-in</span><button class="data-btn" data-acao="pick" data-k="in" id="b-ci"></button></div>
        <div class="campo"><span class="rotulo">Check-out</span><button class="data-btn" data-acao="pick" data-k="out" id="b-co"></button></div>
      </div>
      <p class="noites" id="m-noites" hidden></p>
      <p class="erro" id="m-conflito" role="alert" hidden></p>
      <div class="campo"><span class="rotulo">Quantidade de hóspedes</span>
        <div class="passo"><button data-acao="hosp" data-d="-1" aria-label="Diminuir hóspedes">&minus;</button><output id="m-hosp"></output><button data-acao="hosp" data-d="1" aria-label="Aumentar hóspedes">+</button></div></div>
      <div class="campo"><label for="m-valor">Valor total cobrado pela estadia</label>
        <div class="valor"><span>R$</span><input id="m-valor" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off"></div></div>
      <div class="campo"><span class="rotulo">Forma de pagamento</span>
        <div class="pagamentos">${PAGAMENTOS.map((p) => `<button class="pag" data-acao="pag" data-p="${esc(p)}" aria-pressed="false">${esc(p)}</button>`).join("")}</div></div>
      <button class="btn" id="m-salvar" data-acao="salvar">Salvar</button>`;
  }
  const m = $("modal");
  m.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-label="Registro do quarto ${q}">${topo}${corpo}</div>`;
  m.hidden = false;
  if (!est) {
    $("m-valor").addEventListener("input", (e) => { s.form.valor = e.target.value; atualizarForm(); });
    atualizarForm();
  }
}

function atualizarForm() {
  const f = s.form;
  const temSaida = f.co !== "" && f.co > f.ci;
  const bCi = $("b-ci"), bCo = $("b-co");
  bCi.textContent = br(f.ci);
  bCo.textContent = f.co ? br(f.co) : "Escolher data";
  bCo.classList.toggle("vazio", !temSaida);
  const n = $("m-noites");
  n.hidden = !temSaida;
  if (temSaida) { const k = noites(f.ci, f.co); n.textContent = `${k} ${k === 1 ? "noite" : "noites"}`; }
  const bate = temSaida ? conflito(s.regs, s.quarto, f.ci, f.co) : null;
  const c = $("m-conflito");
  c.hidden = !bate;
  if (bate) c.textContent = `Este quarto já está ocupado de ${br(bate.checkIn)} até ${br(bate.checkOut)}.`;
  $("m-hosp").textContent = f.hosp;
  document.querySelectorAll(".pag").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === f.pag)));
  $("m-salvar").disabled = s.salvando || !(temSaida && !bate && parseValor(f.valor) > 0 && f.pag);
}

async function salvar() {
  const f = s.form;
  const reg = { data: s.sel, quarto: s.quarto, hospedes: f.hosp, valor: parseValor(f.valor), pagamento: f.pag, checkIn: f.ci, checkOut: f.co };
  s.salvando = true; atualizarForm();
  $("m-salvar").textContent = "Salvando na planilha...";
  try {
    await api("salvar", reg);
    s.regs.push(reg);
    fecharModal(); render();
    avisar(`Locação salva na planilha: quarto ${reg.quarto}, ${br(reg.checkIn)} a ${br(reg.checkOut)}.`);
  } catch (e) {
    s.salvando = false;
    $("m-salvar").textContent = "Salvar";
    atualizarForm();
    avisar(e.message, true);
  } finally { s.salvando = false; }
}

async function encerrar() {
  const est = estadiaEm(s.regs, s.quarto, s.sel);
  if (!est) return;
  try {
    await api("checkout", { quarto: est.quarto, checkIn: est.checkIn, checkOut: s.sel });
    est.checkOut = s.sel;
    fecharModal(); render();
    avisar(`Check-out do quarto ${est.quarto} feito em ${br(s.sel)}.`);
  } catch (e) { avisar(e.message, true); }
}

// ---------- calendário em pop-up (check-in e check-out) ----------
function abrirPicker(k) {
  s.picker = k;
  const base = deIso(k === "out" ? (s.form.co || s.form.ci) : s.form.ci);
  s.py = base.getFullYear(); s.pm = base.getMonth();
  renderPicker();
}
function renderPicker() {
  const f = s.form, k = s.picker;
  const dias = grade(s.py, s.pm).map((c) => {
    if (!c) return "<span></span>";
    const sel = k === "in" ? c.chave === f.ci : c.chave === f.co;
    const faixa = k === "out" && f.co && c.chave > f.ci && c.chave < f.co;
    const bloqueado = k === "out" && c.chave <= f.ci;
    return `<button class="dia${sel ? " sel" : ""}${faixa ? " faixa" : ""}" data-acao="escolher" data-chave="${c.chave}" ${bloqueado ? "disabled" : ""} aria-pressed="${sel}" aria-label="${c.n} de ${esc(mesNome(s.py, s.pm).split(" ")[0])}${bloqueado ? ", indisponível" : ""}">${c.n}</button>`;
  }).join("");
  const titulo = k === "in" ? "Escolha o check-in" : "Escolha o check-out";
  const p = $("picker");
  p.innerHTML = `<div class="janela pequena" role="dialog" aria-modal="true" aria-label="${titulo}">
    <div class="janela-topo"><h2 style="font-size:22px">${titulo}</h2><button class="fechar" data-acao="fechar-picker" aria-label="Fechar calendário">&times;</button></div>
    <div class="mes-barra"><button class="seta" data-acao="pmes" data-d="-1" aria-label="Mês anterior">&#8249;</button><strong>${esc(mesNome(s.py, s.pm))}</strong><button class="seta" data-acao="pmes" data-d="1" aria-label="Próximo mês">&#8250;</button></div>
    <div class="sem"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
    <div class="dias">${dias}</div></div>`;
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
    case "pick": abrirPicker(d.k); break;
    case "fechar-picker": fecharPicker(); break;
    case "pmes": { const x = new Date(s.py, s.pm + Number(d.d), 1); s.py = x.getFullYear(); s.pm = x.getMonth(); renderPicker(); break; }
    case "escolher":
      if (s.picker === "in") { s.form.ci = d.chave; if (s.form.co && s.form.co <= d.chave) s.form.co = ""; }
      else s.form.co = d.chave;
      fecharPicker(); atualizarForm(); break;
    case "hosp": s.form.hosp = Math.min(99, Math.max(1, s.form.hosp + Number(d.d))); atualizarForm(); break;
    case "pag": s.form.pag = d.p; atualizarForm(); break;
    case "salvar": salvar(); break;
    case "encerrar": encerrar(); break;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (s.picker) fecharPicker(); else if (s.quarto) fecharModal();
});

// ---------- início ----------
if (s.token) {
  mostrarApp();
  carregar().catch((e) => { if (s.token) avisar(e.message, true); });
}

import { MESES, noites, plural, textoHospedes, linkWhatsApp, linkBooking } from "./reserva.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const WHATSAPP = "5535988773223";
const BOOKING = $("#btn-booking").href.split("?")[0];

function registrar(evento) {
  window.dataLayer?.push({ event: evento });
  window.fbq?.("track", "Contact", { content_name: evento });
}

// ---------- topo ----------
const topo = $(".topo");
const aoRolar = () => topo.classList.toggle("solido", scrollY > 40);
addEventListener("scroll", aoRolar, { passive: true });
aoRolar();

// ---------- estado da reserva ----------
const hoje = new Date();
hoje.setHours(0, 0, 0, 0);
const estado = { entrada: null, saida: null, adultos: 2, criancas: 0, pets: 0 };
let previa = null; // dia sob o mouse enquanto escolhe a saída

// ---------- calendário ----------
const mesesEl = $("#cal-meses");
const primeiroMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
const ultimoMes = new Date(hoje.getFullYear() + 1, hoje.getMonth(), 1);
let vista = primeiroMes;
const doisMeses = matchMedia("(min-width: 1100px)");

function desenharCalendario() {
  const qtd = doisMeses.matches ? 2 : 1;
  mesesEl.classList.toggle("dois", qtd === 2);
  mesesEl.innerHTML = "";
  for (let i = 0; i < qtd; i++) {
    const mes = new Date(vista.getFullYear(), vista.getMonth() + i, 1);
    const bloco = document.createElement("div");
    bloco.className = "cal-mes";
    let html = `<h3>${MESES[mes.getMonth()]} ${mes.getFullYear()}</h3><div class="cal-grade">`;
    html += ["D", "S", "T", "Q", "Q", "S", "S"].map((l, j) =>
      `<abbr title="${["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][j]}">${l}</abbr>`).join("");
    html += "<span></span>".repeat(mes.getDay());
    const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= dias; d++) {
      const data = new Date(mes.getFullYear(), mes.getMonth(), d);
      html += `<button type="button" class="dia${+data === +hoje ? " hoje" : ""}" data-t="${+data}"` +
        ` aria-label="${d} de ${MESES[mes.getMonth()]}"${data < hoje ? " disabled" : ""}>${d}</button>`;
    }
    bloco.innerHTML = html + "</div>";
    mesesEl.append(bloco);
  }
  $("#cal-ant").disabled = +vista <= +primeiroMes;
  $("#cal-prox").disabled = new Date(vista.getFullYear(), vista.getMonth() + qtd - 1, 1) >= ultimoMes;
  pintar();
}

function pintar() {
  const { entrada, saida } = estado;
  const fim = saida ?? (entrada && previa > entrada ? previa : null);
  for (const b of $$(".dia", mesesEl)) {
    const t = +b.dataset.t;
    b.classList.toggle("inicio", t === entrada);
    b.classList.toggle("tem-fim", !!fim);
    b.classList.toggle("fim", t === fim);
    b.classList.toggle("meio", !!fim && t > entrada && t < fim);
    b.setAttribute("aria-pressed", t === entrada || t === saida);
  }
}

mesesEl.addEventListener("click", (ev) => {
  const b = ev.target.closest(".dia");
  if (!b || b.disabled) return;
  const t = +b.dataset.t;
  if (!estado.entrada || estado.saida || t < estado.entrada) {
    estado.entrada = t;
    estado.saida = null;
  } else if (t > estado.entrada) {
    estado.saida = t;
  }
  previa = null;
  pintar();
  atualizar();
});
mesesEl.addEventListener("mouseover", (ev) => {
  const b = ev.target.closest(".dia");
  if (!b || !estado.entrada || estado.saida) return;
  previa = +b.dataset.t;
  pintar();
});
mesesEl.addEventListener("mouseleave", () => { previa = null; pintar(); });

$("#cal-ant").addEventListener("click", () => {
  vista = new Date(vista.getFullYear(), vista.getMonth() - 1, 1);
  desenharCalendario();
});
$("#cal-prox").addEventListener("click", () => {
  vista = new Date(vista.getFullYear(), vista.getMonth() + 1, 1);
  desenharCalendario();
});
doisMeses.addEventListener("change", desenharCalendario);

// ---------- hóspedes ----------
for (const c of $$(".contador")) {
  const campo = c.dataset.campo;
  const [menos, mais] = $$("button", c);
  const saidaEl = $("output", c);
  const mostrar = () => {
    saidaEl.value = estado[campo];
    menos.disabled = estado[campo] <= +c.dataset.min;
    mais.disabled = estado[campo] >= +c.dataset.max;
  };
  c.addEventListener("click", (ev) => {
    const passo = +ev.target.closest("button")?.dataset.passo || 0;
    if (!passo) return;
    estado[campo] = Math.min(+c.dataset.max, Math.max(+c.dataset.min, estado[campo] + passo));
    mostrar();
    atualizar();
  });
  mostrar();
}

// ---------- resumo e botões ----------
const btnAlugar = $("#btn-alugar");
const barra = $("#barra-movel");
const barraBtn = $("#barra-btn");

function dados() {
  return { ...estado, entrada: estado.entrada && new Date(estado.entrada), saida: estado.saida && new Date(estado.saida) };
}

function atualizar() {
  const d = dados();
  const pronto = !!(d.entrada && d.saida);
  const curta = (x) => `${x.getDate()} ${MESES[x.getMonth()].slice(0, 3)}`;

  $("#dica").innerHTML = !d.entrada ? "Toque na data de <b>entrada</b>"
    : !d.saida ? "Agora toque na data de <b>saída</b>" : "Datas escolhidas! Pode trocar quando quiser.";

  let resumo = "";
  if (pronto) {
    resumo = `${curta(d.entrada)} → ${curta(d.saida)} · ${plural(noites(d.entrada, d.saida), "noite", "noites")}` +
      ` · ${textoHospedes(d)}${d.pets ? ` · ${plural(d.pets, "pet", "pets")}` : ""}`;
  }
  $("#resumo").textContent = resumo;

  btnAlugar.setAttribute("aria-disabled", !pronto);
  btnAlugar.classList.toggle("pronto", pronto);
  btnAlugar.href = pronto ? linkWhatsApp(WHATSAPP, d) : `https://wa.me/${WHATSAPP}`;
  $("#btn-booking").href = linkBooking(BOOKING, d);

  $("#barra-resumo").textContent = pronto ? resumo : d.entrada ? "Falta a data de saída" : "Escolha suas datas";
  barraBtn.textContent = pronto ? "Quero alugar!" : "Ver datas";
  barraBtn.href = pronto ? btnAlugar.href : "#reservar";
  barraBtn.target = pronto ? "_blank" : "";
  barraBtn.classList.toggle("pronto", pronto);
}

btnAlugar.addEventListener("click", (ev) => {
  if (btnAlugar.getAttribute("aria-disabled") === "true") {
    ev.preventDefault();
    const dica = $("#dica");
    dica.animate([{ color: "#a8641f", scale: 1.06 }, { scale: 1 }], { duration: 600 });
    return;
  }
  registrar("whatsapp_reserva");
});
barraBtn.addEventListener("click", () => { if (barraBtn.target) registrar("whatsapp_reserva"); });
$("#btn-booking").addEventListener("click", () => registrar("booking"));
for (const a of $$("[data-evento]")) a.addEventListener("click", () => registrar(a.dataset.evento));

// a barra do celular aparece quando o formulário sai da tela
new IntersectionObserver(([e]) => barra.classList.toggle("visivel", !e.isIntersecting && scrollY > 200))
  .observe($("#reservar"));

desenharCalendario();
atualizar();

// ---------- galeria ----------
const fotos = $$(".foto");
for (const f of $$(".filtros button")) {
  f.addEventListener("click", () => {
    for (const o of $$(".filtros button")) {
      o.classList.toggle("ativo", o === f);
      o.setAttribute("aria-pressed", o === f);
    }
    for (const foto of fotos) foto.hidden = !!f.dataset.filtro && foto.dataset.cat !== f.dataset.filtro;
  });
}

const lb = $("#lightbox");
let visiveis = [];
let atual = 0;
function mostrarFoto(i) {
  atual = (i + visiveis.length) % visiveis.length;
  const btn = $("button", visiveis[atual]);
  $("#lb-img").src = btn.dataset.full;
  $("#lb-img").alt = $("img", btn).alt;
  $("#lb-legenda").textContent = $("figcaption", visiveis[atual]).textContent;
}
$("#galeria").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-full]");
  if (!btn) return;
  visiveis = fotos.filter((f) => !f.hidden);
  mostrarFoto(visiveis.indexOf(btn.parentElement));
  lb.showModal();
});
$(".lb-fechar").addEventListener("click", () => lb.close());
$(".lb-ant").addEventListener("click", () => mostrarFoto(atual - 1));
$(".lb-prox").addEventListener("click", () => mostrarFoto(atual + 1));
lb.addEventListener("click", (ev) => { if (ev.target === lb) lb.close(); });
lb.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowLeft") mostrarFoto(atual - 1);
  if (ev.key === "ArrowRight") mostrarFoto(atual + 1);
});
let toqueX = 0;
lb.addEventListener("touchstart", (ev) => { toqueX = ev.touches[0].clientX; }, { passive: true });
lb.addEventListener("touchend", (ev) => {
  const dx = ev.changedTouches[0].clientX - toqueX;
  if (Math.abs(dx) > 50) mostrarFoto(atual + (dx < 0 ? 1 : -1));
});

// ---------- vídeos: só carrega o YouTube quando a pessoa clica ----------
for (const b of $$(".yt")) {
  b.addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.id}?autoplay=1&rel=0`;
    f.title = b.getAttribute("aria-label");
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    b.replaceWith(f);
  });
}

// ---------- tempo (Open-Meteo, grátis e sem chave) ----------
const ICONES = [[0, "☀️"], [2, "🌤️"], [3, "☁️"], [48, "🌫️"], [67, "🌧️"], [77, "❄️"], [82, "🌦️"], [99, "⛈️"]];
const icone = (codigo) => ICONES.find(([max]) => codigo <= max)?.[1] ?? "🌡️";
fetch("https://api.open-meteo.com/v1/forecast?latitude=-22.7547&longitude=-46.1449" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo&forecast_days=5")
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then(({ daily }) => {
    $("#clima-dias").innerHTML = daily.time.map((dia, i) => {
      const nome = i === 0 ? "hoje" : new Date(`${dia}T12:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return `<div class="clima-dia"><b>${nome}</b><span aria-hidden="true">${icone(daily.weather_code[i])}</span>` +
        `${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</div>`;
    }).join("");
    $("#clima").hidden = false;
  })
  .catch(() => {}); // sem previsão, o bloco continua escondido

// ---------- entrada dos blocos ao rolar ----------
const observador = new IntersectionObserver((itens) => {
  for (const i of itens) if (i.isIntersecting) { i.target.classList.add("visto"); observador.unobserve(i.target); }
}, { rootMargin: "0px 0px -8% 0px" });
for (const el of $$(".reveal")) observador.observe(el);

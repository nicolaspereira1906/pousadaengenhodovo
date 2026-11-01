// Regras do gerenciador, sem DOM (testadas em tests/gestao.test.mjs)

const dois = (n) => String(n).padStart(2, "0");

// AAAA-MM-DD na hora local
export const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
export const deIso = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
export const br = (s) => (s ? s.split("-").reverse().join("/") : "");
export const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// aceita "1.250,50", "1250,5", "1250.50"
export function parseValor(txt) {
  let t = String(txt || "").replace(/[^0-9.,]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isNaN(n) ? 0 : n;
}

export const noites = (entrada, saida) => Math.round((deIso(saida) - deIso(entrada)) / 864e5);

// quarto ocupado em `dia`: do check-in até o dia anterior ao check-out
export const estadiaEm = (regs, quarto, dia) =>
  regs.find((r) => r.quarto === quarto && r.checkIn <= dia && dia < r.checkOut);

export const saidaEm = (regs, quarto, dia) =>
  regs.find((r) => r.quarto === quarto && r.checkOut === dia && r.checkIn < r.checkOut);

// reserva nova [ci, co) que bate com alguma já existente no quarto
export const conflito = (regs, quarto, ci, co) =>
  regs.find((r) => r.quarto === quarto && ci < r.checkOut && r.checkIn < co);

// células do mês: null = espaço antes do dia 1
export function grade(ano, mes) {
  const total = new Date(ano, mes + 1, 0).getDate();
  const celulas = Array(new Date(ano, mes, 1).getDay()).fill(null);
  for (let n = 1; n <= total; n++) celulas.push({ n, chave: `${ano}-${dois(mes + 1)}-${dois(n)}` });
  return celulas;
}

// Check-in: horário real do registro. Check-out: sempre meio-dia.
export const HORA_CHECKOUT = "12:00";
export const agora = (d = new Date()) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
export const fmtCheckIn = (r) => br(r.checkIn) + (r.checkInHora ? ` ${r.checkInHora}` : "");
export const fmtCheckOut = (r) => `${br(r.checkOut)} ${HORA_CHECKOUT}`;

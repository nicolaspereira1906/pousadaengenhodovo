// Regras do gerenciador, sem DOM (testadas em tests/gestao.test.mjs)

const dois = (n) => String(n).padStart(2, "0");

// AAAA-MM-DD na hora local
export const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
export const deIso = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
export const br = (s) => (s ? s.split("-").reverse().join("/") : "");
export const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// aceita "1.250,50", "1.250", "1250,5", "1250.50"
export function parseValor(txt) {
  let t = String(txt || "").replace(/[^0-9.,]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.250" = mil duzentos e cinquenta
  const n = parseFloat(t);
  return Number.isNaN(n) ? 0 : n;
}

// máscara do valor: o que se digita são reais e as casas decimais ficam sempre visíveis
// "" -> 0,00 | 25 -> 25,00 | 250 -> 250,00 | 2500 -> 2.500,00 | 250,5 -> 250,50
export function mascaraValor(txt) {
  const t = String(txt || "").replace(/[^\d,]/g, "");
  const v = t.indexOf(",");
  const inteiro = (v >= 0 ? t.slice(0, v) : t).replace(/^0+/, "").slice(0, 9) || "0";
  const dec = (v >= 0 ? t.slice(v + 1).replace(/,/g, "") : "").slice(0, 2).padEnd(2, "0");
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
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

// Café da manhã (cobrado à parte): o que a camareira precisa saber
export const CAFES = ["Com café", "Sem café"];
export const rotuloCafe = (c) => (CAFES.includes(c) ? c : "Café não informado");

// Para a camareira: "não informado" soa como erro; o que ela precisa é confirmar com a recepção
export const rotuloCafeCamareira = (c) => (CAFES.includes(c) ? c : "Café a confirmar");
export const cafeClasse = (c) => (c === "Com café" ? "com" : c === "Sem café" ? "sem" : "nd");

// Quarto pronto para limpeza: locação com limpeza "Pendente" cujo check-out já passou
// (dias anteriores, ou hoje a partir das 12:00). Espelha a regra do servidor; hoje e hora vêm do servidor.
export const precisaLimpeza = (limpeza, checkIn, checkOut, hoje, hora) =>
  limpeza === "Pendente" && checkIn < checkOut && (checkOut < hoje || (checkOut === hoje && hora >= HORA_CHECKOUT));

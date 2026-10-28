// Regras da reserva, sem DOM (testadas em tests/reserva.test.mjs)

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

const dois = (n) => String(n).padStart(2, "0");

export const noites = (entrada, saida) => Math.round((saida - entrada) / 864e5);

// AAAA-MM-DD na hora local (toISOString usaria UTC e poderia trocar o dia)
export const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

export const dataCurta = (d) => `${SEMANA[d.getDay()]}, ${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function textoHospedes({ adultos, criancas }) {
  const partes = [plural(adultos, "adulto", "adultos")];
  if (criancas) partes.push(plural(criancas, "criança", "crianças"));
  return partes.join(" e ");
}

export function mensagem({ entrada, saida, adultos, criancas }) {
  return [
    // "Quero fazer uma reserva!" é o texto que o gatilho de conversão do Tag Manager procura no link
    "Olá! Quero fazer uma reserva!",
    "",
    `Entrada: ${dataCurta(entrada)}`,
    `Saída: ${dataCurta(saida)} (${plural(noites(entrada, saida), "noite", "noites")})`,
    `Hóspedes: ${textoHospedes({ adultos, criancas })}`,
    "",
    "Tem vaga?",
  ].join("\n");
}

export const linkWhatsApp = (numero, dados) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(mensagem(dados))}`;

export function linkBooking(base, { entrada, saida, adultos, criancas }) {
  const p = new URLSearchParams({ group_adults: adultos, group_children: criancas, no_rooms: 1 });
  if (entrada && saida) {
    p.set("checkin", iso(entrada));
    p.set("checkout", iso(saida));
  }
  return `${base}?${p}`;
}

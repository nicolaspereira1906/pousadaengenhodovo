import { test } from "node:test";
import assert from "node:assert/strict";
import { iso, br, parseValor, mascaraValor, noites, estadiaEm, saidaEm, conflito, grade, agora, fmtCheckIn, fmtCheckOut } from "../gestao/regras.js";

const regs = [{ quarto: 3, checkIn: "2026-11-10", checkOut: "2026-11-13", hospedes: 2, valor: 900 }];

test("datas locais e formato brasileiro", () => {
  assert.equal(iso(new Date(2026, 10, 1)), "2026-11-01");
  assert.equal(br("2026-11-01"), "01/11/2026");
  assert.equal(noites("2026-11-10", "2026-11-13"), 3);
});

test("valor aceita formato brasileiro", () => {
  assert.equal(parseValor("1.250,50"), 1250.5);
  assert.equal(parseValor("900"), 900);
  assert.equal(parseValor("abc"), 0);
  assert.equal(parseValor("1.000"), 1000);
  assert.equal(parseValor("1"), 1);
  assert.equal(parseValor("1.250,5"), 1250.5);
});

test("quarto fica ocupado até o dia anterior ao check-out", () => {
  assert.ok(estadiaEm(regs, 3, "2026-11-10"));
  assert.ok(estadiaEm(regs, 3, "2026-11-12"));
  assert.equal(estadiaEm(regs, 3, "2026-11-13"), undefined);
  assert.equal(estadiaEm(regs, 4, "2026-11-11"), undefined);
  assert.ok(saidaEm(regs, 3, "2026-11-13"));
});

test("detecta reserva sobreposta e aceita a que começa no dia da saída", () => {
  assert.ok(conflito(regs, 3, "2026-11-12", "2026-11-15"));
  assert.ok(conflito(regs, 3, "2026-11-08", "2026-11-11"));
  assert.equal(conflito(regs, 3, "2026-11-13", "2026-11-15"), undefined);
  assert.equal(conflito(regs, 3, "2026-11-07", "2026-11-10"), undefined);
  assert.equal(conflito(regs, 5, "2026-11-10", "2026-11-13"), undefined);
});

test("grade do mês começa no dia da semana certo", () => {
  const g = grade(2026, 10); // 1/11/2026 é domingo
  assert.equal(g[0].n, 1);
  assert.equal(g.length, 30);
  assert.equal(grade(2026, 9)[0], null); // 1/10/2026 é quinta
});

test("check-in mostra o horário do registro e check-out é sempre meio-dia", () => {
  assert.equal(agora(new Date(2026, 10, 1, 9, 5)), "09:05");
  assert.equal(fmtCheckIn({ checkIn: "2026-11-01", checkInHora: "14:32" }), "01/11/2026 14:32");
  assert.equal(fmtCheckIn({ checkIn: "2026-11-01" }), "01/11/2026");
  assert.equal(fmtCheckOut({ checkOut: "2026-11-04" }), "04/11/2026 12:00");
});

test("máscara do valor: reais com casas decimais sempre visíveis", () => {
  assert.equal(mascaraValor(""), "0,00");
  assert.equal(mascaraValor("2"), "2,00");
  assert.equal(mascaraValor("02,00"), "2,00"); // digitou 2 antes do 0 de "0,00"
  assert.equal(mascaraValor("25,00"), "25,00");
  assert.equal(mascaraValor("250,00"), "250,00");
  assert.equal(mascaraValor("2500,00"), "2.500,00");
  assert.equal(mascaraValor("1.2500,00"), "12.500,00");
  assert.equal(mascaraValor("1250000"), "1.250.000,00");
  assert.equal(mascaraValor("250,5"), "250,50");
  assert.equal(mascaraValor("25,050"), "25,05");
  assert.equal(mascaraValor(",00"), "0,00");
  assert.equal(mascaraValor("abc"), "0,00");
  assert.equal(parseValor(mascaraValor("2500,5")), 2500.5);
});

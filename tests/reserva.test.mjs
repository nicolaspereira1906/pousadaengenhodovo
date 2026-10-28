import { test } from "node:test";
import assert from "node:assert/strict";
import { noites, iso, mensagem, linkWhatsApp, linkBooking } from "../assets/js/reserva.js";

const entrada = new Date(2026, 9, 29); // 29/10/2026, quinta
const saida = new Date(2026, 10, 2);

test("conta noites e formata datas locais", () => {
  assert.equal(noites(entrada, saida), 4);
  assert.equal(iso(saida), "2026-11-02");
});

test("mensagem do WhatsApp leva tudo o que foi preenchido", () => {
  const msg = mensagem({ entrada, saida, adultos: 2, criancas: 1, pets: 1 });
  assert.match(msg, /Entrada: qui, 29\/10\/2026/);
  assert.match(msg, /Saída: seg, 02\/11\/2026/);
  assert.match(msg, /4 noites/);
  assert.match(msg, /2 adultos e 1 criança/);
  assert.match(msg, /1 pet/);
  assert.doesNotMatch(mensagem({ entrada, saida, adultos: 1, criancas: 0, pets: 0 }), /pet|criança/);
});

test("links de WhatsApp e Booking", () => {
  const wa = linkWhatsApp("5535988773223", { entrada, saida, adultos: 1, criancas: 0, pets: 0 });
  assert.ok(wa.startsWith("https://wa.me/5535988773223?text="));
  assert.match(decodeURIComponent(wa), /1 adulto\n/);
  const bk = linkBooking("https://b.com/h.html", { entrada, saida, adultos: 3, criancas: 2 });
  assert.equal(bk, "https://b.com/h.html?group_adults=3&group_children=2&no_rooms=1&checkin=2026-10-29&checkout=2026-11-02");
});

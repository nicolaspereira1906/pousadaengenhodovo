// Pousada Engenho do Vô: back-end da área privada (/gestao).
// Fica na planilha "Hóspedes e Pagamentos" (Extensões > Apps Script).
// Colunas da aba "Registros": A Data | B Quarto | C Hóspedes | D Valor (R$) | E Forma de pagamento | F Check-in (data e hora) | G Check-out (sempre 12:00)
//
// O usuário e a senha NÃO ficam neste arquivo. Cadastre em
// Configurações do projeto > Propriedades do script:  USUARIO  e  SENHA

const ABA = 'Registros';
const FUSO = 'America/Sao_Paulo';
const HORA_CHECKOUT = '12:00'; // check-out sempre ao meio-dia
const VERSAO = 'v3-checkin-com-horario';
const SESSAO_SEGUNDOS = 6 * 60 * 60; // 6 horas (máximo do CacheService)
const MAX_ERROS = 5;                 // erros de login antes de bloquear
const BLOQUEIO_SEGUNDOS = 15 * 60;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);

    if (d.acao === 'login') return entrar(d);

    if (!sessaoValida(d.token)) return saida({ ok: false, erro: 'sessao' });
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);

    if (d.acao === 'listar') return saida({ ok: true, registros: listar(aba) });

    if (d.acao === 'salvar') {
      aba.appendRow([
        paraData(d.data), Number(d.quarto), Number(d.hospedes), Number(d.valor),
        String(d.pagamento), paraData(d.checkIn, d.checkInHora), paraData(d.checkOut, HORA_CHECKOUT)
      ]);
      return saida({ ok: true });
    }

    if (d.acao === 'checkout') {
      const valores = aba.getDataRange().getValues();
      for (let i = valores.length - 1; i >= 1; i--) {
        const entrada = Utilities.formatDate(new Date(valores[i][5]), FUSO, 'yyyy-MM-dd');
        if (Number(valores[i][1]) === Number(d.quarto) && entrada === d.checkIn) {
          aba.getRange(i + 1, 7).setValue(paraData(d.checkOut, HORA_CHECKOUT));
          return saida({ ok: true });
        }
      }
      return saida({ ok: false, erro: 'Estadia não encontrada' });
    }

    return saida({ ok: false, erro: 'Ação desconhecida' });
  } catch (err) {
    return saida({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return saida({ ok: true, versao: VERSAO, mensagem: 'Área privada da pousada. Use o site para entrar.' });
}

function entrar(d) {
  const cache = CacheService.getScriptCache();
  if (Number(cache.get('erros') || 0) >= MAX_ERROS) {
    return saida({ ok: false, erro: 'Muitas tentativas. Aguarde 15 minutos.' });
  }
  const props = PropertiesService.getScriptProperties();
  const usuario = props.getProperty('USUARIO');
  const senha = props.getProperty('SENHA');
  if (!usuario || !senha) return saida({ ok: false, erro: 'Acesso ainda não configurado na planilha.' });

  const certo = iguais(String(d.usuario || ''), usuario) & iguais(String(d.senha || ''), senha);
  if (!certo) {
    Utilities.sleep(1500);
    cache.put('erros', String(Number(cache.get('erros') || 0) + 1), BLOQUEIO_SEGUNDOS);
    return saida({ ok: false, erro: 'Usuário ou senha incorretos.' });
  }
  cache.remove('erros');
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('s_' + token, '1', SESSAO_SEGUNDOS);
  return saida({ ok: true, token: token });
}

function sessaoValida(token) {
  return !!token && CacheService.getScriptCache().get('s_' + token) === '1';
}

// comparação sem parar no primeiro caractere diferente
function iguais(a, b) {
  let r = a.length === b.length ? 0 : 1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0 ? 1 : 0;
}

function listar(aba) {
  return aba.getDataRange().getValues().slice(1).filter((l) => l[1] !== '').map((l) => ({
    data: Utilities.formatDate(new Date(l[0]), FUSO, 'yyyy-MM-dd'),
    quarto: Number(l[1]),
    hospedes: Number(l[2]),
    valor: Number(l[3]),
    pagamento: String(l[4]),
    checkIn: Utilities.formatDate(new Date(l[5]), FUSO, 'yyyy-MM-dd'),
    checkInHora: Utilities.formatDate(new Date(l[5]), FUSO, 'HH:mm'),
    checkOut: Utilities.formatDate(new Date(l[6]), FUSO, 'yyyy-MM-dd')
  }));
}

// Data (dd/mm/aaaa ou aaaa-mm-dd) + hora (HH:mm, padrão 12:00), no fuso de São Paulo
function paraData(txt, hora) {
  const s = String(txt);
  let a, m, d;
  if (s.indexOf('/') >= 0) { [d, m, a] = s.split('/'); }
  else { [a, m, d] = s.split('-'); }
  const h = /^\d{1,2}:\d{2}$/.test(String(hora || '')) ? String(hora) : '12:00';
  const texto = a + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2) + ' ' + ('0' + h).slice(-5);
  return Utilities.parseDate(texto, FUSO, 'yyyy-MM-dd HH:mm');
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

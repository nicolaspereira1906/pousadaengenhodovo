// Pousada Engenho do Vô: back-end da área privada (/gestao).
// Fica na planilha "Hóspedes e Pagamentos" (Extensões > Apps Script).
// Colunas da aba "Registros":
//   A Data | B Quarto | C Hóspedes | D Valor (R$) | E Forma de pagamento | F Check-in (data e hora) | G Check-out (12:00) | H Café
//
// Dois acessos, definidos em Configurações do projeto > Propriedades do script:
//   USUARIO e SENHA                        -> administração (vê tudo, lança e edita)
//   USUARIO_CAMAREIRA e SENHA_CAMAREIRA    -> camareira (só vê livre/ocupado/pronto para limpeza, hóspedes e café de HOJE)
// Nenhuma senha fica neste arquivo.

const ABA = 'Registros';
const FUSO = 'America/Sao_Paulo';
const HORA_CHECKOUT = '12:00'; // check-out sempre ao meio-dia
const VERSAO = 'v8-cafe-por-horario-de-checkin';
// Café da manhã: quem faz check-in HOJE só entra na conta de hoje se o check-in foi até este horário (madrugada).
// Depois disso, o café só conta a partir do dia seguinte. Quem chegou em dias anteriores conta sempre.
const HORA_LIMITE_CAFE = '06:00';
const SESSAO_SEGUNDOS = 6 * 60 * 60; // 6 horas (máximo do CacheService)
const MAX_ERROS = 5;                 // erros de login antes de bloquear
const BLOQUEIO_SEGUNDOS = 15 * 60;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);

    if (d.acao === 'login') return entrar(d);

    const papel = papelDaSessao(d.token);
    if (!papel) return saida({ ok: false, erro: 'sessao' });
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
    const agora = new Date();
    const hoje = Utilities.formatDate(agora, FUSO, 'yyyy-MM-dd');
    const hora = Utilities.formatDate(agora, FUSO, 'HH:mm'); // hora do servidor: o relógio do celular não manda

    if (d.acao === 'listar') {
      // A camareira NUNCA recebe valor, forma de pagamento ou datas de outros dias: o filtro é aqui, no servidor.
      const registros = papel === 'admin' ? listar(aba) : listarCamareira(aba, hoje, hora);
      return saida({ ok: true, papel: papel, hoje: hoje, registros: registros });
    }

    if (papel !== 'admin') return saida({ ok: false, erro: 'Sem permissão para esta ação.' });

    if (d.acao === 'salvar') {
      aba.appendRow([
        soData(d.data), Number(d.quarto), Number(d.hospedes), Number(d.valor),
        String(d.pagamento), paraData(d.checkIn, d.checkInHora), paraData(d.checkOut, HORA_CHECKOUT),
        d.cafe === 'Com café' ? 'Com café' : 'Sem café'
      ]);
      // formatos explícitos: o Sheets sozinho trocaria a coluna Data para data e hora
      const linha = aba.getLastRow();
      aba.getRange(linha, 1).setNumberFormat('dd/mm/yyyy');
      aba.getRange(linha, 4).setNumberFormat('"R$" #,##0.00');
      aba.getRange(linha, 6, 1, 2).setNumberFormat('dd/mm/yyyy hh:mm');
      return saida({ ok: true });
    }

    if (d.acao === 'checkout') {
      const valores = aba.getDataRange().getValues();
      for (let i = valores.length - 1; i >= 1; i--) {
        const entrada = Utilities.formatDate(new Date(valores[i][5]), FUSO, 'yyyy-MM-dd');
        if (Number(valores[i][1]) === Number(d.quarto) && entrada === d.checkIn) {
          aba.getRange(i + 1, 7).setValue(paraData(d.checkOut, HORA_CHECKOUT)).setNumberFormat('dd/mm/yyyy hh:mm');
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
  const usuario = String(d.usuario || ''), senha = String(d.senha || '');

  const admin = props.getProperty('USUARIO') && props.getProperty('SENHA')
    ? iguais(usuario, props.getProperty('USUARIO')) & iguais(senha, props.getProperty('SENHA')) : 0;
  const camareira = props.getProperty('USUARIO_CAMAREIRA') && props.getProperty('SENHA_CAMAREIRA')
    ? iguais(usuario, props.getProperty('USUARIO_CAMAREIRA')) & iguais(senha, props.getProperty('SENHA_CAMAREIRA')) : 0;

  if (!props.getProperty('USUARIO') && !props.getProperty('USUARIO_CAMAREIRA')) {
    return saida({ ok: false, erro: 'Acesso ainda não configurado na planilha.' });
  }
  const papel = admin ? 'admin' : camareira ? 'camareira' : null;
  if (!papel) {
    Utilities.sleep(1500);
    cache.put('erros', String(Number(cache.get('erros') || 0) + 1), BLOQUEIO_SEGUNDOS);
    return saida({ ok: false, erro: 'Usuário ou senha incorretos.' });
  }
  cache.remove('erros');
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('s_' + token, papel, SESSAO_SEGUNDOS);
  return saida({ ok: true, token: token, papel: papel });
}

// devolve 'admin', 'camareira' ou null. Sessões criadas antes desta versão guardavam '1' e eram do admin.
function papelDaSessao(token) {
  if (!token) return null;
  const v = CacheService.getScriptCache().get('s_' + token);
  if (v === 'camareira') return 'camareira';
  if (v === 'admin' || v === '1') return 'admin';
  return null;
}

// comparação sem parar no primeiro caractere diferente
function iguais(a, b) {
  let r = a.length === b.length ? 0 : 1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0 ? 1 : 0;
}

function lerLinhas(aba) {
  return aba.getDataRange().getValues().slice(1).filter((l) => l[1] !== '');
}

function listar(aba) {
  return lerLinhas(aba).map((l) => ({
    data: Utilities.formatDate(new Date(l[0]), FUSO, 'yyyy-MM-dd'),
    quarto: Number(l[1]),
    hospedes: Number(l[2]),
    valor: Number(l[3]),
    pagamento: String(l[4]),
    checkIn: Utilities.formatDate(new Date(l[5]), FUSO, 'yyyy-MM-dd'),
    checkInHora: Utilities.formatDate(new Date(l[5]), FUSO, 'HH:mm'),
    checkOut: Utilities.formatDate(new Date(l[6]), FUSO, 'yyyy-MM-dd'),
    cafe: String(l[7] || '')
  }));
}

// Camareira: só o que importa HOJE, sem valor, pagamento nem datas.
//  - situacao "ocupado": hóspede no quarto (hospedes e café); chegaHoje = o check-in é hoje
//  - situacao "saindo": check-out é hoje e ainda não deu meio-dia (hóspede ainda no quarto: hospedes e café)
//  - situacao "limpeza": check-out é hoje e já passou do meio-dia: quarto liberado, pronto para limpeza
function listarCamareira(aba, hoje, hora) {
  const saida = [];
  listar(aba).forEach((r) => {
    // conta no café de hoje: dormiu aqui na noite anterior ou chegou na madrugada (até HORA_LIMITE_CAFE)
    const cafeHoje = r.cafe === 'Com café' && (r.checkIn < hoje || (r.checkInHora || '99:99') <= HORA_LIMITE_CAFE);
    if (r.checkIn <= hoje && hoje < r.checkOut) {
      saida.push({ quarto: r.quarto, situacao: 'ocupado', hospedes: r.hospedes, cafe: r.cafe, chegaHoje: r.checkIn === hoje, cafeHoje: cafeHoje });
    } else if (r.checkOut === hoje && r.checkIn < r.checkOut) {
      if (hora >= HORA_CHECKOUT) saida.push({ quarto: r.quarto, situacao: 'limpeza' });
      else saida.push({ quarto: r.quarto, situacao: 'saindo', hospedes: r.hospedes, cafe: r.cafe, cafeHoje: cafeHoje });
    }
  });
  return saida;
}

// Só a data (sem horário): meia-noite no fuso de São Paulo
function soData(txt) {
  const s = String(txt);
  let a, m, d;
  if (s.indexOf('/') >= 0) { [d, m, a] = s.split('/'); }
  else { [a, m, d] = s.split('-'); }
  return Utilities.parseDate(a + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2), FUSO, 'yyyy-MM-dd');
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

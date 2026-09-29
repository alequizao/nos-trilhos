/* Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados. */
// Recompensa diária, compartilhar e Duelo Lula × Flávio (módulo independente; fala com ./duelo.php).
//
// Uso no jogo.js:
//   import { iniciaSocial, socialFim, mostraDiariaSeDevida } from './social.js?v=1.0.5';
//   iniciaSocial({ get S() { return S; }, salvar, SKINS, trocaSkin, mostra, iniciar, audio, atualizaMenu, toast });
//   mostraDiariaSeDevida();      // espera a #tela-escolha sumir e o menu aparecer; mostra 1x por dia
//   socialFim({ corrida: R, pontos, moedas, dist }); // no fim de jogo: soma ao time do personagem e prepara "Desafiar amigos"
// HTML: #tela-diaria, #tela-duelo, #bt-duelo e #bt-compartilhar (menu), #bt-desafiar e #dl-fim (fim), #tela-compartilhar.
// Save (S): diaria {ultimo, seq}, dueloHoje {dia, lula, flavio}, dueloPend [] — saves antigos sem esses campos funcionam.

const API = new URL('duelo.php', import.meta.url).href;
const LINK = 'https://alequizao.com/trilhos/';
const $ = s => document.querySelector(s);
const fmt = n => Math.floor(n).toLocaleString('pt-BR');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const NOME_TIME = { lula: 'Lula', flavio: 'Flávio' };
const DIAS = [
  { moedas: 100 }, { moedas: 150 }, { moedas: 200 }, { moedas: 300 }, { moedas: 400 }, { moedas: 500 }, { moedas: 1000, pranchas: 2 },
];

let C = null;                 // contexto do jogo
const enviados = new WeakMap(); // corrida -> {pontos, moedas, dist} já somados ao duelo (continuar não duplica)
let ultimaCorrida = null;

// ---------- utilidades ----------
function hojeStr(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function ontemStr() { const d = new Date(); d.setDate(d.getDate() - 1); return hojeStr(d); }
const skinAtual = () => (C.SKINS[C.S.skin] || C.SKINS[0] || {});
const timeDe = s => (s && (s.time === 'lula' || s.time === 'flavio')) ? s.time : null;

function injetaIcones() {
  if (document.getElementById('i-compartilhar')) return;
  const d = document.createElement('div');
  d.innerHTML = `<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true" focusable="false">
<symbol id="i-compartilhar" viewBox="0 0 24 24"><circle cx="18" cy="5.2" r="3.2" fill="currentColor"/><circle cx="6" cy="12" r="3.2" fill="currentColor"/><circle cx="18" cy="18.8" r="3.2" fill="currentColor"/><path d="M8.6 10.6l6.8-3.9M8.6 13.4l6.8 3.9" stroke="currentColor" stroke-width="2.2"/></symbol>
<symbol id="i-presente" viewBox="0 0 24 24"><rect x="3" y="8.2" width="18" height="4.6" rx="1.3" fill="currentColor"/><path d="M4.6 13.8h14.8v6.2c0 .8-.6 1.4-1.4 1.4H6c-.8 0-1.4-.6-1.4-1.4z" fill="currentColor"/><path d="M12 8.2v13.2" stroke="#fff" stroke-width="2" opacity=".55"/><path d="M12 8c-1.6-3.6-5.6-4.6-6-2.2-.3 1.9 3.3 2.3 6 2.2zM12 8c1.6-3.6 5.6-4.6 6-2.2.3 1.9-3.3 2.3-6 2.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
<symbol id="i-duelo" viewBox="0 0 24 24"><path d="M3.2 3.2h3.4l8.3 8.3-1.7 1.7L4.9 4.9zM20.8 3.2h-3.4l-8.3 8.3 1.7 1.7 8.3-8.3z" fill="currentColor"/><path d="M5 14.6l4.4 4.4M19 14.6 14.6 19M3.6 17.8l2.6 2.6M20.4 17.8l-2.6 2.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
<symbol id="i-copiar" viewBox="0 0 24 24"><rect x="8" y="8" width="12.6" height="12.6" rx="2.4" fill="currentColor"/><path d="M5.6 15.4H5a1.6 1.6 0 0 1-1.6-1.6V5a1.6 1.6 0 0 1 1.6-1.6h8.8A1.6 1.6 0 0 1 15.4 5v.6" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol>
<symbol id="i-whats" viewBox="0 0 24 24"><path d="M12 2.6a9.4 9.4 0 0 0-8.1 14.2L2.6 21.4l4.7-1.2A9.4 9.4 0 1 0 12 2.6z" fill="currentColor"/><path d="M8.6 7.6c.3-.3.8-.3 1 .1l1 2c.1.3 0 .6-.2.8l-.6.6c.6 1.3 1.7 2.4 3 3l.6-.6c.2-.2.5-.3.8-.2l2 1c.4.2.4.7.1 1l-.7.8c-.6.6-1.6.7-2.4.3a10 10 0 0 1-5-5c-.4-.8-.3-1.8.3-2.4z" fill="#fff"/></symbol>
<symbol id="i-baixar" viewBox="0 0 24 24"><path d="M12 3.4v11M7.2 10l4.8 4.8 4.8-4.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16.8v2.2c0 .9.7 1.6 1.6 1.6h12.8c.9 0 1.6-.7 1.6-1.6v-2.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
</svg>`;
  document.body.appendChild(d.firstChild);
}

// ---------- rede ----------
async function chama(opcoes = {}) {
  if (navigator.onLine === false) throw Object.assign(new Error('offline'), { offline: true });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(API, { cache: 'no-store', signal: ctl.signal, ...opcoes });
    let j = null; try { j = await r.json(); } catch { /* não-JSON */ }
    if (!j) throw new Error('Duelo indisponível no momento.');
    if (!r.ok || !j.ok) throw Object.assign(new Error(j.erro || 'Duelo indisponível no momento.'), { status: r.status });
    return j;
  } catch (e) {
    if (e.name === 'AbortError' || e instanceof TypeError) throw Object.assign(new Error('offline'), { offline: true });
    throw e;
  } finally { clearTimeout(t); }
}
const envia = dados => chama({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });

// =============== RECOMPENSA DIÁRIA ===============
function estadoDiaria() {
  const S = C.S, d = S.diaria && typeof S.diaria === 'object' ? S.diaria : { ultimo: '', seq: 0 };
  const hoje = hojeStr();
  if (d.ultimo === hoje) return { devida: false, dia: ((d.seq || 1) - 1) % 7 };
  const segue = d.ultimo === ontemStr() && d.seq > 0 && d.seq < 7;
  return { devida: true, dia: segue ? d.seq : 0 }; // índice 0..6 do prêmio de hoje
}
function premioTxt(p) { return `${fmt(p.moedas)} moedas${p.pranchas ? ` + ${p.pranchas} pranchas` : ''}`; }
function renderDiaria() {
  const { dia } = estadoDiaria();
  $('#dr-dias').innerHTML = DIAS.map((p, i) => `<div class="dr-dia${i < dia ? ' dr-pego' : ''}${i === dia ? ' dr-hoje' : ''}${i === 6 ? ' dr-bonus' : ''}">
    <small>Dia ${i + 1}</small><span class="dr-ic">${i < dia ? ic('check') : p.pranchas ? ic('prancha') : '<span class="moeda-ic"></span>'}</span>
    <b>${fmt(p.moedas)}</b>${p.pranchas ? `<em>+${p.pranchas} pranchas</em>` : ''}</div>`).join('');
  $('#dr-sub').textContent = dia === 0 ? 'Entre todo dia seguido: o prêmio cresce! Perdeu um dia, volta ao dia 1.'
    : `Sequência de ${dia} ${dia === 1 ? 'dia' : 'dias'}! Não quebra a corrente, hein.`;
  const bt = $('#dr-pegar'); bt.disabled = false;
  bt.innerHTML = `${ic('presente')} Pegar ${premioTxt(DIAS[dia])}`;
}
function pegaDiaria() {
  const est = estadoDiaria(); if (!est.devida) { fechaDiaria(); return; }
  const p = DIAS[est.dia], S = C.S;
  S.moedas += p.moedas; if (p.pranchas) S.pranchas += p.pranchas;
  S.diaria = { ultimo: hojeStr(), seq: est.dia + 1 };
  C.salvar(); C.audio && C.audio();
  $('#dr-pegar').disabled = true;
  C.toast(`${ic('presente')}<span>+${premioTxt(p)}! Volta amanhã pro dia ${est.dia === 6 ? 1 : est.dia + 2}.</span>`);
  fechaDiaria();
}
function fechaDiaria() { diariaFeita = true; C.atualizaMenu(); C.mostra('#tela-menu'); }

let diariaFeita = false, observando = false;
const visivel = el => el && !el.classList.contains('oculto') && getComputedStyle(el).display !== 'none';
function tentaDiaria() {
  if (diariaFeita || !C) return;
  if (!estadoDiaria().devida) { diariaFeita = true; return; }
  if (visivel($('#tela-escolha')) || !visivel($('#tela-menu'))) return; // espera a escolha de personagem / volta ao menu
  renderDiaria(); C.mostra('#tela-diaria');
}
// Mostra o calendário quando o menu principal estiver na tela (e a #tela-escolha não), 1x por dia.
// Pode ser chamada várias vezes; não bloqueia a escolha de personagem.
export function mostraDiariaSeDevida() {
  if (!C || diariaFeita) return;
  if (!observando) {
    observando = true;
    const obs = new MutationObserver(() => { if (diariaFeita) { obs.disconnect(); return; } clearTimeout(tentaDiaria.t); tentaDiaria.t = setTimeout(tentaDiaria, 350); });
    ['#tela-menu', '#tela-escolha'].forEach(s => { const el = $(s); if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }); });
    // a #tela-escolha pode ser criada depois
    if (!$('#tela-escolha')) { const o2 = new MutationObserver(() => { const el = $('#tela-escolha'); if (el) { o2.disconnect(); obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }); } }); o2.observe(document.body, { childList: true }); setTimeout(() => o2.disconnect(), 15000); }
  }
  clearTimeout(tentaDiaria.t); tentaDiaria.t = setTimeout(tentaDiaria, 600); // dá tempo da escolha abrir primeiro
}

// =============== COMPARTILHAR ===============
function textoMenu() { return `Bora correr nos trilhos? Alex, Lula ou Flávio: escolhe o teu e foge do segurança! Jogo 3D grátis no navegador: ${LINK} — por @alequizao`; }
function textoFim(c) {
  const p = skinAtual().nome || 'Alex', t = timeDe(skinAtual());
  return `Fiz ${fmt(c.pontos)} pontos (${fmt(c.dist)} m) correndo de ${p} no Trilhos!${t ? ` Time ${NOME_TIME[t]} no duelo!` : ''} Duvido você me passar: ${LINK} — por @alequizao`;
}

// imagem do placar 1080x1350
async function imagemPlacar(c) {
  try { await Promise.race([document.fonts.load('120px "Lilita One"'), new Promise(r => setTimeout(r, 1200))]); } catch { /* sem fonte: usa a padrão */ }
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  const g = cv.getContext('2d'), W = 1080, t = timeDe(skinAtual());
  const bg = g.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, '#1d4fc4'); bg.addColorStop(.55, '#002776'); bg.addColorStop(1, '#001541'); g.fillStyle = bg; g.fillRect(0, 0, W, 1350);
  // trilhos em perspectiva
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 14;
  for (const x of [-500, 0, 500]) { g.beginPath(); g.moveTo(W / 2 + x * .15, 560); g.lineTo(W / 2 + x * 1.6, 1350); g.stroke(); }
  for (let i = 0; i < 9; i++) { const y = 600 + i * i * 10 + i * 40, k = (y - 560) / 790; g.fillStyle = 'rgba(255,223,0,.08)'; g.fillRect(W / 2 - 150 - k * 700, y, 300 + k * 1400, 8 + k * 14); }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const lilita = n => `${n}px "Lilita One", "Arial Black", sans-serif`;
  const titulo = (txt, y, n, cor) => { g.font = lilita(n); g.lineJoin = 'round'; g.lineWidth = n * .18; g.strokeStyle = '#001541'; g.strokeText(txt, W / 2, y); g.fillStyle = cor; g.fillText(txt, W / 2, y); };
  titulo('NOS TRILHOS', 225, 132, '#ffdf00');
  g.font = '800 44px Nunito, sans-serif'; g.fillStyle = '#e8eeff'; g.fillText('Alex · Lula · Flávio nos Trilhos', W / 2, 310);
  g.font = '800 48px Nunito, sans-serif'; g.fillStyle = '#fff'; g.fillText('Fiz', W / 2, 470);
  titulo(fmt(c.pontos), 640, 190, '#ffffff');
  g.font = '900 52px Nunito, sans-serif'; g.fillStyle = '#ffdf00'; g.fillText('PONTOS', W / 2, 720);
  g.font = '800 42px Nunito, sans-serif'; g.fillStyle = '#e8eeff'; g.fillText(`${fmt(c.dist)} m · ${fmt(c.moedas)} moedas`, W / 2, 800);
  // selo do personagem
  const nome = skinAtual().nome || 'Alex';
  g.font = '900 48px Nunito, sans-serif'; const lw = Math.min(900, g.measureText('correndo de ' + nome).width + 80);
  g.fillStyle = t === 'lula' ? '#e8364f' : t === 'flavio' ? '#009c3b' : '#1d4fc4';
  g.beginPath(); g.roundRect ? g.roundRect(W / 2 - lw / 2, 860, lw, 96, 48) : g.rect(W / 2 - lw / 2, 860, lw, 96); g.fill();
  g.fillStyle = '#fff'; g.fillText('correndo de ' + nome, W / 2, 925, 860);
  if (t) { g.font = '800 40px Nunito, sans-serif'; g.fillStyle = '#ffdf00'; g.fillText(`Duelo: time ${NOME_TIME[t]}!`, W / 2, 1020); }
  titulo('Duvido você me passar!', 1130, 72, '#ffdf00');
  g.font = '900 44px Nunito, sans-serif'; g.fillStyle = '#fff'; g.fillText('alequizao.com/trilhos', W / 2, 1230);
  g.font = '800 38px Nunito, sans-serif'; g.fillStyle = '#9fb6ef'; g.fillText('por @alequizao', W / 2, 1290);
  return new Promise(r => cv.toBlob(b => r(b), 'image/png'));
}

let compAtual = null; // { texto, blob }
async function compartilha(texto, corrida) {
  C.audio && C.audio();
  let arquivo = null;
  if (corrida) { try { const b = await imagemPlacar(corrida); if (b) arquivo = new File([b], 'trilhos-placar.png', { type: 'image/png' }); } catch { /* sem imagem */ } }
  if (navigator.share) {
    try {
      if (arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) await navigator.share({ files: [arquivo], text: texto, title: 'Trilhos' });
      else await navigator.share({ text: texto, title: 'Trilhos', url: LINK });
      return;
    } catch (e) { if (e && e.name === 'AbortError') return; /* outro erro: cai no plano B */ }
  }
  abreFolha(texto, arquivo);
}
function abreFolha(texto, arquivo) {
  compAtual = { texto, arquivo };
  $('#cp-texto').textContent = texto;
  $('#cp-whats').href = 'https://wa.me/?text=' + encodeURIComponent(texto);
  const baixar = $('#cp-baixar');
  if (arquivo) { baixar.classList.remove('oculto'); if (baixar.dataset.url) URL.revokeObjectURL(baixar.dataset.url); baixar.dataset.url = URL.createObjectURL(arquivo); baixar.href = baixar.dataset.url; }
  else baixar.classList.add('oculto');
  $('#cp-msg').textContent = '';
  $('#tela-compartilhar').classList.remove('oculto');
}
async function copia(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch { /* plano B */ }
  try {
    const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

// =============== DUELO ===============
function contribHoje() {
  const d = C.S.dueloHoje;
  return d && d.dia === hojeStr() ? d : { dia: hojeStr(), lula: 0, flavio: 0 };
}
function somaContrib(time, pontos) { const d = contribHoje(); d[time] = (d[time] || 0) + pontos; C.S.dueloHoje = d; }

const corridas = n => `${fmt(n)} ${n === 1 ? 'corrida' : 'corridas'}`;
function renderPlacar(j) {
  const s = j.semana, L = s.lula.pontos, F = s.flavio.pontos, soma = L + F || 1;
  const pl = Math.round(L / soma * 1000) / 10, pf = Math.round((100 - pl) * 10) / 10;
  const lider = L === F ? 'Empate técnico! Cada corrida conta.' : L > F ? 'Time Lula na frente… por enquanto!' : 'Time Flávio na frente… por enquanto!';
  const c = contribHoje();
  $('#dl-corpo').innerHTML = `
    <div class="dl-placar">
      <div class="dl-lados"><b class="dl-l">Lula <span>${pl.toLocaleString('pt-BR')}%</span></b><b class="dl-f"><span>${pf.toLocaleString('pt-BR')}%</span> Flávio</b></div>
      <div class="dl-corda" role="img" aria-label="Lula ${pl}% contra Flávio ${pf}% nesta semana"><i class="dl-bl" style="width:${pl}%"></i><i class="dl-bf" style="width:${pf}%"></i><span class="dl-no" style="left:${pl}%"></span></div>
      <p class="dl-lider">${lider}</p>
    </div>
    <div class="dl-grade">
      <div class="dl-caixa dl-cl"><small>Semana</small><b>${fmt(L)}</b><em>${corridas(s.lula.corridas)}</em></div>
      <div class="dl-caixa dl-cf"><small>Semana</small><b>${fmt(F)}</b><em>${corridas(s.flavio.corridas)}</em></div>
      <div class="dl-caixa dl-cl"><small>Total geral</small><b>${fmt(j.total.lula.pontos)}</b><em>${corridas(j.total.lula.corridas)}</em></div>
      <div class="dl-caixa dl-cf"><small>Total geral</small><b>${fmt(j.total.flavio.pontos)}</b><em>${corridas(j.total.flavio.corridas)}</em></div>
    </div>
    <p class="dl-voce">${ic('estrela')} Sua contribuição hoje: <b>${fmt(c.lula || 0)}</b> pro Lula · <b>${fmt(c.flavio || 0)}</b> pro Flávio</p>`;
}
function estadoDuelo(html, cls = '') { $('#dl-corpo').innerHTML = `<div class="rk-estado ${cls}">${html}</div>`; }
async function carregaDuelo() {
  estadoDuelo('<span class="rk-giro" aria-hidden="true"></span>Contando os pontos…');
  try { renderPlacar(await chama()); }
  catch (e) {
    if (e.offline) estadoDuelo(ic('alerta') + '<b>Sem internet.</b><span>O placar aparece quando você estiver online. Dá pra correr mesmo assim!</span>', 'rk-erro');
    else estadoDuelo(ic('alerta') + `<b>Não deu pra carregar.</b><span>${esc(e.message)}</span><button class="bt bt-azul dl-tentar" type="button">${ic('reiniciar')} Tentar de novo</button>`, 'rk-erro');
  }
}
function indiceBase(time) {
  const S = C.S, lista = C.SKINS.map((s, i) => ({ s, i })).filter(o => timeDe(o.s) === time);
  const o = lista.find(o => o.s.preco === 0) || lista.find(o => S.skins.includes(o.i)) || null;
  return o ? o.i : -1;
}
function correPor(time) {
  const i = indiceBase(time);
  if (i < 0) { C.toast(`${ic('alerta')}<span>Personagem do time ${NOME_TIME[time]} chegando em breve!</span>`); return; }
  const S = C.S;
  if (!S.skins.includes(i)) S.skins.push(i);
  S.skin = i; C.trocaSkin(i); C.salvar();
  C.iniciar();
}

// envia pontos pendentes (corridas feitas offline), no máx. 5 guardadas
async function enviaPendentes() {
  const S = C.S; if (!Array.isArray(S.dueloPend) || !S.dueloPend.length || navigator.onLine === false) return;
  const fila = S.dueloPend.splice(0); C.salvar();
  for (const p of fila) {
    try { await envia(p); if (p.dia === hojeStr()) somaContrib(p.time, p.pontos); }
    catch (e) { if (e.offline) { S.dueloPend.push(p); } }
  }
  C.salvar();
}

// Fim de jogo: soma a corrida ao time (só o que ainda não foi somado) e prepara o "Desafiar amigos".
export function socialFim({ corrida, pontos, moedas, dist }) {
  ultimaCorrida = { pontos: Math.floor(pontos), moedas: Math.floor(moedas), dist: Math.floor(dist) };
  const msg = $('#dl-fim'); if (!msg || !C) return;
  const time = timeDe(skinAtual());
  const ja = (corrida && enviados.get(corrida)) || { pontos: 0, moedas: 0, dist: 0 };
  const d = { time, pontos: ultimaCorrida.pontos - ja.pontos, moedas: Math.max(0, ultimaCorrida.moedas - ja.moedas), dist: ultimaCorrida.dist - ja.dist };
  if (!time || d.pontos < 1 || d.dist < 1) { msg.className = 'dl-fim oculto'; return; }
  if (corrida) enviados.set(corrida, { ...ultimaCorrida });
  const nome = NOME_TIME[time];
  msg.className = `dl-fim dl-${time}`; msg.innerHTML = `${ic('duelo')} Somando +${fmt(d.pontos)} pontos pro time ${nome}…`;
  envia(d).then(() => {
    somaContrib(time, d.pontos); C.salvar();
    msg.innerHTML = `${ic('duelo')} <span><b>+${fmt(d.pontos)}</b> pontos para o time ${nome}!</span>`;
    enviaPendentes();
  }).catch(e => {
    if (e.offline) {
      const S = C.S; if (!Array.isArray(S.dueloPend)) S.dueloPend = [];
      S.dueloPend.push({ ...d, dia: hojeStr() }); S.dueloPend = S.dueloPend.slice(-5); C.salvar();
      msg.innerHTML = `${ic('alerta')} Sem internet: os +${fmt(d.pontos)} do time ${nome} vão quando você voltar online.`;
    } else msg.innerHTML = `${ic('alerta')} Duelo: ${esc(e.message)}`;
  });
}

export function iniciaSocial(ctx) {
  C = ctx; injetaIcones();
  if (!document.getElementById('css-social')) {
    const l = document.createElement('link'); l.id = 'css-social'; l.rel = 'stylesheet'; l.href = new URL('social.css?v=1.0.5', import.meta.url).href;
    document.head.appendChild(l);
  }
  // saves antigos: campos novos com valor padrão
  const S = C.S;
  if (!S.diaria || typeof S.diaria !== 'object') S.diaria = { ultimo: '', seq: 0 };
  if (!Array.isArray(S.dueloPend)) S.dueloPend = [];
  $('#dr-pegar')?.addEventListener('click', pegaDiaria);
  $('#bt-duelo')?.addEventListener('click', () => { C.audio && C.audio(); C.mostra('#tela-duelo'); carregaDuelo(); });
  $('#dl-corpo')?.addEventListener('click', e => { if (e.target.closest('.dl-tentar')) carregaDuelo(); });
  $('#dl-lula')?.addEventListener('click', () => correPor('lula'));
  $('#dl-flavio')?.addEventListener('click', () => correPor('flavio'));
  $('#bt-compartilhar')?.addEventListener('click', () => compartilha(textoMenu(), null));
  $('#bt-desafiar')?.addEventListener('click', () => compartilha(ultimaCorrida ? textoFim(ultimaCorrida) : textoMenu(), ultimaCorrida));
  $('#cp-fechar')?.addEventListener('click', () => $('#tela-compartilhar').classList.add('oculto'));
  $('#tela-compartilhar')?.addEventListener('click', e => { if (e.target.id === 'tela-compartilhar') e.target.classList.add('oculto'); });
  $('#cp-copiar')?.addEventListener('click', async () => {
    const ok = await copia(compAtual ? compAtual.texto : LINK);
    $('#cp-msg').textContent = ok ? 'Copiado! Agora é só colar.' : 'Não deu pra copiar: segure no texto acima para copiar.';
  });
  addEventListener('online', enviaPendentes);
  setTimeout(enviaPendentes, 3000);
}

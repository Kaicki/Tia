/* TIAFLIX — tudo é carregado de catalogo.json e catalogoseries.json */
const $ = s => document.querySelector(s);
const FAV_KEY = 'tiaflix:favoritos';
const state = { itens: [], view: 'inicio', busca: '', genero: '', ano: '', favs: new Set(), destaques: [], heroIdx: 0, heroTimer: null };

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ---------- Favoritos (LocalStorage) ---------- */
function lerFavs() { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) || []); } catch { return new Set(); } }
function salvarFavs() { try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs])); } catch {} }
function alternarFav(key) { state.favs.has(key) ? state.favs.delete(key) : state.favs.add(key); salvarFavs(); }

/* ---------- Google Drive ---------- */
function driveEmbed(link) {
  if (/^[\w-]{20,}$/.test(link)) return `https://drive.google.com/file/d/${link}/preview`;
  const m = String(link).match(/\/d\/([\w-]+)/) || String(link).match(/[?&]id=([\w-]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : link;
}

/* ---------- Carregamento ---------- */
async function lerJson(arq, tipo) {
  try {
    const r = await fetch(arq, { cache: 'no-cache' });
    const dados = await r.json();
    const lista = Array.isArray(dados) ? dados : (dados.itens || []);
    return lista.map(i => ({
      ...i, tipo, key: `${tipo}-${i.id}`,
      generos: [].concat(i.genero || []).map(g => String(g).trim()).filter(Boolean),
      ano: Number(i.ano) || 0
    }));
  } catch (e) { console.error('Erro ao carregar', arq, e); return []; }
}

async function iniciar() {
  state.favs = lerFavs();
  const [f, s] = await Promise.all([lerJson('catalogo.json', 'filme'), lerJson('catalogoseries.json', 'serie')]);
  state.itens = [...f, ...s];
  state.destaques = state.itens.filter(i => i.destaque);
  if (!state.destaques.length) state.destaques = state.itens.slice(0, 3);
  render();
  rota();
}

/* ---------- Dados derivados ---------- */
function base() {
  const v = state.view;
  if (v === 'filmes') return state.itens.filter(i => i.tipo === 'filme');
  if (v === 'series') return state.itens.filter(i => i.tipo === 'serie');
  if (v === 'lista') return state.itens.filter(i => state.favs.has(i.key));
  return state.itens;
}
function filtrar(lista) {
  const q = norm(state.busca);
  return lista.filter(i =>
    (!q || norm(i.titulo).includes(q)) &&
    (!state.genero || i.generos.includes(state.genero)) &&
    (!state.ano || String(i.ano) === state.ano));
}

/* ---------- Render ---------- */
function card(i) {
  const fav = state.favs.has(i.key);
  return `<div class="card" data-key="${esc(i.key)}" tabindex="0" role="button" aria-label="${esc(i.titulo)}">
    <div class="ph">${esc(i.titulo)}</div>
    ${i.capa ? `<img src="${esc(i.capa)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    <div class="tit">${esc(i.titulo)} · ${i.ano || ''}</div>
    <button class="coracao ${fav ? 'on' : ''}" data-fav="${esc(i.key)}" aria-label="Favoritar">${fav ? '♥' : '♡'}</button>
  </div>`;
}
const linha = (t, l) => l.length ? `<section class="linha"><h2>${esc(t)}</h2><div class="trilho">${l.map(card).join('')}</div></section>` : '';

function render() {
  const lista = base();
  const grade = state.busca || state.genero || state.ano || state.view === 'lista';
  $('#hero').hidden = !(state.view === 'inicio' && !grade);
  $('#filtros').hidden = state.view === 'inicio' && !grade;
  preencherFiltros(lista);
  document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('ativo', b.dataset.view === state.view));

  const el = $('#conteudo');
  if (grade) {
    const r = filtrar(lista);
    el.innerHTML = r.length ? `<div class="grade" style="padding-top:${$('#filtros').hidden ? '6rem' : '1rem'}">${r.map(card).join('')}</div>`
      : `<p class="vazio">${state.view === 'lista' ? 'Sua lista está vazia. Toque no ♡ de um título para salvar.' : 'Nenhum título encontrado.'}</p>`;
  } else {
    const porAno = [...lista].sort((a, b) => b.ano - a.ano);
    const recentes = [...lista].sort((a, b) => String(b.adicionado || '').localeCompare(String(a.adicionado || '')));
    let html = linha('Lançamentos', porAno.slice(0, 12))
      + linha('Populares', lista.filter(i => i.popular))
      + linha('Adicionados recentemente', recentes.slice(0, 12));
    [...new Set(lista.flatMap(i => i.generos))].sort().forEach(g => html += linha(g, lista.filter(i => i.generos.includes(g))));
    el.innerHTML = html || '<p class="vazio">Catálogo vazio.</p>';
    if (state.view !== 'inicio') el.style.paddingTop = '6rem'; else el.style.paddingTop = '';
    if (state.view !== 'inicio') $('#filtros').hidden = false;
  }
  if (state.view === 'inicio' && !grade) desenharHero();
}

function preencherFiltros(lista) {
  const gs = [...new Set(lista.flatMap(i => i.generos))].sort();
  const as = [...new Set(lista.map(i => i.ano).filter(Boolean))].sort((a, b) => b - a);
  $('#fGenero').innerHTML = '<option value="">Todos os gêneros</option>' + gs.map(g => `<option ${g === state.genero ? 'selected' : ''}>${esc(g)}</option>`).join('');
  $('#fAno').innerHTML = '<option value="">Todos os anos</option>' + as.map(a => `<option ${String(a) === state.ano ? 'selected' : ''}>${a}</option>`).join('');
}

/* ---------- Hero ---------- */
function desenharHero() {
  clearInterval(state.heroTimer);
  const i = state.destaques[state.heroIdx % state.destaques.length];
  if (!i) { $('#hero').innerHTML = ''; return; }
  const h = $('#hero');
  h.style.backgroundImage = (i.banner || i.capa) ? `url("${i.banner || i.capa}")` : 'linear-gradient(135deg,#4a0000,#000)';
  h.innerHTML = `<div class="hero-info" id="heroInfo">
    <h1>${esc(i.titulo)}</h1>
    <div class="meta"><b>Em destaque</b> · ${i.ano || ''} · ${esc(i.generos.join(', '))}${i.duracao ? ' · ' + esc(i.duracao) : ''}</div>
    <p>${esc(i.descricao)}</p>
    <div class="botoes">
      <button class="btn btn-play" data-assistir="${esc(i.key)}">▶ Assistir</button>
      <button class="btn btn-sec" data-info="${esc(i.key)}">ⓘ Mais informações</button>
    </div></div>`;
  if (state.destaques.length > 1) state.heroTimer = setInterval(() => { state.heroIdx++; desenharHero(); }, 9000);
}

/* ---------- Modal de informações ---------- */
const achar = key => state.itens.find(i => i.key === key);
function abrirInfo(key) {
  const i = achar(key); if (!i) return;
  const fav = state.favs.has(key);
  $('#modalCorpo').innerHTML = `
    <div class="m-banner" style="background-image:${i.banner || i.capa ? `url('${esc(i.banner || i.capa)}')` : 'linear-gradient(135deg,#4a0000,#111)'}"></div>
    <div class="m-corpo">
      <h2>${esc(i.titulo)}</h2>
      <div class="meta">${i.ano || ''} · ${esc(i.generos.join(', '))}${i.duracao ? ' · ' + esc(i.duracao) : ''} · ${i.tipo === 'serie' ? 'Série' : 'Filme'}</div>
      <p>${esc(i.descricao)}</p>
      <div class="botoes">
        <button class="btn btn-play" data-assistir="${esc(key)}">▶ Assistir</button>
        <button class="btn btn-sec btn-fav ${fav ? 'on' : ''}" data-favm="${esc(key)}">${fav ? '♥ Na minha lista' : '♡ Minha lista'}</button>
      </div></div>`;
  $('#modal').hidden = false; document.body.classList.add('travado');
}
function fecharInfo() { $('#modal').hidden = true; if ($('#player').hidden) document.body.classList.remove('travado'); }

/* ---------- Player ---------- */
function abrirPlayer(key) {
  const i = achar(key); if (!i) return;
  if (!i.link) { alert('Este título ainda não tem link de vídeo no catálogo.'); return; }
  fecharInfo();
  $('#playerTitulo').textContent = i.titulo;
  $('#videoWrap').innerHTML = `<iframe src="${esc(driveEmbed(i.link))}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
  $('#playerInfo').innerHTML = `<h2>${esc(i.titulo)}</h2><div class="meta">${i.ano || ''} · ${esc(i.generos.join(', '))}${i.duracao ? ' · ' + esc(i.duracao) : ''}</div><p>${esc(i.descricao)}</p>`;
  $('#player').hidden = false; document.body.classList.add('travado');
}
function fecharPlayer() {
  if ($('#player').hidden) return;
  $('#player').hidden = true; $('#videoWrap').innerHTML = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.body.classList.remove('travado');
}
async function telaCheia() {
  const el = $('#videoWrap');
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      screen.orientation?.unlock?.();
    } else {
      await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      await screen.orientation?.lock?.('landscape').catch(() => {});
    }
  } catch { alert('Use o botão de tela cheia do próprio player.'); }
}
function rota() {
  const h = decodeURIComponent(location.hash);
  if (h.startsWith('#assistir-')) abrirPlayer(h.slice(10)); else fecharPlayer();
}
function assistir(key) { location.hash = 'assistir-' + encodeURIComponent(key); }

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  const fav = t.closest('[data-fav]'), favm = t.closest('[data-favm]'), as = t.closest('[data-assistir]'), inf = t.closest('[data-info]'), c = t.closest('.card');
  if (fav) { e.stopPropagation(); alternarFav(fav.dataset.fav); render(); return; }
  if (favm) { alternarFav(favm.dataset.favm); abrirInfo(favm.dataset.favm); render(); return; }
  if (as) { assistir(as.dataset.assistir); return; }
  if (inf) { abrirInfo(inf.dataset.info); return; }
  if (c) { abrirInfo(c.dataset.key); return; }
  if (t === $('#modal')) fecharInfo();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#player').hidden) history.back(); else fecharInfo(); }
  if ((e.key === 'Enter') && e.target.classList?.contains('card')) abrirInfo(e.target.dataset.key);
});
$('#fecharModal').onclick = fecharInfo;
$('#voltar').onclick = () => { location.hash ? history.back() : fecharPlayer(); };
$('#telaCheia').onclick = telaCheia;
window.addEventListener('hashchange', rota);
window.addEventListener('scroll', () => $('#topo').classList.toggle('solido', scrollY > 40), { passive: true });
document.querySelectorAll('#menu button').forEach(b => b.onclick = () => { state.view = b.dataset.view; state.genero = state.ano = ''; scrollTo(0, 0); render(); });
$('#logo').onclick = e => { e.preventDefault(); state.view = 'inicio'; state.busca = state.genero = state.ano = ''; $('#busca').value = ''; scrollTo(0, 0); render(); };
$('#busca').oninput = e => { state.busca = e.target.value.trim(); render(); };
$('#fGenero').onchange = e => { state.genero = e.target.value; render(); };
$('#fAno').onchange = e => { state.ano = e.target.value; render(); };
$('#limpar').onclick = () => { state.genero = state.ano = state.busca = ''; $('#busca').value = ''; render(); };

iniciar();

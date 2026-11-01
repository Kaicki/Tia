/* TIAFLIX — tudo é carregado de catalogo.json e catalogoseries.json */
const $ = s => document.querySelector(s);
const FAV_KEY = 'tiaflix:favoritos';
const state = {
  erros: [], itens: [], view: 'inicio', busca: '', genero: '', ano: '',
  favs: new Set(), destaques: [], heroIdx: 0, heroTimer: null,
  navegou: false, pk: null, pt: 0, pe: 0
};

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/* url() seguro para CSS (aspas, barras e quebras de linha quebrariam o estilo) */
const cssUrl = u => `url("${String(u).replace(/["\\\n\r]/g, c => encodeURIComponent(c))}")`;

/* ---------- Conta (Supabase) ----------
   O cliente é criado no index.html e fica em window.tiaflixAuth.
   Se o Supabase não carregar, o site continua funcionando só com o LocalStorage. */
const sb = window.tiaflixAuth || null;
let userId = null;

/* ---------- Favoritos (LocalStorage + conta) ---------- */
function lerFavs() { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) || []); } catch { return new Set(); } }
function salvarFavs() { try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs])); } catch {} }

async function alternarFav(key) {
  const ligou = !state.favs.has(key);
  if (ligou) state.favs.add(key); else state.favs.delete(key);
  salvarFavs();
  if (!sb || !userId) return;
  try {
    const r = ligou
      ? await sb.from('favoritos').upsert({ titulo_id: key }, { onConflict: 'user_id,titulo_id', ignoreDuplicates: true })
      : await sb.from('favoritos').delete().eq('titulo_id', key);
    if (r.error) throw r.error;
  } catch (e) { console.error('Erro ao salvar favorito na conta', e); }
}

/* ao entrar: junta os favoritos deste aparelho com os da conta */
async function sincronizarFavs() {
  if (!sb || !userId) return;
  try {
    const { data, error } = await sb.from('favoritos').select('titulo_id');
    if (error) throw error;
    const remoto = new Set(data.map(r => r.titulo_id));
    const soLocal = [...state.favs].filter(k => !remoto.has(k));
    if (soLocal.length) {
      const r = await sb.from('favoritos').upsert(soLocal.map(k => ({ titulo_id: k })), { onConflict: 'user_id,titulo_id', ignoreDuplicates: true });
      if (r.error) throw r.error;
    }
    state.favs = new Set([...remoto, ...state.favs]);
    salvarFavs();
    if (state.itens.length) render();
  } catch (e) { console.error('Erro ao sincronizar favoritos', e); }
}

if (sb) {
  sb.auth.onAuthStateChange((evento, session) => {
    userId = session?.user?.id || null;
    if (evento === 'SIGNED_OUT') {
      state.favs = new Set(); salvarFavs();
      if (state.itens.length) render();
    } else if (userId) {
      setTimeout(sincronizarFavs, 0); // fora do callback, como o Supabase recomenda
    }
  });
}

/* atualiza os corações na tela sem refazer tudo (não perde a posição das linhas) */
function atualizarCoracoes(key) {
  const on = state.favs.has(key);
  document.querySelectorAll('.coracao').forEach(b => {
    if (b.dataset.fav !== key) return;
    b.classList.toggle('on', on);
    b.textContent = on ? '♥' : '♡';
  });
}

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
    if (!r.ok) throw new Error('arquivo não encontrado, HTTP ' + r.status);
    const dados = await r.json();
    const lista = Array.isArray(dados) ? dados : (dados.itens || []);
    return lista.map((i, n) => ({
      ...i, tipo, key: `${tipo}-${i.id ?? n}`,
      link: i.link || i.driveId || '',
      capa: i.capa || i.poster || '',
      banner: i.banner || i.backdrop || '',
      generos: [].concat(i.genero || []).map(g => String(g).trim()).filter(Boolean),
      ano: Number(i.ano) || 0
    }));
  } catch (e) { console.error('Erro ao carregar', arq, e); state.erros.push(`${arq} (${e.message})`); return []; }
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

/* ---------- Busca tolerante ---------- */
/* ignora acentos, maiúsculas, pontuação (: ; - ! etc.) e a ordem das palavras;
   aceita pedaço de palavra e pequenos erros de digitação */
const limpa = t => norm(t).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function distancia(a, b) { // distância de Levenshtein
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function palavraCasa(p, palavrasTitulo, titulo) {
  if (titulo.includes(p)) return true;          // pedaço de palavra
  if (p.length < 4) return false;
  const tol = p.length >= 8 ? 2 : 1;            // erros permitidos
  return palavrasTitulo.some(w =>
    distancia(p, w) <= tol || distancia(p, w.slice(0, p.length)) <= tol);
}

function casaBusca(titulo, q) {
  if (!q) return true;
  const t = limpa(titulo);
  const palavrasT = t.split(' ');
  return q.split(' ').every(p => palavraCasa(p, palavrasT, t));
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
  const q = limpa(state.busca);
  return lista.filter(i =>
    casaBusca(i.titulo, q) &&
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
  const grade = !!(state.busca || state.genero || state.ano || state.view === 'lista');
  const mostrarHero = state.view === 'inicio' && !grade;
  $('#hero').hidden = !mostrarHero;
  $('#filtros').hidden = mostrarHero;
  preencherFiltros(lista);
  document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('ativo', b.dataset.view === state.view));

  const el = $('#conteudo');
  el.style.paddingTop = state.view === 'inicio' ? '' : '6rem';

  if (grade) {
    const r = filtrar(lista);
    el.innerHTML = r.length ? `<div class="grade" style="padding-top:1rem">${r.map(card).join('')}</div>`
      : `<p class="vazio">${state.view === 'lista' ? 'Sua lista está vazia. Toque no ♡ de um título para salvar.' : 'Nenhum título encontrado.'}</p>`;
  } else {
    const porAno = [...lista].sort((a, b) => b.ano - a.ano);
    const recentes = [...lista].sort((a, b) => String(b.adicionado || '').localeCompare(String(a.adicionado || '')));
    let html = linha('Lançamentos', porAno.slice(0, 12))
      + (state.view === 'inicio' ? linha('Séries', lista.filter(i => i.tipo === 'serie')) : '')
      + linha('Populares', lista.filter(i => i.popular))
      + linha('Adicionados recentemente', recentes.slice(0, 12));
    [...new Set(lista.flatMap(i => i.generos))].sort().forEach(g => html += linha(g, lista.filter(i => i.generos.includes(g))));
    const aviso = state.erros.length ? `<p class="vazio" style="padding-top:${state.view === 'inicio' ? '5rem' : '1rem'};color:#ff6b6b">Não consegui ler: ${esc(state.erros.join('; '))}. Confira se o arquivo existe e se o JSON está válido.</p>` : '';
    el.innerHTML = aviso + (html || `<p class="vazio">${state.view === 'series' ? 'Nenhuma série encontrada no catalogoseries.json.' : 'Catálogo vazio.'}</p>`);
  }

  if (mostrarHero) desenharHero();
  else { clearInterval(state.heroTimer); state.heroTimer = null; } // para o carrossel quando o hero está escondido
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
  const img = i.banner || i.capa;
  h.style.backgroundImage = img ? cssUrl(img) : 'linear-gradient(135deg,#4a0000,#000)';
  if (i.banner && i.capa) { const im = new Image(); im.onerror = () => { h.style.backgroundImage = cssUrl(i.capa); }; im.src = i.banner; }
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
    <div class="m-banner"></div>
    <div class="m-corpo">
      <h2>${esc(i.titulo)}</h2>
      <div class="meta">${i.ano || ''} · ${esc(i.generos.join(', '))}${i.duracao ? ' · ' + esc(i.duracao) : ''} · ${i.tipo === 'serie' ? 'Série' : 'Filme'}</div>
      <p>${esc(i.descricao)}</p>
      <div class="botoes">
        <button class="btn btn-play" data-assistir="${esc(key)}">▶ Assistir</button>
        <button class="btn btn-sec btn-fav ${fav ? 'on' : ''}" data-favm="${esc(key)}">${fav ? '♥ Na minha lista' : '♡ Minha lista'}</button>
      </div></div>`;
  const img = i.banner || i.capa;
  $('#modalCorpo .m-banner').style.backgroundImage = img ? cssUrl(img) : 'linear-gradient(135deg,#4a0000,#111)';
  $('#modal').hidden = false; document.body.classList.add('travado');
}
function fecharInfo() { $('#modal').hidden = true; if ($('#player').hidden) document.body.classList.remove('travado'); }

/* ---------- Player ---------- */
const temporadasDe = i => (i.temporadas || []).filter(t => t.episodios && t.episodios.length);
function abrirPlayer(key, t = 0, e = 0) {
  const i = achar(key); if (!i) return;
  const temps = temporadasDe(i);
  if (temps.length && !temps[t]) { t = 0; e = 0; }
  const link = temps.length ? temps[t].episodios[e]?.link : i.link;
  if (!link) { alert('Este título ainda não tem link de vídeo no catálogo.'); return; }
  fecharInfo();
  state.pk = key; state.pt = t; state.pe = e;
  $('#playerTitulo').textContent = i.titulo + (temps.length ? ` · T${temps[t].temporada} E${e + 1}` : '');
  $('#videoWrap').innerHTML = `<iframe src="${esc(driveEmbed(link))}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
  let html = `<h2>${esc(i.titulo)}</h2><div class="meta">${i.ano || ''} · ${esc(i.generos.join(', '))}${i.duracao ? ' · ' + esc(i.duracao) : ''}</div><p>${esc(i.descricao)}</p>`;
  if (temps.length) {
    const ultimo = t === temps.length - 1 && e === temps[t].episodios.length - 1;
    html += `<div class="eps">
      <select id="selTemp" aria-label="Temporada">${temps.map((x, n) => `<option value="${n}" ${n === t ? 'selected' : ''}>Temporada ${x.temporada}</option>`).join('')}</select>
      ${ultimo ? '' : '<button class="btn btn-sec" id="proxEp" type="button">Próximo episódio ▶</button>'}
      <div class="eps-lista">${temps[t].episodios.map((x, n) => `<button class="ep ${n === e ? 'on' : ''}" data-ep="${n}" title="${esc(x.titulo || '')}">${n + 1}</button>`).join('')}</div>
    </div>`;
  }
  $('#playerInfo').innerHTML = html;
  $('#player').hidden = false; $('#player').scrollTo(0, 0); document.body.classList.add('travado');
}
function proximoEp() {
  const temps = temporadasDe(achar(state.pk) || {});
  if (!temps.length) return;
  let t = state.pt, e = state.pe + 1;
  if (e >= temps[t].episodios.length) { t++; e = 0; }
  if (t < temps.length) abrirPlayer(state.pk, t, e);
}
function fecharPlayer() {
  if ($('#player').hidden) return;
  $('#player').hidden = true; $('#videoWrap').innerHTML = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.body.classList.remove('travado');
}
/* voltar: se o usuário abriu o link direto, history.back() sairia do site */
function voltar() {
  if (state.navegou) history.back();
  else { history.replaceState(null, '', location.pathname + location.search); fecharPlayer(); }
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
  let h = location.hash;
  try { h = decodeURIComponent(h); } catch {}
  if (h.startsWith('#assistir-')) abrirPlayer(h.slice(10)); else fecharPlayer();
}
function assistir(key) { state.navegou = true; location.hash = 'assistir-' + encodeURIComponent(key); }

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  const fav = t.closest('[data-fav]'), favm = t.closest('[data-favm]'), as = t.closest('[data-assistir]'), inf = t.closest('[data-info]'), c = t.closest('.card');
  if (fav) {
    const key = fav.dataset.fav;
    alternarFav(key);
    if (state.view === 'lista') render(); else atualizarCoracoes(key);
    return;
  }
  if (favm) {
    const key = favm.dataset.favm;
    alternarFav(key);
    abrirInfo(key);
    if (state.view === 'lista') render(); else atualizarCoracoes(key);
    return;
  }
  if (as) { assistir(as.dataset.assistir); return; }
  if (inf) { abrirInfo(inf.dataset.info); return; }
  const ep = t.closest('[data-ep]'); if (ep) { abrirPlayer(state.pk, state.pt, +ep.dataset.ep); return; }
  if (t.id === 'proxEp') { proximoEp(); return; }
  if (c) { abrirInfo(c.dataset.key); return; }
  if (t === $('#modal')) fecharInfo();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#player').hidden) voltar(); else fecharInfo(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('card')) { e.preventDefault(); abrirInfo(e.target.dataset.key); }
});
document.addEventListener('change', e => { if (e.target.id === 'selTemp') abrirPlayer(state.pk, +e.target.value, 0); });
$('#fecharModal').onclick = fecharInfo;
$('#voltar').onclick = voltar;
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

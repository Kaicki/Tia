const state={catalog:[],heroIndex:0,current:null,saved:JSON.parse(localStorage.getItem('tiaflix-list')||'[]'),search:''};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function driveEmbed(id){
  if(!id)return '';
  // Aceita tanto o ID puro quanto uma URL compartilhada do Google Drive.
  const match=String(id).match(/[-\w]{25,}/);
  return match ? `https://drive.google.com/file/d/${match[0]}/preview` : '';
}
async function init(){
  try{const r=await fetch('catalogo.json');if(!r.ok)throw Error('Não foi possível carregar catalogo.json');state.catalog=await r.json();}
  catch(e){console.error(e);$('#catalog-grid').innerHTML='<p class="empty-state">Erro ao carregar catálogo. Confira o arquivo catalogo.json.</p>';return;}
  renderAll();setup();$('#year').textContent=new Date().getFullYear();
}
function card(item){
  const saved=state.saved.includes(item.id);
  return `<article class="movie-card" data-id="${esc(item.id)}">
    <div class="poster"><img loading="lazy" src="${esc(item.capa)}" alt="Capa de ${esc(item.titulo)}" onerror="this.style.opacity='.2'">
      <button class="add-list ${saved?'saved':''}" data-save="${esc(item.id)}" aria-label="${saved?'Remover da':'Adicionar à'} minha lista">${saved?'✓':'+'}</button>
      <span class="card-play">▶</span></div>
    <div class="card-info"><div class="card-title">${esc(item.titulo)}</div><div class="card-sub">${esc(item.tipo)} · ${esc(item.ano)} · ${esc(item.genero)}</div></div>
  </article>`;
}
function renderRow(selector,items){$(selector).innerHTML=items.map(card).join('')||'<p class="empty-state">Ainda não há títulos nesta seção.</p>';}
function renderCatalog(){
  const genre=$('#genre-filter').value;
  const items=state.catalog.filter(x=>(genre==='Todos'||x.genero===genre)&&(`${x.titulo} ${x.genero} ${x.tipo}`).toLowerCase().includes(state.search));
  $('#catalog-grid').innerHTML=items.map(card).join('');
  $('#empty-state').hidden=items.length>0;
}
function renderSaved(){
  const items=state.catalog.filter(x=>state.saved.includes(x.id));
  $('#my-list-grid').innerHTML=items.map(card).join('');
  $('#my-list-empty').hidden=items.length>0;
}
function renderHero(){
  const items=state.catalog.filter(x=>x.destaque);
  if(!items.length)return;
  const item=items[state.heroIndex%items.length];state.current=item;
  $('#hero-backdrop').style.backgroundImage=`url("${item.banner||item.capa}")`;
  $('#hero-kicker').textContent=item.tipo.toUpperCase()+' • '+item.genero.toUpperCase();
  $('#hero-title').textContent=item.titulo;
  $('#hero-description').textContent=item.descricao;
  $('#hero-meta').innerHTML=`<span>${esc(item.tipo)}</span><span class="dot"></span><span>${esc(item.ano)}</span><span class="dot"></span><span>${esc(item.genero)}</span>`;
  $('#slider-dots').innerHTML=items.map((_,i)=>`<button class="${i===state.heroIndex?'active':''}" data-slide="${i}" aria-label="Destaque ${i+1}"></button>`).join('');
}
function renderAll(){
  const genres=[...new Set(state.catalog.map(x=>x.genero).filter(Boolean))].sort();
  $('#genre-filter').innerHTML='<option value="Todos">Todos os gêneros</option>'+genres.map(g=>`<option>${esc(g)}</option>`).join('');
  renderHero();
  renderRow('#continue-row',state.catalog.slice(0,4));
  renderRow('#featured-row',state.catalog.filter(x=>x.destaque));
  renderRow('#series-row',state.catalog.filter(x=>x.tipo==='Série'));
  renderCatalog();renderSaved();
}
function openDetails(item){
  state.current=item;
  $('#details-art').style.backgroundImage=`url("${item.banner||item.capa}")`;
  $('#modal-title').textContent=item.titulo;
  $('#modal-meta').innerHTML=`<span>${esc(item.tipo)}</span><span class="dot"></span><span>${esc(item.ano)}</span><span class="dot"></span><span>${esc(item.genero)}</span>`;
  $('#modal-description').textContent=item.descricao;
  $('#modal-list').textContent=state.saved.includes(item.id)?'✓ Na minha lista':'＋ Minha lista';
  $('#details-modal').classList.add('open');$('#details-modal').setAttribute('aria-hidden','false');
}
function closeDetails(){$('#details-modal').classList.remove('open');$('#details-modal').setAttribute('aria-hidden','true');}
function play(item){
  if(!item)return;
  closeDetails();$('#player-title').textContent=item.titulo;
  const url=driveEmbed(item.driveId);
  $('#video-frame').innerHTML=url?`<iframe src="${esc(url)}" allow="autoplay; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" title="${esc(item.titulo)}"></iframe>`:
    `<div class="player-placeholder"><div class="play-symbol">▶</div><h2>${esc(item.titulo)}</h2><p>Este título ainda não tem vídeo cadastrado.</p><p>Adicione o ID ou link compartilhável do Google Drive em <b>catalogo.json</b>, no campo <b>driveId</b>.</p></div>`;
  $('#player-modal').classList.add('open');$('#player-modal').setAttribute('aria-hidden','false');
}
function closePlayer(){$('#player-modal').classList.remove('open');$('#player-modal').setAttribute('aria-hidden','true');$('#video-frame').innerHTML='';}
function toggleSaved(id){
  state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];
  localStorage.setItem('tiaflix-list',JSON.stringify(state.saved));
  renderRow('#continue-row',state.catalog.slice(0,4));renderRow('#featured-row',state.catalog.filter(x=>x.destaque));renderRow('#series-row',state.catalog.filter(x=>x.tipo==='Série'));renderCatalog();renderSaved();
  if(state.current?.id===id&&$('#details-modal').classList.contains('open'))$('#modal-list').textContent=state.saved.includes(id)?'✓ Na minha lista':'＋ Minha lista';
}
function setup(){
  window.addEventListener('scroll',()=>$('#topbar').classList.toggle('scrolled',scrollY>20));
  $('#hero-play').addEventListener('click',()=>play(state.current));
  $('#hero-info').addEventListener('click',()=>openDetails(state.current));
  $('#slider-dots').addEventListener('click',e=>{const b=e.target.closest('[data-slide]');if(b){state.heroIndex=Number(b.dataset.slide);renderHero();}});
  $('#modal-play').addEventListener('click',()=>play(state.current));
  $('#modal-list').addEventListener('click',()=>state.current&&toggleSaved(state.current.id));
  $('#player-close').addEventListener('click',closePlayer);
  $('#details-modal').addEventListener('click',e=>{if(e.target.dataset.close)closeDetails();});
  $('#search-toggle').addEventListener('click',()=>{$('#search-wrap').classList.toggle('open');if($('#search-wrap').classList.contains('open'))$('#search-input').focus();});
  $('#search-input').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();renderCatalog();document.querySelector('#catalogo').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#genre-filter').addEventListener('change',renderCatalog);
  $('#mobile-menu').addEventListener('click',()=>$('.main-nav').classList.toggle('show'));
  document.addEventListener('click',e=>{
    const save=e.target.closest('[data-save]');if(save){e.stopPropagation();toggleSaved(save.dataset.save);return;}
    const movie=e.target.closest('.movie-card');if(movie){const item=state.catalog.find(x=>x.id===movie.dataset.id);if(item)openDetails(item);}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDetails();closePlayer();}});
}
init();

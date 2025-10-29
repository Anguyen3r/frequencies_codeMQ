/* script.js
   - Floating bubbles + nebula background (CSS)
   - Click bubble => anchored prompt that orbits the bubble
   - Saves to localStorage and updates local Top counts
   - Mobile-friendly + keyboard accessible
*/

const GENRES = [
  { id: 'techno', label: 'Hard / Techno' },
  { id: 'house',  label: 'House' },
  { id: 'dnb',    label: 'Drum & Bass' },
  { id: 'dub',    label: 'Dubstep' },
  { id: 'elect',  label: 'Electronic' },
  { id: 'main',   label: 'Mainstream / International' }
];

const STORAGE_KEY = 'codemq_votes_v5';

/* ========== DOM refs ========== */
const stage = document.getElementById('stage');
const topToggle = document.getElementById('topToggle');
const topPanel = document.getElementById('topPanel');
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');

let bubbles = [];
let activePrompt = null;      // {el, anchorEl, angle, radius, raf}
let votesCache = null;

/* ---------- initialize UI ---------- */
function init(){
  createBubbles();
  populateTopSelect();
  computeAndRenderTop();
  topToggle.addEventListener('click', toggleTopPanel);
  window.addEventListener('resize', onResize);
  // accessibility: close prompt on Escape
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && activePrompt) closeActivePrompt();
  });
}
init();

/* ---------- create bubbles ---------- */
function createBubbles(){
  stage.innerHTML = '';
  bubbles = [];
  GENRES.forEach((g, idx) => {
    const el = document.createElement('button');
    el.className = 'bubble';
    el.setAttribute('data-genre', g.id);
    el.setAttribute('aria-label', g.label);
    el.type = 'button';
    el.innerHTML = `<span class="glass" aria-hidden="true"></span><span class="label">${g.label}</span>`;

    // initial random size + position
    const size = 100 + Math.round(Math.random()*44);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = (8 + Math.random()*84) + '%';
    el.style.top  = (8 + Math.random()*82) + '%';

    // attach click
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openPromptAnchored(el, g.id);
    });

    stage.appendChild(el);
    bubbles.push({ el, genre: g, size, vx: (Math.random()-0.5)*0.02, vy: (Math.random()-0.5)*0.02 });
    animateBubble(bubbles[bubbles.length-1]);
  });
}

/* ---------- bubble gentle drift ---------- */
function animateBubble(obj){
  (function loop(){
    const el = obj.el;
    const t = performance.now() / 1000;
    const dx = Math.sin(t*0.6 + obj.size) * 0.12;
    const dy = Math.cos(t*0.5 + obj.size*0.8) * 0.14;
    const left = clamp(percent(el.style.left) + dx, 2, 92);
    const top  = clamp(percent(el.style.top)  + dy, 4, 92);
    el.style.left = left + '%';
    el.style.top  = top  + '%';
    requestAnimationFrame(loop);
  }());
}
function percent(v){ return parseFloat(v || '0'); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* ---------- anchored prompt logic ---------- */
function openPromptAnchored(anchorEl, genreId){
  // close existing
  if(activePrompt) closeActivePrompt();

  // create prompt DOM
  const p = document.createElement('div');
  p.className = 'prompt';
  p.innerHTML = `
    <button class="closeX" aria-label="Close prompt">✕</button>
    <h3>Who's your favorite artist?</h3>
    <p class="muted">Optional: dream B2B & why</p>
    <input class="artist" placeholder="Favorite artist (required)" />
    <input class="b2b" placeholder="Dream B2B (optional)" />
    <textarea class="why" rows="2" placeholder="Why (optional)"></textarea>
    <div class="actions">
      <button class="btnLight cancel">Cancel</button>
      <button class="btnPrimary submit">Submit</button>
    </div>
  `;
  document.body.appendChild(p);

  // ensure pointer events allowed
  p.style.pointerEvents = 'auto';

  // button wiring
  p.querySelector('.closeX').addEventListener('click', ()=> closeActivePrompt());
  p.querySelector('.cancel').addEventListener('click', ()=> closeActivePrompt());
  p.querySelector('.submit').addEventListener('click', async () => {
    const artist = p.querySelector('.artist').value.trim();
    if(!artist){ p.querySelector('.artist').focus(); return; }
    const b2b = p.querySelector('.b2b').value.trim();
    const why = p.querySelector('.why').value.trim();
    await saveVote(genreId, artist, b2b, why);
    // brief feedback (subtle scale)
    p.animate([{ transform:'scale(1)' }, { transform:'scale(0.98)' }, { transform:'scale(1)' }], { duration:220 });
    closeActivePrompt();
  });

  // position: compute anchor center
  const anchorRect = anchorEl.getBoundingClientRect();
  const anchorCenter = { x: anchorRect.left + anchorRect.width/2, y: anchorRect.top + anchorRect.height/2 };

  // orbit parameters
  const radius = Math.max(anchorRect.width, 110) * 0.9; // px
  let angle = Math.random() * Math.PI * 2;

  // animate orbit
  let rafId = null;
  function orbitTick(){
    angle += 0.012; // speed
    const x = anchorCenter.x + Math.cos(angle) * radius - p.offsetWidth/2;
    const y = anchorCenter.y + Math.sin(angle) * radius - p.offsetHeight/2;
    p.style.left = `${x}px`;
    p.style.top  = `${y}px`;
    // subtle rotation facing camera
    p.style.transform = `rotate(${Math.sin(angle)*3}deg)`;
    rafId = requestAnimationFrame(orbitTick);
  }
  // initial placement slightly offset
  p.style.position = 'fixed';
  p.style.left = `${anchorCenter.x + radius - p.offsetWidth/2}px`;
  p.style.top  = `${anchorCenter.y - p.offsetHeight/2}px`;
  // start orbit
  rafId = requestAnimationFrame(orbitTick);

  // store active prompt
  activePrompt = { el: p, anchorEl, angle, radius, rafId };
  // focus first input
  setTimeout(()=> p.querySelector('.artist').focus(), 120);

  // while prompt open, highlight anchor bubble
  anchorEl.style.transform = 'scale(1.08)';
  anchorEl.style.boxShadow = `0 40px 110px ${colorWithAlpha(getGenreColor(genreId), 0.18)}`;
}

function closeActivePrompt(){
  if(!activePrompt) return;
  const { el, anchorEl, rafId } = activePrompt;
  // restore anchor styles
  if(anchorEl){
    anchorEl.style.transform = '';
    anchorEl.style.boxShadow = '';
  }
  cancelAnimationFrame(rafId);
  el.remove();
  activePrompt = null;
}

/* ---------- storage & top logic ---------- */
function readVotes(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch(e){ return {}; }
}
function saveLocal(genre, artist, b2b, why){
  const raw = readVotes();
  raw[genre] = raw[genre] || [];
  raw[genre].push({ artist, b2b: b2b || '', why: why || '', ts: Date.now() });
  if(raw[genre].length > 5000) raw[genre].splice(0, raw[genre].length - 5000);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}
async function saveVote(genre, artist, b2b, why){
  // local-only for now
  saveLocal(genre, artist, b2b, why);
  await computeAndRenderTop();
}

/* compute top artists & update bubble visuals */
async function computeAndRenderTop(){
  const raw = readVotes();
  const counts = {};
  GENRES.forEach(g=> counts[g.id] = {});
  Object.keys(raw).forEach(genreId=>{
    (raw[genreId]||[]).forEach(r=>{
      const name = (r.artist||'').trim();
      if(!name) return;
      counts[genreId][name] = (counts[genreId][name]||0) + 1;
    });
  });

  // update bubbles scale/glow
  bubbles.forEach(b=>{
    const map = counts[b.genre.id] || {};
    const list = Object.keys(map).map(a=>({artist:a,count:map[a]})).sort((a,b)=>b.count-a.count);
    const topCount = list[0] ? list[0].count : 0;
    const glow = Math.min(3.2, 0.3 + Math.log10(1 + topCount) * 0.8);
    const scale = 1 + Math.min(0.6, Math.log10(1 + topCount) * 0.11);
    b.el.style.transform = `scale(${scale})`;
    b.el.style.boxShadow = `0 28px ${26 + glow*36}px ${colorWithAlpha(getGenreColor(b.genre.id), 0.12 + glow*0.06)}`;
  });

  // render top list for selected genre
  const sel = genreSelect.value || GENRES[0].id;
  const arr = Object.keys(counts[sel] || {}).map(a=>({artist:a,count:counts[sel][a]})).sort((a,b)=>b.count-a.count);
  let html = '';
  if(arr.length === 0) html = '<div style="color:#9aa">No submissions yet — be the first!</div>';
  else {
    for(let i=0;i<Math.min(20,arr.length);i++){
      const it = arr[i];
      html += `<div class="row">${i+1}. ${escapeHtml(it.artist)} <span style="opacity:.85">${it.count}</span></div>`;
    }
  }
  topList.innerHTML = html;
}

/* ---------- helpers & UI wiring ---------- */
function populateTopSelect(){
  GENRES.forEach(g=>{
    const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.label;
    genreSelect.appendChild(opt);
  });
  genreSelect.addEventListener('change', computeAndRenderTop);
}
function toggleTopPanel(){
  const hidden = topPanel.classList.toggle('hidden');
  topPanel.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if(!hidden) computeAndRenderTop();
}

function getGenreColor(id){
  switch(id){
    case 'techno': return '#FF267D';
    case 'house':  return '#FF8F33';
    case 'dnb':    return '#FFCE00';
    case 'dub':    return '#00D282';
    case 'elect':  return '#2378FF';
    case 'main':   return '#AA5AFF';
    default: return '#ffffff';
  }
}
function colorWithAlpha(hex, a){
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- utility: handle resize (re-anchor prompt if open) ---------- */
function onResize(){
  if(!activePrompt) return;
  // recompute anchor center on resize by relocating prompt to anchor center immediately
  const anchorRect = activePrompt.anchorEl.getBoundingClientRect();
  const anchorCenter = { x: anchorRect.left + anchorRect.width/2, y: anchorRect.top + anchorRect.height/2 };
  const p = activePrompt.el;
  const x = anchorCenter.x + Math.cos(activePrompt.angle) * activePrompt.radius - p.offsetWidth/2;
  const y = anchorCenter.y + Math.sin(activePrompt.angle) * activePrompt.radius - p.offsetHeight/2;
  p.style.left = `${x}px`; p.style.top = `${y}px`;
}

/* ---------- run initial compute ---------- */
computeAndRenderTop();

/* Bubble UI — minimal, performant, responsive
   - localStorage persistence (vote data)
   - smooth drifting bubbles
   - accessible modal with X close
   - top artists panel (computed locally)
*/

const GENRES = [
  { id: 'techno', label: 'Hard / Techno' },
  { id: 'house',  label: 'House' },
  { id: 'dnb',    label: 'Drum & Bass' },
  { id: 'dub',    label: 'Dubstep' },
  { id: 'elect',  label: 'Electronic' },
  { id: 'main',   label: 'Mainstream / International' }
];

const STORAGE_KEY = 'codemq_votes_v4';

// DOM refs
const stage = document.getElementById('stage');
const nebula = document.getElementById('nebula');

const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const voteForm = document.getElementById('voteForm');
const artistInput = document.getElementById('artistInput');
const b2bInput = document.getElementById('b2bInput');
const whyInput = document.getElementById('whyInput');
const cancelBtn = document.getElementById('cancelBtn');

const topToggle = document.getElementById('topToggle');
const topPanel = document.getElementById('topPanel');
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');

// state
let bubbles = [];
let activeGenre = null;

// create bubbles DOM
function createBubbles(){
  stage.innerHTML = '';
  bubbles = [];
  GENRES.forEach((g, i) => {
    const el = document.createElement('button');
    el.className = 'bubble';
    el.setAttribute('data-genre', g.id);
    el.setAttribute('aria-label', g.label + ' bubble');
    el.setAttribute('type', 'button');
    el.innerHTML = `<span class="glass" aria-hidden="true"></span><span class="label">${g.label}</span>`;
    // initial size and position
    const size = 100 + Math.round(Math.random()*48);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = (8 + Math.random()*84) + '%';
    el.style.top = (10 + Math.random()*78) + '%';
    // append
    stage.appendChild(el);
    // pointer events enabled
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      activeGenre = g.id; // store genre (hidden to user)
      openModal();
    });
    bubbles.push({ el, genre: g, size, vx: (Math.random()-0.5)*0.02, vy: (Math.random()-0.5)*0.02 });
    animateBubble(bubbles[bubbles.length-1]);
  });
}

// gentle drifting animation using requestAnimationFrame (high perf)
function animateBubble(obj){
  (function tick(){
    const el = obj.el;
    const t = performance.now() / 1000;
    // sin/cos drift (smooth, deterministic)
    const dx = Math.sin(t*0.6 + obj.size) * 0.12;
    const dy = Math.cos(t*0.5 + obj.size*0.8) * 0.14;
    const left = clamp(percent(el.style.left) + dx, 2, 92);
    const top = clamp(percent(el.style.top) + dy, 4, 92);
    el.style.left = left + '%';
    el.style.top = top + '%';
    requestAnimationFrame(tick);
  }());
}
function percent(v){ return parseFloat(v || '0'); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// modal open/close
function openModal(){
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  artistInput.value = '';
  b2bInput.value = '';
  whyInput.value = '';
  artistInput.focus();
}
function closeModal(){
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  activeGenre = null;
}
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// form submit
voteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const artist = artistInput.value.trim();
  if (!artist) { artistInput.focus(); return; }
  const b2b = b2bInput.value.trim();
  const why = whyInput.value.trim();
  saveVote(activeGenre, artist, b2b, why);
  closeModal();
});

// storage helpers
function readVotes(){
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (e) {
    return {};
  }
}
function saveLocal(genre, artist, b2b, why){
  const raw = readVotes();
  raw[genre] = raw[genre] || [];
  raw[genre].push({ artist, b2b: b2b || '', why: why || '', ts: Date.now() });
  // cap length for performance
  if (raw[genre].length > 5000) raw[genre].splice(0, raw[genre].length - 5000);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}
function saveVote(genre, artist, b2b, why){
  // local-only for now
  saveLocal(genre, artist, b2b, why);
  computeTopAndVisuals();
}

// compute top artists and update bubble glows
function computeTopAndVisuals(){
  const data = readVotes();
  // count per genre
  const counts = {};
  GENRES.forEach(g => counts[g.id] = {});
  Object.keys(data).forEach(genreId => {
    (data[genreId] || []).forEach(r => {
      const name = (r.artist || '').trim();
      if (!name) return;
      counts[genreId][name] = (counts[genreId][name] || 0) + 1;
    });
  });

  // update bubbles (scale/glow)
  bubbles.forEach(b => {
    const map = counts[b.genre.id] || {};
    const sorted = Object.keys(map).map(a => ({ artist: a, count: map[a] })).sort((a,b)=>b.count-a.count);
    const topCount = sorted[0] ? sorted[0].count : 0;
    const glow = Math.min(3.2, 0.3 + Math.log10(1 + topCount) * 0.8);
    const scale = 1 + Math.min(0.6, Math.log10(1 + topCount) * 0.11);
    b.el.style.transform = `scale(${scale})`;
    b.el.style.boxShadow = `0 24px ${26 + glow*36}px ${colorWithAlpha(getGenreColor(b.genre.id), 0.12 + glow*0.06)}`;
  });

  // update top panel for selected genre
  const sel = genreSelect.value || GENRES[0].id;
  const arr = Object.keys(counts[sel] || {}).map(a => ({ artist: a, count: counts[sel][a] })).sort((a,b)=>b.count-a.count);
  let html = '';
  if (arr.length === 0) html = `<div style="color:#9aa">No submissions yet — be the first!</div>`;
  else {
    for (let i=0;i<Math.min(20, arr.length); i++){
      const it = arr[i];
      html += `<div class="row">${i+1}. ${escapeHtml(it.artist)} <span style="opacity:.85">${it.count}</span></div>`;
    }
  }
  topList.innerHTML = html;
}

// helper colors
function getGenreColor(id){
  const g = GENRES.find(x => x.id === id);
  if (!g) return '#ffffff';
  // map id to the iridescent hex we used in CSS
  switch(id){
    case 'techno': return '#c66cff';
    case 'house': return '#00e2a3';
    case 'dnb': return '#33d7ff';
    case 'dub': return '#ffb86b';
    case 'elect': return '#d86bff';
    case 'main': return '#ffffff';
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

// UI wiring & init
function populateTopSelect(){
  GENRES.forEach(g=>{
    const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.label;
    genreSelect.appendChild(opt);
  });
  genreSelect.addEventListener('change', computeTopAndVisuals);
}

topToggle.addEventListener('click', () => {
  const hidden = topPanel.classList.toggle('hidden');
  topToggle.setAttribute('aria-expanded', (!hidden).toString());
});

// cancel button already wired earlier
cancelBtn.addEventListener('click', closeModal);

// init nebula subtle animation (CSS handles it) — nothing JS-needed

// keyboard accessibility: Enter submits form by default; ESC closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modal.classList.contains('hidden')) closeModal();
  }
});

// start
populateTopSelect();
createBubbles();
computeTopAndVisuals();

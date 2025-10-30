/**
 * script.js
 * - 6 large gray translucent bubbles with colored stardust halos
 * - gyroscope/group motion + per-orb orbit + vertical bob
 * - click orb -> prompt to submit artist (saved to localStorage)
 * - stats panel shows counts per orb (localStorage)
 * - music embed for Spotify / SoundCloud
 */

// ---------- canvas setup ----------
const canvas = document.getElementById('bubblesCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

let W = 0, H = 0, DPR = window.devicePixelRatio || 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- configuration ----------
const GENRES = [
  { id: 'techno', label: 'Hard / Techno', color: '#9b7cff' },
  { id: 'house',  label: 'House',        color: '#60a5fa' },
  { id: 'dnb',    label: 'Drum & Bass', color: '#14b8a6' },
  { id: 'dub',    label: 'Dubstep',      color: '#ff6b81' },
  { id: 'elect',  label: 'Electronic',   color: '#fbbf24' },
  { id: 'main',   label: 'Mainstream',   color: '#c084fc' }
];

const CENTER = { x: () => W/2, y: () => H/2 };
const ORBIT_BASE = Math.min(W, H) * 0.16;
const ORB_BASE_R = Math.max(52, Math.min(W,H) * 0.085);
const DUST_PER_ORB = 120;

// ---------- orbs creation ----------
const orbs = GENRES.map((g,i) => {
  const orbit = ORBIT_BASE + i * (ORB_BASE_R * 0.14);
  const radius = ORB_BASE_R * (1 - i*0.04);
  const angle = (i/GENRES.length) * Math.PI*2 + Math.random()*0.12;
  const speed = (0.0009 + Math.random()*0.0012) * (i % 2 === 0 ? 1 : -1);
  const dust = new Array(DUST_PER_ORB).fill(0).map(()=>({
    r: (Math.random()*0.9 + 0.6) * radius * (0.9 + Math.random()*0.5),
    theta: Math.random()*Math.PI*2,
    speed: (0.00045 + Math.random()*0.0009) * (Math.random()<0.5?1:-1),
    size: Math.random()*1.6 + 0.4,
    alpha: 0.03 + Math.random()*0.18
  }));
  return { genre: g, orbit, radius, angle, speed, pulse: Math.random()*Math.PI*2, dust, _cx:0, _cy:0, _core:radius };
});

// ---------- localStorage keys ----------
const STORAGE_KEY = 'codemq_bubble_artists_v1';
const COUNT_KEY = 'codemq_bubble_counts_v1';

// ---------- helpers ----------
function hexToRgba(hex, a=1){
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- stats UI ----------
const statsToggle = document.getElementById('statsToggle');
const statsPanel = document.getElementById('statsPanel');
const statsList = document.getElementById('statsList');
const resetCountsBtn = document.getElementById('resetCounts');

function readCounts(){
  try { return JSON.parse(localStorage.getItem(COUNT_KEY) || "{}"); }
  catch(e){ return {}; }
}
function writeCounts(c){ localStorage.setItem(COUNT_KEY, JSON.stringify(c)); }
function incCount(id){
  const c = readCounts();
  c[id] = (c[id]||0) + 1;
  writeCounts(c);
  renderStats();
}
function resetCounts(){
  localStorage.removeItem(COUNT_KEY);
  renderStats();
}

function renderStats(){
  const c = readCounts();
  let html = '';
  GENRES.forEach(g=>{
    const v = c[g.id] || 0;
    html += `<div class="row"><strong>${g.label}</strong><span>${v}</span></div>`;
  });
  statsList.innerHTML = html;
}
statsToggle.addEventListener('click', ()=>{
  const hidden = statsPanel.classList.toggle('hidden');
  statsPanel.setAttribute('aria-hidden', hidden? 'true':'false');
  if(!hidden) renderStats();
});
resetCountsBtn.addEventListener('click', ()=> resetCounts());

// ---------- nebula background (deep) ----------
let nebPhase = 0;
function drawNebula(now){
  nebPhase += 0.0006;
  const g1 = ctx.createLinearGradient(0,0,W,H);
  g1.addColorStop(0, "rgba(6,4,20,1)");
  g1.addColorStop(0.48 + Math.sin(nebPhase)*0.06, "rgba(18,6,60,0.95)");
  g1.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = g1;
  ctx.fillRect(0,0,W,H);

  // subtle moving cloud bands
  ctx.globalCompositeOperation = "lighter";
  for(let i=0;i<2;i++){
    const off = Math.sin(now*0.00025 + i*1.4) * (W*0.06);
    const rg = ctx.createRadialGradient(CENTER.x()+off*0.6, CENTER.y()*0.7, 100, CENTER.x()+off, CENTER.y()*1.1, Math.max(W,H)*0.8);
    const alpha = 0.02 + i*0.01;
    if(i===0) rg.addColorStop(0, `rgba(140,50,200,${alpha+0.02})`);
    else rg.addColorStop(0, `rgba(35,120,255,${alpha+0.02})`);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(CENTER.x(), CENTER.y(), Math.max(W,H), 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

// ---------- render loop ----------
let last = performance.now();
function render(now){
  const dt = now - last;
  last = now;

  // resize check (if changed externally)
  // (we already use resize listener)

  // background
  drawNebula(now);

  // group (gyroscope) small tilt
  const time = now * 0.001;
  const tilt = Math.sin(time*0.18) * 0.12;

  // draw orbs: aura -> dust -> core
  orbs.forEach((o, idx) => {
    o.angle += o.speed * dt;
    o.pulse += 0.003 * dt;

    const cx = CENTER.x() + Math.cos(o.angle) * o.orbit;
    const cy = CENTER.y() + Math.sin(o.angle) * o.orbit * 0.72 + Math.sin(time*0.6 + idx) * 6; // bob

    // aura
    const auraR = o.radius * (1.9 + 0.3 * Math.sin(o.pulse + idx));
    const aura = ctx.createRadialGradient(cx, cy, o.radius*0.1, cx, cy, auraR);
    aura.addColorStop(0, hexToRgba(o.genre.color, 0.42));
    aura.addColorStop(0.35, hexToRgba(o.genre.color, 0.14));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR, 0, Math.PI*2);
    ctx.fill();

    // dust orbiting particles
    o.dust.forEach(d => {
      d.theta += d.speed * dt + (Math.sin(now*0.001 + d.theta)*0.0002);
      const dx = Math.cos(d.theta) * d.r;
      const dy = Math.sin(d.theta) * d.r * 0.78;
      const px = cx + dx;
      const py = cy + dy;
      const s = d.size * (0.6 + 0.4 * Math.sin(now*0.002 + d.theta));
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(o.genre.color, Math.max(0.02, d.alpha * 0.95));
      ctx.arc(px, py, s, 0, Math.PI*2);
      ctx.fill();
    });

    // core (2D glossy illusion)
    const coreGrad = ctx.createRadialGradient(cx - o.radius*0.14, cy - o.radius*0.12, 1, cx, cy, o.radius);
    coreGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    coreGrad.addColorStop(0.16, hexToRgba(o.genre.color, 1));
    coreGrad.addColorStop(1, hexToRgba(o.genre.color, 0.7));
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = coreGrad;
    const coreSize = o.radius * (0.78 + 0.04 * Math.sin(o.pulse + idx));
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI*2);
    ctx.fill();

    // faint rim
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI*2);
    ctx.stroke();

    // store for clicks
    o._cx = cx; o._cy = cy; o._core = coreSize;
  });

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ---------- click handling: prompt + save ----------
let activePrompt = null;
function closeActivePrompt(){ if(!activePrompt) return; try{ activePrompt.dom.remove(); }catch(e){} activePrompt=null; }
canvas.addEventListener('pointerdown', (ev) => {
  const x = ev.clientX, y = ev.clientY;
  for(let i=0;i<orbs.length;i++){
    const o = orbs[i];
    const dx = x - o._cx, dy = y - o._cy;
    if(Math.sqrt(dx*dx + dy*dy) <= o._core * 0.95){
      openPromptAnchored(i);
      return;
    }
  }
});

function openPromptAnchored(index){
  closeActivePrompt();
  const o = orbs[index];
  const dom = document.createElement('div');
  dom.className = 'prompt';
  dom.innerHTML = `
    <button class="closeX" aria-label="Close">✕</button>
    <h4>${o.genre.label}</h4>
    <p class="muted">Who's your favorite artist? (dream B2B optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" />
    <input class="b2b" placeholder="Dream B2B (optional)" />
    <textarea class="why" rows="2" placeholder="Why (optional)"></textarea>
    <div class="actions">
      <button class="btn ghost cancel">Cancel</button>
      <button class="btn submit">Submit</button>
    </div>
  `;
  document.body.appendChild(dom);

  // wire buttons
  dom.querySelector('.closeX').addEventListener('click', ()=> { closeActivePrompt(); });
  dom.querySelector('.cancel').addEventListener('click', ()=> { closeActivePrompt(); });
  dom.querySelector('.submit').addEventListener('click', ()=> {
    const artist = dom.querySelector('.artist').value.trim();
    if(!artist){ dom.querySelector('.artist').focus(); return; }
    const b2b = dom.querySelector('.b2b').value.trim();
    const why = dom.querySelector('.why').value.trim();
    saveVote(o.genre.id, artist, b2b, why);
    incCount(o.genre.id);
    dom.animate([{ transform: 'scale(1)' }, { transform:'scale(0.98)' }, { transform:'scale(1)'}], { duration:160 });
    closeActivePrompt();
  });

  // position + orbit around orb
  const radius = o._core * 1.6 + 40;
  const angle = Math.random()*Math.PI*2;
  activePrompt = { dom, anchorIndex: index, angle, radius, raf: null };
  positionPromptLoop();
  setTimeout(()=> dom.querySelector('.artist').focus(), 120);
}

function positionPromptLoop(){
  if(!activePrompt) return;
  const p = activePrompt;
  p.angle += 0.012;
  const a = orbs[p.anchorIndex];
  const x = a._cx + Math.cos(p.angle) * p.radius - p.dom.offsetWidth/2;
  const y = a._cy + Math.sin(p.angle) * p.radius - p.dom.offsetHeight/2;
  p.dom.style.left = Math.max(8, Math.min(W - p.dom.offsetWidth - 8, x)) + 'px';
  p.dom.style.top  = Math.max(8, Math.min(H - p.dom.offsetHeight - 8, y)) + 'px';
  p.raf = requestAnimationFrame(positionPromptLoop);
}

// ---------- save votes (local) ----------
function saveVote(genreId, artist, b2b, why){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    raw[genreId] = raw[genreId] || [];
    raw[genreId].push({ artist, b2b, why, ts: Date.now() });
    if(raw[genreId].length > 5000) raw[genreId].splice(0, raw[genreId].length - 5000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    console.log('Saved vote for', genreId, artist);
  }catch(e){ console.error('saveVote', e); }
}

// ---------- music embed handling ----------
const loadMusicBtn = document.getElementById('loadMusic');
const clearMusicBtn = document.getElementById('clearMusic');
const musicInput = document.getElementById('musicInput');
const musicEmbed = document.getElementById('musicEmbed');

loadMusicBtn.addEventListener('click', ()=>{
  const url = (musicInput.value||'').trim();
  musicEmbed.innerHTML = '';
  if(!url) return;
  if(url.includes('open.spotify.com')){
    const embed = url.includes('/embed/') ? url : url.replace('open.spotify.com','open.spotify.com/embed');
    musicEmbed.innerHTML = `<iframe src="${embed}" frameborder="0" allow="encrypted-media" style="width:100%;height:360px;border-radius:8px"></iframe>`;
  } else if(url.includes('soundcloud.com')){
    const uc = encodeURIComponent(url);
    const sc = `https://w.soundcloud.com/player/?url=${uc}&color=%23ff5500`;
    musicEmbed.innerHTML = `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="${sc}" style="border-radius:8px"></iframe>`;
  } else {
    musicEmbed.innerHTML = `<div style="color:#cfcfcf">Paste a Spotify or SoundCloud link (open.spotify.com or soundcloud.com).</div>`;
  }
});
clearMusicBtn.addEventListener('click', ()=> { musicEmbed.innerHTML=''; musicInput.value=''; });

// ---------- init stats from counts ----------
function ensureCountsInitialized(){
  const c = readCounts();
  let changed = false;
  GENRES.forEach(g=>{ if(!c[g.id]){ c[g.id]=0; changed=true; }});
  if(changed) writeCounts(c);
  renderStats();
}
ensureCountsInitialized();

// ---------- keyboard / cleanup ----------
document.addEventListener('keydown', (e)=> { if(e.key === 'Escape') closeActivePrompt(); });
window.addEventListener('beforeunload', ()=> { if(activePrompt && activePrompt.raf) cancelAnimationFrame(activePrompt.raf); });


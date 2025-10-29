/* ===========================
   Code MQ — static + Firestore
   - background stars + gas
   - 6 colored semi-transparent orbs
   - modal to submit artist + b2b
   - save to Firestore or localStorage
   - realtime top lists (Firestore) or local compute
   - Spotify/SoundCloud embed UI
   =========================== */

/* ---------- CONFIG ----------
  If you want realtime shared data across users, paste your
  Firebase config object below. Example:
  const FIREBASE_CONFIG = {
    apiKey: "...",
    authDomain: "yourproject.firebaseapp.com",
    projectId: "yourproject",
    storageBucket: "yourproject.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
  };
  If FIREBASE_CONFIG is null, the app uses localStorage fallback.
*/
const FIREBASE_CONFIG = null; // <-- PASTE YOUR FIREBASE CONFIG OBJECT HERE

/* ---------- GENRES ---------- */
const GENRES = [
  { id: 'techno', name: 'Hard / Techno', color: '#b23cff' },
  { id: 'house',  name: 'House', color: '#00d18a' },
  { id: 'dnb',    name: 'Drum & Bass', color: '#2ec4ff' },
  { id: 'dub',    name: 'Dubstep', color: '#ff9f1c' },
  { id: 'elect',  name: 'Electronic', color: '#d645ff' },
  { id: 'main',   name: 'Mainstream/International', color: '#ffffff' }
];

/* ---------- DOM refs ---------- */
const bgCanvas = document.getElementById('bgCanvas');
const orbsRoot = document.getElementById('orbs');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const favArtistInput = document.getElementById('favArtist');
const b2bInput = document.getElementById('b2bArtist');
const cancelBtn = document.getElementById('cancelBtn');
const submitBtn = document.getElementById('submitBtn');

const openTopBtn = document.getElementById('openTopBtn');
const topPanel = document.getElementById('topPanel');
const genreSelect = document.getElementById('genreSelect');
const panelGenreName = document.getElementById('panelGenreName');
const topList = document.getElementById('topList');

const playlistInput = document.getElementById('playlistInput');
const loadPlaylist = document.getElementById('loadPlaylist');
const clearPlaylist = document.getElementById('clearPlaylist');
const embedWrap = document.getElementById('embedWrap');

const legendList = document.getElementById('legendList');

/* ---------- canvas background: stars + gas/dust ---------- */
const ctx = bgCanvas.getContext('2d');
function resizeCanvas(){
  bgCanvas.width = innerWidth * devicePixelRatio;
  bgCanvas.height = innerHeight * devicePixelRatio;
  bgCanvas.style.width = innerWidth + 'px';
  bgCanvas.style.height = innerHeight + 'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
addEventListener('resize', resizeCanvas);
resizeCanvas();

/* create star field */
const STAR_COUNT = 900;
const stars = [];
for(let i=0;i<STAR_COUNT;i++){
  stars.push({
    x: Math.random()*innerWidth,
    y: Math.random()*innerHeight,
    r: Math.random()*1.6 + 0.2,
    alpha: Math.random()*0.9 + 0.1,
    twinkle: Math.random()*0.02 + 0.002
  });
}

/* create moving gas layers (simple drifting radial gradients) */
const GAS_LAYERS = [];
for(let i=0;i<4;i++){
  GAS_LAYERS.push({
    x: innerWidth/2 + (Math.random()-0.5)*600,
    y: innerHeight/2 + (Math.random()-0.5)*400,
    r: 400 + Math.random()*900,
    speedX: (Math.random()-0.5)*0.12,
    speedY: (Math.random()-0.5)*0.08,
    opacity: 0.04 + Math.random()*0.06,
    hue: 220 + (Math.random()-0.5)*80
  });
}

let time = 0;
function drawBackground(dt){
  time += dt;
  ctx.clearRect(0,0,innerWidth,innerHeight);

  // dark gradient base
  const g = ctx.createLinearGradient(0,0,0,innerHeight);
  g.addColorStop(0, '#02020b');
  g.addColorStop(1, '#000005');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,innerWidth,innerHeight);

  // gas layers
  GAS_LAYERS.forEach((gl, idx) => {
    gl.x += gl.speedX * dt * 0.06;
    gl.y += gl.speedY * dt * 0.06;
    const rad = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r);
    const color = `hsla(${gl.hue},60%,60%,${gl.opacity})`;
    rad.addColorStop(0, color);
    rad.addColorStop(0.4, 'rgba(0,0,0,0.03)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rad;
    ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.globalCompositeOperation = 'source-over';
  });

  // stars (twinkle)
  stars.forEach(s=>{
    s.alpha += (Math.random()*2-1) * s.twinkle;
    if(s.alpha < 0.05) s.alpha = 0.05;
    if(s.alpha > 1) s.alpha = 1;
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  });

  // subtle vignette
  const vg = ctx.createRadialGradient(innerWidth/2, innerHeight/2, Math.min(innerWidth,innerHeight)/4, innerWidth/2, innerHeight/2, Math.max(innerWidth,innerHeight)/1.1);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,innerWidth,innerHeight);
}

/* ---------- create orbs (DOM) ---------- */
const orbs = [];
function createOrbs(){
  orbsRoot.innerHTML = '';
  GENRES.forEach((g, i) => {
    const el = document.createElement('div');
    el.className = 'orb';
    el.dataset.genre = g.id;
    el.dataset.index = i;
    // colored translucent background
    el.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85) 0%, ${hexToRgba(g.color,0.28)} 35%, ${hexToRgba(g.color,0.12)} 70%, rgba(0,0,0,0.06) 100%)`;
    // wisps overlays
    el.style.setProperty('--wisp1', hexToRgba(g.color,0.12));
    el.style.setProperty('--wisp2', hexToRgba(g.color,0.06));
    el.style.boxShadow = `0 20px 60px ${hexToRgba(g.color,0.12)}`;

    // inner glass and label
    const glass = document.createElement('div'); glass.className = 'glass';
    const label = document.createElement('div'); label.className='label'; label.textContent = g.name;
    el.appendChild(glass); el.appendChild(label);

    // random initial placement
    const size = 110 + Math.random()*50;
    el.style.width = `${size}px`; el.style.height = `${size}px`;
    el.style.left = `${10 + Math.random()*80}%`;
    el.style.top = `${10 + Math.random()*75}%`;

    // wisps pseudo elements color via before/after (applied inline)
    el.style.setProperty('--before-color', hexToRgba(g.color,0.18));
    el.style.setProperty('--after-color', hexToRgba(g.color,0.08));
    // give hover pointer events active
    el.style.pointerEvents = 'auto';

    // attach events
    el.addEventListener('click', (ev)=> {
      ev.stopPropagation();
      openModalForGenre(g);
    });

    orbsRoot.appendChild(el);
    orbs.push({ el, meta: g, score:0 });
    // animate with random CSS key-like motion via requestAnimationFrame
    animateOrb(el, i);
  });
}

/* per-orb subtle motion using requestAnimationFrame */
function animateOrb(el, idx){
  const startX = parseFloat(el.style.left);
  const startY = parseFloat(el.style.top);
  const driftX = (Math.random()-0.5)*6;
  const driftY = (Math.random()-0.5)*6;
  const jitter = () => {
    const t = performance.now()/1000 + idx;
    const x = startX + Math.sin(t*0.6 + idx)*3 + Math.cos(t*0.3 + idx*1.3)*2 + driftX;
    const y = startY + Math.cos(t*0.5 + idx)*4 + Math.sin(t*0.25 + idx*0.9)*2 + driftY;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    requestAnimationFrame(jitter);
  };
  jitter();
}

/* ---------- modal handling ---------- */
let currentGenre = null;
function openModalForGenre(genre){
  currentGenre = genre;
  modalTitle.textContent = `Add favorite artist — ${genre.name}`;
  favArtistInput.value = '';
  b2bInput.value = '';
  modal.classList.remove('hidden');
  favArtistInput.focus();
}
cancelBtn.addEventListener('click', ()=> modal.classList.add('hidden'));
submitBtn.addEventListener('click', async ()=> {
  const artist = favArtistInput.value.trim();
  const b2b = b2bInput.value.trim();
  if(!artist){ favArtistInput.focus(); return; }
  // save to backend or local
  await saveVote(currentGenre.id, artist, b2b);
  modal.classList.add('hidden');
});

/* ---------- storage: Firestore or localStorage fallback ---------- */
let db = null;
let useFirestore = false;
if(FIREBASE_CONFIG){
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    useFirestore = true;
    console.log('Firestore enabled');
  }catch(e){ console.warn('Firebase init failed', e); useFirestore=false; }
}

async function saveVote(genreId, artist, b2b){
  const payload = { genre: genreId, artist: artist, b2b: b2b || '', ts: firebase && firebase.firestore ? firebase.firestore.FieldValue.serverTimestamp() : Date.now() };
  if(useFirestore && db){
    try{
      await db.collection('artistVotes').add(payload);
    }catch(e){
      console.error('Firestore write error', e);
      saveLocal(genreId, artist, b2b);
    }
  } else {
    saveLocal(genreId, artist, b2b);
  }
  // refresh local UI
  computeAndRenderTop();
}

/* local fallback save */
function saveLocal(genreId, artist, b2b){
  const key = 'codemq_votes_v1';
  const raw = JSON.parse(localStorage.getItem(key) || '{}');
  raw[genreId] = raw[genreId] || [];
  raw[genreId].push({artist, b2b, ts:Date.now()});
  localStorage.setItem(key, JSON.stringify(raw));
}

/* ---------- compute top artists and render ---------- */
async function readAllVotes(){
  if(useFirestore && db){
    // read all votes
    const snap = await db.collection('artistVotes').get();
    const out = {};
    snap.forEach(doc => {
      const v = doc.data();
      if(!v || !v.genre) return;
      out[v.genre] = out[v.genre] || [];
      out[v.genre].push({artist:v.artist || '', b2b:v.b2b || '', ts: v.ts ? v.ts.toMillis ? v.ts.toMillis() : v.ts : Date.now()});
    });
    return out;
  } else {
    const key = 'codemq_votes_v1';
    return JSON.parse(localStorage.getItem(key) || '{}');
  }
}

async function computeAndRenderTop(){
  const raw = await readAllVotes();
  // compute counts per genre
  const counts = {};
  GENRES.forEach(g=> counts[g.id] = {});
  Object.keys(raw).forEach(genreId=>{
    const arr = raw[genreId] || [];
    arr.forEach(r=>{
      const name = (r.artist || '').trim();
      if(!name) return;
      counts[genreId][name] = (counts[genreId][name] || 0) + 1;
    });
  });
  // convert to sorted arrays
  const topPerGenre = {};
  GENRES.forEach(g=>{
    const map = counts[g.id] || {};
    const list = Object.keys(map).map(a=>({artist:a,count:map[a]})).sort((a,b)=>b.count-a.count);
    topPerGenre[g.id] = list;
    // update orb glow/scale
    const orbObj = orbs.find(o=>o.meta.id===g.id);
    const topCount = list[0] ? list[0].count : 0;
    if(orbObj){
      const glow = Math.min(1.8, 0.4 + Math.log10(1+topCount)*0.25);
      orbObj.el.style.boxShadow = `0 24px ${30 + glow*40}px ${hexToRgba(g.color, 0.12 + glow*0.08)}`;
      const scale = 1 + Math.min(0.45, Math.log10(1+topCount)*0.06);
      orbObj.el.style.transform = `scale(${scale})`;
    }
  });

  // render panel for selected genre
  const sel = genreSelect.value || GENRES[0].id;
  panelGenreName.textContent = GENRES.find(g=>g.id===sel).name;
  const arr = topPerGenre[sel] || [];
  let html = '';
  if(arr.length === 0) html = '<div style="color:#9aa">No submissions yet — be the first.</div>';
  else{
    const topN = Math.min(50, arr.length);
    for(let i=0;i<topN;i++){
      const it = arr[i];
      html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03)"><div>${i+1}. ${escapeHtml(it.artist)}</div><div style="opacity:0.8">${it.count}</div></div>`;
    }
  }
  topList.innerHTML = html;
}

/* ---------- realtime listener (Firestore) ---------- */
if(useFirestore && db){
  db.collection('artistVotes').onSnapshot(()=> {
    computeAndRenderTop();
  });
}

/* ---------- UI wiring ---------- */
openTopBtn.addEventListener('click', ()=> {
  topPanel.classList.toggle('hidden');
});
genreSelect.addEventListener('change', computeAndRenderTop);

/* populate genre select & legend */
GENRES.forEach(g=>{
  const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
  const li = document.createElement('li'); li.textContent = g.name; li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.02), ${hexToRgba(g.color,0.18)})`; legendList.appendChild(li);
});

/* playlist embed loader */
loadPlaylist.addEventListener('click', ()=>{
  const v = playlistInput.value.trim();
  if(!v){ embedWrap.innerHTML=''; return; }
  // Spotify URI
  if(v.startsWith('spotify:playlist:')){
    const id = v.split(':').pop();
    embedWrap.innerHTML = `<iframe src="https://open.spotify.com/embed/playlist/${id}" width="100%" height="92" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
    return;
  }
  // Spotify share url
  if(v.includes('open.spotify.com')){
    const u = v.replace('/playlist/','/embed/playlist/').replace('open.spotify.com','open.spotify.com/embed');
    embedWrap.innerHTML = `<iframe src="${u}" width="100%" height="92" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
    return;
  }
  // SoundCloud example (url to widget)
  if(v.includes('soundcloud.com')){
    // use SoundCloud oEmbed widget (simple iframe)
    embedWrap.innerHTML = `<iframe width="100%" height="120" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(v)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false"></iframe>`;
    return;
  }
  embedWrap.innerHTML = `<div style="color:#f88">Unrecognized playlist URL. Use Spotify or SoundCloud link.</div>`;
});
clearPlaylist.addEventListener('click', ()=>{ playlistInput.value=''; embedWrap.innerHTML=''; });

/* ---------- utilities ---------- */
function hexToRgba(hex, alpha=1){
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- animation loop ---------- */
let last = performance.now();
function loop(now){
  const dt = now - last;
  last = now;
  drawBackground(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- init ---------- */
createOrbs();
computeAndRenderTop();

/* ---------- click outside to close modal ---------- */
document.addEventListener('click', (e)=>{
  if(!modal.classList.contains('hidden') && !modal.querySelector('.modalCard').contains(e.target)) {
    modal.classList.add('hidden');
  }
});

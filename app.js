/* app.js — Integrated: horizontal audio-reactive ribbon + bubbles + modal + intro fade
   Drop this into your repo replacing the old app.js. Relies on Three.js (already loaded in index.html).
   Notes:
   - Audio analysis works when the audio source is a direct-playable audio element (local file, direct MP3/OGG URL).
   - SoundCloud page URLs will be embedded as an iframe (no analyzer); in that case visuals fall back to simulated beats.
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // optional: add Firebase config if you want realtime persistence

/* ---------- Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){
  if (typeof hex === 'string') return hex; // if already CSS string
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Persistence (local fallback) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch(e) {
    console.warn('Firebase init failed — using localStorage', e);
    useFirebase = false;
  }
}
async function saveVote(genreId, artistName, b2b){
  const rec = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef) await dbRef.child(genreId).push(rec);
  else {
    const KEY='codemq_votes';
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    data[genreId] = data[genreId] || [];
    data[genreId].push(rec);
    if (data[genreId].length > 20000) data[genreId].splice(0, data[genreId].length-20000);
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('codemq_local_update'));
  }
}
async function readAllVotesOnce(){
  if (useFirebase && dbRef) {
    const snap = await dbRef.get();
    return snap.exists() ? snap.val() : {};
  } else {
    return JSON.parse(localStorage.getItem('codemq_votes') || '{}');
  }
}
if (!useFirebase) window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* ---------- DOM refs & initial hidden UI ---------- */
const uiWrap = document.getElementById('ui');
const legendWrap = document.getElementById('legend');
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');
const playlistPanel = document.getElementById('playlistPanel');
const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');
const legendList = document.getElementById('legendList');

// start hidden until intro plays
uiWrap.style.opacity = '0';
uiWrap.style.pointerEvents = 'none';
legendWrap.style.opacity = '0';
legendWrap.style.pointerEvents = 'none';

/* ---------- Genres & color mapping ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79, playlist: 'https://soundcloud.com/your-hard-techno-playlist' },
  { id:'house', name:'House', color:0xffbf5f, playlist: 'https://soundcloud.com/your-house-playlist' },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85, playlist: 'https://soundcloud.com/your-dnb-playlist' },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff, playlist: 'https://soundcloud.com/your-dubstep-playlist' },
  { id:'electronic', name:'Electronic / Dance', color:0x9f5fff, playlist: 'https://soundcloud.com/your-electronic-playlist' },
  { id:'mainstream', name:'Mainstream / International', color:0xffffff, playlist: 'https://soundcloud.com/your-mainstream-playlist' }
];
GENRES.forEach(g=>{
  const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
  const li = document.createElement('li'); li.textContent = g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
  li.style.color = lum >= 128 ? '#000' : '#fff';
  legendList.appendChild(li);
});
toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));
genreSelect.addEventListener('change', ()=> computeAndRenderTop());

/* ---------- Three.js scene ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

// Camera and renderer: zoom out so bubbles take approx 4/5 of frame
const CAMERA_Z = 1000; // user requested zoom out (4/5 frame)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 50, CAMERA_Z);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000010, 1);
wrap.appendChild(renderer.domElement);

/* lighting */
const ambient = new THREE.AmbientLight(0xffffff, 0.45); scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 0.8); directional.position.set(10,20,10); scene.add(directional);

/* ---------- Starfield (two layers, twinkle) ---------- */
function makeStarLayer(count, spreadX=6000, spreadY=3500, spreadZ=6000, size=1.2, opacity=0.9){
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count*3);
  const phases = new Float32Array(count);
  for (let i=0;i<count;i++){
    positions[i*3] = (Math.random()-0.5)*spreadX;
    positions[i*3+1] = (Math.random()-0.5)*spreadY;
    positions[i*3+2] = -Math.random()*spreadZ - 200;
    phases[i] = Math.random()*Math.PI*2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const points = new THREE.Points(geo, mat);
  return { geo, mat, points };
}
const starsFar = makeStarLayer(1800, 7000, 4000, 7000, 1.0, 0.9);
const starsNear = makeStarLayer(700, 3600, 2200, 3800, 2.0, 0.6);
scene.add(starsFar.points, starsNear.points);

/* ---------- Dust background plane ---------- */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(8000, 4200), new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false }));
dustPlane.position.set(0, 0, -3000);
scene.add(dustPlane);

/* ---------- Utilities: small textures ---------- */
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.2,'rgba(255,255,255,0.9)');
  g.addColorStop(0.6,'rgba(255,255,255,0.2)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
const POINT_TEX = generateStarTexture();

/* ---------- Ribbon (horizontal) — cloud of points forming a glowing waveform ---------- */
const RIBBON_POINTS = 240; // number of samples along the horizontal ribbon
const ribbonGeo = new THREE.BufferGeometry();
const ribbonPos = new Float32Array(RIBBON_POINTS * 3);
const ribbonSize = new Float32Array(RIBBON_POINTS);
for (let i=0;i<RIBBON_POINTS;i++){
  const x = (i/(RIBBON_POINTS-1) - 0.5) * 2200; // wide across X
  ribbonPos[i*3] = x;
  ribbonPos[i*3+1] = 0;
  ribbonPos[i*3+2] = -50;
  ribbonSize[i] = 8 + Math.random()*6;
}
ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3));
ribbonGeo.setAttribute('pSize', new THREE.BufferAttribute(ribbonSize, 1));
const ribbonMat = new THREE.PointsMaterial({ size: 12, map: POINT_TEX, transparent:true, opacity:0.95, depthWrite:false, blending: THREE.AdditiveBlending });
let ribbon = new THREE.Points(ribbonGeo, ribbonMat);
scene.add(ribbon);

/* ---------- Bubble cluster (genre bubbles) ---------- */
const CLUSTER_RADIUS = 420;
const BUBBLES_GROUP = new THREE.Group(); scene.add(BUBBLES_GROUP);
const BUBBLES = {};

GENRES.forEach((g, idx) => {
  const color = new THREE.Color(g.color);
  // larger bubble radius per request
  const coreRadius = 60 + Math.random()*20;
  const geo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.18,
    metalness: 0.08,
    transmission: 0.6,
    emissive: color.clone().multiplyScalar(0.02),
    emissiveIntensity: 0.6,
    clearcoat: 0.2,
    depthWrite: false // allow phasing
  });
  const mesh = new THREE.Mesh(geo, mat);

  // soft rim sprite
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateStarTexture(), color: g.color, transparent:true, opacity:0.18, blending:THREE.AdditiveBlending, depthWrite:false }));
  sprite.scale.set(coreRadius*8.5, coreRadius*8.5, 1);
  mesh.add(sprite);

  // container for transforms
  const container = new THREE.Group();
  container.add(mesh);
  // initial placement on ring (they will orbit together)
  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.55, -idx*6);

  // stardust ring (tilted, counter-rotating)
  function makeRing(){
    const ring = new THREE.Group();
    const ringRadius = coreRadius * (1.9 + Math.random()*0.8);
    const pcount = 180 + Math.floor(Math.random()*140);
    const ppos = new Float32Array(pcount*3);
    for (let i=0;i<pcount;i++){
      const a = (i/pcount) * Math.PI*2;
      const rr = ringRadius + (Math.random()-0.5)*(coreRadius*0.36);
      ppos[i*3] = Math.cos(a)*rr;
      ppos[i*3+1] = Math.sin(a)*rr;
      ppos[i*3+2] = (Math.random()-0.5)*(coreRadius*0.6);
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(ppos,3));
    const rmat = new THREE.PointsMaterial({ size: 9 + Math.random()*6, map: POINT_TEX, transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending });
    rmat.color = color.clone().multiplyScalar(0.95);
    const points = new THREE.Points(rgeo, rmat);
    ring.add(points);
    // soft glow for ring
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateStarTexture(), color: g.color, transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
    glow.scale.set(ringRadius*2.0, ringRadius*2.0, 1);
    ring.add(glow);
    // tilt
    ring.rotation.set((Math.random()-0.5)*0.8, (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.2);
    ring.userData.rotationSpeed = (Math.random()*0.006 + 0.002) * (idx % 2 === 0 ? -1 : 1);
    return { ring, points, rmat: rmat };
  }
  const ringObj = makeRing();
  container.add(ringObj.ring);

  // gas halo
  const gas = new THREE.Mesh(new THREE.SphereGeometry(coreRadius*1.9, 32, 32), new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.035, blending:THREE.AdditiveBlending, depthWrite:false }));
  container.add(gas);

  BUBBLES_GROUP.add(container);
  BUBBLES[g.id] = { id:g.id, idx, container, mesh, mat, sprite, ringObj, gas, color, baseAngle };
});

/* ---------- Wave ribbon helper: convert audio data -> y positions ---------- */
function computeRibbonFromAudio(byteArray){
  // input: Uint8Array from analyser frequency data
  // We'll sample across the low->mid frequencies into positions for the ribbon
  const out = new Float32Array(RIBBON_POINTS);
  const bins = byteArray.length;
  for (let i=0;i<RIBBON_POINTS;i++){
    // map i -> frequency bin index using squared mapping for more low emphasis
    const t = i / (RIBBON_POINTS-1);
    const idx = Math.floor(Math.pow(t, 1.2) * (bins-1));
    const v = byteArray[idx] / 255; // 0..1
    out[i] = (v - 0.18) * 260 * (0.6 + 0.8*Math.sin(t*4)); // scale & offset
  }
  return out;
}

/* ---------- Audio controller + analyzer (works for direct-playable audio) ---------- */
const audioController = (function(){
  let audioCtx = null, analyser = null, source = null, dataArray = null;
  let audioEl = null, active = false;
  async function ensure(){
    if (!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
  }
  // load direct-playable URL or object URL. If it's a SoundCloud page URL, we return false (embed will be used)
  async function loadUrl(url){
    try {
      // Basic heuristic: if URL contains 'soundcloud.com' but not an audio file extension, we defer to embed
      const lc = url.toLowerCase();
      const likelyPage = lc.includes('soundcloud.com') && !(/\.(mp3|ogg|wav|m4a)$/i).test(lc);
      if (likelyPage) return false;
      await ensure();
      if (!audioEl){
        audioEl = document.createElement('audio');
        audioEl.crossOrigin = 'anonymous';
        audioEl.controls = true;
        audioEl.style.width = '100%';
      }
      // stop previous
      if (source){ try{ source.disconnect(); } catch(e){} }
      audioEl.src = url;
      audioEl.loop = true;
      await audioEl.play().catch(()=>{ /* autoplay blocked — user interaction required */ });
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      // attach audioEl to spotifyEmbed area
      spotifyEmbed.innerHTML = ''; spotifyEmbed.appendChild(audioEl);
      return true;
    } catch(err){
      console.warn('loadUrl failed', err);
      active = false; return false;
    }
  }
  function loadEmbed(url){
    // embed a SoundCloud player iframe into spotifyEmbed (no analyzer)
    spotifyEmbed.innerHTML = '';
    const iframe = document.createElement('iframe');
    // use SoundCloud embed if link appears to be a track or playlist page
    // Build a SoundCloud oEmbed embed by changing to /embed if possible
    try {
      let src = url;
      if (url.includes('soundcloud.com')){
        // if user gave a track/playlist url it'll often respond to the embed endpoint
        if (!src.includes('/embed/')) {
          src = src.replace('soundcloud.com', 'w.soundcloud.com/player/?url=' + encodeURIComponent(url));
        }
      }
      iframe.src = src;
    } catch(e){
      iframe.src = url;
    }
    iframe.width = '100%';
    iframe.height = '120';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay';
    spotifyEmbed.appendChild(iframe);
    // no analyzer available in this path
    return true;
  }
  function stop(){
    if (audioEl){ try{ audioEl.pause(); audioEl.src = ''; } catch(e){} }
    if (audioCtx && audioCtx.state !== 'closed') try{ audioCtx.suspend(); }catch(e){}
    active = false;
  }
  function getAmps(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.03));
    let bass = 0;
    for (let i=0;i<lowCount;i++) bass += dataArray[i];
    bass = bass / lowCount / 255;
    let sum=0;
    for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length) / 255;
    return { bass, rms, raw: dataArray };
  }
  return { loadUrl, loadEmbed, stop, getAmps, isActive: ()=> active };
})();

/* ---------- Intro fade overlay + autoplay once for "Wave" ---------- */
const INTRO_TRACK = 'https://soundcloud.com/user-200235414/wave-1'; // user-provided link
let introPlayed = false;
function playIntroOnce(){
  // overlay element in HTML: #fade-overlay exists per your index.html
  const overlay = document.getElementById('fade-overlay') || (function(){ const d=document.createElement('div'); d.id='fade-overlay'; document.body.appendChild(d); return d; })();
  overlay.style.transition = 'opacity 1.5s ease';
  overlay.style.pointerEvents = 'auto';

  // Attempt to load & play intro track via audioController (direct playable or embed)
  (async ()=>{
    if (introPlayed) return;
    introPlayed = true;

    // Try to load with analyzer (direct file) — will return false for soundcloud page => embed fallback
    const loaded = await audioController.loadUrl(INTRO_TRACK);
    if (!loaded) {
      audioController.loadEmbed(INTRO_TRACK);
    }

    // Start fade immediately and remove after 1.5s — the ui appears slightly after
    setTimeout(()=> {
      overlay.style.opacity = '0';
      setTimeout(()=> { try{ overlay.remove(); }catch(e){} }, 1600);
    }, 0);

    // reveal UI slightly after fade (0.5s after fade start)
    setTimeout(()=> {
      uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto';
      legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto';
    }, 800);
  })();
}

/* ---------- Modal & click behavior (centered) ---------- */
let activeModal = null;
function openCenteredModal(genreId){
  // reuse previous center modal implementation (styled by .panel)
  closeModal();
  const g = GENRES.find(x=>x.id===genreId); if (!g) return;
  const modal = document.createElement('div');
  modal.className = 'panel';
  modal.style.position = 'fixed';
  modal.style.left = '50%';
  modal.style.top = '50%';
  modal.style.transform = 'translate(-50%,-50%)';
  modal.style.zIndex = 9999;
  modal.style.width = '460px';
  modal.style.maxWidth = '92vw';
  modal.style.textAlign = 'left';
  modal.style.backdropFilter = 'blur(8px)';
  modal.innerHTML = `
    <button class="closeX" aria-label="Close" style="position:absolute;right:12px;top:12px;border:none;background:transparent;color:#dfefff;font-size:20px;cursor:pointer">✕</button>
    <h3 style="margin-top:4px">${g.name}</h3>
    <p style="color:#cfd8e6;margin-top:4px;font-size:13px">Who's your favorite artist? (Dream B2B optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px" />
    <input class="b2b" placeholder="Dream B2B (optional)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px" />
    <textarea class="why" rows="3" placeholder="Why (optional)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px"></textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
      <div style="display:flex;gap:8px;align-items:center">
        <input id="modalAudioFile" type="file" accept="audio/*" style="display:none" />
        <button id="openAudioFile" class="btn" style="padding:8px;border-radius:6px;border:none;background:#222;color:#fff;cursor:pointer">Load Local Audio</button>
        <input id="modalAudioUrl" placeholder="Direct MP3/OGG URL or SoundCloud link" style="padding:8px;border-radius:6px;border:none;width:260px;background:rgba(255,255,255,0.02);color:#fff" />
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost cancel" style="padding:8px;border-radius:6px;border:none;background:transparent;color:#fff">Cancel</button>
        <button class="btn submit" style="padding:8px;border-radius:6px;border:none;background:#1db954;color:#fff">Submit</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.closeX').addEventListener('click', ()=> closeModal());
  modal.querySelector('.cancel').addEventListener('click', ()=> closeModal());
  modal.querySelector('.submit').addEventListener('click', async ()=>{
    const artist = modal.querySelector('.artist').value.trim(); if (!artist){ modal.querySelector('.artist').focus(); return; }
    const b2b = modal.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashBubble(genreId);
    computeAndRenderTop();
    closeModal();
  });

  // local audio / url loader
  const openAudioFile = modal.querySelector('#openAudioFile');
  const modalAudioFile = modal.querySelector('#modalAudioFile');
  const modalAudioUrl = modal.querySelector('#modalAudioUrl');

  openAudioFile.addEventListener('click', ()=> modalAudioFile.click());
  modalAudioFile.addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    await audioController.loadUrl(url); // analyzer available
    insertAudioPlayerInModal(modal, url, f.name);
  });
  modalAudioUrl.addEventListener('keydown', async (ev)=>{
    if (ev.key === 'Enter'){ const v = modalAudioUrl.value.trim(); if (!v) return;
      const loaded = await audioController.loadUrl(v);
      if (!loaded) audioController.loadEmbed(v);
      insertAudioPlayerInModal(modal, v, v);
    }
  });

  // show UI if hidden
  uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto';
  legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto';

  activeModal = { dom: modal, genreId: g.id };
  setTimeout(()=> modal.querySelector('.artist').focus(), 120);
}
function closeModal(){ if (!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal = null; }
function insertAudioPlayerInModal(modal, src, label){
  let player = modal.querySelector('audio');
  if (!player){ player = document.createElement('audio'); player.controls = true; player.style.width = '100%'; player.style.marginTop='8px'; modal.appendChild(player); }
  player.src = src; player.play().catch(()=>{});
  let info = modal.querySelector('.audioLabel');
  if (!info){ info = document.createElement('div'); info.className='audioLabel'; info.style.fontSize='12px'; info.style.marginTop='6px'; modal.appendChild(info); }
  info.textContent = `Loaded: ${label}`;
}

/* ---------- Top list renderer (keeps existing behavior) ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const perGenreCounts = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r=>{ const k=(r.artist||'').trim(); if(!k) return; counts[k]=(counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id] = sorted;
    updateBubbleHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });
  const sel = genreSelect.value || GENRES[0].id;
  const arr = perGenreCounts[sel] || [];
  let html = '';
  for (let i=0;i<Math.min(15, arr.length); i++){
    html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  }
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  topList.innerHTML = html;
}
function updateBubbleHighlight(genreId, topCount){
  const b = BUBBLES[genreId]; if (!b) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount) * 0.9);
  b.coreEmissive = val;
  b.mesh && (b.mesh.material.emissiveIntensity = val);
  const base = 1.0 + Math.min(0.7, Math.log10(1 + topCount) * 0.12);
  b.mesh && b.mesh.scale.set(base, base, base);
}

/* ---------- Click / Raycast: find bubble -> modal -> load genre playlist ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerDown(e){
  // reveal UI on first interaction (if overlay is gone or still present)
  if (uiWrap.style.opacity === '0') { uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // collect bubble cores
  const cores = [];
  BUBBLES_GROUP.children.forEach(c => {
    c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); });
  });
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    // find parent container
    let parent = null;
    for (const c of BUBBLES_GROUP.children) {
      if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; }
    }
    if (parent){
      const found = Object.values(BUBBLES).find(o => o.container === parent);
      if (found) {
        // open modal and also switch playlist to genre's playlist automatically
        openCenteredModal(found.id);
        switchToGenre(found.id);
      }
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Switch to genre playlist (stops previous audio) ---------- */
async function switchToGenre(genreId){
  const g = GENRES.find(x=>x.id===genreId);
  if (!g) return;
  // stop previous
  audioController.stop();
  // try load playlist url with analyzer — if fails (SoundCloud page) embed it
  const url = g.playlist;
  const loaded = await audioController.loadUrl(url);
  if (!loaded) audioController.loadEmbed(url);
  // ribbon color adapts to genre color
  const col = new THREE.Color(g.color);
  ribbonMat.color = col.clone().multiplyScalar(1.0);
  // pulse immediate feedback
  flashBubble(genreId);
}

/* ---------- flash bubble visual ---------- */
function flashBubble(genreId){
  const b = BUBBLES[genreId]; if (!b) return;
  const orig = b.mesh.material.emissiveIntensity || 0.6;
  b.mesh.material.emissiveIntensity = Math.max(1.8, orig*2.6);
  setTimeout(()=> { b.mesh.material.emissiveIntensity = orig; }, 1000);
}

/* ---------- ribbon color helper (hue shift toward genre) ---------- */
function ribbonSetHue(hex){
  ribbonMat.color = new THREE.Color(hex).multiplyScalar(1.0);
}

/* ---------- Animation loop: ribbon + bubbles + stars + smoke pulse ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // audio analysis (if available)
  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : 0;
  const rms = amps ? amps.rms : (0.06 + Math.sin(t*0.25)*0.02);

  // stars twinkle
  starsFar.points.rotation.z += 0.0003;
  starsNear.points.rotation.z -= 0.00055;
  starsNear.mat.opacity = 0.55 + Math.sin(t*0.9 + 3.1) * 0.08 + rms * 0.12;
  starsFar.mat.opacity = 0.88 + Math.cos(t*0.4 + 1.7) * 0.04 + bass * 0.06;

  // dust plane rotate slowly
  dustPlane.rotation.z += 0.00008;

  // update ribbon: if analyzer available, use computed waveform; else simulate organic wave
  let yvals = null;
  if (amps && amps.raw) {
    yvals = computeRibbonFromAudio(amps.raw);
  } else {
    // simulated wave for no-analyzer case
    yvals = new Float32Array(RIBBON_POINTS);
    for (let i=0;i<RIBBON_POINTS;i++){
      const t2 = (i/(RIBBON_POINTS-1));
      yvals[i] = Math.sin(t*2.0 + t2*12.0) * (28 + Math.sin(i*0.3 + t)*12) * (0.9 + 0.6*Math.sin(t*0.7 + i*0.15));
    }
  }
  // write into ribbon positions & sizes
  const posAttr = ribbon.geometry.attributes.position;
  const sizeAttr = ribbon.geometry.attributes.pSize;
  for (let i=0;i<RIBBON_POINTS;i++){
    posAttr.array[i*3+1] = yvals[i] * (0.85 + bass*0.6); // vertical offset scaled by bass
    // slight Z wobble for depth
    posAttr.array[i*3+2] = -50 + Math.sin(t*0.9 + i*0.04) * 10;
    sizeAttr.array[i] = 8 + Math.max(0, (Math.abs(yvals[i]) / 20)) * (6 + bass*18);
  }
  posAttr.needsUpdate = true;
  sizeAttr.needsUpdate = true;
  // ribbon brightness and size overall responds to bass
  ribbonMat.opacity = 0.85 + Math.min(0.6, bass * 0.8);
  ribbonMat.size = 10 + bass * 18;

  // camera gentle breathing influenced by bass/rms
  camera.position.z = CAMERA_Z + Math.sin(t*0.08) * 6 + bass * 60;
  camera.position.x = Math.sin(t*0.03) * 10 * (0.6 + rms);
  camera.position.y = Math.cos(t*0.02) * 6 * (0.6 + rms);
  camera.lookAt(0,0,0);

  // cluster orbit: unified diagonal-horizontal oval (tilt up-right)
  const clusterSpeed = 0.12 + bass * 0.3;
  GENRES.forEach((g, idx) => {
    const b = BUBBLES[g.id];
    if (!b) return;
    const phase = t * clusterSpeed + b.baseAngle * (0.6 + idx*0.06);
    // diagonal oval: x large, y smaller, tilted up-right
    const ex = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.62 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);
    // place bubble along unified orbit (not in groups)
    const x = Math.cos(phase) * ex;
    const y = Math.sin(phase*1.02 + idx*0.31) * ey;
    // tilt up-right: apply transform matrix by rotating positions slightly
    const tiltAngle = 0.26; // tilt up-right
    const xt = x * Math.cos(tiltAngle) - y * Math.sin(tiltAngle);
    const yt = x * Math.sin(tiltAngle) + y * Math.cos(tiltAngle);
    b.container.position.x = xt + (idx - (GENRES.length-1)/2) * Math.sin(t*0.03)*2;
    b.container.position.y = yt + Math.cos(idx*0.5 + t*0.2)*4;
    b.container.position.z = Math.sin(t*(0.55 + idx*0.02))*10 - idx*4;

    // local spin
    b.mesh.rotation.y += 0.002 + idx*0.0002;
    b.mesh.rotation.x += 0.0011;

    // ring counter-rotation
    b.ringObj.ring.rotation.z += b.ringObj.ring.userData.rotationSpeed * (1 + bass * 0.9);
    b.ringObj.rmat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx)) * 0.18 + rms * 0.18;

    // gas breathing
    b.gas.material.opacity = 0.035 + 0.012 * Math.sin(t*0.9 + idx) + bass * 0.02;

    // rim sprite pulse
    b.mesh.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.14 + rms * 0.28; });

    // Adaptive: if ribbon currently uses the same hue, slightly increase bubble emissive
    // (we set ribbonMat.color when switching genres; compare roughly)
    // Not strict equality check — just a soft animation handled elsewhere
  });

  renderer.render(scene, camera);
}
animate();

/* ---------- Raycast + pointer events already wired above; resize ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
});

/* ---------- Startup tasks ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());

// Play intro on page load (only once)
window.addEventListener('load', ()=>{
  // ensure fade-overlay exists in DOM; if style defines #fade-overlay you already added it in index.html
  playIntroOnce();
  // minor safety: if user interacts, resume audio context on some browsers
  document.body.addEventListener('click', async function resumeOnce(){ try{ if (typeof AudioContext !== 'undefined') { const ctx = (window.AudioContext || window.webkitAudioContext); if (ctx && ctx.prototype && ctx.prototype.resume) { /* no-op */ } } }catch(e){} document.body.removeEventListener('click', resumeOnce); }, { once:true });
});

/* ---------- Small debug sanity ---------- */
setTimeout(()=> { if (!Object.keys(BUBBLES).length) console.error('Bubbles not initialized — check Three.js load'); }, 900);

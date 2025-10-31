/* app.js — Mobile-first, 7-genre orbs + audio-reactive ribbon
   - Mobile-friendly sizing and orientation handling.
   - Orbs called "ORB" / "ORB_GROUP" / "ORB_MESHES" in code (matches your naming).
   - Vote/save uses localStorage by default; optional Firebase config supported.
   - Placeholders for Spotify playlists — replace with real playable URLs/streams.
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // set your Firebase config object (or leave null to use localStorage)
const MOBILE_PARTICLE_SCALE = 0.6; // reduces particle counts on mobile for perf

/* ---------- Small helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){
  const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255;
  return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* safe DOM getter / create placeholders if missing */
function getEl(id, tag='div', createIfMissing=false, attrs={}){
  let el = document.getElementById(id);
  if (!el && createIfMissing){
    el = document.createElement(tag); el.id = id;
    Object.keys(attrs).forEach(k=>el.setAttribute(k, attrs[k]));
    el.style.position = 'absolute'; el.style.left = '-9999px'; el.style.top = '-9999px';
    document.body.appendChild(el);
  }
  return el;
}

/* ---------- Persistence (Firebase optional / fallback localStorage) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG){
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch(e){ console.warn('Firebase init failed; using localStorage', e); useFirebase=false; }
}

async function saveVote(genreId, payload){
  // payload { email, artists:[], b2b, country, ts }
  payload.ts = Date.now();
  if (useFirebase && dbRef) {
    await dbRef.child(genreId).push(payload);
  } else {
    const KEY='codemq_votes_v2';
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    data[genreId] = data[genreId] || [];
    data[genreId].push(payload);
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
    return JSON.parse(localStorage.getItem('codemq_votes_v2') || '{}');
  }
}
if (!useFirebase) window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* ---------- UI refs & initial hidden state (mobile-first) ---------- */
const uiWrap = getEl('ui', 'div', true);
const canvasWrap = getEl('canvasWrap', 'div', true);
const legendWrap = getEl('legend', 'div', true);
const genreSelect = getEl('genreSelect', 'select', true);
const topList = getEl('topList', 'div', true);
const spotifyEmbed = getEl('spotifyEmbed', 'div', true);
const toggleTop = getEl('toggleTop', 'button', true);
const leftPanel = getEl('leftPanel', 'div', true);
const legendList = getEl('legendList', 'div', true); // we keep it simple for mobile

// Hide UI until interaction to improve mobile autoplay behavior and initial render
uiWrap.style.opacity = '0'; uiWrap.style.pointerEvents = 'none';
legendWrap.style.opacity = '0'; legendWrap.style.pointerEvents = 'none';

/* ---------- Genres (7) & Colors (mobile palette) ----------
   Hard Techno (red), Techno (orange), House (amber), Drum & Bass (green),
   Dubstep (cyan), Electronic/Dance (purple), Pop/International (pink)
*/
const GENRES = [
  { id:'hard-techno',  name:'Hard Techno', color: 0xff3b3b },
  { id:'techno',       name:'Techno',      color: 0xff7a00 },
  { id:'house',        name:'House',       color: 0xffbf5f },
  { id:'dnb',          name:'Drum & Bass', color: 0x5fff85 },
  { id:'dubstep',      name:'Dubstep',     color: 0x5fc9ff },
  { id:'electronic',   name:'Electronic / Dance', color: 0x9f5fff },
  { id:'pop',          name:'Pop / International', color: 0xff66aa }
];

// minimal legend boxes (no extra words) — stacked beside the player (mobile: top area)
GENRES.forEach(g=>{
  if (genreSelect && genreSelect.tagName === 'SELECT'){
    const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; genreSelect.appendChild(o);
  }
  if (legendList){
    const b = document.createElement('button');
    b.className = 'legendBox';
    b.dataset.genre = g.id;
    b.title = g.name;
    b.innerHTML = `<span class="dot" style="background:${toCssHex(g.color)}"></span><span class="label">${g.name}</span>`;
    b.addEventListener('click', ()=> { playGenreAudio(g.id).catch(()=>{}); focusOnOrb(g.id); computeAndRenderTop(); });
    legendList.appendChild(b);
  }
});

/* ---------- Three.js core (mobile-first conservative settings) ---------- */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000010, 0.00007);

const CAMERA_Z = 780;
const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 12, CAMERA_Z);
camera.lookAt(0,0,0);

// renderer (use existing canvas if provided)
const existingCanvas = document.getElementById('canvas');
let renderer;
if (existingCanvas) {
  renderer = new THREE.WebGLRenderer({ canvas: existingCanvas, antialias:true, alpha:true });
} else {
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.inset = '0';
  canvasWrap.appendChild(renderer.domElement);
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // cap for mobile perf
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x04040b, 1);

const amb = new THREE.AmbientLight(0xffffff, 0.44); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(8,18,8); scene.add(dir);

/* ---------- Starfield & background dust (lighter for mobile) ---------- */
function makeStarLayer(count, spreadX=5000, spreadY=3000, spreadZ=5000, size=1.0, opacity=0.85){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5) * spreadX;
    pos[i*3+1] = (Math.random()-0.5) * spreadY;
    pos[i*3+2] = -Math.random()*spreadZ - 200;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  return { points: new THREE.Points(geo, mat), mat, geo };
}
const smallScale = (window.innerWidth < 720) ? MOBILE_PARTICLE_SCALE : 1.0;
const starsFar = makeStarLayer(Math.floor(1200 * smallScale), 6000, 3600, 6000, 1.0*smallScale, 0.9);
const starsNear = makeStarLayer(Math.floor(520 * smallScale), 3500, 2200, 3500, 1.6*smallScale, 0.6);
scene.add(starsFar.points, starsNear.points);

// subtle dust plane texture
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800),
  new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.04, depthWrite:false })
);
dustPlane.position.set(0,0,-2400);
scene.add(dustPlane);

/* ---------- small procedural textures ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,4,size/2,size/2,size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, toCssRgba(colorHex, 0.22));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=48; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}

/* helper to create translucent orb material optimized for mobile */
function createTranslucentMaterial(colorHex){
  const color = new THREE.Color(colorHex);
  return new THREE.MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.88),
    transparent: true,
    opacity: 0.16,
    roughness: 0.06,
    metalness: 0.02,
    depthWrite: false,
    emissive: color.clone().multiplyScalar(0.02)
  });
}

/* ---------- ORB cluster (translucent planets/orbs) ---------- */
const CLUSTER_RADIUS = (window.innerWidth < 720) ? 220 : 420;
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};

function createStardustRing(coreRadius, colorHex, tilt, particleCount=140, size=5.0, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.5);
  const count = Math.max(80, Math.floor(particleCount * smallScale));
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i=0;i<count;i++){
    const theta = (i/count) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5) * (coreRadius*0.28);
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.45);
    sizes[i] = (Math.random()*1.0 + 1.0) * size * (0.7 + Math.random()*0.6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({ size:4.8 * smallScale, map: generateStarTexture(), transparent:true, opacity:0.75, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.95);
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // ring halo
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), transparent:true, opacity:0.10, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*1.8, ringRadius*1.8, 1);
  group.add(glow);

  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.004 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, points, mat, rotationSpeed, ringRadius };
}

GENRES.forEach((g, idx) => {
  const color = new THREE.Color(g.color);
  const coreRadius = ((window.innerWidth < 720) ? 22 : 36) + Math.random()*8;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 32, 32);
  const coreMat = createTranslucentMaterial(g.color);

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  // outline glow sprite
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.18, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*7.6, coreRadius*7.6, 1);
  coreMesh.add(rim);

  const container = new THREE.Group();
  container.add(coreMesh);

  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.55, -idx*4);

  const tilt = { x:(Math.random()*0.6 - 0.3)*Math.PI/2, y:(Math.random()*0.6 - 0.3)*Math.PI/2, z:(Math.random()*0.4 - 0.2)*Math.PI/6 };
  const ringObj = createStardustRing(coreRadius, complementColorHex(g.color), tilt, 140 + Math.floor(Math.random()*60), 6.5, (idx % 2 === 0));
  container.add(ringObj.group);

  const gasGeo = new THREE.SphereGeometry(coreRadius*1.6, 24, 24);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.028, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core: coreMesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- complement color helper (simple rotate hue) ---------- */
function complementColorHex(hex){
  // rotate hue by ~160 degrees (approx complement) in HSL via canvas trick
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  hsl.h = (hsl.h + 0.45) % 1.0;
  const cc = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s*0.8), Math.min(1, hsl.l*1.1));
  return (cc.getHex ? cc.getHex() : cc.getHexString ? parseInt(cc.getHexString(),16) : cc);
}

/* ---------- Aurora/smoke layers (subtle) ---------- */
function createAuroraSprite(colorStops, size=1400, opacity=0.3){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,20,size/2,size/2,size*0.95);
  colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  return spr;
}
const smokeBack1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(120,40,200,0.10)'},{offset:0.8,color:'rgba(20,150,200,0.04)'},{offset:1,color:'rgba(0,0,0,0)'}], 1800, 0.36);
smokeBack1.scale.set(2600,1400,1); smokeBack1.position.set(-60,-120,-1600); scene.add(smokeBack1);
const smokeFront1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(160,40,220,0.06)'},{offset:0.7,color:'rgba(30,200,220,0.05)'},{offset:1,color:'rgba(0,0,0,0)'}], 1200, 0.20);
smokeFront1.scale.set(2000,1000,1); smokeFront1.position.set(30,80,-300); scene.add(smokeFront1);

/* ---------- Audio / WebAudio controller (time-domain for ribbon) ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, freqData=null, timeData=null, audioEl=null, active=false;
  async function ensure(){
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.frequencyBinCount);
    }
  }
  async function loadUrl(url, { loop = true } = {}){
    try {
      await ensure();
      if (!audioEl){ audioEl = document.createElement('audio'); audioEl.crossOrigin='anonymous'; audioEl.controls=true; audioEl.style.width='100%'; audioEl.style.maxWidth='680px'; audioEl.style.display='block'; }
      audioEl.src = url;
      audioEl.loop = !!loop;
      // user gesture may be required to actually play — we still attempt
      audioEl.play().catch(()=>{});
      if (source) try{ source.disconnect(); }catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      if (spotifyEmbed) {
        spotifyEmbed.innerHTML = '';
        // attach the audio element (native) for mobile-friendly controls
        spotifyEmbed.appendChild(audioEl);
      }
      return true;
    } catch(err){
      console.warn('audio load failed', err); active=false; return false;
    }
  }
  function stop(){
    if (audioEl) try{ audioEl.pause(); audioEl.currentTime = 0; }catch(e){}
    if (audioCtx && audioCtx.state!=='closed') try{ audioCtx.suspend(); }catch(e){}
    active=false;
  }
  function getAmps(){
    if (!analyser || !freqData) return null;
    analyser.getByteFrequencyData(freqData);
    const lowCount = Math.max(1, Math.floor(freqData.length * 0.02));
    let bass=0; for (let i=0;i<lowCount;i++) bass += freqData[i];
    bass = bass / lowCount / 255;
    let sum=0; for (let i=0;i<freqData.length;i++) sum += freqData[i]*freqData[i];
    const rms = Math.sqrt(sum / freqData.length) / 255;
    return { bass, rms, rawFreq: freqData };
  }
  function getTimeDomain(){
    if (!analyser || !timeData) return null;
    analyser.getByteTimeDomainData(timeData);
    return timeData; // Uint8Array 0..255
  }
  function isActive(){ return active; }
  return { loadUrl, stop, getAmps, getTimeDomain, isActive };
})();

/* ---------- Ribbon (energy waveform across screen) ---------- */
const RIBBON = {};
function initRibbon(){
  const POINTS = 200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(POINTS * 3);
  const colors = new Float32Array(POINTS * 3);
  function worldWidthAtZ(z) {
    const vFOV = camera.fov * Math.PI / 180;
    const height = 2 * Math.tan(vFOV / 2) * Math.abs(camera.position.z - z);
    return height * camera.aspect;
  }
  const width = worldWidthAtZ(0) * 1.05;
  for (let i=0;i<POINTS;i++){
    const x = -width/2 + (i/(POINTS-1)) * width;
    positions[i*3] = x;
    positions[i*3+1] = Math.sin(i/6) * 8;
    positions[i*3+2] = -120;
    colors[i*3] = 0.8; colors[i*3+1] = 0.7; colors[i*3+2] = 1.0;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending });
  const line = new THREE.Line(geometry, mat);
  line.frustumCulled = false;
  scene.add(line);

  // glow sprite behind the ribbon
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,c.width,0);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.06)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,c.width,c.height);
  const glowTex = new THREE.CanvasTexture(c);
  const spriteMat = new THREE.SpriteMaterial({ map: glowTex, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(width*1.05, Math.max(24, width*0.02), 1);
  sprite.position.set(0, -6, -140);
  scene.add(sprite);

  RIBBON.line = line;
  RIBBON.sprite = sprite;
  RIBBON.geometry = geometry;
  RIBBON.points = POINTS;
  RIBBON.width = width;
  RIBBON.baseY = 0;
  RIBBON.currentGenre = null;
}
initRibbon();

/* ---------- Playlist mapping (Spotify placeholders) ----------
   NOTE: Spotify web embeds are iframe-based and not directly audio-analyzable by WebAudio.
   For ribbon audio-reactivity we need a direct audio source (mp3 URL) or user-local file.
   We'll keep Spotify embed in the UI and also try to load a direct preview/audio where available.
   Replace the placeholder URLs with real playable audio/mp3 streams for reactivity.
*/
const GENRE_PLAYLISTS = {
  'hard-techno':  { uiEmbed: '<iframe src="https://open.spotify.com/embed/playlist/REPLACE_HARD" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>', audioUrl: null },
  'techno':       { uiEmbed: '<iframe src="https://open.spotify.com/embed/playlist/REPLACE_TECHNO" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>', audioUrl: null },
  'house':        { uiEmbed: '<iframe src="https://open.spotify.com/embed/playlist/REPLACE_HOUSE" width="100%" height="80" frameborder="0" allow="autoplay;"></iframe>', audioUrl: null },
  'dnb':          { uiEmbed: '<iframe src="https://open.spotify.com/embed/playlist/REPLACE_DNB" width="100%" height="80" frameborder="0" allow="autoplay;"></iframe>', audioUrl: null },
  'dubstep':      { uiEmbed: '<iframe src="https://open.spotify.com/embed/playlist/REPLACE_DUBSTEP" width="100%" height="80" frameborder="0" allow="autoplay;"></iframe>', audioUrl: null },
  'electronic':   { uiEmbed: '<iframe src="https://open.spotify.com/embed/playlist/REPLACE_ELECTRONIC" width="100%" height="80" frameborder="0" allow="autoplay;"></iframe>', audioUrl: null },
  'pop':          { uiEmbed: '<iframe src="https://open.spotify.com/embed/playlist/REPLACE_POP" width="100%" height="80" frameborder="0" allow="autoplay;"></iframe>', audioUrl: null }
};

/* ---------- Play genre: load UI embed + attempt to load audio URL (if available) ---------- */
let currentGenreId = null;
async function playGenreAudio(genreId){
  const info = GENRE_PLAYLISTS[genreId] || GENRE_PLAYLISTS['electronic'];
  // place the Spotify embed (or fallback) into spotifyEmbed
  if (spotifyEmbed) spotifyEmbed.innerHTML = info.uiEmbed || '';

  // if a direct audioUrl is provided, try to load for WebAudio analysis
  if (info.audioUrl) {
    await audioController.loadUrl(info.audioUrl, { loop:true });
    currentGenreId = genreId;
    tintRibbonToGenre(genreId);
    return true;
  } else {
    // no direct audio available — stop WebAudio but tint ribbon color & show embed
    audioController.stop();
    currentGenreId = genreId;
    tintRibbonToGenre(genreId);
    return false;
  }
}

/* sets ribbon vertex colors and sprite tint */
function tintRibbonToGenre(genreId){
  const g = GENRES.find(x=>x.id===genreId);
  if (!g || !RIBBON.geometry) return;
  const colors = RIBBON.geometry.attributes.color.array;
  const tr = ((g.color>>16)&255)/255, tg = ((g.color>>8)&255)/255, tb = (g.color&255)/255;
  for (let i=0;i<RIBBON.points;i++){
    const idx = i*3;
    colors[idx] = 0.25 + tr * 0.75;
    colors[idx+1] = 0.25 + tg * 0.75;
    colors[idx+2] = 0.25 + tb * 0.75;
  }
  RIBBON.geometry.attributes.color.needsUpdate = true;
  if (RIBBON.sprite && RIBBON.sprite.material) {
    RIBBON.sprite.material.color = new THREE.Color(g.color);
    RIBBON.sprite.material.opacity = 0.58;
  }
}

/* ---------- Raycast / pointer handling (mobile touch friendly) ---------- */
const raycaster = new THREE.Raycaster();
const ndcMouse = new THREE.Vector2();

function onPointerDown(e){
  // reveal UI on first interaction
  if (uiWrap) { uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; }
  if (legendWrap) { legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }

  const rect = renderer.domElement.getBoundingClientRect();
  const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
  const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
  ndcMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndcMouse, camera);

  const cores = [];
  ORB_GROUP.children.forEach(c => { c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }); });
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    // find parent container
    let parent = null;
    for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent){
      const found = Object.values(ORB_MESHES).find(o => o.container === parent);
      if (found) {
        // play/add UI embed and focus camera
        playGenreAudio(found.id).catch(()=>{});
        openCenteredModal(found.id);
      }
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive:true });
renderer.domElement.addEventListener('touchstart', onPointerDown, { passive:true });

/* ---------- Modal for votes (email + captcha placeholder) ---------- */
let activeModal = null;
function closeModal(){ if(!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal=null; }
function openCenteredModal(genreId){
  closeModal();
  const g = GENRES.find(x=>x.id===genreId); if (!g) return;
  const modal = document.createElement('div');
  modal.className = 'panel modalVote';
  modal.style.position = 'fixed';
  modal.style.left = '50%';
  modal.style.top = '50%';
  modal.style.transform = 'translate(-50%,-50%)';
  modal.style.zIndex = 9999;
  modal.style.width = '92vw';
  modal.style.maxWidth = '420px';
  modal.style.padding = '12px';
  modal.style.boxSizing = 'border-box';
  modal.innerHTML = `
    <button class="closeX" aria-label="Close" style="position:absolute;right:10px;top:8px;border:none;background:transparent;color:#dfefff;font-size:20px;cursor:pointer">✕</button>
    <h3 style="margin:4px 0 6px 0">${g.name}</h3>
    <div style="font-size:13px;color:#cfd8e6;margin-bottom:6px">Vote — enter up to 10 artists (comma separated)</div>
    <input class="email" placeholder="Email (for validation)" style="width:100%;padding:8px;border-radius:8px;border:none;margin-top:6px;background:rgba(255,255,255,0.02);color:#fff" />
    <textarea class="artists" rows="3" placeholder="Artist1, Artist2, ..." style="width:100%;padding:8px;border-radius:8px;border:none;margin-top:8px;background:rgba(255,255,255,0.02);color:#fff"></textarea>
    <input class="b2b" placeholder="Dream B2B (optional)" style="width:100%;padding:8px;border-radius:8px;border:none;margin-top:8px;background:rgba(255,255,255,0.02);color:#fff" />
    <input class="country" placeholder="Country (optional)" style="width:100%;padding:8px;border-radius:8px;border:none;margin-top:8px;background:rgba(255,255,255,0.02);color:#fff" />
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
      <input type="checkbox" class="robot" id="robotAgree" />
      <label for="robotAgree" style="font-size:12px;color:#cbd6e6">I am not a bot</label>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn cancel" style="padding:8px;border-radius:8px;background:transparent;border:none;color:#fff">Cancel</button>
      <button class="btn submit" style="padding:8px;border-radius:8px;background:#14c56d;border:none;color:#051219">Submit</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.closeX').addEventListener('click', ()=> closeModal());
  modal.querySelector('.cancel').addEventListener('click', ()=> closeModal());
  modal.querySelector('.submit').addEventListener('click', async ()=>{
    const email = modal.querySelector('.email').value.trim();
    const artistsRaw = modal.querySelector('.artists').value.trim();
    const b2b = modal.querySelector('.b2b').value.trim();
    const country = modal.querySelector('.country').value.trim();
    const robot = modal.querySelector('.robot').checked;
    if (!robot) { alert('Please confirm you are not a bot.'); return; }
    if (!artistsRaw) { alert('Please enter at least one artist'); modal.querySelector('.artists').focus(); return; }
    const artists = artistsRaw.split(',').map(s=>s.trim()).filter(Boolean).slice(0,10);
    await saveVote(genreId, { email, artists, b2b, country });
    flashOrb(genreId);
    computeAndRenderTop();
    closeModal();
  });
  activeModal = { dom: modal, genreId };
  uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto';
  legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto';
}

/* ---------- flash feedback for orb on vote ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const mat = o.core.material; const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.6, orig * 2.5);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ---------- Top computation UI (renders top 15 for focused genre) ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const perGenreCounts = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r=>{
      (r.artists||[]).forEach(a=>{
        const k=(a||'').trim(); if(!k) return; counts[k]=(counts[k]||0)+1;
      });
    });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id]=sorted;
    updateOrbHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });

  const sel = (genreSelect && genreSelect.value) ? genreSelect.value : GENRES[0].id;
  const arr = perGenreCounts[sel] || [];
  // top 15 displayed as scrollable list
  let html = `<div class="topHeader">Top ${Math.min(50, Math.max(15, arr.length))}</div>`;
  html += '<div class="topScroll">';
  for (let i=0;i<Math.min(50, arr.length);i++){
    html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  }
  if (!arr.length) html += '<div style="padding:10px;color:#bbb">No votes yet — be the first!</div>';
  html += '</div>';
  if (topList) topList.innerHTML = html;
}

/* animate orb highlight based on votes (subtle) */
function updateOrbHighlight(genreId, topCount){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount)*0.9);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount)*0.12);
  o.core.scale.set(base, base, base);
}

/* ---------- Camera follow / focus when toggling a genre ---------- */
let cameraTarget = new THREE.Vector3(0,0,0);
let cameraFollow = null; // orb id to follow

function focusOnOrb(genreId){
  const o = ORB_MESHES[genreId];
  if (!o) { cameraFollow = null; return; }
  cameraFollow = genreId;
  // compute a target world position offset (slightly closer)
  const pos = o.container.position.clone();
  cameraTarget.copy(pos);
  cameraTarget.z = pos.z + 160; // camera offset towards orb
  // also render top 15 for that genre
  if (genreSelect) { genreSelect.value = genreId; computeAndRenderTop(); }
}

/* ---------- Animation / render loop ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : 0;
  const rms = amps ? amps.rms : 0.06 + Math.sin(t*0.25)*0.02;

  // twinkle stars
  starsFar.points.rotation.z += 0.00025 + 0.00012 * (rms*2);
  starsNear.points.rotation.z -= 0.00042 + 0.00016 * (rms*2);
  starsNear.mat.opacity = 0.5 + Math.sin(t*0.9 + 3.1) * 0.06 + rms * 0.12;
  starsFar.mat.opacity = 0.88 + Math.cos(t*0.4 + 1.7) * 0.03 + bass * 0.04;
  dustPlane.rotation.z += 0.00008;

  // subtle smoke pulsation
  const smokePulse = 0.6 + Math.sin(t*0.9) * 0.08 + bass * 0.6;
  smokeBack1.material.opacity = 0.26 * smokePulse;
  smokeFront1.material.opacity = 0.20 * (0.85 + Math.sin(t*0.5)*0.05 + rms*0.6);

  // camera gentle motion and optional follow
  const baseZ = CAMERA_Z;
  if (cameraFollow && ORB_MESHES[cameraFollow]) {
    // smoothed follow
    const o = ORB_MESHES[cameraFollow];
    const targetPos = o.container.position.clone();
    const desired = new THREE.Vector3(targetPos.x*0.2, targetPos.y*0.2, baseZ + (-targetPos.z*0.15));
    camera.position.lerp(desired, 0.06);
    camera.lookAt(targetPos.x*0.2, targetPos.y*0.2, 0);
  } else {
    camera.position.z = baseZ + Math.sin(t*0.08) * 4 + bass * 60;
    camera.position.x = Math.sin(t*0.03) * 8 * (0.7 + rms * 0.6);
    camera.position.y = Math.cos(t*0.025) * 5 * (0.7 + rms * 0.5);
    camera.lookAt(0,0,0);
  }

  // ORB orbit + ring rotation
  const clusterSpeed = 0.14 + bass * 0.4 + 0.02;
  ORB_GROUP.children.forEach((container, idx) => {
    const odata = ORB_MESHES[GENRES[idx].id];
    const phaseOffset = container.userData.baseAngle || (idx / ORB_GROUP.children.length) * Math.PI*2;
    // some orbs go clockwise, some counter — keep overall flow but alternate ring rotation sign
    const angle = t * (clusterSpeed * (1 + idx * 0.015)) + phaseOffset * (0.6 + idx*0.06);
    const ex = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.55 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);
    container.position.x = Math.cos(angle) * ex + (idx - (GENRES.length-1)/2) * Math.sin(t*0.02)*1.8;
    container.position.y = Math.sin(angle * (1 + idx*0.01) + idx*0.21) * ey + Math.cos(idx*0.45 + t*0.18)*3.6;
    container.position.z = Math.sin(t*(0.45 + idx*0.02))*6 - idx*2.5;

    // gentle spin
    container.children.forEach(ch => { if (ch.isMesh) { ch.rotation.y += 0.0012 + idx*0.0003; ch.rotation.x += 0.0007; } });

    // rotate rings (counterclockwise on half)
    if (odata && odata.ringObj){
      odata.ringObj.group.rotation.z += odata.ringObj.rotationSpeed * (1 + bass * 0.6);
      odata.ringObj.mat.opacity = 0.72 - Math.abs(Math.sin(t*0.6 + idx))*0.14 + rms * 0.18;
    }

    if (odata && odata.gas){
      odata.gas.material.opacity = 0.028 + 0.006 * Math.sin(t*0.9 + idx) + bass*0.015;
    }

    // audio-driven pulse on orb core
    const pulse = 1 + (bass * 0.28) + (rms * 0.10);
    if (odata && odata.core) {
      const targetScale = 1.0 + Math.min(0.45, (pulse - 1) * (1 + idx*0.04));
      odata.core.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
      odata.core.material.emissiveIntensity = 0.4 + Math.min(1.4, (bass * 1.4 + rms * 0.6));
      // rim sprite opacity
      odata.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.12 + rms * 0.2; });
    }
  });

  /* --- Ribbon update: time-domain or idle --- */
  try {
    if (RIBBON && RIBBON.geometry){
      const pos = RIBBON.geometry.attributes.position.array;
      const pts = RIBBON.points;
      const timeData = audioController.getTimeDomain();
      if (timeData && timeData.length > 0){
        const step = Math.floor(timeData.length / pts) || 1;
        for (let i=0;i<pts;i++){
          const td = timeData[Math.min(timeData.length-1, i*step)];
          const v = (td / 128.0) - 1.0;
          const amplitude = 80 + (currentGenreId ? 50 : 0);
          const y = v * amplitude * (0.7 + Math.sin(i*0.18 + t*0.7) * 0.12);
          const idx = i*3;
          pos[idx+1] = y - 8;
          pos[idx+2] = -120 + Math.sin(t*0.26 + i*0.05)*4.2;
        }
        const amps2 = audioController.getAmps();
        const brightness = amps2 ? (0.25 + amps2.rms*1.2) : 0.36;
        if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = Math.min(0.88, 0.2 + brightness);
      } else {
        for (let i=0;i<pts;i++){
          const idx = i*3;
          pos[idx+1] = Math.sin(i*0.12 + t*0.9) * 10 + Math.sin(i*0.08 + t*0.28)*4 - 8;
          pos[idx+2] = -120 + Math.sin(t*0.12 + i*0.02)*3;
        }
        if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = 0.46;
      }
      RIBBON.geometry.attributes.position.needsUpdate = true;
    }
  } catch(e){ /* ribbon safe */ }

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize & orientation handling (mobile switching) ---------- */
function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();

  // recompute ribbon width & sprite scale
  if (RIBBON && RIBBON.width){
    const width = (2 * Math.tan(camera.fov * Math.PI/180 / 2) * Math.abs(camera.position.z)) * camera.aspect * 1.05;
    RIBBON.width = width;
    if (RIBBON.sprite) RIBBON.sprite.scale.set(width*1.05, Math.max(24, width*0.02), 1);
    const pos = RIBBON.geometry.attributes.position.array;
    for (let i=0;i<RIBBON.points;i++){
      const x = -width/2 + (i/(RIBBON.points-1)) * width;
      pos[i*3] = x;
    }
    RIBBON.geometry.attributes.position.needsUpdate = true;
  }

  // adjust cluster radius for narrow screens
  const newRadius = (w < 720) ? 220 : 420;
  if (Math.abs(newRadius - CLUSTER_RADIUS) > 1) {
    // move group outward/inward smoothly
    ORB_GROUP.children.forEach((c, idx) => {
      const baseAngle = c.userData.baseAngle || (idx / ORB_GROUP.children.length) * Math.PI*2;
      c.position.set(Math.cos(baseAngle)*newRadius, Math.sin(baseAngle)*newRadius*0.55, c.position.z);
    });
  }
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 260));
onResize();

/* ---------- UI behavior: genreSelect change should focus on orb + update top list ---------- */
if (genreSelect) genreSelect.addEventListener('change', ()=>{
  const g = genreSelect.value;
  focusOnOrb(g);
  playGenreAudio(g).catch(()=>{});
  computeAndRenderTop();
});

/* ---------- Start-up ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 900);

console.log('app.js loaded — mobile-first, 7-genre orbs + ribbon active.');

/* ---------- Notes ----------
 - Replace GENRE_PLAYLISTS[].uiEmbed with real Spotify embed iframe strings.
 - For audio-reactive ribbon you need a direct audio source (mp3/ogg) assigned to GENRE_PLAYLISTS[].audioUrl.
 - Mobile browsers block autoplay until user gesture; the UI reveals on first touch to improve UX.
 - This file is defensive: it creates missing DOM nodes so it can run stand-alone on mobile.
 - If anything is not visible (orbs/ribbon) double-check that Three.js is loaded before this script.
*/
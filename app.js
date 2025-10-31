/* app.js — Updated with organic sound ribbon, audio-reactive behavior, adaptive genre color
   - Drop into your repo replacing the previous app.js
   - Requires Three.js loaded in index.html (already present)
   - Uses existing UI element IDs from your index.html / style.css
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // optional
const CAMERA_Z = 850;        // camera distance (tweak if you want more or less zoom)
const INTRO_FADE_MS = 1500;  // fade duration (1.5s)
const INTRO_AUDIO_URL = "https://soundcloud.com/user-200235414/wave-1"; // your soundcloud page (best if it's a direct playable stream)

/* ---------- Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Persistence (Firebase optional / fallback localStorage) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch(e) {
    console.warn('Firebase init failed; falling back to localStorage', e);
    useFirebase = false;
  }
}
async function saveVote(genreId, artistName, b2b){
  const rec = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef) {
    await dbRef.child(genreId).push(rec);
  } else {
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

/* ---------- UI refs (existing index.html) ---------- */
const uiWrap = document.getElementById('ui');
const legendWrap = document.getElementById('legend');
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');
const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');
const legendList = document.getElementById('legendList');

// initially hidden until first interaction (overlay logic will show later)
uiWrap.style.opacity = '0';
uiWrap.style.pointerEvents = 'none';
legendWrap.style.opacity = '0';
legendWrap.style.pointerEvents = 'none';

/* ---------- Genres & Colors ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79 },
  { id:'house', name:'House', color:0xffbf5f },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },
  { id:'electronic', name:'Electronic / Dance', color:0x9f5fff },
  { id:'mainstream', name:'Mainstream / International', color:0xffffff }
];
// soundcloud generic playlists by genre (placeholder links — replace with your own playlists)
const GENRE_PLAYLISTS = {
  'techno': 'https://soundcloud.com/your-hard-techno-playlist',
  'house': 'https://soundcloud.com/your-house-playlist',
  'dnb': 'https://soundcloud.com/your-dnb-playlist',
  'dubstep': 'https://soundcloud.com/your-dubstep-playlist',
  'electronic': 'https://soundcloud.com/your-electronic-playlist',
  'mainstream': 'https://soundcloud.com/your-mainstream-playlist'
};

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

/* ---------- THREE.JS setup ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 18, CAMERA_Z);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000010, 1);
wrap.appendChild(renderer.domElement);

const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

/* ---------- Starfield & dust (kept from your version) ---------- */
function makeStarLayer(count, spreadX=5000, spreadY=3000, spreadZ=5000, size=1.2, opacity=0.9){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5) * spreadX;
    pos[i*3+1] = (Math.random()-0.5) * spreadY;
    pos[i*3+2] = -Math.random()*spreadZ - 200;
    phases[i] = Math.random()*Math.PI*2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const points = new THREE.Points(geo, mat);
  return { points, geo, mat };
}
const starsFar = makeStarLayer(1800, 6000, 3600, 6000, 1.1, 0.9);
const starsNear = makeStarLayer(700, 3500, 2200, 3500, 1.9, 0.6);
scene.add(starsFar.points, starsNear.points);

const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800), new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false }));
dustPlane.position.set(0,0,-2600);
scene.add(dustPlane);

/* ---------- Reusable textures ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,6,size/2,size/2,size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, toCssRgba(colorHex, 0.28));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}

/* ---------- Cluster / bubbles (keeps previous behavior) ---------- */
const CLUSTER_RADIUS = 420;
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};

function createStardustRing(coreRadius, colorHex, tilt, particleCount=220, size=9.5, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.85);
  const positions = new Float32Array(particleCount*3);
  const sizes = new Float32Array(particleCount);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5) * (coreRadius*0.36);
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.5);
    sizes[i] = (Math.random()*1.6 + 1.6) * size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);
  const points = new THREE.Points(geo, mat);
  group.add(points);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*2.0, ringRadius*2.0, 1);
  group.add(glow);
  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.004 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, points, mat, rotationSpeed, ringRadius };
}

GENRES.forEach((g, idx) => {
  const color = new THREE.Color(g.color);
  const coreRadius = 40 + Math.random()*10;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent:true, opacity:0.30, roughness:0.16, metalness:0.08, transmission:0.7,
    emissive: color.clone().multiplyScalar(0.02), emissiveIntensity:0.6, clearcoat:0.2
  });
  coreMat.depthWrite = false;
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*9.8, coreRadius*9.8, 1);
  coreMesh.add(rim);
  const container = new THREE.Group();
  container.add(coreMesh);
  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.6, -idx*6);
  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  const ringObj = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random()*160), 9.5, (idx % 2 === 0));
  container.add(ringObj.group);
  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.035, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);
  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core: coreMesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- Aurora / smoke (back and front) ---------- */
function createAuroraSprite(colorStops, size=1600, opacity=0.3){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,20,size/2,size/2,size*0.95);
  colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  return spr;
}
const smokeBack1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(120,40,200,0.12)'},{offset:0.8,color:'rgba(20,150,200,0.06)'},{offset:1,color:'rgba(0,0,0,0)'}], 2000, 0.42);
smokeBack1.scale.set(3000,1600,1); smokeBack1.position.set(-60,-120,-1800); scene.add(smokeBack1);
const smokeBack2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(200,40,140,0.10)'},{offset:0.6,color:'rgba(60,40,220,0.08)'},{offset:1,color:'rgba(0,0,0,0)'}], 1800, 0.3);
smokeBack2.scale.set(2600,1300,1); smokeBack2.position.set(120,-60,-1600); scene.add(smokeBack2);
const smokeFront1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(160,40,220,0.08)'},{offset:0.7,color:'rgba(30,200,220,0.07)'},{offset:1,color:'rgba(0,0,0,0)'}], 1400, 0.30);
smokeFront1.scale.set(2200,1100,1); smokeFront1.position.set(30,80,-320); scene.add(smokeFront1);
const smokeFront2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(240,120,100,0.06)'},{offset:0.7,color:'rgba(90,80,255,0.05)'},{offset:1,color:'rgba(0,0,0,0)'}], 1200, 0.24);
smokeFront2.scale.set(1800,900,1); smokeFront2.position.set(-80,40,-260); scene.add(smokeFront2);
// corner blobs
const cornerSpecs = [
  {x:-1.0,y:-1.0,color:'rgba(160,40,220,0.14)'},
  {x:1.0,y:-0.9,color:'rgba(40,200,220,0.11)'},
  {x:-0.9,y:1.0,color:'rgba(240,120,100,0.09)'},
  {x:0.9,y:0.9,color:'rgba(100,120,255,0.07)'}
];
const cornerSprites = [];
cornerSpecs.forEach((s,i)=>{
  const spr = createAuroraSprite([{offset:0,color:s.color},{offset:1,color:'rgba(0,0,0,0)'}], 900, 0.14);
  spr.scale.set(900,900,1);
  spr.position.set(s.x * 1200 * (0.6 + Math.random()*0.4), s.y * 700 * (0.6 + Math.random()*0.4), -320);
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- Ribbon (organic sound-wave ribbon) ----------
   Implementation notes:
   - We make a horizontal ribbon represented by a smooth polyline (many points)
   - Each point's vertical offset is modulated by analyser data (when available) or idle noise
   - The ribbon has a Line (core) and a soft sprite/aura behind to emulate glow
   - Ribbon color gradient is biased toward activeGenreColor but contains all genre hints
*/
const RIBBON_POINTS = 180;
const ribbonGeo = new THREE.BufferGeometry();
const ribbonPositions = new Float32Array(RIBBON_POINTS * 3);
const ribbonColors = new Float32Array(RIBBON_POINTS * 3);
for (let i=0;i<RIBBON_POINTS;i++){
  const x = (i/(RIBBON_POINTS-1) - 0.5) * 1600; // spread across screen-space world units
  const y = 0;
  const z = -80;
  ribbonPositions[i*3] = x; ribbonPositions[i*3+1] = y; ribbonPositions[i*3+2] = z;
  // default color white-ish (will lerp in shader)
  ribbonColors[i*3] = 1; ribbonColors[i*3+1] = 1; ribbonColors[i*3+2] = 1;
}
ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPositions, 3).setUsage(THREE.DynamicDrawUsage));
ribbonGeo.setAttribute('color', new THREE.BufferAttribute(ribbonColors, 3));

const ribbonMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, linewidth: 2, blending: THREE.AdditiveBlending });
const ribbonLine = new THREE.Line(ribbonGeo, ribbonMat);
ribbonLine.frustumCulled = false;
scene.add(ribbonLine);

// soft ribbon glow (big sprite behind)
const ribbonGlowTex = createRibbonGlowTexture();
const ribbonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ribbonGlowTex, transparent:true, opacity:0.26, blending:THREE.AdditiveBlending, depthWrite:false }));
ribbonGlow.scale.set(1600, 220, 1);
ribbonGlow.position.set(0, 0, -140);
scene.add(ribbonGlow);

// helper to create a long soft gradient texture for ribbon glow
function createRibbonGlowTexture(){
  const sizeX = 2048, sizeY = 256;
  const c = document.createElement('canvas'); c.width = sizeX; c.height = sizeY;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,sizeX,0);
  // blend of many colors to hint all genres (we bias later)
  const colorStops = [
    {offset:0, color: 'rgba(150,40,220,0.9)'},
    {offset:0.18, color: 'rgba(255,80,130,0.9)'},
    {offset:0.36, color: 'rgba(255,190,90,0.9)'},
    {offset:0.54, color: 'rgba(120,220,130,0.9)'},
    {offset:0.72, color: 'rgba(80,210,255,0.9)'},
    {offset:0.9, color: 'rgba(160,100,255,0.9)'},
    {offset:1, color: 'rgba(255,255,255,0.9)'}
  ];
  colorStops.forEach(s => g.addColorStop(s.offset, s.color));
  ctx.fillStyle = g; ctx.fillRect(0,0,sizeX,sizeY);
  // fade vertically
  const vGrad = ctx.createLinearGradient(0,0,0,sizeY);
  vGrad.addColorStop(0, 'rgba(255,255,255,1)');
  vGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = vGrad; ctx.fillRect(0,0,sizeX,sizeY);
  ctx.globalCompositeOperation = 'source-over';
  return new THREE.CanvasTexture(c);
}

/* ---------- Audio controller (analyser for ribbon) ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, dataArray=null, audioEl=null, active=false, playingUrl=null;
  async function ensure(){
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
  }
  // tries to load a URL into an <audio> element and connect to analyser
  async function loadUrl(url, autoplay=true){
    try {
      await ensure();
      // if same url already loaded, just play
      if (!audioEl){
        audioEl = document.createElement('audio');
        audioEl.crossOrigin = 'anonymous';
        audioEl.controls = false;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
      }
      // Stop previous source if any
      if (source){
        try { source.disconnect(); } catch(e) {}
        source = null;
      }
      audioEl.src = url;
      playingUrl = url;
      if (autoplay) {
        try{ await audioEl.play(); }catch(e){ console.warn('Autoplay blocked'); }
      }
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      // place small player UI into spotifyEmbed slot (replaces previous)
      spotifyEmbed.innerHTML = '';
      spotifyEmbed.appendChild(audioEl);
      audioEl.loop = true;
      return true;
    } catch(err){
      console.warn('audio load failed', err); active=false; return false;
    }
  }
  function stop(){
    if (audioEl) {
      try{ audioEl.pause(); }catch(e){}
    }
    if (audioCtx && audioCtx.state !== 'closed'){
      // leave context open but suspend
      try{ audioCtx.suspend(); }catch(e){}
    }
    active = false;
  }
  function getAmps(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    // compute bass and RMS
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.03));
    let bass=0; for (let i=0;i<lowCount;i++) bass += dataArray[i];
    bass = bass / lowCount / 255;
    let sum=0; for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length) / 255;
    return { bass, rms, raw:dataArray };
  }
  function isActive(){ return active; }
  return { loadUrl, stop, getAmps, isActive, _internal: { audioEl: ()=> audioEl } };
})();

/* ---------- Raycast & modal logic (keeps previous behavior but toggled center modal) ---------- */
const raycaster = new THREE.Raycaster();
const ndcMouse = new THREE.Vector2();

function revealUIOnFirstInteraction(){
  if (uiWrap.style.opacity === '0') {
    setTimeout(()=>{ uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; }, 300); // slight delay after fade
    setTimeout(()=>{ legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }, 450);
  }
}

function onPointerDown(e){
  revealUIOnFirstInteraction();
  const rect = renderer.domElement.getBoundingClientRect();
  ndcMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndcMouse, camera);
  const cores = [];
  ORB_GROUP.children.forEach(c => { c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }); });
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    let parent = null;
    for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent){
      const found = Object.values(ORB_MESHES).find(o => o.container === parent);
      if (found) {
        // zoom-in option / follow (not implemented as a heavy camera animation here, but we focus by playing genre)
        openCenteredModal(found.id);
        // switch playlist to genre automatically
        const playlistUrl = GENRE_PLAYLISTS[found.id] || GENRE_PLAYLISTS['mainstream'];
        // stop intro if it's playing
        audioController.loadUrl(playlistUrl).catch(()=>{});
        setActiveGenre(found.id);
      }
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Modal UI (centered) ---------- */
let activeModal = null;
function closeModal(){ if(!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal=null; }
function openCenteredModal(genreId){
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
  modal.style.backdropFilter = 'blur(6px)';
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
        <input id="modalAudioUrl" placeholder="Paste MP3/OGG URL" style="padding:8px;border-radius:6px;border:none;width:220px;background:rgba(255,255,255,0.02);color:#fff" />
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
    const artist = modal.querySelector('.artist').value.trim(); if (!artist) { modal.querySelector('.artist').focus(); return; }
    const b2b = modal.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashOrb(genreId);
    computeAndRenderTop();
    closeModal();
  });
  const openAudioFile = modal.querySelector('#openAudioFile');
  const modalAudioFile = modal.querySelector('#modalAudioFile');
  const modalAudioUrl = modal.querySelector('#modalAudioUrl');
  openAudioFile.addEventListener('click', ()=> modalAudioFile.click());
  modalAudioFile.addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    await audioController.loadUrl(url);
    insertAudioPlayerInModal(modal, url, f.name);
  });
  modal.querySelector('#modalAudioUrl').addEventListener('keydown', async (ev)=>{
    if (ev.key === 'Enter'){ const url = modalAudioUrl.value.trim(); if (!url) return; await audioController.loadUrl(url); insertAudioPlayerInModal(modal, url, url); }
  });
  activeModal = { dom: modal, genreId };
  // reveal UI too
  uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto';
  legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto';
  setTimeout(()=> modal.querySelector('.artist').focus(), 120);
}
function insertAudioPlayerInModal(modal, src, label){
  let player = modal.querySelector('audio');
  if (!player){
    player = document.createElement('audio'); player.controls = true; player.style.width='100%'; player.style.marginTop='8px';
    modal.appendChild(player);
  }
  player.src = src; player.play().catch(()=>{});
  let info = modal.querySelector('.audioLabel');
  if (!info){ info = document.createElement('div'); info.className = 'audioLabel'; info.style.fontSize='12px'; info.style.marginTop='6px'; modal.appendChild(info); }
  info.textContent = `Loaded: ${label}`;
}

/* ---------- Flash feedback ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const mat = o.core.material; const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.8, orig * 2.6);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ---------- Top compute UI (keeps previous logic) ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const perGenreCounts = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r=>{ const k=(r.artist||'').trim(); if(!k) return; counts[k]=(counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id]=sorted;
    updateOrbHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });
  const sel = genreSelect.value || GENRES[0].id;
  const arr = perGenreCounts[sel] || []; let html='';
  for (let i=0;i<Math.min(50,arr.length);i++) html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  topList.innerHTML = html;
}
function updateOrbHighlight(genreId, topCount){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount)*0.9);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount)*0.12);
  o.core.scale.set(base, base, base);
}

/* ---------- Active genre state (affects ribbon color bias) ---------- */
let activeGenreId = null;
function setActiveGenre(genreId){
  activeGenreId = genreId;
  // subtle lighting change
  const g = GENRES.find(x=>x.id===genreId);
  if (g) {
    // tween-like set: lerp target emissive for all cores slightly
    GENRES.forEach(h => {
      const o = ORB_MESHES[h.id];
      if (!o) return;
      // if it's the active one, slightly boost emissive
      o.core.material.emissive = new THREE.Color(g.color).multiplyScalar(h.id === genreId ? 0.08 : 0.015);
    });
  }
}

/* ---------- Animation loop: ribbon reaction + cluster orbit + stars + smoke ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // audio amplitude
  const amps = audioController.getAmps ? audioController.getAmps() : null;
  const bass = amps ? amps.bass : 0;
  const rms = amps ? amps.rms : 0.06 + Math.sin(t*0.25)*0.02;

  // star layers twinkle
  starsFar.points.rotation.z += 0.00035;
  starsNear.points.rotation.z -= 0.00048;
  starsNear.mat.opacity = 0.55 + Math.sin(t*0.9 + 3.1) * 0.08 + rms * 0.12;
  starsFar.mat.opacity = 0.88 + Math.cos(t*0.4 + 1.7) * 0.04 + bass * 0.06;

  dustPlane.rotation.z += 0.00012;

  // smoke pulse
  const smokePulse = 0.6 + Math.sin(t*0.9) * 0.12 + bass * 0.9;
  smokeBack1.material.opacity = 0.28 * smokePulse;
  smokeBack2.material.opacity = 0.22 * (0.9 + Math.cos(t*0.7)*0.06 + bass*0.4);
  smokeFront1.material.opacity = 0.24 * (0.9 + Math.sin(t*0.5)*0.06 + rms*0.9);
  smokeFront2.material.opacity = 0.20 * (1 + Math.cos(t*0.63)*0.05 + bass*0.6);
  cornerSprites.forEach((s,i)=> s.material.opacity = (0.12 + Math.sin(t*0.7 + i)*0.03 + bass*0.06));

  // camera gentle breathing (camera keeps cluster ~center; bass pushes out slightly)
  const baseZ = CAMERA_Z;
  camera.position.z = baseZ + Math.sin(t*0.08) * 6 + bass * 80;
  camera.position.x = Math.sin(t*0.04) * 12 * (0.7 + rms * 0.8);
  camera.position.y = Math.cos(t*0.03) * 6 * (0.7 + rms * 0.6);
  camera.lookAt(0,0,0);

  // cluster motion (unified orbit, diagonal/tilted oval)
  const clusterSpeed = 0.14 + bass * 0.4;
  GENRES.forEach((g, idx) => {
    const o = ORB_MESHES[g.id];
    if (!o) return;
    const angle = t * clusterSpeed + o.baseAngle * (0.6 + idx*0.08);
    // tilt the orbit: diagonal horizontal oval — tilt up-right as requested
    const tiltX = 0.18; // slight tilt in X
    const tiltY = -0.14; // tilt up-right
    const ex = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.75 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02); // wider ellipse (4/5 screen feel)
    // apply a rotated oval (diagonal)
    const rawX = Math.cos(angle) * ex;
    const rawY = Math.sin(angle * 1.02 + idx*0.31) * ey;
    // rotate by small angle to tilt diagonal
    const rot = 0.45; // rotate axes
    o.container.position.x = rawX * Math.cos(rot) - rawY * Math.sin(rot);
    o.container.position.y = rawX * Math.sin(rot) + rawY * Math.cos(rot);
    o.container.position.z = Math.sin(t*(0.55 + idx*0.02))*10 - idx*4;

    // local spin and ring counter-rotation
    o.core.rotation.y += 0.002 + idx*0.0003;
    o.core.rotation.x += 0.0011;
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass * 0.8);
    o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms * 0.22;
    o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.018;
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.16 + rms * 0.28; });
  });

  // Ribbon: update positions by analyzer data (or idle organic noise)
  const posAttr = ribbonGeo.attributes.position;
  const colAttr = ribbonGeo.attributes.color;
  const data = amps && amps.raw ? amps.raw : null;
  for (let i=0;i<RIBBON_POINTS;i++){
    // map index to analyser bin range
    const px = (i/(RIBBON_POINTS-1) - 0.5) * 1600;
    let height = 0;
    if (data){
      // sample several bins for smoother width-frequency mapping
      const bin = Math.floor((i / RIBBON_POINTS) * data.length);
      const v = (data[bin] || 0) / 255;
      // scale and shape for 'ribbon' amplitude
      height = v * 160 + Math.sin(t * 0.8 + i * 0.12) * 8;
    } else {
      // idle organic motion (perlin-like via sin/cos combos)
      height = Math.sin(t * 0.6 + i * 0.12) * 12 + Math.cos(t * 0.3 + i * 0.07) * 6;
    }
    // Slight z variance to give 3D depth
    const z = -80 + Math.cos(i * 0.18 + t * 0.38) * 10;
    posAttr.array[i*3] = px;
    posAttr.array[i*3 + 1] = height;
    posAttr.array[i*3 + 2] = z;
    // color: base gradient but bias toward active genre color
    // base rainbow hue:
    const hue = (i / RIBBON_POINTS) * 360;
    const base = new THREE.Color(`hsl(${hue},70%,65%)`);
    if (activeGenreId) {
      const gcol = new THREE.Color(GENRES.find(x=>x.id===activeGenreId).color);
      // bias factor (0..1)
      const bias = 0.55;
      base.lerp(gcol, bias);
    }
    colAttr.array[i*3] = base.r;
    colAttr.array[i*3 + 1] = base.g;
    colAttr.array[i*3 + 2] = base.b;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;

  // ribbon glow subtle pulse with rms
  ribbonGlow.material.opacity = 0.18 + Math.min(0.6, 0.18 + rms * 0.8);

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
});

/* ---------- Startup / Intro fade & audio autoplay once ---------- */
let introPlayed = false;
function startIntroSequence(){
  if (introPlayed) return;
  introPlayed = true;

  // fade overlay element exists in your index.html as #fade-overlay
  const fadeEl = document.getElementById('fade-overlay');
  if (fadeEl){
    // start audio and fade at same time
    // try to load intro audio once (may be blocked by browser until user interaction)
    audioController.loadUrl(INTRO_AUDIO_URL, true).then(ok=>{
      // we started playing (or attempted)
    }).catch(()=>{});
    // set transition and fade out over INTRO_FADE_MS
    fadeEl.style.transition = `opacity ${INTRO_FADE_MS}ms ease`;
    // start fade immediately
    setTimeout(()=> { fadeEl.style.opacity = '0'; }, 0);
    // remove after complete
    setTimeout(()=> { try{ fadeEl.remove(); }catch(e){} }, INTRO_FADE_MS + 60);
    // reveal UI slightly after fade begins
    setTimeout(()=> { uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; }, Math.max(350, INTRO_FADE_MS * 0.25));
    setTimeout(()=> { legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }, Math.max(450, INTRO_FADE_MS * 0.35));
  } else {
    // fallback: just attempt play
    audioController.loadUrl(INTRO_AUDIO_URL, true).catch(()=>{});
    // reveal UI soon
    setTimeout(()=> { uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }, 600);
  }
}

/* ---------- Playlist loader (top-right UI button) ---------- */
loadSpotify.addEventListener('click', async ()=>{
  const v = spotifyInput.value.trim();
  if (!v) { spotifyEmbed.innerHTML = ''; return; }
  // Support generic mp3/ogg url or SoundCloud page URLs (best if direct stream)
  // We'll try to load the URL into audioController (it may fail for SoundCloud pages that are not direct streams)
  const ok = await audioController.loadUrl(v, true);
  if (!ok){
    // fallback: show an iframe embed if it's a SoundCloud page
    if (v.includes('soundcloud.com')){
      spotifyEmbed.innerHTML = `<iframe width="100%" height="120" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(v)}"></iframe>`;
    } else {
      spotifyEmbed.innerHTML = `<div style="color:#f2f2f2">Couldn't load audio directly. You can paste a direct audio URL or a SoundCloud page URL.</div>`;
    }
  }
});

/* ---------- setActive genre on bubble click (we already call setActiveGenre in pointer handler) ---------- */

/* ---------- Startup UI + safety ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Bubbles not initialized — check Three.js load'); }, 900);

/* Reveal + intro on load (autoplay tried once) */
window.addEventListener('load', ()=> {
  // small delay to let assets settle
  setTimeout(()=> startIntroSequence(), 80);

  // If autoplay blocked, reveal UI on first user interaction and resume audio then
  document.body.addEventListener('pointerdown', async function oncePlay(){
    try {
      // resume audio context if suspended
      if (audioController._internal && audioController._internal.audioEl && audioController._internal.audioEl()){
        const el = audioController._internal.audioEl();
        if (el && el.paused) {
          try { await el.play(); } catch(e) {}
        }
      }
    } catch(e){}
    // reveal UI if not already
    revealUIOnFirstInteraction();
    document.body.removeEventListener('pointerdown', oncePlay);
  }, { once: true });
});

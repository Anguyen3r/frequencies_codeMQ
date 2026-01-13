/* app.js — Integrated single-file version
   Features:
   - Ribbon waveform (shader) with idle flow + audio-reactive amplitude
   - Bubbles orbiting a diagonal horizontal oval, pass through each other
   - Stars with per-star twinkle phases
   - Smoke/aurora sprites front & back
   - Intro fade overlay and one-time autoplay of "wave" SoundCloud track
   - Modal on bubble click with audio-loading & vote UI
   - Single animation loop
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // or your firebase config object to enable DB
const INTRO_TRACK = 'https://soundcloud.com/user-200235414/wave-1'; // your track (attempt play)
const GENRE_PLAYLISTS = {
  'techno': 'https://soundcloud.com/your-hard-techno-playlist',
  'house':  'https://soundcloud.com/your-house-playlist',
  'dnb':    'https://soundcloud.com/your-dnb-playlist',
  'dubstep':'https://soundcloud.com/your-dubstep-playlist',
  'electronic': 'https://soundcloud.com/your-electronic-playlist',
  'mainstream': 'https://soundcloud.com/your-mainstream-playlist'
};

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
  } catch(e) { console.warn('Firebase init failed; falling back to localStorage', e); useFirebase=false; }
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
  } else return JSON.parse(localStorage.getItem('codemq_votes') || '{}');
}
if (!useFirebase) window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* ---------- UI refs & initial hidden state ---------- */
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

// start hidden until first interaction or after intro
uiWrap.style.opacity = '0'; uiWrap.style.pointerEvents = 'none';
legendWrap.style.opacity = '0'; legendWrap.style.pointerEvents = 'none';

/* ---------- Genres ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79 },
  { id:'house', name:'House', color:0xffbf5f },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },
  { id:'electronic', name:'Electronic / Dance', color:0x9f5fff },
  { id:'mainstream', name:'Mainstream / International', color:0xffffff }
];
GENRES.forEach(g=>{
  const opt=document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
  const li=document.createElement('li'); li.textContent=g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), ${toCssHex(g.color)})`;
  const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
  li.style.color = lum >= 128 ? '#000' : '#fff';
  legendList.appendChild(li);
});
toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));
genreSelect.addEventListener('change', ()=> computeAndRenderTop());

/* ---------- Three.js core ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00007);

const CAMERA_Z = 950; // zoom out so cluster ~4/5 screen
const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 20, CAMERA_Z);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

/* lights */
const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(10,20,10); scene.add(dir);

/* ---------- Stars (two layers + per-star phase attribute) ---------- */
function makeStarLayer(count, spreadX, spreadY, spreadZ, size, opacity){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const phase = new Float32Array(count);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5)*spreadX;
    pos[i*3+1] = (Math.random()-0.5)*spreadY;
    pos[i*3+2] = -Math.random()*spreadZ - 200;
    phase[i] = Math.random()*Math.PI*2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase,1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const points = new THREE.Points(geo, mat);
  return { points, geo, mat };
}
const starsFar = makeStarLayer(1600, 6000, 3600, 6000, 1.1, 0.92);
const starsNear = makeStarLayer(900, 3500, 2200, 3500, 1.9, 0.6);
scene.add(starsFar.points, starsNear.points);

/* ---------- Dust plane ---------- */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(7000, 3800),
  new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false })
);
dustPlane.position.set(0,0,-2600);
scene.add(dustPlane);

/* ---------- Procedural textures ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,6,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.25,'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6,toCssRgba(colorHex,0.28));
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.2,'rgba(255,255,255,0.9)'); g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
function toCssRgba(hex,a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }

/* ---------- Ribbon (shader plane) ---------- */
/* Vertex shader: displace vertices vertically using sine + noise + audio amplitude (passed as uniform)
   Fragment shader: additive gradient glow with soft falloff and color blending */
const ribbonVert = `
  uniform float uTime;
  uniform float uAmp;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vWave;
  // simple 2D pseudo-noise
  float hash(float n){ return fract(sin(n)*43758.5453123); }
  float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i.x + i.y*57.0);
    float b = hash(i.x+1.0 + i.y*57.0);
    float c = hash(i.x + (i.y+1.0)*57.0);
    float d = hash(i.x+1.0 + (i.y+1.0)*57.0);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }
  void main(){
    vUv = uv;
    float x = (uv.x - 0.5) * 8.0; // widen
    // base sine wave
    float sine = sin((uv.x * 12.0 + uTime*1.6) + uPhase*2.0);
    // layered noise
    float n = noise(vec2(uv.x*6.0 + uTime*0.3, uv.y*4.0)) * 0.6;
    float disp = (sine * 0.9 + n*0.4) * (0.6 + uAmp*1.6);
    // vertical lift scaled by ribbon height
    vec3 pos = position;
    pos.y += disp * 1.2;
    vWave = abs(disp);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const ribbonFrag = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  varying float vWave;
  void main(){
    // center glow
    float dist = abs(vUv.y - 0.5);
    float band = smoothstep(0.45, 0.0, dist) * (0.6 + vWave*0.9);
    vec3 col = mix(uColorA, uColorB, vUv.x);
    // add small rim
    float rim = pow(1.0 - dist*2.0, 3.0);
    vec3 final = col * (0.5*band + rim*0.35) + vec3(1.0)*pow(band,2.0)*0.18;
    gl_FragColor = vec4(final, clamp(band*1.2, 0.0, 1.0));
    // additive feel when blending occurs in canvas due to transparent background
  }
`;
const ribbonUniforms = {
  uTime: { value: 0 },
  uAmp: { value: 0.02 },
  uPhase: { value: Math.random()*6.28 },
  uColorA: { value: new THREE.Color(0x3ea6ff) },
  uColorB: { value: new THREE.Color(0xff6fb1) }
};
const ribbonMat = new THREE.ShaderMaterial({
  uniforms: ribbonUniforms,
  vertexShader: ribbonVert,
  fragmentShader: ribbonFrag,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
// plane wide across the screen
const ribbonMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.2, 256, 32), ribbonMat);
ribbonMesh.position.set(0, -6, -120); // slightly back so bubbles appear in front and behind as needed
ribbonMesh.rotation.x = -0.12; // slight tilt
scene.add(ribbonMesh);

/* ---------- Bubbles cluster ---------- */
const CLUSTER_RADIUS = 420 * 0.95;
const BUBBLE_GROUP = new THREE.Group(); scene.add(BUBBLE_GROUP);
const BUBBLES = {};
function createBubble(coreRadius, colorHex){
  const color = new THREE.Color(colorHex);
  const geo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.32,
    roughness: 0.15,
    metalness: 0.06,
    transmission: 0.72,
    emissive: color.clone().multiplyScalar(0.02),
    emissiveIntensity: 0.6,
    clearcoat: 0.2,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), color: colorHex, transparent:true, opacity:0.15, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*7.6, coreRadius*7.6, 1);
  mesh.add(rim);
  return { mesh, mat, rim, coreRadius };
}
// Build genre bubbles
GENRES.forEach((g, idx) => {
  const radius = 50 + Math.random()*14; // larger bubbles
  const b = createBubble(radius, g.color);
  const container = new THREE.Group();
  container.add(b.mesh);
  container.userData.baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.idx = idx;
  // initial placement on oval
  const baseAngle = container.userData.baseAngle;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.55, -idx*6);
  BUBBLE_GROUP.add(container);
  BUBBLES[g.id] = { id:g.id, idx, container, core:b.mesh, mat:b.mat, baseAngle, radius };
});

/* ---------- Smoke / aurora sprites (similar to earlier) ---------- */
function createAuroraSprite(colorStops, size=1600, opacity=0.28){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,18,size/2,size/2,size*0.95);
  colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  return spr;
}
const smokeBack = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.25,color:'rgba(60,40,200,0.12)'},{offset:0.8,color:'rgba(24,160,180,0.06)'},{offset:1,color:'rgba(0,0,0,0)'}], 2000, 0.42);
smokeBack.scale.set(3000,1600,1); smokeBack.position.set(-40,-140,-1800); scene.add(smokeBack);
const smokeFront = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.25,color:'rgba(200,60,140,0.08)'},{offset:1,color:'rgba(0,0,0,0)'}], 1600, 0.30);
smokeFront.scale.set(2200,1100,1); smokeFront.position.set(40,60,-320); scene.add(smokeFront);

/* ---------- Raycast / interactions ---------- */
const raycaster = new THREE.Raycaster();
const ndcMouse = new THREE.Vector2();

function onPointerDown(e){
  if (uiWrap.style.opacity === '0') { uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto'; }
  const rect = renderer.domElement.getBoundingClientRect();
  ndcMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndcMouse, camera);
  // build list of bubble meshes (the cores)
  const cores = Object.values(BUBBLES).map(b => b.core);
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    // find parent container
    let parent = null;
    for (const c of BUBBLE_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent){
      const found = Object.values(BUBBLES).find(o => o.container === parent);
      if (found) openCenteredModal(found.id);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Centered modal (same approach you had) ---------- */
let activeModal = null;
function closeModal(){ if(!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal=null; }
function openCenteredModal(genreId){
  closeModal();
  const g = GENRES.find(x=>x.id===genreId); if (!g) return;
  const modal = document.createElement('div'); modal.className='panel';
  modal.style.position='fixed'; modal.style.left='50%'; modal.style.top='50%'; modal.style.transform='translate(-50%,-50%)';
  modal.style.zIndex='9999'; modal.style.width='420px'; modal.style.maxWidth='92vw'; modal.style.backdropFilter='blur(6px)';
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
    flashBubble(genreId);
    computeAndRenderTop();
    closeModal();
  });

  // audio URL loader inside modal
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
  // reveal UI gently
  uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto';
  legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto';
  setTimeout(()=> modal.querySelector('.artist').focus(), 120);
}
function insertAudioPlayerInModal(modal, src, label){
  let player = modal.querySelector('audio');
  if (!player){ player = document.createElement('audio'); player.controls=true; player.style.width='100%'; player.style.marginTop='8px'; modal.appendChild(player); }
  player.src = src; player.play().catch(()=>{});
  let info = modal.querySelector('.audioLabel');
  if (!info){ info=document.createElement('div'); info.className='audioLabel'; info.style.fontSize='12px'; info.style.marginTop='6px'; modal.appendChild(info); }
  info.textContent = `Loaded: ${label}`;
}

/* ---------- flash visual feedback ---------- */
function flashBubble(genreId){
  const o = BUBBLES[genreId]; if (!o) return;
  const mat = o.mat; const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.6, orig*2.7);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ---------- Top compute & UI ---------- */
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
    updateBubbleHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });
  const sel = genreSelect.value || GENRES[0].id;
  const arr = perGenreCounts[sel] || []; let html='';
  for (let i=0;i<Math.min(50,arr.length);i++) html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  topList.innerHTML = html;
}
function updateBubbleHighlight(genreId, topCount){
  const o = BUBBLES[genreId]; if (!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount)*0.9);
  o.mat.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount)*0.12);
  o.core.scale.set(base, base, base);
}

/* ---------- WebAudio analyzer (audioController) ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, dataArray=null, audioEl=null, active=false, lastUrl=null;
  async function ensure(){
    if (!audioCtx){ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048; dataArray = new Uint8Array(analyser.frequencyBinCount); }
  }
  async function loadUrl(url, { loop=true } = {}){
    try {
      await ensure();
      if (!audioEl){ audioEl = document.createElement('audio'); audioEl.crossOrigin='anonymous'; audioEl.controls=true; audioEl.style.width='100%'; }
      if (lastUrl === url && audioEl.src){ // resume if same
        audioEl.loop = loop; audioEl.play().catch(()=>{});
        active = true; return true;
      }
      audioEl.src = url; audioEl.loop = loop;
      // attempt play (may be blocked)
      await audioEl.play().catch(()=>{});
      if (source) try{ source.disconnect(); }catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true; lastUrl = url;
      // attach small player to spotifyEmbed for user visibility
      spotifyEmbed.innerHTML = ''; spotifyEmbed.appendChild(audioEl);
      return true;
    } catch(err){ console.warn('audio load failed', err); active=false; return false; }
  }
  function stop(){ if (audioEl) try{ audioEl.pause(); }catch(e){} if (audioCtx && audioCtx.state!=='closed') try{ audioCtx.suspend(); }catch(e){} active=false; }
  function getAmps(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.03));
    let bass=0; for (let i=0;i<lowCount;i++) bass += dataArray[i];
    bass = bass / lowCount / 255;
    let sum=0; for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length) / 255;
    return { bass, rms, raw: dataArray };
  }
  return { loadUrl, stop, getAmps, isActive: ()=> active, audioEl: ()=> audioEl };
})();

/* ---------- Intro fade + single autoplay behavior ---------- */
let introPlayed = false;
function playIntroOnce(){
  if (introPlayed) return; introPlayed = true;
  // Attempt to load intro track via the audioController (may fail due to SoundCloud CORS)
  audioController.loadUrl(INTRO_TRACK, { loop:false }).then(success => {
    // if success, fade overlay together with audio start
  }).catch(()=>{ /* ignore */ });
}

/* Fade overlay element (exists in your index as #fade-overlay) */
const fadeOverlay = document.getElementById('fade-overlay');
function startIntroFade(){
  // ensure overlay visible
  if (fadeOverlay){
    // Start audio and fade simultaneously
    playIntroOnce();
    // fade duration 1.5s
    fadeOverlay.style.transition = 'opacity 1.5s ease';
    requestAnimationFrame(()=> {
      fadeOverlay.style.opacity = '0';
      // show UI slightly after fade completes
      setTimeout(()=> {
        uiWrap.style.transition = 'opacity 0.6s ease';
        uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents='auto';
        legendWrap.style.transition = 'opacity 0.6s ease';
        legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents='auto';
      }, 1700);
      // remove overlay from DOM
      setTimeout(()=> { try{ fadeOverlay.remove(); }catch(e){} }, 1800);
    });
  } else {
    // no overlay - still reveal UI
    uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto';
    legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto';
    playIntroOnce();
  }
}

/* Play intro on first user interaction if autoplay blocked */
document.addEventListener('click', function oncePlay(){ if (!introPlayed){ startIntroFade(); document.removeEventListener('click', oncePlay); }});

/* If page load happens and autoplay allowed, start fade+audio */
window.addEventListener('load', () => {
  // small timeout for UX
  setTimeout(()=> startIntroFade(), 80);
});

/* ---------- Stars twinkle utility ---------- */
function updateStars(t){
  // animate global rotations and per-layer opacity using sine + small randomness
  starsFar.points.rotation.z += 0.00035;
  starsNear.points.rotation.z -= 0.00052;
  // time-based opacities
  const rmsSim = 0.06 + Math.sin(t*0.22)*0.02;
  starsNear.mat.opacity = 0.55 + Math.sin(t*0.9 + 3.1)*0.08 + rmsSim * 0.12;
  starsFar.mat.opacity = 0.88 + Math.cos(t*0.4 + 1.7)*0.04 + Math.abs(Math.sin(t*0.2))*0.03;
}

/* ---------- Utility: sample ribbon height at normalized x (-1..1) ----------
   We'll use the ribbon shader function logic approximate on CPU to provide a centerline height
   to offset bubble orbits (gives the feel that bubbles orbit around the ribbon). */
function sampleRibbonAt(normX, time, amp, phase){
  // chew with similar formula as shader (sine + small noise).
  const sine = Math.sin(( (normX+1.0)*0.5 * 12.0 + time*1.6) + phase*2.0);
  const noise = Math.sin(normX*6.1 + time*0.37)*0.18 + Math.sin(normX*2.3 + time*0.13)*0.08;
  const disp = (sine * 0.9 + noise*0.4) * (0.6 + amp*1.6);
  return disp * 1.2 * 1.0; // scale to match shader's vertical units
}

/* ---------- Animation loop (single loop) ---------- */
let startTime = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const t = (now - startTime) * 0.001;

  // audio amplitude
  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : 0;
  const rms = amps ? amps.rms : 0.06 + Math.sin(t*0.25)*0.02;
  const ribbonAmp = Math.max(0.01, rms * 1.2 + bass * 1.8);

  // ribbon uniforms
  ribbonUniforms.uTime.value = t;
  ribbonUniforms.uAmp.value = ribbonAmp;
  ribbonUniforms.uPhase.value += 0.0009 + bass*0.02; // phase drift

  // ribbon color adapt: if any genre audio playing, pick that color; else gradient default
  // keep a global activeGenreColor if set when user selects bubble
  if (window.__activeGenreColorHex){
    const c = new THREE.Color(window.__activeGenreColorHex);
    ribbonUniforms.uColorA.value.lerp(c, 0.08); // blend smoothly
    // compliment colorB
    const mixB = c.clone().offsetHSL(0.08, 0.15, -0.02);
    ribbonUniforms.uColorB.value.lerp(mixB, 0.06);
  } else {
    // idle gradient shift
    const idleA = new THREE.Color(0x2ea9ff);
    const idleB = new THREE.Color(0xff6fb1);
    ribbonUniforms.uColorA.value.lerp(idleA, 0.02);
    ribbonUniforms.uColorB.value.lerp(idleB, 0.02);
  }

  // smoke subtle movement
  smokeBack.position.x += Math.sin(t*0.02)*0.04;
  smokeBack.position.y += Math.cos(t*0.015)*0.03;
  smokeFront.position.x += Math.cos(t*0.018)*0.06;
  smokeFront.position.y += Math.sin(t*0.02)*0.05;

  // camera micro-motion for cinematic feel
  camera.position.z = CAMERA_Z + Math.sin(t*0.08)*4 + bass*30;
  camera.position.x = Math.sin(t*0.04)*8 * (0.7 + rms*0.6);
  camera.position.y = Math.cos(t*0.03)*4 * (0.7 + rms*0.6);
  camera.lookAt(0,0,0);

  // update stars
  updateStars(t);

  // animate bubbles along an oval orbit that is tilted (diagonal horizontal oval)
  const clusterSpeed = 0.14 + bass*0.4;
  const tiltAngle = -0.18; // tilt up-right slightly
  const tiltCos = Math.cos(tiltAngle), tiltSin = Math.sin(tiltAngle);
  const ringEcc = 0.6;
  Object.values(BUBBLES).forEach((o) => {
    const idx = o.idx;
    const phaseOffset = o.baseAngle;
    const angle = t*clusterSpeed + phaseOffset*(0.6 + idx*0.08);
    // eccentric radii (make oval diagonal by rotating position after)
    let ex = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    let ey = CLUSTER_RADIUS * ringEcc * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);
    // sample ribbon displacement under this bubble's normalized x to create orbit-around-ribbon feel
    // NormX in -1..1: compute based on angle
    const normX = Math.cos(angle);
    const ribbonDisp = sampleRibbonAt(normX, t, ribbonAmp, ribbonUniforms.uPhase.value);
    // position before tilt
    let px = Math.cos(angle) * ex;
    let py = Math.sin(angle * 1.02 + idx*0.31) * ey + ribbonDisp * 18.0; // apply ribbon influence on y
    // slight stagger jitter so orbits aren't perfect
    px += (idx - Object.keys(BUBBLES).length/2) * Math.sin(t*0.03)*1.2;
    // apply rotation/tilt to make oval diagonal
    const rx = px * tiltCos - py * tiltSin;
    const ry = px * tiltSin + py * tiltCos;
    o.container.position.x = rx;
    o.container.position.y = ry;
    o.container.position.z = Math.sin(t*(0.55 + idx*0.02))*10 - idx*3.2;
    // local spin and rim pulsing
    o.core.rotation.y += 0.002 + idx*0.0003;
    o.core.rotation.x += 0.0011;
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.12 + rms * 0.32; });
    // ring and gas breathing (if present)
    if (o.ringObj) {
      o.ringObj.group.rotation.z += (o.ringObj.rotationSpeed || 0.004) * (1 + bass*0.8);
      if (o.ringObj.mat) o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms*0.22;
    }
    if (o.gas) o.gas.material.opacity = 0.035 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.018;
  });

  renderer.render(scene, camera);
}

/* ---------- Resize ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
});

/* ---------- Startup ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());
startTime = performance.now();
animate();

/* ---------- Provide bubble click loading behavior (change playlist to genre) ---------- */
// If user clicks bubble and loads genre playlist: load SoundCloud playlist if available,
// set __activeGenreColorHex for ribbon color adapt, and play/loop.
async function switchToGenre(genreId){
  const g = GENRES.find(x=>x.id === genreId);
  if (!g) return;
  const url = GENRE_PLAYLISTS[genreId] || GENRE_PLAYLISTS[g.name.toLowerCase()] || null;
  if (url) {
    await audioController.loadUrl(url, { loop:true }).catch(()=>{});
  }
  // set ribbon active color
  window.__activeGenreColorHex = g.color;
  // flash the bubble visually
  flashBubble(genreId);
}
/* connect modal submit or add a direct click-to-play mapping */
 // NOTE: within openCenteredModal you can call switchToGenre(genreId) after submit or add a "Play Genre" button.
 // For convenience, let's add a small click handler: double-click bubble will switch playlist quickly.
renderer.domElement.addEventListener('dblclick', (ev)=>{
  // raycast same as pointerdown logic
  const rect = renderer.domElement.getBoundingClientRect();
  ndcMouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndcMouse, camera);
  const cores = Object.values(BUBBLES).map(b => b.core);
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length>0){
    let hit = hits[0].object;
    let parent=null;
    for (const c of BUBBLE_GROUP.children){ if (c.children.includes(hit) || c===hit || c.children.includes(hit.parent)) { parent=c; break; } }
    if (parent){
      const found = Object.values(BUBBLES).find(o=>o.container===parent);
      if (found) switchToGenre(found.id);
    }
  }
});

/* ---------- Quick note about SoundCloud URLs ----------
  Raw SoundCloud page URLs (like those you've given) often don't stream directly via <audio>
  due to CORS and SoundCloud requiring oEmbed / API player. If you encounter playback failure,
  you can:
    - Host the audio file (mp3/ogg) with CORS allowed and use that URL.
    - Use SoundCloud's Widget API to embed their player (different approach).
  The audioController will attempt to play; if the browser blocks autoplay it will start on first user interaction.
*/

/* sanity */
setTimeout(()=> { if (!Object.keys(BUBBLES).length) console.error('Bubbles not initialized — check Three.js load'); }, 900);

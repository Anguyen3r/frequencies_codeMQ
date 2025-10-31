/* app.js — Laser ribbon + orbiting bubbles (reactive), integrated with existing UI/modal logic
   Paste over your current app.js. Requires Three.js loaded in index.html and the DOM elements you already provided.
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // optional, keep null for now

/* ---------- Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex,a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Persistence (Firebase optional / fallback localStorage) ---------- */
let dbRef=null, useFirebase=false;
if (FIREBASE_CONFIG){
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch(e){ console.warn('Firebase init failed', e); useFirebase=false; }
}
async function saveVote(genreId, artistName, b2b){
  const rec = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef) await dbRef.child(genreId).push(rec);
  else {
    const KEY='codemq_votes';
    const data = JSON.parse(localStorage.getItem(KEY)||'{}');
    data[genreId]=data[genreId]||[];
    data[genreId].push(rec);
    if (data[genreId].length > 20000) data[genreId].splice(0,data[genreId].length-20000);
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

/* ---------- DOM refs & initial states ---------- */
const wrap = document.getElementById('canvasWrap');
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

// hide UI until first interaction (per your design)
uiWrap.style.opacity = '0'; uiWrap.style.pointerEvents = 'none';
legendWrap.style.opacity = '0'; legendWrap.style.pointerEvents = 'none';

/* ---------- Genres & playlists (SoundCloud placeholders) ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79 },
  { id:'house', name:'House', color:0xffbf5f },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },
  { id:'electronic', name:'Electronic / Dance', color:0x9f5fff },
  { id:'mainstream', name:'Mainstream / International', color:0xffffff }
];

const genrePlaylists = {
  'techno': 'https://soundcloud.com/your-hard-techno-playlist',       // replace with real SoundCloud stream/hosted url
  'house': 'https://soundcloud.com/your-house-playlist',
  'dnb': 'https://soundcloud.com/your-dnb-playlist',
  'dubstep': 'https://soundcloud.com/your-dubstep-playlist',
  'electronic': 'https://soundcloud.com/your-electronic-playlist',
  'mainstream': 'https://soundcloud.com/your-mainstream-playlist'
};

/* populate UI selects & legend */
GENRES.forEach(g=>{
  const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.name; genreSelect.appendChild(opt);
  const li = document.createElement('li'); li.textContent = g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
  li.style.color = lum >= 128 ? '#000' : '#fff';
  legendList.appendChild(li);
});
toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));
genreSelect.addEventListener('change', ()=> computeAndRenderTop());

/* ---------- Three.js: scene, camera, renderer ---------- */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

// Camera zoom tuned so bubbles + smoke occupy ~4/5 to give room
const CAMERA_Z = 950;
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 18, CAMERA_Z);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000010, 1);
wrap.appendChild(renderer.domElement);

/* lighting */
const ambient = new THREE.AmbientLight(0xffffff, 0.45); scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(10,20,10); scene.add(dir);

/* ---------- Starfield (layers) ---------- */
function makeStarLayer(count, spreadX=6000, spreadY=3600, spreadZ=6000, size=1.2, opacity=0.9){
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
  const pts = new THREE.Points(geo, mat);
  return { points: pts, geo, mat };
}
const starsFar = makeStarLayer(1600, 7000, 4000, 7000, 1.1, 0.9);
const starsNear = makeStarLayer(700, 3500, 2200, 3500, 1.9, 0.6);
scene.add(starsFar.points, starsNear.points);

/* ---------- Dust / smoke backplate ---------- */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000,3800), new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false }));
dustPlane.position.set(0,0,-2600); scene.add(dustPlane);

/* ---------- Orb (bubble) cluster ---------- */
const CLUSTER_RADIUS = 420;
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};

function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,8,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.25,'rgba(255,255,255,0.8)');
  grad.addColorStop(0.6, toCssRgba(colorHex,0.28));
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.2,'rgba(255,255,255,0.95)'); g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}

function createStardustRing(coreRadius, colorHex, tilt, particleCount=220, size=8.5, counter=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius*(1.8 + Math.random()*0.9);
  const positions = new Float32Array(particleCount*3);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount)*Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5)*(coreRadius*0.36);
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5)*(coreRadius*0.5);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);
  const pts = new THREE.Points(geo, mat);
  group.add(pts);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false}));
  glow.scale.set(ringRadius*2, ringRadius*2, 1); group.add(glow);
  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const rotationSpeed = (0.004 + Math.random()*0.006) * (counter ? -1 : 1);
  return { group, points:pts, mat, rotationSpeed, ringRadius };
}

GENRES.forEach((g, idx)=>{
  const color = new THREE.Color(g.color);
  const coreRadius = 44 + Math.random()*8;
  const geo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const mat = new THREE.MeshPhysicalMaterial({
    color:0xffffff, transparent:true, opacity:0.30, roughness:0.16, metalness:0.08, transmission:0.7,
    emissive: color.clone().multiplyScalar(0.02), emissiveIntensity:0.6, clearcoat:0.2
  });
  mat.depthWrite = false;
  const mesh = new THREE.Mesh(geo, mat);
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*9.8, coreRadius*9.8, 1); mesh.add(rim);

  const container = new THREE.Group(); container.add(mesh);
  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle; container.userData.idx = idx;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.6, -idx*6);

  // stardust ring
  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  const ringObj = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random()*160), 9.5, (idx % 2 === 0));
  container.add(ringObj.group);

  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.035, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat); container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core:mesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- Ribbon (3D waveform) ---------- 
   - We create a tubular ribbon along a curve of N points; on each frame update the Y values with FFT/buffer
   - Crisp look: moderately thin tube with emissive material (keeps clean - no heavy blur)
*/
const RIBBON_POINTS = 128;
let ribbon;
function createRibbon(){
  // initial straight horizontal curve across X axis centered at origin
  const pts = [];
  const width = 840; // horizontal extent
  for (let i=0;i<RIBBON_POINTS;i++){
    const t = i/(RIBBON_POINTS-1);
    const x = (t - 0.5) * width; // centered
    const y = 0;
    const z = Math.sin(t*Math.PI*2) * 8; // slight z wobble
    pts.push(new THREE.Vector3(x,y,z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubularSegments = RIBBON_POINTS * 3;
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, 6.5, 8, false); // radius ~6.5 => visible but crisp
  // emissive material; keep sharp
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x7aa1ff, emissiveIntensity: 1.1,
    metalness: 0.1, roughness: 0.25, transparent: true, opacity: 0.95, side: THREE.DoubleSide
  });
  ribbon = new THREE.Mesh(geometry, mat);
  ribbon.userData.basePoints = pts; // store base points to update
  ribbon.position.set(0, 0, -20); // slightly behind center so bubbles can pass through visually
  scene.add(ribbon);
}
createRibbon();

/* ---------- Aurora/smoke layers (kept from earlier) ---------- */
function createAuroraSprite(colorStops,size=1600,opacity=0.3){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,20,size/2,size/2,size*0.95);
  colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  return spr;
}
const smokeBack1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(120,40,200,0.12)'},{offset:0.8,color:'rgba(20,150,200,0.06)'},{offset:1,color:'rgba(0,0,0,0)'}],2000,0.42);
smokeBack1.scale.set(3000,1600,1); smokeBack1.position.set(-60,-120,-1800); scene.add(smokeBack1);
const smokeFront1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(160,40,220,0.08)'},{offset:0.7,color:'rgba(30,200,220,0.07)'},{offset:1,color:'rgba(0,0,0,0)'}], 1400, 0.30);
smokeFront1.scale.set(2200,1100,1); smokeFront1.position.set(30,80,-320); scene.add(smokeFront1);

/* corner gas */
const cornerSpecs = [
  {x:-1,y:-1,color:'rgba(160,40,220,0.14)'},
  {x:1,y:-0.9,color:'rgba(40,200,220,0.11)'},
  {x:-0.9,y:1,color:'rgba(240,120,100,0.09)'},
  {x:0.9,y:0.9,color:'rgba(100,120,255,0.07)'}
];
const cornerSprites = [];
cornerSpecs.forEach((s,i)=>{
  const spr = createAuroraSprite([{offset:0,color:s.color},{offset:1,color:'rgba(0,0,0,0)'}],900,0.14);
  spr.scale.set(900,900,1); spr.position.set(s.x*1200*(0.6+Math.random()*0.4), s.y*700*(0.6+Math.random()*0.4), -320);
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- Raycasting & UI reveal ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onPointerDown(e){
  if (uiWrap.style.opacity === '0'){ uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto'; }
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  // gather cores
  const cores = [];
  ORB_GROUP.children.forEach(c => { c.traverse(n=>{ if (n.isMesh && n.geometry && n.geometry.type==='SphereGeometry') cores.push(n); }); });
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    let parent = null;
    for (const c of ORB_GROUP.children) if (c.children.includes(hit) || c===hit || c.children.includes(hit.parent)) { parent = c; break; }
    if (parent) {
      const found = Object.values(ORB_MESHES).find(o => o.container === parent);
      if (found) openCenteredModal(found.id);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Modal logic (reused, centered) ---------- */
let activeModal = null;
function closeModal(){ if (!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal = null; }
function openCenteredModal(genreId){
  closeModal();
  const g = GENRES.find(x=>x.id===genreId); if (!g) return;
  const modal = document.createElement('div'); modal.className='panel';
  modal.style.position='fixed'; modal.style.left='50%'; modal.style.top='50%'; modal.style.transform='translate(-50%,-50%)';
  modal.style.zIndex='9999'; modal.style.width='420px'; modal.style.maxWidth='90vw'; modal.style.textAlign='left'; modal.style.backdropFilter='blur(6px)';
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
    const artist = modal.querySelector('.artist').value.trim(); if (!artist){ modal.querySelector('.artist').focus(); return; }
    const b2b = modal.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashOrb(genreId);
    computeAndRenderTop();
    closeModal();
  });

  // local audio loader
  const openAudioFile = modal.querySelector('#openAudioFile'); const modalAudioFile = modal.querySelector('#modalAudioFile');
  const modalAudioUrl = modal.querySelector('#modalAudioUrl');
  openAudioFile.addEventListener('click', ()=> modalAudioFile.click());
  modalAudioFile.addEventListener('change', async (ev)=> {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    await audioController.loadUrl(url);
    insertAudioPlayerInModal(modal, url, f.name);
  });
  modalAudioUrl.addEventListener('keydown', async (ev)=> {
    if (ev.key === 'Enter'){ const url=modalAudioUrl.value.trim(); if (!url) return; await audioController.loadUrl(url); insertAudioPlayerInModal(modal,url,url); }
  });

  activeModal = { dom: modal, genreId };
  uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto';
  legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto';
  setTimeout(()=> modal.querySelector('.artist').focus(), 120);
}
function insertAudioPlayerInModal(modal, src, label){
  let player = modal.querySelector('audio'); if (!player){ player = document.createElement('audio'); player.controls=true; player.style.width='100%'; player.style.marginTop='8px'; modal.appendChild(player); }
  player.src = src; player.play().catch(()=>{});
  let info = modal.querySelector('.audioLabel'); if (!info){ info = document.createElement('div'); info.className='audioLabel'; info.style.fontSize='12px'; info.style.marginTop='6px'; modal.appendChild(info); }
  info.textContent = `Loaded: ${label}`;
}

/* ---------- Audio controller & WebAudio analyzer ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, dataArray=null, audioEl=null, active=false, lastUrl=null;
  async function ensure(){
    if (!audioCtx){ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048; dataArray = new Uint8Array(analyser.frequencyBinCount); }
  }
  async function loadUrl(url){
    try {
      await ensure();
      if (!audioEl){ audioEl = document.createElement('audio'); audioEl.crossOrigin='anonymous'; audioEl.controls=false; audioEl.style.display='none'; document.body.appendChild(audioEl); }
      if (lastUrl === url && audioEl.src) {
        audioEl.play().catch(()=>{});
      } else {
        audioEl.pause(); audioEl.src = url; audioEl.loop = true;
        // try play; may be blocked until user interaction
        const p = audioEl.play();
        if (p) p.catch(()=>{ /* ignore autoplay blocked; will start on user gesture */ });
        if (source) try{ source.disconnect(); }catch(e){}
        source = audioCtx.createMediaElementSource(audioEl);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        active = true; lastUrl = url;
        // show player in spotifyEmbed area as simple UI
        spotifyEmbed.innerHTML = ''; const v = audioEl.cloneNode(true); v.controls=true; v.style.width='100%'; spotifyEmbed.appendChild(v);
      }
      return true;
    } catch(err){ console.warn('audio load failed', err); active=false; return false; }
  }
  function stop(){ if (audioEl) try{ audioEl.pause(); }catch(e){} if (audioCtx && audioCtx.state!=='closed') try{ audioCtx.suspend(); }catch(e){} active=false; }
  function getAmps(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    // compute bass fraction
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.02));
    let bass=0; for (let i=0;i<lowCount;i++) bass += dataArray[i];
    bass = bass / lowCount / 255;
    let sum=0; for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length) / 255;
    return { bass, rms, raw:dataArray };
  }
  return { loadUrl, stop, getAmps, isActive: ()=> active };
})();

/* ---------- Flash feedback on vote ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const orig = o.core.material.emissiveIntensity || 0.6;
  o.core.material.emissiveIntensity = Math.max(1.6, orig*2.5);
  setTimeout(()=> o.core.material.emissiveIntensity = orig, 900);
}

/* ---------- Top rendering (UI) ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const perGenreCounts = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r=>{ const k=(r.artist||'').trim(); if(!k) return; counts[k] = (counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id] = sorted;
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

/* ---------- Intro fade overlay + autoplay intro track (once only) ---------- */
const FIRST_INTRO_URL = 'https://soundcloud.com/user-200235414/wave-1'; // you provided this
let introPlayed = false;
async function startIntroOnce(){
  if (introPlayed) return;
  introPlayed = true;
  // find overlay element (#fade-overlay) from your index.html (style.css already contains it)
  const overlay = document.getElementById('fade-overlay') || document.getElementById('fadeOverlay');
  // Attempt to load the intro track
  audioController.loadUrl(FIRST_INTRO_URL).then(ok=>{
    // if loaded, play attempt already done inside loadUrl
  }).catch(()=>{ /* ignore */ });
  // fade overlay immediately over 1.5s
  if (overlay){
    overlay.style.transition = 'opacity 1.5s ease';
    // start at visible -> hide
    setTimeout(()=> overlay.style.opacity = '0', 0);
    setTimeout(()=> { try{ overlay.remove(); }catch(e){} }, 1500 + 200);
    // reveal UI slightly after (delay)
    setTimeout(()=> { uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto'; }, 1700);
  } else {
    // if no overlay element, reveal UI
    uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto';
  }
}

/* ---------- Switch to genre playlist on bubble click (stop intro) ---------- */
function switchToGenre(genreId){
  const url = genrePlaylists[genreId] || genrePlaylists[genreId] === undefined ? genrePlaylists[genreId] : null;
  if (!url) {
    console.warn('No playlist url for genre', genreId);
    return;
  }
  // stop existing audio if needed and load new URL
  audioController.loadUrl(url).then(ok=>{
    // optional: visual focus
    Object.values(ORB_MESHES).forEach(o => o.core.material.emissiveIntensity = 0.6);
    if (ORB_MESHES[genreId]) ORB_MESHES[genreId].core.material.emissiveIntensity = 1.8;
  });
}

/* ---------- Raycast click hooking to switch and modal ---------- */
renderer.domElement.addEventListener('dblclick', (e)=>{
  // double-click a bubble to switch audio to that genre (quick shortcut)
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const cores = []; ORB_GROUP.children.forEach(c=> c.traverse(n=>{ if (n.isMesh && n.geometry && n.geometry.type==='SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length>0){
    let hit = hits[0].object;
    let parent = null;
    for (const c of ORB_GROUP.children) if (c.children.includes(hit) || c===hit || c.children.includes(hit.parent)) { parent = c; break; }
    if (parent){
      const found = Object.values(ORB_MESHES).find(o=>o.container===parent);
      if (found) switchToGenre(found.id);
    }
  }
});

/* ---------- Animation loop: ribbon + orbs + stars + smoke ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // get audio analysis
  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : 0;
  const rms = amps ? amps.rms : 0.06 + Math.sin(t*0.25)*0.02;
  const spectrum = amps ? amps.raw : null;

  // stars twinkle
  starsFar.points.rotation.z += 0.00035;
  starsNear.points.rotation.z -= 0.00048;
  starsNear.mat.opacity = 0.55 + Math.sin(t*0.9 + 3.1) * 0.08 + rms * 0.12;
  starsFar.mat.opacity = 0.88 + Math.cos(t*0.4 + 1.7) * 0.04 + bass * 0.06;

  // dust plane slow rotate
  dustPlane.rotation.z += 0.00012;

  // smoke subtle breathing
  smokeBack1.material.opacity = 0.28 * (0.6 + Math.sin(t*0.9)*0.12 + bass*0.6);
  smokeFront1.material.opacity = 0.24 * (0.9 + Math.sin(t*0.5)*0.06 + rms*0.9);

  // camera gentle move responding to bass
  camera.position.z = CAMERA_Z + Math.sin(t*0.08)*6 + bass * 80;
  camera.position.x = Math.sin(t*0.04)*12*(0.7 + rms*0.8);
  camera.position.y = Math.cos(t*0.03)*6*(0.7 + rms*0.6);
  camera.lookAt(0,0,0);

  // cluster orbit: single unified diagonal oval orbit with tilt
  const clusterSpeed = 0.12 + bass * 0.35;
  GENRES.forEach((g, idx) => {
    const o = ORB_MESHES[g.id];
    if (!o) return;
    const phase = o.baseAngle;
    const angle = t*clusterSpeed + phase*(0.6 + idx*0.08);
    // Diagonal horizontal oval: rotate orbit plane slightly (tilt up-right)
    const ex = CLUSTER_RADIUS * 1.02 * (1 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.55 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);
    // produce diagonal oval by rotating coordinates a bit
    const diagX = Math.cos(angle) * ex * Math.cos(0.28) - Math.sin(angle) * ey * Math.sin(0.28);
    const diagY = Math.cos(angle) * ex * Math.sin(0.12) + Math.sin(angle) * ey * Math.cos(0.12);
    o.container.position.x = diagX + (idx - 2.5) * Math.sin(t*0.03)*2;
    o.container.position.y = diagY + Math.cos(idx*0.5 + t*0.2)*4;
    o.container.position.z = Math.sin(t*(0.55 + idx*0.02))*10 - idx*4;

    // local spin & ring counter-rotation
    o.core.rotation.y += 0.002 + idx*0.0003;
    o.core.rotation.x += 0.0011;
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass * 0.8);
    o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms * 0.22;
    o.gas.material.opacity = 0.035 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.018;
    // rim sprite pulse
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.12 + rms * 0.28; });
  });

  // update ribbon geometry from audio spectrum: map spectrum to vertical displacement
  if (ribbon && ribbon.userData && ribbon.userData.basePoints){
    // get positions array of tube geometry -> we will update the curve and rebuild geometry only moderately often to keep crispness
    const base = ribbon.userData.basePoints;
    // modify curve points Y using low/high frequency bands mix
    for (let i=0;i<base.length;i++){
      // map i to spectrum index
      let specIdx = Math.floor((i / base.length) * (spectrum ? spectrum.length : 64));
      specIdx = Math.max(0, Math.min((spectrum? spectrum.length:64)-1, specIdx));
      const specVal = spectrum ? spectrum[specIdx] / 255 : (0.5 + 0.5*Math.sin(i*0.2 + t*1.6));
      // amplify different ranges: center indices -> bass prominence
      const centerFactor = 1 - Math.abs((i/base.length)-0.5)*1.8;
      const y = (specVal * 180 - 40) * (0.42 + centerFactor*0.6) * (0.8 + bass*1.8);
      const z = Math.sin(i*0.12 + t*0.9) * 8; // gentle z ripple
      base[i].y = y;
      base[i].z = z;
    }
    // rebuild a lightweight geometry: create new curve and set positions of tube using new curve's path
    const newCurve = new THREE.CatmullRomCurve3(base);
    const segments = RIBBON_POINTS * 3;
    const newGeo = new THREE.TubeGeometry(newCurve, segments, 6.5, 8, false);
    // swap geometry (dispose previous)
    ribbon.geometry.dispose();
    ribbon.geometry = newGeo;

    // color shift with rms and bass for extra life
    const colorA = new THREE.Color(0x7aa1ff).lerp(new THREE.Color(0xff6fc7), Math.min(1, rms*1.6));
    ribbon.material.emissive.copy(colorA);
    ribbon.material.emissiveIntensity = 0.9 + bass*1.6;
    ribbon.material.color.setScalar(0.95 - Math.min(0.4, rms*0.5));
  }

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
});

/* ---------- Startup actions ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());

/* Fade overlay trigger on page load: begin intro immediately, fade 1.5s, reveal UI shortly after.
   Autoplay might be blocked — audioController.loadUrl will attempt play and fallback to user gesture.
*/
window.addEventListener('load', ()=>{
  startIntroOnce();
  // ensure overlay removal if user interacted before load
  const overlay = document.getElementById('fade-overlay') || document.getElementById('fadeOverlay');
  if (overlay){
    // overlay exists and will be transitioned by startIntroOnce
  } else {
    // ensure UI becomes visible if no overlay present
    uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto';
  }
});

/* provide double-click hint in console */
console.log('Dream Bubbles app.js loaded — double-click a bubble to switch genre playlist (replace genrePlaylists with real SoundCloud/hosted urls).');

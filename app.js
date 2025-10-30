/* app.js — Updated: zoomed out cluster (3/5 screen), unified orbit, staggered counter-orbit,
   multi-color pulsing aurora (front+back), random twinkling stars, center overlay UI on bubble click,
   audio-reactive pulsing (direct URL or local audio file), localStorage persistence (Firebase optional).
   Replace your old app.js with this file. Requires Three.js already loaded in index.html.
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // set to config object to enable Firebase realtime DB (optional)

/* ---------- Small helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Persistence (Firebase optional / localStorage fallback) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch(e) {
    console.warn('Firebase init error; falling back to localStorage', e);
    useFirebase = false;
  }
}
async function saveVote(genreId, artistName, b2b){
  const rec = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef) await dbRef.child(genreId).push(rec);
  else {
    const KEY = 'codemq_votes';
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    data[genreId] = data[genreId] || [];
    data[genreId].push(rec);
    if (data[genreId].length > 20000) data[genreId].splice(0, data[genreId].length-20000);
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('codemq_local_update'));
  }
}
async function readAllVotesOnce(){
  if (useFirebase && dbRef){
    const snap = await dbRef.get();
    return snap.exists() ? snap.val() : {};
  } else return JSON.parse(localStorage.getItem('codemq_votes') || '{}');
}
if (!useFirebase) window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* ---------- UI refs ---------- (must match your HTML) */
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');

const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');

const legendList = document.getElementById('legendList');

/* ---------- Genres ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79 },
  { id:'house', name:'House', color:0xffbf5f },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },
  { id:'electronic', name:'Electronic', color:0x9f5fff },
  { id:'mainstream', name:'Mainstream/International', color:0xffffff }
];

/* populate UI selects & legend (but keep visible controls hidden until bubble click) */
GENRES.forEach(g=>{
  const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
  const li = document.createElement('li'); li.textContent=g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
  li.style.color = lum >= 128 ? '#000' : '#fff';
  legendList.appendChild(li);
});
toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));

/* ---------- Ambient UI overlay (hidden) ---------- */
/* We'll create a centered overlay that is hidden by default and shown when clicking a bubble */
const overlay = document.createElement('div');
overlay.id = 'centerOverlay';
overlay.style.position = 'fixed';
overlay.style.left = '50%';
overlay.style.top = '50%';
overlay.style.transform = 'translate(-50%,-50%)';
overlay.style.zIndex = '9999';
overlay.style.minWidth = '420px';
overlay.style.maxWidth = '86vw';
overlay.style.padding = '18px';
overlay.style.borderRadius = '12px';
overlay.style.backdropFilter = 'blur(6px)';
overlay.style.background = 'linear-gradient(180deg, rgba(6,8,15,0.88), rgba(8,10,20,0.78))';
overlay.style.border = '1px solid rgba(255,255,255,0.04)';
overlay.style.boxShadow = '0 10px 40px rgba(0,0,0,0.6)';
overlay.style.display = 'none'; // hidden by default
overlay.style.color = '#fff';
overlay.innerHTML = `
  <button id="overlayClose" style="position:absolute;right:12px;top:10px;border:none;background:transparent;color:#dfefff;font-size:20px;cursor:pointer">✕</button>
  <div id="overlayContent" style="display:grid;gap:10px">
    <h2 id="overlayTitle" style="margin:0 0 6px 0;font-weight:600">Genre</h2>
    <div id="overlayBody" style="display:flex;flex-direction:column;gap:8px">
      <input id="overlayArtist" placeholder="Favorite artist (required)" style="padding:10px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff" />
      <input id="overlayB2B" placeholder="Dream B2B (optional)" style="padding:10px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff" />
      <textarea id="overlayWhy" rows="2" placeholder="Why (optional)" style="padding:10px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="overlayCancel" style="padding:8px 10px;border-radius:8px;border:none;background:transparent;color:#fff">Cancel</button>
        <button id="overlaySubmit" style="padding:8px 12px;border-radius:8px;border:none;background:#1db954;color:#fff">Submit</button>
      </div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.03)" />
      <div id="audioControls" style="display:flex;flex-direction:column;gap:6px">
        <input id="overlayAudioUrl" placeholder="Paste direct audio URL (mp3/ogg) - optional" style="padding:8px;border-radius:6px;border:none;background:rgba(255,255,255,0.03);color:#fff" />
        <div style="display:flex;gap:8px">
          <input id="overlayFileInput" type="file" accept="audio/*" style="display:none" />
          <button id="overlayLoadFile" style="padding:8px;border-radius:6px;border:none;background:#3b82f6;color:#fff">Load local file</button>
          <button id="overlayLoadUrl" style="padding:8px;border-radius:6px;border:none;background:#ef476f;color:#fff">Load URL</button>
          <button id="overlayStop" style="padding:8px;border-radius:6px;border:none;background:#666;color:#fff">Stop</button>
        </div>
        <div id="overlayPlayerHolder"></div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(overlay);
document.getElementById('overlayClose').addEventListener('click', ()=> hideOverlay());
document.getElementById('overlayCancel').addEventListener('click', ()=> hideOverlay());
document.getElementById('overlayLoadFile').addEventListener('click', ()=> document.getElementById('overlayFileInput').click());
document.getElementById('overlayLoadUrl').addEventListener('click', async ()=>{
  const url = document.getElementById('overlayAudioUrl').value.trim();
  if (!url) return alert('Paste a direct audio file URL (mp3/ogg). Spotify links will embed but cannot be analyzed.');
  const ok = await audioController.loadUrl(url);
  if (!ok) alert('Unable to load audio. Try a CORS-enabled direct file URL or load local file.');
});
document.getElementById('overlayFileInput').addEventListener('change', async (ev)=>{
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  const url = URL.createObjectURL(f);
  const ok = await audioController.loadUrl(url);
  if (!ok) alert('Could not play local file.');
});
document.getElementById('overlayStop').addEventListener('click', ()=> audioController.stop());
document.getElementById('overlaySubmit').addEventListener('click', async ()=>{
  const artist = document.getElementById('overlayArtist').value.trim(); if(!artist){ document.getElementById('overlayArtist').focus(); return; }
  const b2b = document.getElementById('overlayB2B').value.trim();
  if (!activeOverlayGenre) return;
  await saveVote(activeOverlayGenre, artist, b2b);
  flashOrb(activeOverlayGenre);
  computeAndRenderTop();
  hideOverlay();
});
function showOverlayForGenre(genreId){
  activeOverlayGenre = genreId;
  const g = GENRES.find(x=>x.id===genreId);
  document.getElementById('overlayTitle').textContent = (g && g.name) ? g.name : 'Genre';
  // reset fields
  document.getElementById('overlayArtist').value=''; document.getElementById('overlayB2B').value=''; document.getElementById('overlayWhy').value='';
  overlay.style.display='block';
  setTimeout(()=> document.getElementById('overlayArtist').focus(),120);
}
function hideOverlay(){ overlay.style.display='none'; activeOverlayGenre = null; audioController.stop(); spotifyEmbed.innerHTML=''; }

/* ---------- three.js scene ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
// light fog but not too dense
scene.fog = new THREE.FogExp2(0x000012, 0.00008);

/* camera: zoom so cluster occupies ~60% (3/5).
   We'll compute camera Z from clusterRadius and screen height heuristic so it's adaptive. */
let clusterRadius = Math.min(420, Math.max(280, Math.min(window.innerWidth, window.innerHeight) * 0.26));
function computeCameraZForCluster(clusterRadius){
  // approximate: pick z such that circle of radius clusterRadius fits ~60% of screen height
  // Using fov (in radians): visibleHeightAtZ = 2 * z * tan(fov/2)
  const fov = THREE.MathUtils.degToRad(48);
  // desired visible height to fit cluster: clusterDiameter / desiredFraction
  const desiredFraction = 0.6; // cluster should occupy ~60% of height
  const clusterVisibleHeight = clusterRadius * 2 / desiredFraction;
  const z = clusterVisibleHeight / (2 * Math.tan(fov/2));
  return Math.max(z, 420); // clamp minimum
}
const camera = new THREE.PerspectiveCamera(48, window.innerWidth/window.innerHeight, 0.1, 12000);
camera.position.set(0, 18, computeCameraZForCluster(clusterRadius));
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

/* lights */
const ambient = new THREE.AmbientLight(0xffffff, 0.45); scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9); dirLight.position.set(10,20,10); scene.add(dirLight);

/* ---------- starfield: two layers for random twinkle ---------- */
function makeStarLayer(count, spreadX=6000, spreadY=3600, spreadZ=6000, size=1.2, opacity=0.9){
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const baseSizes = new Float32Array(count);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5)*spreadX;
    pos[i*3+1] = (Math.random()-0.5)*spreadY;
    pos[i*3+2] = -Math.random()*spreadZ - 200;
    baseSizes[i] = Math.random()*1.6 + 0.6;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('baseSize', new THREE.BufferAttribute(baseSizes,1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const pts = new THREE.Points(g, mat);
  return { pts, geom:g, mat, baseSizes };
}
const starFar = makeStarLayer(2200, 7000, 4200, 7000, 1.2, 0.88);
const starNear = makeStarLayer(900, 3800, 2400, 3800, 1.9, 0.6);
scene.add(starFar.pts, starNear.pts);

/* dust plane (far back) */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(9000,5000), new THREE.MeshBasicMaterial({ map:dustTex, transparent:true, opacity:0.045, depthWrite:false }));
dustPlane.position.set(0,0,-3200);
scene.add(dustPlane);

/* ---------- helper textures ---------- */
function generateGlowTexture(colorHex){
  const size = 256; const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,8,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)'); grad.addColorStop(0.2,'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5,toCssRgba(colorHex,0.34)); grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.2,'rgba(255,255,255,0.95)'); g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
function toCssRgba(hex,a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }

/* ---------- ORBS + RINGS + GAS ---------- */
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {}; // by genre id

function createStardustRing(coreRadius, colorHex, tilt, particleCount=260, size=9.0, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.9);
  const pos = new Float32Array(particleCount*3);
  const sz = new Float32Array(particleCount);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5)*(coreRadius*0.36);
    pos[i*3] = Math.cos(theta)*rr; pos[i*3+1] = Math.sin(theta)*rr; pos[i*3+2] = (Math.random()-0.5)*(coreRadius*0.5);
    sz[i] = (Math.random()*1.6 + 1.6) * size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sz,1));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);
  const pts = new THREE.Points(geo, mat);
  group.add(pts);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), color: colorHex, transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*2.2, ringRadius*2.2, 1); group.add(glow);
  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.0045 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, pts, mat, rotationSpeed };
}

/* Build orbs arranged around center but all part of same orbit. No groups of 3. */
const totalOrbs = GENRES.length;
for (let i=0;i<totalOrbs;i++){
  const g = GENRES[i];
  const color = new THREE.Color(g.color);
  const coreRadius = 30 + Math.random()*8;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 64, 64);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent:true, opacity:0.28, roughness:0.16, metalness:0.08,
    transmission:0.7, emissive: color.clone().multiplyScalar(0.02), emissiveIntensity:0.6, clearcoat:0.25, depthWrite:false
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  // rim glow sprite
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*9.6, coreRadius*9.6, 1); coreMesh.add(rim);

  // container for positioning and ring
  const container = new THREE.Group();
  container.add(coreMesh);

  // place in circle
  const baseAngle = (i/totalOrbs) * Math.PI*2;
  const phaseShift = (Math.random() * Math.PI*0.9) - 0.45; // staggered
  const clusterR = clusterRadius;
  container.userData = { baseAngle, phaseShift, idx: i };

  // tilt ring randomly
  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  // alternate counter direction per orb for variety
  const ccw = (i % 2 === 0);
  const ring = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random()*120), 10.0, ccw);
  container.add(ring.group);

  // gas halo
  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.055, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx:i, container, core:coreMesh, ringObj: ring, gas: gasMesh, baseAngle };
}

/* ---------- Aurora / smoke (multi-color) ---------- */
function createAuroraCanvas(stops, size=1700){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(size/2,size/2,30,size/2,size/2,size*0.9);
  stops.forEach(s=> g.addColorStop(s.offset, s.color));
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
const backStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.18, color:'rgba(80,20,200,0.12)'},
  {offset:0.48, color:'rgba(30,160,200,0.08)'},
  {offset:0.78, color:'rgba(240,90,170,0.06)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];
const frontStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.2, color:'rgba(200,40,140,0.10)'},
  {offset:0.5, color:'rgba(80,40,220,0.12)'},
  {offset:0.85, color:'rgba(30,180,200,0.10)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];
const backTex = createAuroraCanvas(backStops, 2200);
const backSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:backTex, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false }));
backSprite.scale.set(3600,2000,1); backSprite.position.set(0,-240,-3400); scene.add(backSprite);

const frontTex = createAuroraCanvas(frontStops, 1800);
const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:frontTex, transparent:true, opacity:0.34, blending:THREE.AdditiveBlending, depthWrite:false }));
frontSprite.scale.set(2600,1300,1); frontSprite.position.set(80,60,-520); scene.add(frontSprite);

/* corner gas */
const cornerDefs = [
  {x:-1.0,y:-1.0,c:'rgba(160,40,220,0.18)'},
  {x:1.0,y:-0.9,c:'rgba(40,200,220,0.12)'},
  {x:-0.9,y:1.0,c:'rgba(240,120,100,0.10)'},
  {x:0.9,y:0.9,c:'rgba(100,120,255,0.08)'}
];
const cornerSprites = [];
cornerDefs.forEach((d,i)=>{
  const tex = createAuroraCanvas([{offset:0,color:d.c},{offset:1,color:'rgba(0,0,0,0)'}], 1000);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:0.14 + Math.random()*0.06, blending:THREE.AdditiveBlending, depthWrite:false }));
  spr.scale.set(1000,1000,1);
  const px = d.x * 1500 * (0.6 + Math.random()*0.4);
  const py = d.y * 900 * (0.6 + Math.random()*0.4);
  spr.position.set(px,py,-520);
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- Raycasting & pointer ---------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let activeOverlayGenre = null;

function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
  ndc.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
  raycaster.setFromCamera(ndc, camera);
  // find sphere geometries
  const cores = [];
  ORB_GROUP.children.forEach(c => c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    // find parent container
    let parent = null;
    for (const c of ORB_GROUP.children) { if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)){ parent = c; break; } }
    if (parent){
      const found = Object.values(ORB_MESHES).find(o => o.container === parent);
      if (found) {
        // show centered overlay (music + prompt)
        showOverlayForGenre(found.id);
      }
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- flash feedback ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const mat = o.core.material; const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.8, orig*2.8);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ---------- compute top list ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const per = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r=>{ const k=(r.artist||'').trim(); if(!k) return; counts[k] = (counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    per[g.id] = sorted; updateOrbHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });
  const sel = genreSelect.value || GENRES[0].id;
  const arr = per[sel] || []; let html = '';
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

/* ---------- Audio controller (WebAudio analyzer) ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, dataArray=null, audioEl=null, active=false;
  async function ensure(){
    if (!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
  }
  async function loadUrl(url){
    try {
      await ensure();
      if (!audioEl){
        audioEl = document.createElement('audio'); audioEl.crossOrigin='anonymous'; audioEl.controls=true; audioEl.style.width='100%';
        document.getElementById('overlayPlayerHolder').innerHTML=''; document.getElementById('overlayPlayerHolder').appendChild(audioEl);
      } else { audioEl.pause(); audioEl.src=''; }
      audioEl.src = url;
      await audioEl.play().catch(()=>{}); // user gesture may be required
      if (source) try{ source.disconnect(); } catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      return true;
    } catch(e){ console.warn('audio load failed', e); active=false; return false; }
  }
  function stop(){
    if (audioEl){ try{ audioEl.pause(); } catch(e){} }
    if (audioCtx && audioCtx.state !== 'closed') try{ audioCtx.suspend(); } catch(e){}
    active = false;
  }
  function getAmps(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    // compute low-band energy
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.03));
    let bassSum=0; for (let i=0;i<lowCount;i++) bassSum += dataArray[i];
    const bassAvg = bassSum / lowCount;
    let sum=0; for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length);
    return { bass: bassAvg/255, rms: rms/255, raw: dataArray };
  }
  return { loadUrl, stop, getAmps, isActive: ()=> active };
})();

/* ---------- Animation loop ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // audio amplitudes
  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : (0.06 + 0.02*Math.sin(t*0.6)); // default breathing if no audio
  const rms = amps ? amps.rms : (0.08 + 0.03*Math.sin(t*0.3));

  // aurora motion + pulsing (pulses more when bass)
  backSprite.rotation.z = Math.sin(t*0.03) * 0.035 + bass*0.14;
  backSprite.material.opacity = 0.42 + Math.sin(t*0.08)*0.03 + bass*0.10;
  frontSprite.rotation.z = Math.cos(t*0.12) * 0.06 - bass*0.07;
  frontSprite.material.opacity = 0.30 + Math.cos(t*0.1)*0.03 + rms*0.10;

  // corner blobs drift + slight pulse
  cornerSprites.forEach((s,i)=>{
    s.position.x += Math.sin(t*0.05 + i)*0.008 + (i-1.5)*bass*0.02;
    s.position.y += Math.cos(t*0.04 + i*1.2)*0.008 + (i-1.5)*rms*0.015;
    s.material.opacity = 0.12 + 0.04*Math.sin(t*0.7 + i) + bass*0.05;
  });

  // star layers random twinkle (update per-layer opacity + tiny jitter)
  starNear.mat.opacity = 0.55 + Math.sin(t*0.9)*0.08 + (Math.random()*0.02 - 0.01);
  starFar.mat.opacity = 0.88 + Math.cos(t*0.4)*0.04 + (Math.random()*0.02 - 0.01);

  // dust slow rotation
  dustPlane.rotation.z += 0.00012;

  // subtle camera motion so camera isn't fixed distance to cluster
  const camBaseZ = computeCameraZForCluster(clusterRadius);
  camera.position.z = camBaseZ + Math.sin(t*0.14)*8 + bass*48; // bass slightly expands view
  camera.position.x = Math.sin(t*0.03)*14 * (0.6 + rms*0.8);
  camera.position.y = Math.cos(t*0.02)*8 * (0.6 + rms*0.6);
  camera.lookAt(0,0,0);

  // animate orbs: unified orbit (not groups of 3) with staggered phases
  const orbitSpeedBase = 0.12;
  for (let i=0;i<GENRES.length;i++){
    const g = GENRES[i];
    const o = ORB_MESHES[g.id];
    if (!o) continue;
    const { baseAngle, phaseShift } = o.container.userData;
    const speed = orbitSpeedBase + i*0.02;
    const nx = Math.cos(t*speed + baseAngle + phaseShift) * clusterRadius;
    const ny = Math.sin(t*speed*1.05 + baseAngle*1.3 + phaseShift*0.6) * (clusterRadius*0.38);
    // alternate small counter-phase for some orbs to give crossing motion
    const alt = (i % 2 === 0) ? 1 : -1;
    o.container.position.x = nx + alt * bass * 12;
    o.container.position.y = ny + rms * 8;
    o.container.position.z = Math.sin(t*(0.6 + i*0.03))*8;

    // core spin
    o.core.rotation.y += 0.002 + i*0.00018;
    o.core.rotation.x += 0.0012;

    // ring counter-rotation and reaction to music
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass*0.5);
    o.ringObj.mat.opacity = 0.8 - Math.abs(Math.sin(t*0.6 + i))*0.18 + rms*0.18;
    o.gas.material.opacity = 0.045 + 0.01*Math.sin(t*0.9 + i) + bass*0.015;

    // rim sprite pulse
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.18 + rms*0.26; });
  }

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize handling ---------- */
window.addEventListener('resize', ()=>{
  clusterRadius = Math.min(420, Math.max(280, Math.min(window.innerWidth, window.innerHeight) * 0.26));
  camera.position.z = computeCameraZForCluster(clusterRadius);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- Init ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 900);

/* ---------- End of file ---------- */

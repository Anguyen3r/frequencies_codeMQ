/* Combined app.js — merged: gray-bubble visuals + stardust/smoke + audio + overlay + persistence
   Replace your existing app.js with this file. Requires Three.js included in index.html.
   Firebase optional (set FIREBASE_CONFIG to your config object to enable realtime DB).
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // set to config object to enable Firebase (optional)

/* ---------- Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex,a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Persistence (Firebase optional / local fallback) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase connected');
  } catch(e){ console.warn('Firebase init failed; using localStorage', e); useFirebase=false; }
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
  }
  return JSON.parse(localStorage.getItem('codemq_votes') || '{}');
}
if (!useFirebase) window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* ---------- UI refs (must match your index.html) ---------- */
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');

const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');

const legendList = document.getElementById('legendList');

/* ---------- Genres & Colors ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79 },
  { id:'house', name:'House', color:0xffbf5f },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },
  { id:'electronic', name:'Electronic', color:0x9f5fff },
  { id:'mainstream', name:'Mainstream/International', color:0xffffff }
];

/* populate the UI options & legend */
GENRES.forEach(g=>{
  const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
  const li = document.createElement('li'); li.textContent=g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
  li.style.color = lum >= 128 ? '#000' : '#fff';
  legendList.appendChild(li);
});
toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));

/* ---------- overlay UI (centered prompt + audio loader) ---------- */
const overlay = document.createElement('div');
overlay.id = 'centerOverlay';
overlay.style.cssText = `
  position:fixed; left:50%; top:50%; transform:translate(-50%,-50%);
  z-index:9999; min-width:420px; max-width:88vw; padding:18px; border-radius:12px;
  backdrop-filter:blur(6px); background:rgba(8,10,16,0.86); border:1px solid rgba(255,255,255,0.04);
  box-shadow:0 20px 60px rgba(0,0,0,0.6); display:none; color:#fff;
`;
overlay.innerHTML = `
  <button id="overlayClose" style="position:absolute;right:12px;top:10px;border:none;background:transparent;color:#dfefff;font-size:20px;cursor:pointer">✕</button>
  <div style="display:grid;gap:10px">
    <h2 id="overlayTitle" style="margin:0;font-weight:600">Genre</h2>
    <div style="display:flex;flex-direction:column;gap:8px">
      <input id="overlayArtist" placeholder="Favorite artist (required)" style="padding:10px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff" />
      <input id="overlayB2B" placeholder="Dream B2B (optional)" style="padding:10px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff" />
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="overlayCancel" style="padding:8px 10px;border-radius:8px;border:none;background:transparent;color:#fff">Cancel</button>
        <button id="overlaySubmit" style="padding:8px 12px;border-radius:8px;border:none;background:#1db954;color:#fff">Submit</button>
      </div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.03)" />
      <div style="display:flex;flex-direction:column;gap:6px">
        <input id="overlayAudioUrl" placeholder="Direct audio URL (mp3/ogg) — optional" style="padding:8px;border-radius:6px;border:none;background:rgba(255,255,255,0.03);color:#fff" />
        <div style="display:flex;gap:8px">
          <input type="file" id="overlayFileInput" accept="audio/*" style="display:none" />
          <button id="overlayLoadFile" style="padding:8px;border-radius:6px;border:none;background:#3b82f6;color:#fff">Load local file</button>
          <button id="overlayLoadUrl" style="padding:8px;border-radius:6px;border:none;background:#ef476f;color:#fff">Load URL</button>
          <button id="overlayStop" style="padding:8px;border-radius:6px;border:none;background:#777;color:#fff">Stop</button>
        </div>
        <div id="overlayPlayerHolder" style="margin-top:6px"></div>
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
  if (!url) return alert('Paste a direct audio file URL (mp3/ogg).');
  const ok = await audioController.loadUrl(url);
  if (!ok) alert('Unable to load audio (CORS or unsupported).');
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
let activeOverlayGenre = null;
function showOverlayForGenre(genreId){
  activeOverlayGenre = genreId;
  const g = GENRES.find(x=>x.id===genreId);
  document.getElementById('overlayTitle').textContent = g ? g.name : 'Genre';
  document.getElementById('overlayArtist').value=''; document.getElementById('overlayB2B').value='';
  overlay.style.display='block';
  setTimeout(()=> document.getElementById('overlayArtist').focus(), 120);
}
function hideOverlay(){ overlay.style.display='none'; activeOverlayGenre = null; audioController.stop(); spotifyEmbed.innerHTML=''; }

/* ---------- Three.js setup ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000012, 0.00008);

/* Camera — set to emulate the gray version framing (fixed) */
const CAMERA_FOV = 48;
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth/window.innerHeight, 0.1, 12000);
/* Use a fixed camera Z chosen to match the gray feel — not dynamically zooming */
const CAMERA_Z_GRAY = 420; // tuned to match the gray version framing
camera.position.set(0, 18, CAMERA_Z_GRAY);
camera.lookAt(0,0,0);

/* Renderer */
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

/* Lighting — slightly toned down for the gray subtle look */
const ambient = new THREE.AmbientLight(0xffffff, 0.42); scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.7); dir.position.set(10,20,10); scene.add(dir);

/* ---------- star layers (twinkle) ---------- */
function makeStarLayer(count, sx=7000, sy=4200, sz=7000, size=1.2, opacity=0.86){
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count*3);
  for (let i=0;i<count;i++){
    positions[i*3] = (Math.random()-0.5)*sx;
    positions[i*3+1] = (Math.random()-0.5)*sy;
    positions[i*3+2] = -Math.random()*sz - 200;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const pts = new THREE.Points(geo, mat);
  return { pts, mat };
}
const starFar = makeStarLayer(2000,7000,4200,7000,1.2,0.82);
const starNear = makeStarLayer(900,3800,2400,3800,1.9,0.56);
scene.add(starFar.pts, starNear.pts);

/* dust plane far behind (subtle) */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(9000,5000), new THREE.MeshBasicMaterial({ map:dustTex, transparent:true, opacity:0.036, depthWrite:false }));
dustPlane.position.set(0,0,-3200);
scene.add(dustPlane);

/* ---------- helper procedural textures ---------- */
function generateGlowTexture(colorHex){
  const size = 256; const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,8,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)'); grad.addColorStop(0.2,'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5,toCssRgba(colorHex,0.34)); grad.addColorStop(1,'rgba(0,0,0,0)');
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
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }

/* ---------- ORBS + RINGS setup (gray core + colored rim + rings) ---------- */
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};
/* bubble size modifiers per request: +30% scale vs prior baseline and 15% less transparent */
const BUBBLE_SCALE_FACTOR = 1.30;
const OPACITY_BOOST = 1.15;

/* creates ring (stardust) */
function createStardustRing(coreRadius, colorHex, tilt, particleCount=220, size=8.0, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.6);
  const positions = new Float32Array(particleCount*3);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount)*Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5)*(coreRadius*0.36);
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5)*(coreRadius*0.45);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.82, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.85);
  const pts = new THREE.Points(geo, mat);
  group.add(pts);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), color: colorHex, transparent:true, opacity:0.10, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*1.8, ringRadius*1.8, 1); group.add(glow);
  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.0038 + Math.random()*0.0045;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, pts, mat, rotationSpeed };
}

/* Build orbs — gray core material + colored rim + ring */
const BASE_CORE_RADIUS = 30; // base before scale
for (let i=0;i<GENRES.length;i++){
  const g = GENRES[i];
  const coreRadius = BASE_CORE_RADIUS * (0.9 + Math.random()*0.2); // slight variance
  const scaledRadius = coreRadius * BUBBLE_SCALE_FACTOR;

  const coreGeo = new THREE.SphereGeometry(scaledRadius, 64, 64);
  // Gray base color material (restores gray-look)
  const grayHex = 0xbfbfbf;
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: grayHex,
    transparent: true,
    opacity: Math.min(0.98, 0.34 * OPACITY_BOOST), // slightly less transparent
    roughness: 0.18,
    metalness: 0.06,
    transmission: 0.55,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.2,
    clearcoat: 0.08,
    depthWrite:false
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);

  // rim sprite colored to match genre, subtle
  const rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.16, blending:THREE.AdditiveBlending, depthWrite:false }));
  rimSprite.scale.set(scaledRadius*9.2, scaledRadius*9.2, 1);
  coreMesh.add(rimSprite);

  const container = new THREE.Group();
  container.add(coreMesh);

  // base orbit placement circular, all together as requested
  const baseAngle = (i / GENRES.length) * Math.PI*2;
  const clusterR = Math.min(420, Math.max(320, Math.min(window.innerWidth, window.innerHeight) * 0.28));
  container.position.set(Math.cos(baseAngle)*clusterR, Math.sin(baseAngle)*clusterR*0.55, -i*6);

  // ring tilt variety and create ring
  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/4, y:(Math.random()*0.9 - 0.45)*Math.PI/6, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  const ccw = (i % 2 === 0);
  const ringObj = createStardustRing(scaledRadius, g.color, tilt, 220 + Math.floor(Math.random()*100), 9.0, ccw);
  container.add(ringObj.group);

  // gas halo subtle
  const gasGeo = new THREE.SphereGeometry(scaledRadius*1.9, 24, 24);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.052, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx:i, container, core:coreMesh, ringObj, gas:gasMesh, baseAngle, scaledRadius, clusterR };
}

/* add group to scene */
scene.add(ORB_GROUP);

/* ---------- aurora / smoke (soft multi-color behind + front) ---------- */
function buildAuroraTexture(stops, size=1600){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(size/2,size/2,30,size/2,size/2,size*0.9);
  stops.forEach(s=> g.addColorStop(s.offset, s.color));
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
const backStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.2, color:'rgba(70,28,160,0.08)'},
  {offset:0.5, color:'rgba(28,140,170,0.05)'},
  {offset:0.85, color:'rgba(200,80,170,0.03)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];
const frontStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.2, color:'rgba(170,30,110,0.06)'},
  {offset:0.5, color:'rgba(70,30,200,0.06)'},
  {offset:0.85, color:'rgba(30,150,170,0.05)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];
const backTex = buildAuroraTexture(backStops, 2200);
const backSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:backTex, transparent:true, opacity:0.34, blending:THREE.AdditiveBlending, depthWrite:false }));
backSprite.scale.set(3200,1800,1); backSprite.position.set(0,-240,-3200); scene.add(backSprite);

const frontTex = buildAuroraTexture(frontStops, 1800);
const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:frontTex, transparent:true, opacity:0.24, blending:THREE.AdditiveBlending, depthWrite:false }));
frontSprite.scale.set(2400,1200,1); frontSprite.position.set(80,60,-540); scene.add(frontSprite);

/* corner gas (subtle) */
const cornerDefs = [
  {x:-1, y:-1, c:'rgba(140,40,220,0.12)'},
  {x:1, y:-0.9, c:'rgba(40,160,200,0.09)'},
  {x:-0.9, y:1, c:'rgba(220,100,80,0.07)'},
  {x:0.9, y:0.9, c:'rgba(90,100,240,0.06)'}
];
const cornerSprites = [];
cornerDefs.forEach((d,i)=>{
  const t = buildAuroraTexture([{offset:0,color:d.c},{offset:1,color:'rgba(0,0,0,0)'}], 900);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, transparent:true, opacity:0.10 + Math.random()*0.04, blending:THREE.AdditiveBlending, depthWrite:false }));
  spr.scale.set(900,900,1);
  spr.position.set(d.x*1400*(0.6+Math.random()*0.3), d.y*800*(0.6+Math.random()*0.3), -520);
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- raycasting for bubble clicks (shows overlay) ---------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
  ndc.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const cores = [];
  ORB_GROUP.children.forEach(c => c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length>0){
    let hit = hits[0].object;
    let parent = null;
    for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c===hit || c.children.includes(hit.parent)){ parent=c; break; } }
    if (parent){
      const found = Object.values(ORB_MESHES).find(o => o.container === parent);
      if (found) showOverlayForGenre(found.id);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- flash feedback (on vote) ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const orig = o.core.material.emissiveIntensity || 0.2;
  o.core.material.emissiveIntensity = Math.max(1.6, orig*2.6);
  setTimeout(()=> { o.core.material.emissiveIntensity = orig; }, 900);
}

/* ---------- compute top list ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r => { const k=(r.artist||'').trim(); if(!k) return; counts[k] = (counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    // update top list UI for selected genre
    if (genreSelect.value === g.id){
      const topArr = sorted;
      let html='';
      for (let i=0;i<Math.min(50,topArr.length);i++) html += `<div class="row"><strong>${i+1}. ${escapeHtml(topArr[i].artist)}</strong><span class="score">${topArr[i].count}</span></div>`;
      if(!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
      topList.innerHTML = html;
    }
    // highlight orb based on top count
    const topCount = sorted[0] ? sorted[0].count : 0;
    updateOrbHighlight(g.id, topCount);
  });
}
function updateOrbHighlight(genreId, topCount){
  const o = ORB_MESHES[genreId]; if(!o) return;
  const val = Math.min(3.2, 0.45 + Math.log10(1 + topCount)*0.8);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.45, Math.log10(1 + topCount)*0.11);
  o.core.scale.set(base, base, base);
}

/* ---------- audio controller (WebAudio analyzer) ---------- */
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
      audioEl.src = url; await audioEl.play().catch(()=>{});
      if (source) try{ source.disconnect(); } catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser); analyser.connect(audioCtx.destination);
      active = true; return true;
    } catch(e){ console.warn('audio load error', e); active=false; return false; }
  }
  function stop(){ if (audioEl){ try{ audioEl.pause(); }catch(e){} } if (audioCtx && audioCtx.state !== 'closed'){ try{ audioCtx.suspend(); }catch(e){} } active=false; }
  function getAmps(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.03));
    let bassSum=0; for (let i=0;i<lowCount;i++) bassSum += dataArray[i];
    const bassAvg = bassSum / lowCount;
    let sum=0; for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length);
    return { bass: bassAvg/255, rms: rms/255, raw: dataArray };
  }
  return { loadUrl, stop, getAmps, isActive: ()=> active };
})();

/* ---------- animation loop: dreamier, slower motion; rings counter-rotate; smoke pulses ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // audio-driven amplitude or default breathing if none
  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : (0.06 + 0.02*Math.sin(t*0.7));
  const rms = amps ? amps.rms : (0.08 + 0.03*Math.sin(t*0.35));

  // aurora subtle pulsing
  backSprite.rotation.z = Math.sin(t*0.03)*0.025 + bass*0.10;
  backSprite.material.opacity = 0.30 + Math.sin(t*0.08)*0.02 + bass*0.07;
  frontSprite.rotation.z = Math.cos(t*0.12)*0.045 - bass*0.05;
  frontSprite.material.opacity = 0.22 + Math.cos(t*0.1)*0.02 + rms*0.07;

  // corner subtle float
  cornerSprites.forEach((s,i)=>{
    s.position.x += Math.sin(t*0.045 + i)*0.006 + (i-1.5)*bass*0.012;
    s.position.y += Math.cos(t*0.035 + i*1.2)*0.006 + (i-1.5)*rms*0.009;
    s.material.opacity = 0.10 + 0.025*Math.sin(t*0.7 + i) + bass*0.035;
  });

  // stars twinkle (randomized small jitter)
  starNear.mat.opacity = 0.48 + Math.sin(t*0.9)*0.05 + (Math.random()*0.01 - 0.005);
  starFar.mat.opacity = 0.82 + Math.cos(t*0.4)*0.025 + (Math.random()*0.01 - 0.005);

  // dust slow rotation
  dustPlane.rotation.z += 0.00006;

  // camera is fixed to CAMERA_Z_GRAY, small gentle bob for dreaminess (not zooming)
  const bobX = Math.sin(t*0.02)*6*(0.6 + rms*0.8);
  const bobY = Math.cos(t*0.02)*3*(0.6 + rms*0.6);
  camera.position.x = bobX;
  camera.position.y = bobY + 12; // slight lift for depth feel
  camera.lookAt(0,0,0);

  // unified orbit for orbs (slower "dreamier" speed)
  const orbitBase = 0.06; // slow
  for (let i=0;i<GENRES.length;i++){
    const g = GENRES[i];
    const o = ORB_MESHES[g.id]; if (!o) continue;
    const { baseAngle, phaseShift, clusterR } = o;
    const speed = orbitBase + i*0.008;
    const nx = Math.cos(t*speed + baseAngle + phaseShift) * clusterR;
    const ny = Math.sin(t*speed*1.03 + baseAngle*1.15 + phaseShift*0.45) * (clusterR*0.40);
    const alt = (i % 2 === 0) ? 1 : -1;
    o.container.position.x = nx + alt*bass*6;
    o.container.position.y = ny + rms*5;
    o.container.position.z = Math.sin(t*(0.45 + i*0.02))*5;

    // core slow spin
    o.core.rotation.y += 0.0016 + i*0.00008;
    o.core.rotation.x += 0.0008;

    // rings rotate opposite, react modestly to bass
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass*0.25);
    o.ringObj.mat.opacity = 0.75 - Math.abs(Math.sin(t*0.5 + i))*0.10 + rms*0.12;

    // gas breathing
    o.gas.material.opacity = 0.038 + 0.007*Math.sin(t*0.9 + i) + bass*0.01;

    // rim sprite subtle pulse
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.13 + rms*0.16; });
  }

  renderer.render(scene, camera);
}
animate();

/* ---------- resize handler ---------- */
window.addEventListener('resize', ()=>{
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
});

/* ---------- init UI + data ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());

/* quick check for orbs existence */
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 800);

/* ---------- END of file ---------- */

/* app.js — MERGED: gray-bubble base + stardust rings + aurora smoke + twinkling stars + overlay UI
   Requirements: index.html includes Three.js (global THREE) and has #canvasWrap and the UI panel items used previously.
   Persistence: localStorage (codemq_votes). No Firebase by default.
*/

/* ------------------- CONFIG ------------------- */
const FIREBASE_CONFIG = null; // leave null unless you want to enable Firebase
const GENRES = [
  { id: 'techno', name: 'Hard / Techno', color: 0xff4f79 },
  { id: 'house', name: 'House', color: 0xffbf5f },
  { id: 'dnb', name: 'Drum & Bass', color: 0x5fff85 },
  { id: 'dubstep', name: 'Dubstep', color: 0x5fc9ff },
  { id: 'electronic', name: 'Electronic', color: 0x9f5fff },
  { id: 'mainstream', name: 'Mainstream/International', color: 0xffffff }
];

/* ------------------- persistence (localStorage) ------------------- */
async function saveVote(genreId, artistName, b2b) {
  const key = 'codemq_votes';
  const data = JSON.parse(localStorage.getItem(key) || '{}');
  data[genreId] = data[genreId] || [];
  data[genreId].push({ artist: (artistName||'').trim(), b2b: (b2b||'').trim(), ts: Date.now() });
  if (data[genreId].length > 20000) data[genreId].splice(0, data[genreId].length - 20000);
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('codemq_local_update'));
}
async function readAllVotesOnce() {
  return JSON.parse(localStorage.getItem('codemq_votes') || '{}');
}

/* ------------------- UI references ------------------- */
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');
const legendList = document.getElementById('legendList');
const spotifyEmbed = document.getElementById('spotifyEmbed'); // left but we'll keep it empty

// fill selects & legend
if (genreSelect) {
  GENRES.forEach(g => {
    const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.name; genreSelect.appendChild(opt);
  });
}
if (legendList) {
  GENRES.forEach(g => {
    const li = document.createElement('li'); li.textContent = g.name;
    // subtle pill color
    li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
    li.style.color = getContrastColor(g.color);
    legendList.appendChild(li);
  });
}
if (toggleTop && leftPanel) toggleTop.addEventListener('click', () => leftPanel.classList.toggle('hidden'));

/* ------------------- Overlay UI (center prompt) ------------------- */
const overlay = document.createElement('div');
overlay.id = 'codemq_overlay';
overlay.style.cssText = `
  position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
  z-index:9999;min-width:380px;max-width:88vw;padding:14px;border-radius:12px;
  backdrop-filter:blur(6px);background:rgba(6,8,15,0.9);border:1px solid rgba(255,255,255,0.03);
  display:none;color:#e6eef8;
`;
overlay.innerHTML = `
  <button id="overlayClose" style="position:absolute;right:10px;top:8px;border:none;background:transparent;color:#dfefff;font-size:18px;cursor:pointer">✕</button>
  <h3 id="overlayTitle" style="margin:6px 0 8px 0;">Genre</h3>
  <input id="overlayArtist" placeholder="Favorite artist (required)" style="width:100%;padding:10px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff;margin-bottom:8px" />
  <input id="overlayB2B" placeholder="Dream B2B (optional)" style="width:100%;padding:10px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff;margin-bottom:8px" />
  <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
    <button id="overlayCancel" style="padding:8px 12px;border-radius:8px;border:none;background:transparent;color:#fff">Cancel</button>
    <button id="overlaySubmit" style="padding:8px 12px;border-radius:8px;border:none;background:#1db954;color:#fff">Submit</button>
  </div>
`;
document.body.appendChild(overlay);
document.getElementById('overlayClose').addEventListener('click', hideOverlay);
document.getElementById('overlayCancel').addEventListener('click', hideOverlay);
document.getElementById('overlaySubmit').addEventListener('click', async () => {
  const artist = document.getElementById('overlayArtist').value.trim();
  if (!artist) { document.getElementById('overlayArtist').focus(); return; }
  const b2b = document.getElementById('overlayB2B').value.trim();
  if (!currentOverlayGenre) return hideOverlay();
  await saveVote(currentOverlayGenre, artist, b2b);
  flashOrb(currentOverlayGenre);
  computeAndRenderTop();
  hideOverlay();
});
let currentOverlayGenre = null;
function showOverlayForGenre(genreId) {
  currentOverlayGenre = genreId;
  const g = GENRES.find(x => x.id === genreId);
  document.getElementById('overlayTitle').textContent = g ? g.name : 'Genre';
  document.getElementById('overlayArtist').value = '';
  document.getElementById('overlayB2B').value = '';
  overlay.style.display = 'block';
  setTimeout(() => document.getElementById('overlayArtist').focus(), 120);
}
function hideOverlay() { overlay.style.display = 'none'; currentOverlayGenre = null; }

/* ------------------- helpers ------------------- */
function toCssHex(n) { return '#' + ('000000' + (n.toString(16))).slice(-6); }
function getContrastColor(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const yiq = (r*299 + g*587 + b*114)/1000;
  return yiq >= 128 ? '#000' : '#fff';
}
function escapeHtml(s) { return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ------------------- Three.js scene (MAIN) ------------------- */
const wrap = document.getElementById('canvasWrap') || (function(){ const d=document.createElement('div'); d.id='canvasWrap'; document.body.appendChild(d); return d; })();

// Scene/camera/renderer
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000011, 0.00006);

// cluster sizing & camera framing that emulates the gray version
let clusterRadius = Math.min(420, Math.max(300, Math.min(window.innerWidth, window.innerHeight) * 0.28));
function computeCameraZForCluster(clusterRadius) {
  const fov = THREE.MathUtils.degToRad(48);
  const desiredFraction = 0.6; // cluster ~60% of height (like original)
  const clusterVisibleHeight = clusterRadius * 2 / desiredFraction;
  const z = clusterVisibleHeight / (2 * Math.tan(fov/2));
  return Math.max(z, 420);
}
const camera = new THREE.PerspectiveCamera(48, window.innerWidth/window.innerHeight, 0.1, 12000);
camera.position.set(0, 18, computeCameraZForCluster(clusterRadius));
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

/* lights */
const ambient = new THREE.AmbientLight(0xffffff, 0.44); scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(10,20,10); scene.add(dir);

/* star layers (twinkle) */
function makeStarLayer(count, spreadX=7000, spreadY=4200, spreadZ=7000, size=1.2, opacity=0.82) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5)*spreadX;
    pos[i*3+1] = (Math.random()-0.5)*spreadY;
    pos[i*3+2] = -Math.random()*spreadZ - 200;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const pts = new THREE.Points(g, mat);
  return { pts, mat };
}
const starFar = makeStarLayer(2000,7000,4200,7000,1.2,0.88);
const starNear = makeStarLayer(900,3800,2400,3800,1.9,0.56);
scene.add(starFar.pts, starNear.pts);

/* subtle background dust plane (very far) */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(9000,5000), new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.04, depthWrite:false }));
dustPlane.position.set(0,0,-3200);
scene.add(dustPlane);

/* --- procedural textures for glow & star particles --- */
function generateGlowTexture(colorHex) {
  const size = 256;
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,8,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.2,'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5,toCssRgba(colorHex,0.32));
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.2,'rgba(255,255,255,0.9)'); g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s); return new THREE.CanvasTexture(c);
}
function toCssRgba(hex,a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }

/* ------------------- Gray-style bubbles (base) + rings + gas ------------------- */
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {}; // keyed by id

const BASE_CORE_RADIUS = 30; // baseline before scale
const BUBBLE_SCALE_FACTOR = 1.30; // per request
const OPACITY_BOOST = 1.15;

GENRES.forEach((g, i) => {
  const coreRadius = BASE_CORE_RADIUS * (0.95 + Math.random()*0.12);
  const scaledRadius = coreRadius * BUBBLE_SCALE_FACTOR;
  const coreGeo = new THREE.SphereGeometry(scaledRadius, 64, 64);
  const grayHex = 0xbfbfbf;

  const coreMat = new THREE.MeshPhysicalMaterial({
    color: grayHex,
    transparent: true,
    opacity: Math.min(0.98, 0.34 * OPACITY_BOOST),
    roughness: 0.18,
    metalness: 0.06,
    transmission: 0.55,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.2,
    clearcoat: 0.08,
    depthWrite: false
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);

  // colored rim sprite
  const rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.16, blending: THREE.AdditiveBlending, depthWrite:false }));
  rimSprite.scale.set(scaledRadius*9.2, scaledRadius*9.2, 1);
  coreMesh.add(rimSprite);

  const container = new THREE.Group();
  container.add(coreMesh);

  // initial circular placement (centered cluster)
  const baseAngle = (i / GENRES.length) * Math.PI * 2;
  container.position.set(Math.cos(baseAngle) * clusterRadius, Math.sin(baseAngle) * clusterRadius * 0.55, -i*5);
  container.userData = { baseAngle, phaseShift: (Math.random()*0.9 - 0.45), idx: i, clusterR: clusterRadius };

  // ring tilt variety + ring creation
  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/3, y:(Math.random()*0.9 - 0.45)*Math.PI/6, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  const ccw = (i % 2 === 0);
  const ringObj = createStardustRing(scaledRadius, g.color, tilt, 220 + Math.floor(Math.random()*120), 9.6, ccw);
  container.add(ringObj.group);

  // gas halo
  const gasGeo = new THREE.SphereGeometry(scaledRadius*1.9, 24, 24);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.052, blending: THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id: g.id, idx: i, container, core: coreMesh, ringObj, gas: gasMesh, baseAngle, scaledRadius };
});

function createStardustRing(coreRadius, colorHex, tilt, particleCount=260, size=9.0, counterClockwise=true) {
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.8);
  const pos = new Float32Array(particleCount*3);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5)*(coreRadius*0.4);
    pos[i*3] = Math.cos(theta)*rr; pos[i*3+1] = Math.sin(theta)*rr; pos[i*3+2] = (Math.random()-0.5)*(coreRadius*0.45);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.88, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.95);
  const pts = new THREE.Points(geo, mat);
  group.add(pts);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), color: colorHex, transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*2.0, ringRadius*2.0, 1);
  group.add(glow);
  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.004 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, pts, mat, rotationSpeed };
}

/* ------------------- Aurora / smoke layers (back + front + corner) ------------------- */
function makeAuroraTexture(stops, size=1600){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2,size/2,20,size/2,size/2,size*0.9);
  stops.forEach(s => g.addColorStop(s.offset, s.color));
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
const backStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.18, color:'rgba(70,20,160,0.12)'},
  {offset:0.48, color:'rgba(30,160,170,0.06)'},
  {offset:0.78, color:'rgba(240,90,170,0.04)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];
const frontStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.2, color:'rgba(200,40,140,0.08)'},
  {offset:0.5, color:'rgba(80,40,220,0.08)'},
  {offset:0.85, color:'rgba(30,180,200,0.06)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];
const backTex = makeAuroraTexture(backStops, 2200);
const backSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: backTex, transparent:true, opacity:0.34, blending:THREE.AdditiveBlending, depthWrite:false }));
backSprite.scale.set(3200,1800,1); backSprite.position.set(0,-240,-3200); scene.add(backSprite);

const frontTex = makeAuroraTexture(frontStops, 1800);
const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent:true, opacity:0.24, blending:THREE.AdditiveBlending, depthWrite:false }));
frontSprite.scale.set(2400,1200,1); frontSprite.position.set(60,40,-520); scene.add(frontSprite);

const cornerDefs = [
  {x:-1.0,y:-1.0,c:'rgba(160,40,220,0.12)'},
  {x:1.0,y:-0.9,c:'rgba(40,200,220,0.10)'},
  {x:-0.9,y:1.0,c:'rgba(240,120,100,0.08)'},
  {x:0.9,y:0.9,c:'rgba(100,120,255,0.06)'}
];
const cornerSprites = [];
cornerDefs.forEach((d,i) => {
  const tex = makeAuroraTexture([{offset:0,color:d.c},{offset:1,color:'rgba(0,0,0,0)'}], 900);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity: 0.10 + Math.random()*0.05, blending:THREE.AdditiveBlending, depthWrite:false }));
  spr.scale.set(900,900,1);
  spr.position.set(d.x * 1200 * (0.6 + Math.random()*0.3), d.y * 700 * (0.6 + Math.random()*0.3), -520);
  scene.add(spr); cornerSprites.push(spr);
});

/* ------------------- Raycasting -> overlay (click bubble) ------------------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
  mouse.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
  raycaster.setFromCamera(mouse, camera);
  // find sphere meshes
  const cores = [];
  ORB_GROUP.children.forEach(c => c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0) {
    let hit = hits[0].object;
    // find parent container
    let parent = null;
    for (const c of ORB_GROUP.children) { if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent) {
      const found = Object.values(ORB_MESHES).find(o => o.container === parent);
      if (found) showOverlayForGenre(found.id);
    }
  }
});

/* ------------------- Visual feedback (flash) ------------------- */
function flashOrb(genreId) {
  const o = ORB_MESHES[genreId]; if (!o) return;
  const mat = o.core.material; const orig = mat.emissiveIntensity || 0.2;
  mat.emissiveIntensity = Math.max(1.6, orig*2.6);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ------------------- compute top list UI ------------------- */
async function computeAndRenderTop() {
  const raw = await readAllVotesOnce();
  const per = {};
  GENRES.forEach(g => {
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k => arr[k]);
    const counts = {};
    arr.forEach(r => { const k = (r.artist||'').trim(); if (!k) return; counts[k] = (counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a => ({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    per[g.id] = sorted;
    updateOrbHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });
  const sel = (genreSelect && genreSelect.value) ? genreSelect.value : GENRES[0].id;
  const arr = per[sel] || []; let html = '';
  for (let i=0;i<Math.min(50,arr.length);i++) html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  if (topList) topList.innerHTML = html;
}
function updateOrbHighlight(genreId, topCount) {
  const o = ORB_MESHES[genreId]; if(!o) return;
  const val = Math.min(3.2, 0.45 + Math.log10(1 + topCount)*0.8);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.45, Math.log10(1 + topCount)*0.11);
  o.core.scale.set(base, base, base);
}

/* ------------------- Audio controller (minimal fallback for breathing) ------------------- */
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
        // not adding to UI automatically (we removed Play Your Set)
      } else { audioEl.pause(); audioEl.src=''; }
      audioEl.src = url;
      await audioEl.play().catch(()=>{});
      if (source) try{ source.disconnect(); } catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser); analyser.connect(audioCtx.destination);
      active = true; return true;
    } catch(e){ console.warn('audio load error', e); active=false; return false; }
  }
  function stop(){ if (audioEl){ try{ audioEl.pause(); }catch(e){} } if (audioCtx && audioCtx.state !== 'closed'){ try{ audioCtx.suspend(); }catch(e){} } active=false; }
  function getAmps(){ if (!analyser || !dataArray) return null; analyser.getByteFrequencyData(dataArray);
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.03)); let bassSum=0; for (let i=0;i<lowCount;i++) bassSum += dataArray[i];
    const bassAvg = bassSum / lowCount; let sum=0; for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length); return { bass: bassAvg/255, rms: rms/255, raw: dataArray };
  }
  return { loadUrl, stop, getAmps, isActive: ()=> active };
})();

/* ------------------- Animation loop: gray-like motion + added visuals ------------------- */
let start = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // audio breathing fallback
  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : (0.05 + 0.02*Math.sin(t*0.6));
  const rms = amps ? amps.rms : (0.08 + 0.03*Math.sin(t*0.35));

  // aurora pulses
  backSprite.rotation.z = Math.sin(t*0.03)*0.03 + bass*0.06;
  backSprite.material.opacity = 0.30 + Math.sin(t*0.07)*0.02 + bass*0.06;
  frontSprite.rotation.z = Math.cos(t*0.12)*0.045 - bass*0.03;
  frontSprite.material.opacity = 0.22 + Math.cos(t*0.1)*0.02 + rms*0.06;

  // corner drift
  cornerSprites.forEach((s,i)=> {
    s.position.x += Math.sin(t*0.035 + i)*0.005;
    s.position.y += Math.cos(t*0.03 + i*1.2)*0.005;
    s.material.opacity = 0.10 + 0.03*Math.sin(t*0.6 + i) + bass*0.03;
  });

  // stars twinkle
  starNear.mat.opacity = 0.48 + Math.sin(t*0.9)*0.05 + (Math.random()*0.01 - 0.005);
  starFar.mat.opacity = 0.82 + Math.cos(t*0.4)*0.025 + (Math.random()*0.01 - 0.005);

  // dust rotate slightly
  dustPlane.rotation.z += 0.00005;

  // camera subtle bob (keeps gray framing)
  const camBaseZ = computeCameraZForCluster(clusterRadius);
  camera.position.z = camBaseZ + Math.sin(t*0.12)*6 + bass*18;
  camera.position.x = Math.sin(t*0.02)*6 * (0.6 + rms*0.5);
  camera.position.y = Math.cos(t*0.02)*3 * (0.6 + rms*0.5);
  camera.lookAt(0,0,0);

  // orbs unified gyroscopic orbit (this replicates the gray movement feel)
  const orbitBase = 0.06; // slow dreamy base
  GENRES.forEach((g, i) => {
    const o = ORB_MESHES[g.id]; if (!o) return;
    const { baseAngle } = o;
    const speed = orbitBase + i*0.012;
    const nx = Math.cos(t*speed + baseAngle + o.container.userData.phaseShift) * o.container.userData.clusterR;
    const ny = Math.sin(t*speed*1.03 + baseAngle*1.12 + o.container.userData.phaseShift*0.46) * (o.container.userData.clusterR*0.40);
    const alt = (i % 2 === 0) ? 1 : -1;
    o.container.position.x = nx + alt * bass * 6;
    o.container.position.y = ny + rms * 4;
    o.container.position.z = Math.sin(t*(0.6 + i*0.02))*6;

    // core gentle spin
    o.core.rotation.y += 0.0016 + i*0.00008;
    o.core.rotation.x += 0.0009;

    // ring counterrotate & subtle react
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass*0.2);
    o.ringObj.mat.opacity = 0.75 - Math.abs(Math.sin(t*0.5 + i))*0.12 + rms*0.10;
    o.gas.material.opacity = 0.038 + 0.008*Math.sin(t*0.9 + i) + bass*0.01;

    // rim sprite pulse
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.12 + rms*0.22; });
  });

  renderer.render(scene, camera);
}
animate();

/* ------------------- responsive ------------------- */
window.addEventListener('resize', () => {
  clusterRadius = Math.min(420, Math.max(300, Math.min(window.innerWidth, window.innerHeight) * 0.28));
  camera.position.z = computeCameraZForCluster(clusterRadius);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------- startup UI/data ------------------- */
computeAndRenderTop();
window.addEventListener('codemq_local_update', () => computeAndRenderTop());
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 900);

/* ------------------- EOF ------------------- */

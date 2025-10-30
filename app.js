/* app.js — updated
   - Adds per-orb 3D stardust rings (larger particles, tilted, opposite rotation)
   - Adds per-orb gas/halo spheres
   - Keeps existing UI: spotify input, top artists list, stats, localStorage/Firebase logic
   - Uses Three.js (loaded from index.html)
*/

/* ---------- CONFIG (keep FIREBASE_CONFIG null unless you use Firebase) ---------- */
const FIREBASE_CONFIG = null; // leave null to use localStorage fallback

/* ---------- Utilities (same names as your previous implementation) ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  return `rgba(${r},${g},${b},${a})`;
}
function getContrastColor(hex){
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  const yiq = (r*299 + g*587 + b*114)/1000;
  return yiq >= 128 ? '#000' : '#fff';
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Persistence: Firebase optional, else localStorage ---------- */
let dbRef = null;
let useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch (e) {
    console.warn('Firebase init failed, falling back to localStorage', e);
    useFirebase = false;
  }
}

async function saveVote(genreId, artistName, b2b) {
  const record = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef) {
    await dbRef.child(genreId).push(record);
  } else {
    const key = 'codemq_votes';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    data[genreId] = data[genreId] || [];
    data[genreId].push(record);
    if (data[genreId].length > 20000) data[genreId].splice(0, data[genreId].length - 20000);
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('codemq_local_update'));
  }
}
async function readAllVotesOnce(){
  if (useFirebase && dbRef){
    const snap = await dbRef.get();
    return snap.exists() ? snap.val() : {};
  } else {
    return JSON.parse(localStorage.getItem('codemq_votes') || '{}');
  }
}
if (!useFirebase) {
  window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());
}

/* ---------- UI References (should match your index.html) ---------- */
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');

const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');

const legendList = document.getElementById('legendList');

/* ---------- GENRES (kept same) ---------- */
const GENRES = [
  { id: 'techno', name: 'Hard / Techno', color: 0xff4f79 },
  { id: 'house',  name: 'House',         color: 0xffbf5f },
  { id: 'dnb',    name: 'Drum & Bass',  color: 0x5fff85 },
  { id: 'dubstep',name: 'Dubstep',       color: 0x5fc9ff },
  { id: 'electronic',name:'Electronic',   color: 0x9f5fff },
  { id: 'mainstream',name:'Mainstream/International', color: 0xffffff }
];

/* populate UI selects and legend */
GENRES.forEach(g => {
  const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.name;
  genreSelect.appendChild(opt);

  const li = document.createElement('li');
  li.textContent = g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  li.style.color = getContrastColor(g.color);
  legendList.appendChild(li);
});

/* toggle left panel */
toggleTop.addEventListener('click', ()=>{
  leftPanel.classList.toggle('hidden');
});

/* spotify loader */
loadSpotify.addEventListener('click', ()=>{
  const v = (spotifyInput.value||'').trim();
  spotifyEmbed.innerHTML = '';
  if (!v) return;
  let embedUrl = v;
  if (v.startsWith('spotify:playlist:')) {
    const id = v.split(':').pop();
    embedUrl = `https://open.spotify.com/embed/playlist/${id}`;
  } else if (v.includes('open.spotify.com')) {
    embedUrl = v.replace('open.spotify.com', 'open.spotify.com/embed');
  }
  spotifyEmbed.innerHTML = `<iframe src="${embedUrl}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
    <div style="margin-top:6px"><a target="_blank" rel="noreferrer" href="${embedUrl}">Open in Spotify</a></div>`;
});

/* ---------- Three.js Scene ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.0006);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 8000);
camera.position.set(0,0,120);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
wrap.appendChild(renderer.domElement);

/* lighting */
const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(8,12,10); scene.add(dir);

/* starfield */
const starGeo = new THREE.BufferGeometry();
const starCount = 1200;
const starPos = new Float32Array(starCount * 3);
for (let i=0;i<starCount;i++){
  starPos[i*3] = (Math.random()-0.5)*3000;
  starPos[i*3+1] = (Math.random()-0.5)*1800;
  starPos[i*3+2] = -Math.random()*3000;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.9 });
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

/* big dust plane (clouds texture) */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(3000, 1600),
  new THREE.MeshBasicMaterial({ map: dustTex, transparent: true, opacity: 0.06, depthWrite: false })
);
dustPlane.position.set(0,0,-1200);
scene.add(dustPlane);

/* helper textures */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,10,size/2,size/2,size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.5, toCssRgba(colorHex,0.3));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s = 64;
  const c = document.createElement('canvas'); c.width=c.height=s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.2,'rgba(255,255,255,0.9)');
  g.addColorStop(0.6,'rgba(255,255,255,0.2)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}

/* ---------- Create Orbs, Rings, Gas ---------- */
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {}; // keyed by genre id
const RINGS = [];      // store ring objects for animation
const GAS_SPHERES = []; // gas halos

GENRES.forEach((g, idx) => {
  const color = new THREE.Color(g.color);

  // CORE SPHERE (gray translucent)
  const coreRadius = 26 + (Math.random()*8); // vary size slightly
  const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xdddddd,
    transparent: true,
    opacity: 0.28,
    roughness: 0.18,
    metalness: 0.06,
    transmission: 0.7,
    clearcoat: 0.25,
    emissive: color.clone().multiplyScalar(0.02),
    emissiveIntensity: 0.6
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);

  // subtle rim sprite
  const glowTex = generateGlowTexture(g.color);
  const spriteMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent:true, opacity:0.22 });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(coreRadius*10, coreRadius*10, 1);
  coreMesh.add(sprite);

  // container for this orb and local children
  const orbContainer = new THREE.Group();
  orbContainer.add(coreMesh);

  // position them in a loose ring (cluster)
  const baseAngle = (idx / GENRES.length) * Math.PI * 2;
  const clusterRadius = 420;
  orbContainer.position.set(Math.cos(baseAngle) * clusterRadius, Math.sin(baseAngle) * clusterRadius * 0.6, -idx * 6);

  // create stardust ring (tilted ring of larger glowing particles)
  const ring = createStardustRing(coreRadius, g.color, {
    tiltX: (Math.random()*0.9 - 0.45) * Math.PI/2, // random tilt
    tiltY: (Math.random()*0.9 - 0.45) * Math.PI/2,
    tiltZ: (Math.random()*0.9 - 0.45) * Math.PI/6
  }, /*counterClockwise=*/ true);
  // place ring local to orb
  ring.group.position.set(0,0,0);
  orbContainer.add(ring.group);

  // add a soft gas sphere around orb for ambience
  const gasGeo = new THREE.SphereGeometry(coreRadius * 1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({
    color: g.color,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  orbContainer.add(gasMesh);

  // put into scene
  ORB_GROUP.add(orbContainer);

  // store refs
  ORB_MESHES[g.id] = {
    id: g.id, idx,
    container: orbContainer,
    core: coreMesh,
    sprite,
    ringObj: ring,
    gas: gasMesh,
    baseAngle
  };
});

/* ---------- Stardust ring factory ---------- */
/*
  createStardustRing(coreRadius, colorHex, tilt = {tiltX, tiltY, tiltZ}, counterClockwise)
  returns { group, particles, rotationSpeed }
*/
function createStardustRing(coreRadius, colorHex, tilt, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.6 + Math.random()*0.6); // slightly larger than core
  const particleCount = Math.floor(160 + Math.random()*160); // 160-320 per ring
  const positions = new Float32Array(particleCount * 3);
  const alphas = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);

  for (let i=0;i<particleCount;i++){
    // place evenly around circle + small radial jitter
    const theta = (i / particleCount) * Math.PI * 2;
    const rr = ringRadius + (Math.random()-0.5) * (coreRadius * 0.35);
    const x = Math.cos(theta) * rr;
    const y = Math.sin(theta) * rr;
    const z = (Math.random()-0.5) * (coreRadius * 0.25); // ring thickness
    positions[i*3] = x;
    positions[i*3+1] = y;
    positions[i*3+2] = z;

    // larger particle sizes and some alpha variety
    sizes[i] = (Math.random()*1.8 + 1.6) * (2.5); // scaled for visibility
    alphas[i] = 0.45 + Math.random()*0.45;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // store sizes & alpha in attributes in case we later use shader; for now we won't use per-vertex size in PointsMaterial
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes, 1));

  // PointsMaterial: use glow sprite (generateStarTexture) to get soft particle disc
  const mat = new THREE.PointsMaterial({
    size: 6.5,                     // larger visible size
    map: generateStarTexture(),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: false
  });
  // color by ring color with slight tint
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);

  const points = new THREE.Points(geo, mat);

  // tilt ring orientation from tilt vector
  group.rotation.set(tilt.tiltX || 0, tilt.tiltY || 0, tilt.tiltZ || 0);
  group.add(points);

  // small inner soft glow quad to give ring an aura
  const glowTex = generateGlowTexture(colorHex);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: colorHex, transparent:true, opacity:0.12, depthWrite:false, blending:THREE.AdditiveBlending }));
  glow.scale.set(ringRadius*2.4, ringRadius*2.4, 1);
  group.add(glow);

  // rotation speed: we will rotate group.z or group.y in opposite direction to orb spin
  const baseSpeed = 0.004 + Math.random() * 0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);

  return { group, points, mat, rotationSpeed };
}

/* ---------- Raycasting / Click handling (prompts) ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  // intersect ORB_GROUP children (core meshes)
  const children = [];
  ORB_GROUP.children.forEach(c => {
    c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') children.push(n); });
  });
  const intersects = raycaster.intersectObjects(children, true);
  if (intersects.length > 0){
    // map to the orb container
    let obj = intersects[0].object;
    while (obj && !obj.parent) obj = obj.parent;
    // find which orb container holds this mesh
    const container = ORB_GROUP.children.find(c => c.children.includes(obj) || c === obj || c.children.includes(obj.parent));
    if (container){
      // find genre id by matching reference
      const found = Object.values(ORB_MESHES).find(o => o.container === container);
      if (found) openPromptAnchored(found.id);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Prompt (anchored, with exit button) ---------- */
let activePrompt = null;
function closeActivePrompt(){
  if (!activePrompt) return;
  try { cancelAnimationFrame(activePrompt.raf); } catch(e){}
  try { activePrompt.dom.remove(); } catch(e){}
  activePrompt = null;
}
function openPromptAnchored(genreId){
  // close existing
  closeActivePrompt();

  const g = GENRES.find(x => x.id === genreId);
  if (!g) return;

  const dom = document.createElement('div');
  dom.className = 'prompt panel';
  dom.innerHTML = `
    <button class="closeX" aria-label="Close" style="position:absolute;right:10px;top:8px;border:none;background:transparent;color:#dfefff;font-size:18px;cursor:pointer">✕</button>
    <h4>${g.name}</h4>
    <p class="muted">Who's your favorite artist? (Dream B2B optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" />
    <input class="b2b" placeholder="Dream B2B (optional)" />
    <textarea class="why" rows="2" placeholder="Why (optional)"></textarea>
    <div class="actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn ghost cancel">Cancel</button>
      <button class="btn submit">Submit</button>
    </div>
  `;
  document.body.appendChild(dom);

  // wire close
  dom.querySelector('.closeX').addEventListener('click', ()=> closeActivePrompt());
  dom.querySelector('.cancel').addEventListener('click', ()=> closeActivePrompt());
  dom.querySelector('.submit').addEventListener('click', async ()=>{
    const artist = dom.querySelector('.artist').value.trim();
    if (!artist) { dom.querySelector('.artist').focus(); return; }
    const b2b = dom.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashOrb(genreId);
    computeAndRenderTop();
    closeActivePrompt();
  });

  // anchored orbital placement around the orb
  activePrompt = { dom, anchorGenre: genreId, angle: Math.random()*Math.PI*2, radius: 160, raf: null };
  function loop(){
    if (!activePrompt) return;
    activePrompt.angle += 0.012;
    const o = ORB_MESHES[genreId];
    if (!o) return;
    const worldPos = new THREE.Vector3();
    o.container.getWorldPosition(worldPos);
    worldPos.project(camera);
    const sx = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
    const sy = ( -worldPos.y * 0.5 + 0.5) * window.innerHeight;
    const x = sx + Math.cos(activePrompt.angle) * activePrompt.radius - dom.offsetWidth/2;
    const y = sy + Math.sin(activePrompt.angle) * activePrompt.radius - dom.offsetHeight/2;
    dom.style.left = Math.max(8, Math.min(window.innerWidth - dom.offsetWidth - 8, x)) + 'px';
    dom.style.top  = Math.max(8, Math.min(window.innerHeight - dom.offsetHeight - 8, y)) + 'px';
    activePrompt.raf = requestAnimationFrame(loop);
  }
  loop();
  setTimeout(()=> dom.querySelector('.artist').focus(), 120);
}

/* ---------- flash feedback ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId];
  if (!o) return;
  o.core.material.emissiveIntensity = 2.0;
  setTimeout(()=> o.core.material.emissiveIntensity = 0.6, 900);
}

/* ---------- Top computation & UI ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const perGenreCounts = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    // normalize if Firebase object
    if (!Array.isArray(arr)) arr = Object.keys(arr || {}).map(k => arr[k]);
    const counts = {};
    arr.forEach(r=>{
      const key = (r.artist || '').trim();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id] = sorted;
    // orb highlight scale
    const topCount = sorted[0] ? sorted[0].count : 0;
    updateOrbHighlight(g.id, topCount);
  });

  // render selected genre
  const sel = genreSelect.value || GENRES[0].id;
  const arr = perGenreCounts[sel] || [];
  let html = '';
  for (let i=0;i<Math.min(50,arr.length);i++){
    html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  }
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  topList.innerHTML = html;
}
function updateOrbHighlight(genreId, topCount){
  const o = ORB_MESHES[genreId];
  if (!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount) * 0.9);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount) * 0.12);
  o.core.scale.set(base, base, base);
}

/* ---------- Animation Loop (with ring opposite rotation) ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // subtle camera parallax or group travel
  ORB_GROUP.rotation.y = Math.sin(t*0.06) * 0.06;
  ORB_GROUP.rotation.x = Math.sin(t*0.04) * 0.03;

  // rotate star field / dust plane
  starField.rotation.z += 0.0005;
  dustPlane.rotation.z += 0.00025;

  // animate orbs and rings
  GENRES.forEach((g, idx) => {
    const o = ORB_MESHES[g.id];
    if (!o) return;

    // cluster orbit movement (Lissajous style)
    const speed = 0.12 + idx*0.02;
    const ampX = 420, ampY = 160;
    const nx = Math.cos(t * speed + idx) * ampX;
    const ny = Math.sin(t * speed * 1.05 + idx * 1.3) * ampY;
    o.container.position.x = nx;
    o.container.position.y = ny;
    o.container.position.z = Math.sin(t * (0.6 + idx*0.04)) * 8;

    // gentle rotation of core
    o.core.rotation.y += 0.002 + idx*0.0002;
    o.core.rotation.x += 0.0012;

    // ring rotates opposite direction (counterclockwise relative to core)
    // ringObj.rotationSpeed was negative when created (we used counterClockwise true)
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed; // negative -> opposite

    // make ring particles gently pulsate opacity or size
    o.ringObj.mat.opacity = 0.85 - Math.abs(Math.sin(t*0.6 + idx)) * 0.18;

    // gas sphere subtle breathing
    o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx);
  });

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------- init / bindings ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) {
  dbRef.on('value', ()=> computeAndRenderTop());
}
window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* --------------- quick sanity console --------------- */
setTimeout(()=> {
  if (!Object.keys(ORB_MESHES).length) console.error("Orbs not initialized — check script loading and Three.js availability.");
}, 800);

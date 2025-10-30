/* app.js — Enhanced version with aurora layers + larger stardust rings + zoom out
   Drop into your repo replacing old app.js. Uses Three.js already loaded by index.html.
   Preserves UI IDs and persistence logic (localStorage / Firebase optional).
*/

/* ---------- CONFIG (Firebase optional) ---------- */
const FIREBASE_CONFIG = null; // set to config object to enable Firebase

/* ---------- Small Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255; return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Persistence (Firebase or localStorage) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase ready');
  } catch(e) {
    console.warn('Firebase init failed; falling back to localStorage', e);
    useFirebase = false;
  }
}
async function saveVote(genreId, artistName, b2b){
  const record = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef) {
    await dbRef.child(genreId).push(record);
  } else {
    const KEY = 'codemq_votes';
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    data[genreId] = data[genreId] || [];
    data[genreId].push(record);
    if (data[genreId].length > 20000) data[genreId].splice(0, data[genreId].length - 20000);
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

/* ---------- UI hooks (must match index.html) ---------- */
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');

const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');

const legendList = document.getElementById('legendList');

/* ---------- Genres (same as before) ---------- */
const GENRES = [
  { id: 'techno', name: 'Hard / Techno', color: 0xff4f79 },
  { id: 'house',  name: 'House',         color: 0xffbf5f },
  { id: 'dnb',    name: 'Drum & Bass',  color: 0x5fff85 },
  { id: 'dubstep',name: 'Dubstep',       color: 0x5fc9ff },
  { id: 'electronic',name:'Electronic',   color: 0x9f5fff },
  { id: 'mainstream',name:'Mainstream/International', color: 0xffffff }
];

/* populate genre select & legend */
GENRES.forEach(g => {
  const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.name; genreSelect.appendChild(opt);
  const li = document.createElement('li'); li.textContent = g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  li.style.color = ( ( (g.color>>16&255)*299 + (g.color>>8&255)*587 + (g.color&255)*114 )/1000 >= 128 ) ? '#000' : '#fff';
  legendList.appendChild(li);
});
toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));

/* spotify embed */
loadSpotify.addEventListener('click', ()=>{
  const v = (spotifyInput.value||'').trim();
  spotifyEmbed.innerHTML = '';
  if (!v) return;
  let embedUrl = v;
  if (v.startsWith('spotify:playlist:')){
    const id = v.split(':').pop(); embedUrl = `https://open.spotify.com/embed/playlist/${id}`;
  } else if (v.includes('open.spotify.com')){
    embedUrl = v.replace('open.spotify.com','open.spotify.com/embed');
  }
  spotifyEmbed.innerHTML = `<iframe src="${embedUrl}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
  <div style="margin-top:6px"><a target="_blank" rel="noreferrer" href="${embedUrl}">Open in Spotify</a></div>`;
});

/* ---------- Three.js scene setup ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00045);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 8000);
camera.position.set(0, 0, 300); // Z increased to zoom out and show all bubbles

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

/* lighting */
const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

/* starfield (far background) */
const starGeo = new THREE.BufferGeometry();
const STAR_COUNT = 1400;
const starPos = new Float32Array(STAR_COUNT*3);
for (let i=0;i<STAR_COUNT;i++){
  starPos[i*3] = (Math.random()-0.5)*5000;
  starPos[i*3+1] = (Math.random()-0.5)*3000;
  starPos[i*3+2] = -Math.random()*5000;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent:true, opacity:0.95 });
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

/* big slow dust plane (very far back) */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(5000, 2600),
  new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity: 0.06, depthWrite: false })
);
dustPlane.position.set(0,0,-2400);
scene.add(dustPlane);

/* helper canvas textures */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,8,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.2,'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5,toCssRgba(colorHex,0.35));
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s = 64; const c = document.createElement('canvas'); c.width=c.height=s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.2,'rgba(255,255,255,0.9)'); g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}

/* ---------- ORB + RING creation (bigger rings, ring tilt, opposite rotation) ---------- */
const ORB_GROUP = new THREE.Group();
scene.add(ORB_GROUP);
const ORB_MESHES = {}; // keyed by genre id

// ring factory (Points, tilted, larger particles)
function createStardustRing(coreRadius, colorHex, opts={tiltX:0,tiltY:0,tiltZ:0, particleCount:280, size:7}, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.9); // larger radius
  const particleCount = opts.particleCount || 280;
  const positions = new Float32Array(particleCount*3);
  const sizes = new Float32Array(particleCount);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI * 2;
    const rr = ringRadius + (Math.random()-0.5)*(coreRadius*0.4);
    const x = Math.cos(theta)*rr;
    const y = Math.sin(theta)*rr;
    const z = (Math.random()-0.5)*(coreRadius*0.5);
    positions[i*3] = x; positions[i*3+1] = y; positions[i*3+2] = z;
    sizes[i] = (Math.random()*1.6 + 1.6) * opts.size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({
    size: opts.size || 7,
    map: generateStarTexture(),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // a faint glow sprite to give ring an extra aura
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), color: colorHex, transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*2.1, ringRadius*2.1, 1);
  group.add(glow);

  // tilt
  group.rotation.set(opts.tiltX||0, opts.tiltY||0, opts.tiltZ||0);

  // rotation speed (negative means counterclockwise if core rotates positive)
  const baseSpeed = 0.0045 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, points, mat, rotationSpeed, ringRadius };
}

/* build orbs */
GENRES.forEach((g, idx) => {
  const color = new THREE.Color(g.color);
  const coreRadius = 26 + (Math.random()*9); // core radius
  const coreGeo = new THREE.SphereGeometry(coreRadius, 64, 64);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.16,
    metalness: 0.08,
    transmission: 0.7,
    emissive: color.clone().multiplyScalar(0.02),
    emissiveIntensity: 0.6,
    clearcoat: 0.25
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);

  // soft rim sprite
  const rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rimSprite.scale.set(coreRadius*9.6, coreRadius*9.6, 1);
  coreMesh.add(rimSprite);

  const container = new THREE.Group();
  container.add(coreMesh);

  // initial cluster placement
  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  const clusterRadius = 420;
  container.position.set(Math.cos(baseAngle)*clusterRadius, Math.sin(baseAngle)*clusterRadius*0.6, -idx*8);

  // ring tilt variety (mix horizontal, vertical, diagonal)
  const tilt = {
    tiltX: (Math.random()*0.9 - 0.45) * Math.PI/2,
    tiltY: (Math.random()*0.9 - 0.45) * Math.PI/2,
    tiltZ: (Math.random()*0.6 - 0.3) * Math.PI/6
  };
  // create ring and attach
  const ringObj = createStardustRing(coreRadius, g.color, { tiltX:tilt.tiltX, tiltY:tilt.tiltY, tiltZ:tilt.tiltZ, particleCount: 220 + Math.floor(Math.random()*160), size: 8.5 }, /* counterClockwise=*/ true);
  container.add(ringObj.group);

  // soft gas sphere around orb for ambience (slight tint)
  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.055, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core:coreMesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- Aurora layers: back + front + corner gas blobs ---------- */

// Create a large soft gradient sprite texture utility
function createGradientSprite(colors, size=1024, radial=true){
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const cx = size/2, cy = size/2;
  if (radial){
    const g = ctx.createRadialGradient(cx,cy,20,cx,cy,size*0.9);
    // colors is array of {offset,color}
    colors.forEach(stop=> g.addColorStop(stop.offset, stop.color));
    ctx.fillStyle = g;
    ctx.fillRect(0,0,size,size);
  } else {
    const g = ctx.createLinearGradient(0,0,size,size);
    colors.forEach(stop=> g.addColorStop(stop.offset, stop.color));
    ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
  }
  return new THREE.CanvasTexture(c);
}

// Back aurora: slow, very diffused, large
const backColors = [
  { offset:0.0, color:'rgba(28,12,60,0.0)' },
  { offset:0.25, color:'rgba(110,40,200,0.12)' },
  { offset:0.55, color:'rgba(30,200,220,0.08)' },
  { offset:0.85, color:'rgba(240,120,180,0.06)' },
  { offset:1.0, color:'rgba(10,6,20,0.0)' }
];
const backTex = createGradientSprite(backColors, 1600, true);
const backSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: backTex, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false }));
backSprite.scale.set(2400, 1200, 1);
backSprite.position.set(0, -120, -1600);
scene.add(backSprite);

// Front aurora: faster, semi-transparent, sits in front
const frontColors = [
  { offset:0.0, color:'rgba(200,60,160,0.0)' },
  { offset:0.25, color:'rgba(100,40,200,0.12)' },
  { offset:0.55, color:'rgba(30,180,200,0.14)' },
  { offset:0.85, color:'rgba(250,180,60,0.08)' },
  { offset:1.0, color:'rgba(0,0,0,0.0)' }
];
const frontTex = createGradientSprite(frontColors, 1200, true);
const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent:true, opacity:0.34, blending:THREE.AdditiveBlending, depthWrite:false }));
frontSprite.scale.set(1800, 900, 1);
frontSprite.position.set(60, 40, -200);
scene.add(frontSprite);

// Corner gas blobs (four corners subtle glow)
const cornerColors = [
  { x:-1.0, y:-1.0, color:'rgba(160,40,220,0.16)' },
  { x:1.0, y:-0.9, color:'rgba(40,200,220,0.12)' },
  { x:-0.9, y:1.0, color:'rgba(240,120,100,0.10)' },
  { x:0.9, y:0.9, color:'rgba(100,120,255,0.08)' }
];
const cornerSprites = [];
cornerColors.forEach((c, i) => {
  const grad = createGradientSprite([{offset:0,color:c.color},{offset:1,color:'rgba(0,0,0,0)'}], 900, true);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: grad, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false }));
  spr.scale.set(900,900,1);
  // position off-screen corners in world units relative to camera frustum
  const px = c.x * 1200 * (0.6 + Math.random()*0.4);
  const py = c.y * 700 * (0.6 + Math.random()*0.4);
  spr.position.set(px, py, -250);
  spr.material.opacity = 0.18 + Math.random()*0.06;
  scene.add(spr);
  cornerSprites.push(spr);
});

/* ---------- Raycasting & prompt handling (anchors etc) ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  // intersect core meshes (they are first children of containers)
  const cores = [];
  ORB_GROUP.children.forEach(c => {
    c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); });
  });
  const intersects = raycaster.intersectObjects(cores, true);
  if (intersects.length > 0){
    let hit = intersects[0].object;
    // find parent container
    let parentContainer = null;
    for (let c of ORB_GROUP.children){
      if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parentContainer = c; break; }
    }
    if (parentContainer){
      const found = Object.values(ORB_MESHES).find(o => o.container === parentContainer);
      if (found) openPromptAnchored(found.id);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Prompt anchored with EXIT button (works) ---------- */
let activePrompt = null;
function closeActivePrompt(){ if(!activePrompt) return; try{ cancelAnimationFrame(activePrompt.raf); }catch(e){} try{ activePrompt.dom.remove(); }catch(e){} activePrompt=null; }
function openPromptAnchored(genreId){
  closeActivePrompt();
  const g = GENRES.find(x=>x.id===genreId);
  if (!g) return;
  const dom = document.createElement('div'); dom.className='prompt panel';
  dom.innerHTML = `
    <button class="closeX" aria-label="Close" style="position:absolute;right:8px;top:8px;border:none;background:transparent;color:#dfefff;font-size:18px;cursor:pointer">✕</button>
    <h4>${g.name}</h4>
    <p class="muted">Who's your favorite artist? (Dream B2B optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" />
    <input class="b2b" placeholder="Dream B2B (optional)" />
    <textarea class="why" rows="2" placeholder="Why (optional)"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn ghost cancel">Cancel</button>
      <button class="btn submit">Submit</button>
    </div>
  `;
  document.body.appendChild(dom);
  // wire buttons
  dom.querySelector('.closeX').addEventListener('click', ()=> closeActivePrompt());
  dom.querySelector('.cancel').addEventListener('click', ()=> closeActivePrompt());
  dom.querySelector('.submit').addEventListener('click', async ()=>{
    const artist = dom.querySelector('.artist').value.trim(); if(!artist){ dom.querySelector('.artist').focus(); return; }
    const b2b = dom.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashOrb(genreId);
    computeAndRenderTop();
    closeActivePrompt();
  });

  // anchored orbiting placement
  activePrompt = { dom, angle: Math.random()*Math.PI*2, radius: 160, genreId, raf: null };
  function loop(){
    if(!activePrompt) return;
    activePrompt.angle += 0.012;
    const o = ORB_MESHES[genreId];
    if (!o) return;
    const worldPos = new THREE.Vector3();
    o.container.getWorldPosition(worldPos);
    worldPos.project(camera);
    const sx = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;
    const x = sx + Math.cos(activePrompt.angle) * activePrompt.radius - dom.offsetWidth/2;
    const y = sy + Math.sin(activePrompt.angle) * activePrompt.radius - dom.offsetHeight/2;
    dom.style.left = Math.max(8, Math.min(window.innerWidth - dom.offsetWidth - 8, x)) + 'px';
    dom.style.top  = Math.max(8, Math.min(window.innerHeight - dom.offsetHeight - 8, y)) + 'px';
    activePrompt.raf = requestAnimationFrame(loop);
  }
  loop(); setTimeout(()=> dom.querySelector('.artist').focus(), 120);
}

/* ---------- flash visual feedback ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId];
  if (!o) return;
  const mat = o.core.material;
  const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.6, orig*2.6);
  setTimeout(()=>{ mat.emissiveIntensity = orig; }, 900);
}

/* ---------- Top compute & UI ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const perGenreCounts = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r=>{ const k=(r.artist||'').trim(); if(!k) return; counts[k]= (counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id] = sorted;
    const topCount = sorted[0] ? sorted[0].count : 0;
    updateOrbHighlight(g.id, topCount);
  });

  const sel = genreSelect.value || GENRES[0].id;
  const arr = perGenreCounts[sel] || []; let html='';
  for (let i=0;i<Math.min(50,arr.length);i++){
    html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  }
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  topList.innerHTML = html;
}
function updateOrbHighlight(genreId, topCount){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount) * 0.9);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount) * 0.12);
  o.core.scale.set(base, base, base);
}

/* ---------- Animation loop: orbs + rings + aurora independent motion ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // back/ front aurora independent motion (slow cycles + slight rotation)
  backSprite.rotation.z = Math.sin(t*0.03) * 0.05;
  backSprite.material.opacity = 0.48 + Math.sin(t*0.08)*0.03;
  frontSprite.rotation.z = Math.cos(t*0.12) * 0.08;
  frontSprite.material.opacity = 0.30 + Math.cos(t*0.1)*0.04;

  // corner blobs subtle float
  cornerSprites.forEach((s, i)=>{
    s.position.x += Math.sin(t*0.05 + i) * 0.02;
    s.position.y += Math.cos(t*0.04 + i*1.2) * 0.02;
    s.material.opacity = 0.12 + 0.04 * Math.sin(t*0.7 + i);
  });

  // starfield + dust plane
  starField.rotation.z += 0.0005;
  dustPlane.rotation.z += 0.00025;

  // animate orbs cluster movement + local motion
  GENRES.forEach((g, idx)=>{
    const o = ORB_MESHES[g.id];
    if (!o) return;
    const speed = 0.12 + idx*0.02;
    const ampX = 420, ampY = 160;
    const nx = Math.cos(t*speed + idx) * ampX;
    const ny = Math.sin(t*speed*1.05 + idx*1.3) * ampY;
    o.container.position.x = nx;
    o.container.position.y = ny;
    o.container.position.z = Math.sin(t*(0.6 + idx*0.04)) * 8;

    // core gentle spin
    o.core.rotation.y += 0.002 + idx*0.0002;
    o.core.rotation.x += 0.0012;

    // ring rotates opposite direction (negative rotationSpeed)
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed;
    // gentle modulation to ring opacity & size for life
    o.ringObj.mat.opacity = 0.85 - Math.abs(Math.sin(t*0.6 + idx))*0.18;

    // gas sphere breathing
    o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx);
  });

  renderer.render(scene, camera);
}
animate();

/* ---------- resize handler ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------- init ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());

/* sanity check */
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 900);

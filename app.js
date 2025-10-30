/* ============
  Code MQ — app.js
  - Three.js scene
  - 6 genre orbs with dust/wisps
  - click -> prompt for artist + B2B -> store (localStorage or Firebase)
  - top lists UI and Top-50 panel
  - Spotify embed loader
  ============ */

/* ---------- CONFIG: (OPTIONAL) Firebase Realtime Database ----------
If you want cross-browser realtime updates, create a Firebase project
and paste your config object below. If you leave `FIREBASE_CONFIG = null`
the demo will use localStorage only.
*/
const FIREBASE_CONFIG = null;
/*
Example (replace the values with your project's):
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://<project-id>.firebaseio.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
*/

/* ---------- Genres & Colors ---------- */
const GENRES = [
  { id: 'techno', name: 'Hard / Techno', color: 0xff4f79 },
  { id: 'house', name: 'House', color: 0xffbf5f },
  { id: 'dnb', name: 'Drum & Bass', color: 0x5fff85 },
  { id: 'dubstep', name: 'Dubstep', color: 0x5fc9ff },
  { id: 'electronic', name: 'Electronic', color: 0x9f5fff },
  { id: 'mainstream', name: 'Mainstream/International', color: 0xffffff }
];

/* ---------- Persistence layer: uses Firebase if configured; else localStorage ---------- */
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
    console.warn('Firebase init error, falling back to localStorage', e);
    useFirebase = false;
  }
}

/* utility: read/write */
async function saveVote(genreId, artistName, b2b) {
  const record = { artist: artistName.trim(), b2b: (b2b || '').trim(), ts: Date.now() };
  if (useFirebase && dbRef) {
    // push record under genre
    await dbRef.child(genreId).push(record);
  } else {
    // localStorage fallback
    const key = 'codemq_votes';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    data[genreId] = data[genreId] || [];
    data[genreId].push(record);
    // keep limit to last 500 per genre
    if (data[genreId].length > 2000) data[genreId].splice(0, data[genreId].length - 2000);
    localStorage.setItem(key, JSON.stringify(data));
    // also dispatch local event to update UI immediate
    window.dispatchEvent(new CustomEvent('codemq_local_update'));
  }
}

async function readAllVotesOnce() {
  if (useFirebase && dbRef) {
    const snapshot = await dbRef.get();
    if (!snapshot.exists()) return {};
    return snapshot.val();
  } else {
    const data = JSON.parse(localStorage.getItem('codemq_votes') || '{}');
    return data;
  }
}

/* If using localStorage, listen for our custom event to update UI */
if (!useFirebase) {
  window.addEventListener('codemq_local_update', () => {
    computeAndRenderTop();
  });
}

/* ---------- UI Setup ---------- */
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');

GENRES.forEach(g => {
  const opt = document.createElement('option');
  opt.value = g.id; opt.textContent = g.name;
  genreSelect.appendChild(opt);
});

toggleTop.addEventListener('click', () => {
  if (leftPanel.classList.contains('hidden')) leftPanel.classList.remove('hidden');
  else leftPanel.classList.add('hidden');
});

genreSelect.addEventListener('change', () => computeAndRenderTop());

/* playlist UI */
const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');
loadSpotify.addEventListener('click', () => {
  const v = spotifyInput.value.trim();
  if (!v) { spotifyEmbed.innerHTML = ''; return; }
  // Support either Spotify embed url or playlist URI
  let embedUrl = v;
  if (v.startsWith('spotify:playlist:')) {
    const id = v.split(':').pop();
    embedUrl = `https://open.spotify.com/embed/playlist/${id}`;
  }
  if (v.includes('open.spotify.com')) {
    // convert to embed if needed
    embedUrl = v.replace('open.spotify.com', 'open.spotify.com/embed');
  }
  spotifyEmbed.innerHTML = `<iframe src="${embedUrl}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
  <div style="margin-top:6px"><a target="_blank" rel="noreferrer" href="${embedUrl}">Open in Spotify</a></div>`;
});

/* legend entries */
const legendList = document.getElementById('legendList');
GENRES.forEach(g => {
  const li = document.createElement('li');
  li.textContent = g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  li.style.color = getContrastColor(g.color);
  legendList.appendChild(li);
});

/* ---------- 3D Scene (Three.js) ---------- */
const wrap = document.getElementById('canvasWrap');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 0, 800);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

// subtle fog for depth
scene.fog = new THREE.FogExp2(0x00000c, 0.0009);

// stars (particles)
const starsGeo = new THREE.BufferGeometry();
const starCount = 1200;
const starPositions = new Float32Array(starCount * 3);
for (let i=0;i<starCount;i++){
  starPositions[i*3] = (Math.random()-0.5)*4000;
  starPositions[i*3+1] = (Math.random()-0.5)*2000;
  starPositions[i*3+2] = -Math.random()*4000;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent:true, opacity:0.9});
const starField = new THREE.Points(starsGeo, starsMat);
scene.add(starField);

// gas/dust layer (big slowly rotating sprite)
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png'); // fallback cloud texture externally hosted
const dustGeo = new THREE.PlaneGeometry(3000, 1500);
const dustMat = new THREE.MeshBasicMaterial({ map: dustTex, transparent: true, opacity: 0.08, depthWrite:false});
const dustPlane = new THREE.Mesh(dustGeo, dustMat);
dustPlane.position.set(0,0,-800);
scene.add(dustPlane);

// lights
const amb = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(0,1,1);
scene.add(dir);

/* Orbs container and mapping */
const orbGroup = new THREE.Group();
scene.add(orbGroup);
const ORB_MESHES = {}; // store by genre id

// create each orb: transparent sphere with emissive, and a small particle wisps group
GENRES.forEach((g, idx) => {
  const colorHex = g.color;
  const color = new THREE.Color(colorHex);

  const geometry = new THREE.SphereGeometry(60 + Math.random()*40, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.1,
    metalness: 0.1,
    emissive: color.clone().multiplyScalar(0.03),
    emissiveIntensity: 0.6,
    envMapIntensity: 0.2,
  });
  const mesh = new THREE.Mesh(geometry, material);

  // initial positions in ring layout
  const angle = (idx / GENRES.length) * Math.PI * 2;
  const radius = 420;
  mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, - (idx*10));
  mesh.userData = { genreId: g.id, baseColor: colorHex, idx };

  // small halo sprite:
  const spriteMat = new THREE.SpriteMaterial({
    map: generateGlowTexture(colorHex),
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.25
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(380, 380, 1);
  mesh.add(sprite);
  orbGroup.add(mesh);

  // create wisps (small particles clustered)
  const wGroup = new THREE.Group();
  const pCount = 40;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount*3);
  for (let i=0;i<pCount;i++){
    const r = 90 + Math.random()*80;
    const a = Math.random()*Math.PI*2;
    const z = (Math.random()-0.5)*40;
    pPos[i*3] = Math.cos(a)*r + (Math.random()-0.5)*15;
    pPos[i*3+1] = Math.sin(a)*r + (Math.random()-0.5)*15;
    pPos[i*3+2] = z;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ size: 6, map: generateStarTexture(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.9, color });
  const points = new THREE.Points(pGeo, pMat);
  points.position.set(0,0,0);
  mesh.add(points);

  ORB_MESHES[g.id] = { mesh, points, sprite, material };
});

/* raycaster for clicks */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onClick(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
  mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(orbGroup.children, true);
  if (intersects.length > 0){
    let obj = intersects[0].object;
    // walk up to parent orb mesh
    while (obj && !obj.userData.genreId) obj = obj.parent;
    if (obj && obj.userData.genreId) {
      handleOrbClick(obj.userData.genreId);
    }
  }
}
renderer.domElement.addEventListener('click', onClick);

/* ---------- Interaction logic: click prompt and record ---------- */
async function handleOrbClick(genreId){
  const genre = GENRES.find(g=>g.id===genreId);
  // prompt artist and b2b
  const artist = prompt(`Add your favorite artist for ${genre.name} (name only):`);
  if (!artist || !artist.trim()) return;
  const b2b = prompt(`Optional: who would you want them B2B with? (name or leave blank)`);
  // save
  await saveVote(genreId, artist, b2b);
  // give visual feedback
  flashOrb(genreId);
  computeAndRenderTop(); // update UI
}

/* flash orb on vote */
function flashOrb(genreId){
  const obj = ORB_MESHES[genreId];
  if (!obj) return;
  obj.material.emissiveIntensity = 1.8;
  setTimeout(()=>{ obj.material.emissiveIntensity = 0.6; }, 1200);
}

/* ---------- Top computation & UI rendering ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  // raw structure: { genreId: [ {artist, b2b, ts}, ... ] }
  const perGenreCounts = {};
  GENRES.forEach(g => {
    const arr = (raw && raw[g.id]) ? Object.values(raw[g.id]) : (raw && raw[g.id] ? raw[g.id] : raw[g.id] || []);
    // if Firebase, arr will be object keyed by push id; normalize
    const normalized = Array.isArray(arr) ? arr : Object.keys(arr || {}).map(k => arr[k]);
    const counts = {};
    normalized.forEach(r=>{
      const key = (r.artist || '').trim();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    // make sorted array
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id] = sorted;
    // update orb glow: top gets bigger emissiveIntensity
    const top = sorted[0] ? sorted[0].artist : null;
    updateOrbHighlight(g.id, top ? sorted[0].count : 0);
  });

  // render top list in left panel
  const sel = genreSelect.value || GENRES[0].id;
  const topArr = perGenreCounts[sel] || [];
  const limit = Math.min(50, topArr.length);
  let html = '';
  for (let i=0;i<limit;i++){
    const it = topArr[i];
    html += `<div class="row"><strong>${i+1}. ${escapeHtml(it.artist)}</strong> <span class="score">${it.count}</span></div>`;
  }
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  topList.innerHTML = html;
}

/* update orb glow based on top count */
function updateOrbHighlight(genreId, topCount){
  const obj = ORB_MESHES[genreId];
  if (!obj) return;
  // scale emissive intensity logarithmic
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount) * 0.9);
  obj.material.emissiveIntensity = val;
  // also scale size a bit
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount) * 0.12);
  obj.meshScale = base;
  obj.mesh && (obj.mesh.scale.set(base, base, base));
}

/* ---------- animation loop ---------- */
let t = 0;
function animate(){
  requestAnimationFrame(animate);
  t += 0.005;

  // rotate starfield slowly
  starField.rotation.z += 0.0006;
  dustPlane.rotation.z += 0.0003;

  // animate each orb floating independently
  GENRES.forEach((g, idx) => {
    const obj = ORB_MESHES[g.id];
    if (!obj) return;
    const mesh = obj.mesh || obj.mesh; // but we stored as mesh earlier
    // move each orb in a slow Lissajous
    const ampX = 380;
    const ampY = 160;
    const speed = 0.25 + idx*0.02;
    const nx = Math.cos(t*speed + idx) * ampX;
    const ny = Math.sin(t*speed*1.1 + idx*1.3) * ampY;
    obj.mesh.position.x = nx;
    obj.mesh.position.y = ny;
    // rotate wisps slightly
    obj.points.rotation.z = t * (0.2 + idx*0.03);
    // pulse sprite opacity based on emissiveIntensity
    obj.sprite.material.opacity = Math.min(0.45, 0.15 + obj.material.emissiveIntensity * 0.12);
  });

  renderer.render(scene, camera);
}
animate();

/* ---------- Helpers ---------- */
function toCssHex(n){
  return '#'+('000000'+(n.toString(16))).slice(-6);
}
function getContrastColor(hex){
  // simple luminance test
  const r = (hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  const yiq = (r*299 + g*587 + b*114) /1000;
  return yiq >= 128 ? '#000' : '#fff';
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* tiny canvas textures for glow stars (reuse) */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, 10, size/2, size/2, size/2);
  ctx.fillStyle = '#ffffff';
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.5, toCssRgba(colorHex,0.25));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
function generateStarTexture(){
  const s = 64;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.2,'rgba(255,255,255,0.9)');
  g.addColorStop(0.6,'rgba(255,255,255,0.2)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
function toCssRgba(hex, a){
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- Startup: compute top now and (if using Firebase) attach listener ---------- */
computeAndRenderTop();

if (useFirebase && dbRef) {
  // listen for realtime changes
  dbRef.on('value', snap => {
    // when data changes, re-render top lists
    computeAndRenderTop();
  });
}

/* ---------- window resize ---------- */
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
});

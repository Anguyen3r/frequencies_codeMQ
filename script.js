/* Nebula Orbs — static client-side build
   - Three.js scene with nebula layers + stars
   - 6 colored semi-transparent orbs with orbiting dust
   - click orb -> modal (no genre shown) that can't auto-dismiss (user can X)
   - submissions saved to localStorage; counts update top list + orb glow
   - Spotify / SoundCloud embed loader
*/

// ---------- CONFIG ----------
const USE_FIRESTORE = false; // set true later if you wire Firestore
// storage key for local fallback
const STORAGE_KEY = 'codemq_votes_v2';

// genres + colors (iridescent palette)
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:'#c66cff' },
  { id:'house',  name:'House', color:'#00e2a3' },
  { id:'dnb',    name:'Drum & Bass', color:'#33d7ff' },
  { id:'dub',    name:'Dubstep', color:'#ffb86b' },
  { id:'elect',  name:'Electronic', color:'#d86bff' },
  { id:'main',   name:'Mainstream/International', color:'#ffffff' }
];

// ---------- UI refs ----------
const stage = document.getElementById('stage');
const modal = document.getElementById('modal');
const favArtist = document.getElementById('favArtist');
const b2bArtist = document.getElementById('b2bArtist');
const submitBtn = document.getElementById('submitBtn');
const closeX = document.getElementById('closeX');

const openTopBtn = document.getElementById('openTopBtn');
const topPanel = document.getElementById('topPanel');
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const panelGenreName = document.querySelector('#topPanel h3');

const playlistInput = document.getElementById('playlistInput');
const loadPlaylist = document.getElementById('loadPlaylist');
const clearPlaylist = document.getElementById('clearPlaylist');
const embedWrap = document.getElementById('embedWrap');

const legend = document.getElementById('legend');

let selectedOrbGenre = null; // genre id when opened modal

// ---------- Three.js scene ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 6000);
camera.position.set(0,0,800);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

// orbit controls for debugging (disabled by default)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enabled = false;

// fog and subtle ambient
scene.fog = new THREE.FogExp2(0x000007, 0.00045);
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

// ---------- Nebula layers (large transparent planes with gradient textures) ----------
function makeNebulaTexture(hueShift=200, size=1024){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const cx = size/2, cy = size/2;
  // radial gradient, multiple stops, hue shift
  const g = ctx.createRadialGradient(cx, cy, size*0.05, cx, cy, size*0.9);
  const hue = hueShift + (Math.random()-0.5)*60;
  g.addColorStop(0, `hsla(${hue}, 85%, 70%, 0.9)`);
  g.addColorStop(0.2, `hsla(${hue+20}, 80%, 60%, 0.55)`);
  g.addColorStop(0.5, `hsla(${hue+60}, 70%, 50%, 0.22)`);
  g.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,size,size);
  // gentle noise overlay
  const img = ctx.getImageData(0,0,size,size);
  for(let i=0;i<img.data.length;i+=4){
    const v = (Math.random()*12 - 6);
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + v));
    img.data[i+1] = Math.min(255, Math.max(0, img.data[i+1] + v));
    img.data[i+2] = Math.min(255, Math.max(0, img.data[i+2] + v));
  }
  ctx.putImageData(img,0,0);
  return new THREE.CanvasTexture(c);
}

const nebulaGroup = new THREE.Group();
scene.add(nebulaGroup);
for(let i=0;i<4;i++){
  const tex = makeNebulaTexture(180 + i*40, 1024);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true, opacity: 0.06 + i*0.03, depthWrite:false, blending:THREE.AdditiveBlending });
  const geo = new THREE.PlaneGeometry(4000,2000);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((Math.random()-0.5)*400, (Math.random()-0.5)*300, -900 - i*80);
  mesh.rotation.z = Math.random()*0.6 - 0.3;
  mesh.userData = { speedX: (Math.random()-0.5)*0.03, speedY: (Math.random()-0.5)*0.02, rotSpeed: (Math.random()-0.5)*0.001 };
  nebulaGroup.add(mesh);
}

// ---------- stars (points) ----------
const starCount = 2200;
const starsGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(starCount * 3);
const colors = new Float32Array(starCount * 3);
for(let i=0;i<starCount;i++){
  positions[i*3] = (Math.random()-0.5) * 5000;
  positions[i*3+1] = (Math.random()-0.5) * 2500;
  positions[i*3+2] = -Math.random() * 5000;
  const c = new THREE.Color(0xffffff);
  c.offsetHSL(0, 0, Math.random()*0.4 - 0.2);
  colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const starsMaterial = new THREE.PointsMaterial({ size: 1.8, vertexColors:true, transparent:true, opacity:0.95 });
const starField = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starField);

// ---------- orbs (spheres) ----------
const orbGroup = new THREE.Group();
scene.add(orbGroup);

const ORB_DATA = []; // store {id,mesh,particles,baseScale}

function makeOrb(genre, index){
  // geometry & iridescent-ish material
  const radius = 60 + Math.random()*30;
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.32,
    roughness: 0.05,
    metalness: 0.2,
    emissive: new THREE.Color(genre.color).multiplyScalar(0.05),
    emissiveIntensity: 0.6,
    envMapIntensity: 0.3,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);

  // initial ring of dust particles around orb
  const pcount = 160;
  const pgeo = new THREE.BufferGeometry();
  const ppos = new Float32Array(pcount*3);
  for(let i=0;i<pcount;i++){
    const a = Math.random()*Math.PI*2;
    const r = radius*1.55 + Math.random()*60;
    ppos[i*3]   = Math.cos(a)*r + (Math.random()-0.5)*10;
    ppos[i*3+1] = Math.sin(a)*r*0.6 + (Math.random()-0.5)*8;
    ppos[i*3+2] = (Math.random()-0.5)*20;
  }
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos,3));
  const pmat = new THREE.PointsMaterial({ size: 4, color: genre.color, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false });
  const particles = new THREE.Points(pgeo, pmat);
  mesh.add(particles);

  // soft halo sprite:
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const cx = canvas.getContext('2d');
  const g = cx.createRadialGradient(128,128,10,128,128,128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.2, hexToRgba(genre.color, 0.5));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = g; cx.fillRect(0,0,256,256);
  const spriteTex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: spriteTex, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(radius*6, radius*6, 1);
  mesh.add(sprite);

  // position in ring layout
  const angle = (index / GENRES.length) * Math.PI*2;
  const ringR = 420;
  mesh.position.set(Math.cos(angle)*ringR, Math.sin(angle)*ringR*0.6, -index*10);
  mesh.userData = { genreId: genre.id, index, radius };

  orbGroup.add(mesh);
  ORB_DATA.push({ id: genre.id, mesh, particles, sprite, baseRadius: radius });
}

// create all orbs
GENRES.forEach((g, idx)=> makeOrb(g, idx));

// raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onClick(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
  mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(orbGroup.children, true);
  if(intersects.length){
    let obj = intersects[0].object;
    // climb to parent mesh
    while(obj && !obj.userData.genreId) obj = obj.parent;
    if(obj && obj.userData.genreId){
      selectedOrbGenre = obj.userData.genreId;
      openModal();
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onClick);

// ---------- modal logic ----------
function openModal(){
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  favArtist.value = '';
  b2bArtist.value = '';
  favArtist.focus();
}
function closeModal(){
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}
closeX.addEventListener('click', closeModal);

// submit saves
submitBtn.addEventListener('click', async ()=>{
  const artist = favArtist.value.trim();
  const b2b = b2bArtist.value.trim();
  if(!artist) { favArtist.focus(); return; }
  await saveVote(selectedOrbGenre, artist, b2b);
  closeModal();
});

// click outside modal doesn't auto-close to avoid accidental dismiss — but X will close
modal.addEventListener('click', (e)=>{
  if(e.target === modal) {
    // do nothing (force explicit X or submit)
  }
});

// ---------- storage (local fallback) ----------
function saveLocal(genre, artist, b2b){
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data[genre] = data[genre] || [];
  data[genre].push({ artist, b2b, ts: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
async function saveVote(genre, artist, b2b){
  // placeholder for Firestore if later integrated
  if(USE_FIRESTORE){
    // implement Firestore writes later
  } else {
    saveLocal(genre, artist, b2b);
    computeAndRenderTop();
  }
}

// ---------- compute top from storage & update orb glow ----------
async function readAllLocal(){
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
}
async function computeAndRenderTop(){
  const raw = await readAllLocal();
  const counts = {};
  GENRES.forEach(g=> counts[g.id]={});
  Object.keys(raw).forEach(genre=>{
    (raw[genre]||[]).forEach(r=>{
      const name = (r.artist||'').trim();
      if(!name) return;
      counts[genre][name] = (counts[genre][name]||0) + 1;
    });
  });
  // update orbs
  ORB_DATA.forEach(o=>{
    const list = Object.keys(counts[o.id]||{}).map(a=>({artist:a,count:counts[o.id][a]})).sort((a,b)=>b.count-a.count);
    const topCount = list[0] ? list[0].count : 0;
    const glow = Math.min(3.0, 0.4 + Math.log10(1+topCount)*0.6);
    const color = GENRES.find(g=>g.id===o.id).color;
    o.mesh.material.emissive = new THREE.Color(color);
    o.mesh.material.emissiveIntensity = glow * 0.35;
    const scale = 1 + Math.min(0.6, Math.log10(1+topCount)*0.12);
    o.mesh.scale.set(scale,scale,scale);
  });
  // render panel for currently selected genre
  const sel = genreSelect.value || GENRES[0].id;
  const arr = Object.keys(counts[sel]||{}).map(a=>({artist:a,count:counts[sel][a]})).sort((a,b)=>b.count-a.count);
  let html = '';
  if(arr.length===0) html = '<div style="color:#9aa">No submissions yet</div>';
  else{
    for(let i=0;i<Math.min(50,arr.length);i++){
      const it = arr[i];
      html += `<div class="row">${i+1}. ${escapeHtml(it.artist)} <span style="opacity:.8">${it.count}</span></div>`;
    }
  }
  topList.innerHTML = html;
}

// ---------- UI wiring ----------
openTopBtn.addEventListener('click', ()=> topPanel.classList.toggle('hidden'));
GENRES.forEach(g=>{
  const o = document.createElement('option'); o.value=g.id; o.textContent=g.name; genreSelect.appendChild(o);
  const tag = document.createElement('div'); tag.className='genreTag'; tag.textContent=g.name; tag.style.background = hexToRgba(g.color,0.88); legend.appendChild(tag);
});
genreSelect.addEventListener('change', computeAndRenderTop);

// ---------- playlist embed ----------
loadPlaylist.addEventListener('click', ()=>{
  const v = playlistInput.value.trim();
  if(!v){ embedWrap.innerHTML = ''; return; }
  if(v.startsWith('spotify:playlist:')){
    const id = v.split(':').pop();
    embedWrap.innerHTML = `<iframe src="https://open.spotify.com/embed/playlist/${id}" allow="encrypted-media"></iframe>`;
    return;
  }
  if(v.includes('open.spotify.com')){
    const u = v.replace('open.spotify.com','open.spotify.com/embed');
    embedWrap.innerHTML = `<iframe src="${u}" allow="encrypted-media"></iframe>`;
    return;
  }
  if(v.includes('soundcloud.com')){
    embedWrap.innerHTML = `<iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(v)}&color=%23ff5500&auto_play=false" allow="autoplay"></iframe>`;
    return;
  }
  embedWrap.innerHTML = `<div style="color:#f88">Unrecognized URL</div>`;
});
clearPlaylist.addEventListener('click', ()=>{ playlistInput.value=''; embedWrap.innerHTML=''; });

// ---------- helpers ----------
function hexToRgba(hex, a=1){
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ---------- animate loop ----------
let last = performance.now();
function animate(now){
  const dt = (now - last)/16.666; // approx frames
  last = now;
  // nebula drift
  nebulaGroup.children.forEach((m, i)=>{
    m.position.x += m.userData.speedX * dt;
    m.position.y += m.userData.speedY * dt;
    m.rotation.z += m.userData.rotSpeed * dt;
  });
  // star twinkle: slightly change material opacity (simulate)
  starsMaterial.opacity = 0.9 + Math.sin(now*0.0008)*0.05;

  // rotate particle rings for each orb
  ORB_DATA.forEach((o, idx)=>{
    const t = now * 0.001;
    o.particles.rotation.z = t * (0.12 + idx*0.02);
    // small bobbing
    o.mesh.position.x += Math.sin(t*0.2 + idx) * 0.03;
    o.mesh.position.y += Math.cos(t*0.17 + idx*0.5) * 0.04;
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ---------- init ----------
computeAndRenderTop();

// ---------- resize ----------
window.addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- note: add Firestore later ----------
/* To add real-time DB later:
   - create Supabase or Firebase project
   - wire saves in saveVote(genre,artist,b2b) to remote DB
   - add listener to update counts and call computeAndRenderTop()
*/


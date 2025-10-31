<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Orbiting Genres — Mobile-First</title>
<!-- Minimal reset + pixelated / AR-inspired aesthetic -->
<style>
  :root{
    --bg:#02020a;
    --glass: rgba(0,0,0,0.32);
    --glass-strong: rgba(0,0,0,0.55);
    --ui-accent: rgba(255,255,255,0.06);
    --font-sz: 13px;
    --rounded: 12px;
  }
  html,body{height:100%;margin:0;background:var(--bg);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;overflow:hidden;color:#eaf1ff;font-family:Inter,ui-sans-serif,system-ui, -apple-system, "Helvetica Neue", Arial;}
  /* canvas container */
  #wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;touch-action:none}
  canvas{display:block;width:100%;height:100%;}
  /* top-right compact UI */
  .top-right {
    position:fixed; right:12px; top:12px; width:92px; z-index:30; display:flex; flex-direction:column; gap:8px; align-items:center;
    pointer-events:auto;
  }
  .playlist {
    width: 92px; height:86px; border-radius:10px; overflow:hidden;
    background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
    box-shadow: 0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02);
    display:flex;align-items:center;justify-content:center;padding:6px;
    backdrop-filter: blur(6px);
  }
  .playlist iframe, .playlist audio{ width:100%; height:100%; border-radius:8px; display:block; }
  .genre-grid {
    margin-top:6px; display:flex; flex-direction:column; gap:6px; width:100%;
  }
  .genre-box {
    height:22px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600;
    color:rgba(0,0,0,0.85); text-shadow: none; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    cursor:pointer; user-select:none;
    -webkit-tap-highlight-color: transparent;
  }
  .genre-box[data-textcolor="light"]{ color:#fff; text-shadow: 0 1px 0 rgba(0,0,0,0.35); }
  /* legend minimal text (only genre boxes) */
  .top-right small { display:block; margin-top:4px; font-size:10px; color:rgba(255,255,255,0.35); text-align:center; }

  /* top50 scroll list (under genre boxes on bigger layouts; on mobile it slides up) */
  .top50 {
    position:fixed; right:12px; top:110px; width:200px; max-height:44vh; overflow:auto; z-index:30;
    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
    border-radius:10px; padding:8px; font-size:12px; line-height:1.2; box-shadow:0 10px 30px rgba(0,0,0,0.6);
    backdrop-filter: blur(8px);
  }
  .top50 .row{ display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 4px; border-radius:6px; }
  .top50 .row:nth-child(odd){ background: linear-gradient(90deg, rgba(255,255,255,0.01), transparent); }
  .top50 .artist { color: #eaf1ff; font-weight:600; font-size:12px; }
  .top50 .count { color: rgba(255,255,255,0.35); font-size:11px; }

  /* bottom nav: transparent black glass like iOS */
  .bottom-nav {
    position:fixed; left:12px; right:12px; bottom:12px; height:56px; z-index:40;
    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
    border-radius:18px; display:flex; align-items:center; justify-content:space-around; padding:8px 14px; gap:12px;
    box-shadow: 0 18px 40px rgba(0,0,0,0.7); backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.03);
  }
  .btn-nav { flex:1; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; cursor:pointer; user-select:none; }
  .btn-nav.small { font-size:12px; opacity:0.86; }
  /* micro pixel / AR accent: thin pixel-y border */
  .pixel-accent { box-shadow: 0 0 0 1px rgba(255,255,255,0.02) inset; border: 1px solid rgba(255,255,255,0.02); }

  /* mobile responsiveness adjustments */
  @media (max-width:520px){
    .top-right { right:10px; top:10px; width:84px; }
    .top50 { right:10px; top:106px; width:180px; max-height:40vh; font-size:11px; }
    .playlist { height:78px; width:84px; }
    .bottom-nav { left:8px; right:8px; bottom:8px; height:62px; border-radius:16px; }
  }

  /* visual hint when an orb is selected */
  .hud {
    position: fixed; left:12px; top:12px; z-index:30; display:flex; gap:8px; align-items:center; pointer-events:none;
  }
  .hud .chip { padding:6px 10px; border-radius:10px; backdrop-filter: blur(6px); background: rgba(0,0,0,0.25); font-size:12px; font-weight:700; }
  /* keep canvas behind UI */
  #three-canvas{ position:fixed; inset:0; z-index:1; display:block; }
</style>
</head>
<body>

<div id="wrap">
  <canvas id="three-canvas"></canvas>
</div>

<!-- small HUD + UI -->
<div class="hud" id="hud" style="display:none"><div class="chip" id="hudText">Genre</div></div>

<div class="top-right">
  <div class="playlist pixel-accent" id="playlistWrap" title="Playlist (tap to start)">
    <!-- example: small spotify embed or audio element — replace data-playlist attr -->
    <!-- default placeholder; we attempt to load audio when user taps a genre -->
    <div style="font-size:11px;color:rgba(255,255,255,0.22);text-align:center">Playlist</div>
  </div>

  <div class="genre-grid" id="genreGrid"></div>
  <small style="opacity:0.9">Tap a genre to load</small>
</div>

<div class="top50 pixel-accent" id="top50Wrap" aria-hidden="false">
  <div style="font-weight:800;margin-bottom:6px;font-size:13px">Top 50 (sample)</div>
  <div id="topRows"></div>
</div>

<div class="bottom-nav" id="bottomNav">
  <div class="btn-nav pixel-accent small" id="btnHome">Home</div>
  <div class="btn-nav pixel-accent small" id="btnGenres">Genres</div>
  <div class="btn-nav pixel-accent small" id="btnMap">Map</div>
</div>

<!-- Three.js + script -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/three.min.js"></script>
<script>
/* Combined app script:
   - Vertical nebula ribbon in center (sprite-based gradient)
   - Orbiting translucent orbs (7 genres) with halo + stardust ring + comet-like trail sprite
   - Mobile-first camera & responsive sizing
   - Simple UI hooking: genre boxes (tap to select) loads a placeholder audio element into playlist area
*/

/* ---------- CONFIG ---------- */
const GENRES = [
  { id:'hard-techno', name:'Hard Techno', color:0xff2b2b }, // red
  { id:'techno', name:'Techno', color:0xd18cff },          // purple
  { id:'house', name:'House', color:0xffbf5f },            // orange
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },        // green
  { id:'dubstep', name:'Dubstep', color:0x00e5ff },        // cyan
  { id:'electronic', name:'Electronic', color:0x1450ff },  // sapphire / blue
  { id:'pop', name:'Pop', color:0xff66aa }                 // pink
];

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00008);

const CAMERA_Z = 740;
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 18, CAMERA_Z);
camera.lookAt(0, 0, 0);

/* lights */
const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

/* ---------- background stars and concentrated center stars ---------- */
function makeStars(count, spreadX=5000, spreadY=3000, spreadZ=5000, size=1.2, opacity=0.9){
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
  return new THREE.Points(geo, mat);
}

const starsFar = makeStars(1400, 6000, 3600, 6000, 1.0, 0.9);
const starsNear = makeStars(700, 3000, 1600, 2500, 1.7, 0.65);
scene.add(starsFar, starsNear);

/* concentrated central sparkle (vertical column of brighter twinkles) */
function makeConcentratedStars(count=200, radius=220, height=700){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i=0;i<count;i++){
    const a = Math.random()*Math.PI*2;
    const r = Math.random() * radius * (0.2 + Math.random()*0.8);
    const y = (Math.random()-0.5) * height;
    pos[i*3] = Math.cos(a) * r * 0.25; // more vertical column (thin)
    pos[i*3+1] = y;
    pos[i*3+2] = -60 + (Math.random()-0.5)*40;
    phases[i] = Math.random()*Math.PI*2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size:1.8, transparent:true, opacity:0.95, depthWrite:false, blending:THREE.AdditiveBlending });
  return new THREE.Points(geo, mat);
}
const centerStars = makeConcentratedStars(360, 180, 640);
scene.add(centerStars);

/* ---------- vertical nebula ribbon (sprite textured gradient) ---------- */
function createNebulaSprite(width=260, height=1200){
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
  const ctx = c.getContext('2d');
  // create a soft vertical nebula using layered gradients & noise-like strokes
  const grad = ctx.createLinearGradient(0,0,c.width, c.height);
  grad.addColorStop(0, 'rgba(30,24,50,0.0)');
  grad.addColorStop(0.12, 'rgba(20,60,120,0.12)');
  grad.addColorStop(0.35, 'rgba(40,20,80,0.06)');
  grad.addColorStop(0.55, 'rgba(20,80,150,0.12)');
  grad.addColorStop(0.75, 'rgba(40,18,70,0.06)');
  grad.addColorStop(1, 'rgba(10,10,16,0.02)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,c.width,c.height);
  // faint horizontal noise streaks to add texture
  for (let i=0;i<220;i++){
    const y = Math.random()*c.height;
    ctx.globalAlpha = 0.03 + Math.random()*0.07;
    ctx.fillStyle = `rgba(255,255,255,${0.01 + Math.random()*0.02})`;
    ctx.fillRect(Math.random()*24 - 12, y, c.width + Math.random()*40, 1 + Math.random()*2);
  }
  ctx.globalAlpha = 1.0;
  // create sprite texture
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, opacity:0.82, blending:THREE.AdditiveBlending, depthWrite:false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(width, height, 1);
  spr.position.set(0, 0, -100);
  return spr;
}
const nebula = createNebulaSprite(220, 920);
scene.add(nebula);

/* ---------- functions for procedural small textures (glow, star dot, trail) ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const cx = size/2;
  const grad = ctx.createRadialGradient(cx,cx,2, cx,cx, cx);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.8)');
  const r = (colorHex>>16)&255, g=(colorHex>>8)&255, b=colorHex&255;
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.36)`);
  grad.addColorStop(0.9, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}

function generateTrailTexture(){
  const w = 512, h = 64;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,w,0);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.08)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.26)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);
  return new THREE.CanvasTexture(c);
}
const TRAIL_TEX = generateTrailTexture();

/* ---------- Orbs (translucent planets) ---------- */
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};
const CLUSTER_RADIUS = 220;

function createTranslucentMaterial(colorHex){
  const color = new THREE.Color(colorHex);
  const mat = new THREE.MeshPhysicalMaterial({
    color: color.clone().multiplyScalar(0.85),
    transparent: true,
    opacity: 0.18,
    roughness: 0.05,
    metalness: 0.02,
    transmission: 0.9,
    clearcoat: 0.2,
    reflectivity: 0.2,
    depthWrite: false
  });
  mat.emissive = color.clone().multiplyScalar(0.02);
  mat.emissiveIntensity = 0.6;
  return mat;
}

GENRES.forEach((g, idx) => {
  const coreRadius = 28 + Math.random()*10;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const coreMat = createTranslucentMaterial(g.color);
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);

  // glow rim
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.18, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*7.6, coreRadius*7.6, 1);
  coreMesh.add(rim);

  // comet trail sprite (subtle silver/white)
  const trailMat = new THREE.SpriteMaterial({ map: TRAIL_TEX, color: 0xffffff, transparent:true, opacity:0.28, depthWrite:false, blending:THREE.AdditiveBlending });
  const trail = new THREE.Sprite(trailMat);
  trail.scale.set(coreRadius*3.2, coreRadius*0.9, 1);
  trail.position.set(-coreRadius*0.6, 0, 0); // behind orbit (we'll rotate)
  coreMesh.add(trail);

  // stardust ring (larger radius and complementary-ish color)
  const ringCount = 160 + Math.floor(Math.random()*120);
  const ringRadius = coreRadius * (2.6 + Math.random()*2.6);
  const positions = new Float32Array(ringCount * 3);
  for (let i=0;i<ringCount;i++){
    const a = (i / ringCount) * Math.PI*2;
    const r = ringRadius + (Math.random()-0.5) * (coreRadius*0.6);
    positions[i*3] = Math.cos(a) * r;
    positions[i*3+1] = Math.sin(a) * r * (0.72 + Math.random()*0.6);
    positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.6);
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const compColor = new THREE.Color(g.color).offsetHSL(0.5, -0.2, 0.06).getHex(); // shift hue for contrast
  const ringMat = new THREE.PointsMaterial({ size: 6.0, map: generateGlowTexture(compColor), transparent:true, opacity:0.82, depthWrite:false, blending:THREE.AdditiveBlending });
  ringMat.color = new THREE.Color(compColor).multiplyScalar(0.9);
  const ringPoints = new THREE.Points(ringGeo, ringMat);
  ringPoints.rotation.z = Math.random()*Math.PI*0.5;
  ringPoints.userData = { rotationSpeed: (idx%2===0 ? -0.004 : 0.004) * (0.8 + Math.random()*0.8) };

  const container = new THREE.Group();
  container.add(coreMesh);
  container.add(ringPoints);

  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.42, -idx*3);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core: coreMesh, ring: ringPoints, trail: trail, baseAngle, color: g.color };
});

/* ---------- UI wiring (genre boxes + playlist placeholder) ---------- */
const genreGrid = document.getElementById('genreGrid');
const playlistWrap = document.getElementById('playlistWrap');
const hud = document.getElementById('hud');
const hudText = document.getElementById('hudText');
const topRows = document.getElementById('topRows');

function luminance(hex){
  const r = (hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  return (r*299 + g*587 + b*114)/1000;
}

GENRES.forEach(g=>{
  const box = document.createElement('div');
  box.className = 'genre-box pixel-accent';
  box.textContent = g.name.split(' ').slice(0,2).join(' ');
  box.style.background = toCssHex(g.color);
  const textcolor = luminance(g.color) < 130 ? 'light' : 'dark';
  box.dataset.textcolor = (textcolor==='light') ? 'light' : 'dark';
  box.addEventListener('click', ()=> selectGenre(g.id));
  genreGrid.appendChild(box);
});

/* placeholder top artists sample (we'll fill with Spotify Top-50-like picks — you can replace) */
const SAMPLE_TOP = {
  'hard-techno': ['Regal', 'DMX Krew', 'I Hate Models', 'Perc', 'Dax J','Rebekah','Amelie Lens','Ancient Methods','Phase Fatale','Masayoshi Iimori','Anetha','Dylan','Terence Fixmer','Rrose','SNTS'],
  'techno': ['Charlotte de Witte','Adam Beyer','Carl Cox','Nina Kraviz','Joseph Capriati','Len Faki','Maceo Plex','Richie Hawtin','Dax J','Mad Mike','Slam','Cari Lekebusch','Chris Liebing','Seth Troxler','Ben Klock'],
  'house': ['Armand Van Helden','MK','Jamie Jones','Kerri Chandler','Purple Disco Machine','Disclosure','Solomun','Honey Dijon','Fisher','Claptone','Kevin Saunderson','John Summit','Dennis Ferrer','Franky Rizardo','Duke Dumont'],
  'dnb': ['Goldie','Andy C','Pendulum','Sub Focus','Noisia','Calibre','LTJ Bukem','High Contrast','Andy C','Adam F','Roni Size','Wilkinson','Netsky','Danny Byrd','Spor'],
  'dubstep': ['Skrillex','Zeds Dead','Doctor P','Flux Pavilion','Rusko','Excision','Noisia','Bassnectar','Benga','Skream','Caspa','Nero','Knife Party','Sub Focus','Rusko'],
  'electronic': ['Four Tet','Caribou','Bonobo','Jamie xx','Aphex Twin','Moderate','Boards of Canada','The Chemical Brothers','LCD Soundsystem','Kraftwerk','Flume','Tycho','Moby','Kiasmos','Sasha'],
  'pop': ['Dua Lipa','Billie Eilish','The Weeknd','Lana Del Rey','Doja Cat','Harry Styles','Ariana Grande','Taylor Swift','Demi Lovato','Olivia Rodrigo','Khalid','Shawn Mendes','Rihanna','Bruno Mars','Lady Gaga']
};
function renderTop(genreId){
  const arr = SAMPLE_TOP[genreId] || SAMPLE_TOP['pop'];
  topRows.innerHTML = '';
  for (let i=0;i<Math.min(50,arr.length);i++){
    const r = document.createElement('div'); r.className='row';
    const a = document.createElement('div'); a.className='artist'; a.textContent = `${i+1}. ${arr[i]}`;
    const c = document.createElement('div'); c.className='count'; c.textContent = (Math.max(1, 50-i));
    r.appendChild(a); r.appendChild(c); topRows.appendChild(r);
  }
}

/* playlist loader (attempt to place a small audio element inside playlistWrap) */
let currentAudio = null;
function loadPlaylistForGenre(genreId){
  // placeholder: choose a public mp3 / or embed Spotify player if you have an embed URL
  // Here we attempt to use a short public audio sample per genre — replace these URLs with real playlists
  const sampleMap = {
    'hard-techno':'https://ccmixter.org/content/PaulBatchelor/PaulBatchelor_-_2009_-_Overdrive.mp3',
    'techno':'https://ccmixter.org/content/betabug/mixtape/samples/betabug_-_beat.mp3',
    'house':'https://ccmixter.org/content/hugo/imp/06-House.mp3',
    'dnb':'https://ccmixter.org/content/JamesLast/goodtrack/wav/24-Jazztronik.mp3',
    'dubstep':'https://ccmixter.org/content/djdiffer/dj/dubstep_sample.mp3',
    'electronic':'https://ccmixter.org/content/SaunajokiHarju/08-Space-Ambience.mp3',
    'pop':'https://ccmixter.org/content/troy/04-poploop.mp3'
  };
  const url = sampleMap[genreId] || sampleMap['electronic'];
  if (currentAudio) { try { currentAudio.pause(); } catch(e){} currentAudio.remove(); currentAudio = null; }
  const a = document.createElement('audio');
  a.controls = true;
  a.src = url;
  a.loop = true;
  a.preload = 'auto';
  a.style.width = '100%';
  a.style.height = '100%';
  a.style.borderRadius = '6px';
  // try to play; will probably be blocked until user gesture
  a.play().catch(()=>{/*blocked until user gesture*/});
  playlistWrap.innerHTML = '';
  playlistWrap.appendChild(a);
  currentAudio = a;
}

/* select genre: zoom-ish HUD & load playlist and show top list */
let selectedGenre = null;
function selectGenre(id){
  selectedGenre = id;
  const g = GENRES.find(x=>x.id===id);
  if (!g) return;
  hud.style.display = 'flex'; hudText.textContent = g.name;
  renderTop(id);
  loadPlaylistForGenre(id);
  // tint nebula and central glow slightly by genre color
  if (nebula && nebula.material) {
    nebula.material.color = new THREE.Color(g.color);
    nebula.material.opacity = 0.9;
  }
  // show subtle highlight on orb: increase emissive intensity
  Object.values(ORB_MESHES).forEach(o=> {
    if (o.id === id) { o.core.material.emissiveIntensity = 1.8; } else { o.core.material.emissiveIntensity = 0.45; }
  });
  // tiny camera push toward center (portrait) — small lerp handled in animation
}

/* ---------- Interaction: raycast to tap an orb (also select genre) ---------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (ev)=>{
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const cores = [];
  ORB_GROUP.children.forEach(c => c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    // find container
    let hit = hits[0].object;
    let parent = null;
    for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent){
      const idx = parent.userData.idx;
      const genre = GENRES[idx];
      if (genre) selectGenre(genre.id);
    }
  } else {
    // if clicked empty space, hide HUD after a short delay
    setTimeout(()=> { hud.style.display = 'none'; }, 1300);
  }
});

/* ---------- Animation loop: vertical ribbon subtle motion + orbits + trails ---------- */
renderer.setClearColor(0x000010, 1);
function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // adjust nebula height to look good in portrait vs landscape
  const targetHeight = Math.max(720, Math.min(1400, window.innerHeight * 1.4));
  nebula.scale.set(220 * (window.innerWidth / 420), targetHeight, 1);
}
window.addEventListener('resize', onResize, {passive:true});
onResize();

let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;
  // twinkle stars
  starsFar.rotation.z += 0.00028 + Math.sin(t*0.13)*0.00002;
  starsNear.rotation.z -= 0.00048 + Math.cos(t*0.11)*0.00003;
  // subtle modulation
  const rmsSim = 0.06 + Math.sin(t*0.37)*0.02;

  // centered stars shimmer
  const posAttr = centerStars.geometry.attributes.position;
  const phases = centerStars.geometry.attributes.phase.array;
  for (let i=0;i<posAttr.count;i++){
    const baseY = posAttr.array[i*3+1];
    // small pulsing in size via material opacity
  }
  centerStars.material.opacity = 0.85 + Math.sin(t*1.8)*0.08;

  // nebula gentle float & rotate (vertical motion)
  nebula.position.y = Math.sin(t*0.4) * 8;
  nebula.material.opacity = 0.6 + Math.sin(t*0.22)*0.12;

  // ORB orbit: revolve around center (clockwise), but alternate some counterclockwise ring rotation handled in ring userData
  const clusterSpeed = 0.18 + Math.sin(t*0.07)*0.01;
  ORB_GROUP.children.forEach((container, idx) => {
    const baseAngle = container.userData.baseAngle || (idx / ORB_GROUP.children.length) * Math.PI*2;
    // make orbits more vertical-column aligned (so they revolve around central vertical ribbon)
    // we generate an angle that ensures uniform clockwise (positive) but add a small stagger to some
    const direction = (idx % 2 === 0) ? 1 : -1; // alternate direction for subtle staggering effect
    const angle = t * (clusterSpeed * (1 + idx*0.018)) * direction + baseAngle;
    const ex = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.48 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);
    container.position.x = Math.cos(angle) * ex;
    container.position.y = Math.sin(angle * 1.02 + idx*0.31) * ey;
    container.position.z = Math.sin(t*(0.55 + idx*0.02))*8 - idx*2;

    // rotate rings around orb and modulate opacity
    const odata = ORB_MESHES[GENRES[idx].id];
    if (odata && odata.ring){
      odata.ring.rotation.z += (odata.ring.userData.rotationSpeed || 0.003) * (1 + Math.sin(t*0.7)*0.3);
      odata.ring.material.opacity = 0.85 - Math.abs(Math.sin(t*0.6 + idx))*0.14 + rmsSim * 0.2;
    }

    // trail orientation faces motion: compute velocity approx by small angle offset
    const vAngle = t * (clusterSpeed * (1 + idx*0.018)) * direction + baseAngle + 0.06;
    // set trail sprite rotation to point opposite direction of motion
    if (odata && odata.trail){
      odata.trail.material.opacity = 0.24 + Math.abs(Math.sin(t*0.8 + idx))*0.06;
      const dirVec = new THREE.Vector3(Math.cos(vAngle)*ex, Math.sin(vAngle*1.02)*ey, 0);
      const angle2d = Math.atan2(dirVec.y, dirVec.x);
      odata.trail.rotation.z = angle2d; // align trail with motion
      // scale trail depending on speed
      const sp = 1 + Math.min(1.6, Math.abs(Math.sin(t*0.2 + idx))*0.6);
      odata.trail.scale.set((odata.core.geometry.parameters.radius||32)*4 * sp, (odata.core.geometry.parameters.radius||32)*0.8 * (0.9 + Math.random()*0.12), 1);
    }

    // soft breathing & emissive pulse
    if (odata && odata.core){
      const pulse = 1 + (0.12 * Math.abs(Math.sin(t*0.9 + idx)));
      odata.core.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.06);
      odata.core.material.emissiveIntensity = 0.45 + Math.abs(Math.sin(t*0.9 + idx))*0.8;
    }
  });

  renderer.render(scene, camera);
}
animate();

/* small helpers */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }

/* attempt to initialize UI with default genre */
selectGenre(GENRES[2].id); // default to House

/* expose a console-friendly check for orbs */
console.log('Scene ready — orbs:', Object.keys(ORB_MESHES).length);
</script>
</body>
</html>
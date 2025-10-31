/* app.js
   Mobile-first orbital genres scene (orbs, nebula, stars) + UI wiring (genre boxes, small playlist, top50)
   Expects:
     - <canvas id="three-canvas"></canvas>
     - DOM: #genreGrid, #playlistWrap, #topRows, .hud (optional)
   Defensive: no-ops if UI nodes missing.
   Three.js must be loaded first (e.g., <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/three.min.js"></script>)
*/

/* ---------- Small helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function safeGet(id, tag='div', createIfMissing=false){
  let el = document.getElementById(id);
  if (!el && createIfMissing){
    el = document.createElement(tag);
    el.id = id;
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    document.body.appendChild(el);
  }
  return el;
}

/* ---------- CONFIG: genres + UI mapping ---------- */
const GENRES = [
  { id:'hard-techno', name:'Hard Techno', color:0xff2b2b },
  { id:'techno',      name:'Techno',      color:0xd18cff },
  { id:'house',       name:'House',       color:0xffbf5f },
  { id:'dnb',         name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep',     name:'Dubstep',     color:0x00e5ff },
  { id:'electronic',  name:'Electronic',  color:0x1450ff },
  { id:'pop',         name:'Pop',         color:0xff66aa }
];

/* sample "Top" lists (replace with real data later) */
const SAMPLE_TOP = {
  'hard-techno': ['I Hate Models','Rebekah','Dax J','Regal','SNTS','Perc','Anetha','Amelie Lens','Ancient Methods','Phase Fatale','Rrose','Terence Fixmer','Masayoshi Iimori','Tommy Four Seven','Dylan'],
  'techno': ['Charlotte de Witte','Adam Beyer','Carl Cox','Nina Kraviz','Ben Klock','Richie Hawtin','Joseph Capriati','Laurent Garnier','Len Faki','Maceo Plex','Slam','Chris Liebing','Paul Kalkbrenner','Alan Fitzpatrick','Dax J'],
  'house': ['Kerri Chandler','Purple Disco Machine','Disclosure','Solomun','Honey Dijon','Fisher','Claptone','John Summit','MK','Duke Dumont','Dennis Ferrer','Franky Rizardo','Kevin Saunderson','Todd Edwards','KAYTRANADA'],
  'dnb': ['Goldie','Andy C','Pendulum','Noisia','High Contrast','Calibre','LTJ Bukem','Sub Focus','Roni Size','Netsky','Adam F','Wilkinson','Logistics','Danny Byrd','Spor'],
  'dubstep': ['Skrillex','Flux Pavilion','Excision','Rusko','Benga','Caspa','Nero','Skream','Zeds Dead','Doctor P','Bassnectar','Knife Party','Sub Focus','Virtual Riot','Seven Lions'],
  'electronic': ['Four Tet','Bonobo','Aphex Twin','Caribou','Jamie xx','Boards of Canada','The Chemical Brothers','LCD Soundsystem','Kraftwerk','Tycho','Flume','Moby','Bonobo','Kiasmos','Sasha'],
  'pop': ['Dua Lipa','Billie Eilish','The Weeknd','Doja Cat','Harry Styles','Ariana Grande','Taylor Swift','Olivia Rodrigo','Lana Del Rey','Bruno Mars','Rihanna','Khalid','Shawn Mendes','Lady Gaga','Coldplay']
};

/* ---------- DOM refs (defensive) ---------- */
const canvas = document.getElementById('three-canvas') || safeGet('three-canvas','canvas',true);
const genreGrid = safeGet('genreGrid','div',true);
const playlistWrap = safeGet('playlistWrap','div',true);
const topRows = safeGet('topRows','div',true);
const hud = document.getElementById('hud');
const hudText = document.getElementById('hudText');

/* ---------- Renderer & scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000010, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00008);

const CAMERA_Z = 740;
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 18, CAMERA_Z);
camera.lookAt(0,0,0);

const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

/* ---------- Procedural textures ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const cx = size/2;
  const grad = ctx.createRadialGradient(cx,cx,2, cx,cx,cx);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.9)');
  const r = (colorHex>>16)&255, g=(colorHex>>8)&255, b=colorHex&255;
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.36)`);
  grad.addColorStop(0.9, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateTrailTexture(){
  const w=512,h=64;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,w,0);
  g.addColorStop(0,'rgba(255,255,255,0.0)');
  g.addColorStop(0.15,'rgba(255,255,255,0.06)');
  g.addColorStop(0.45,'rgba(255,255,255,0.28)');
  g.addColorStop(0.75,'rgba(255,255,255,0.06)');
  g.addColorStop(1,'rgba(255,255,255,0.0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  return new THREE.CanvasTexture(c);
}
const TRAIL_TEX = generateTrailTexture();

/* ---------- Stars (far + near) and center concentrated sparkle ---------- */
function makeStars(count, spreadX=6000, spreadY=3600, spreadZ=6000, size=1.2, opacity=0.9){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const phases = new Float32Array(count);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5) * spreadX;
    pos[i*3+1] = (Math.random()-0.5) * spreadY;
    pos[i*3+2] = -Math.random() * spreadZ - 200;
    phases[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  return new THREE.Points(geo, mat);
}
const starsFar = makeStars(1200, 6000, 3600, 6000, 1.0, 0.9);
const starsNear = makeStars(700, 3000, 1700, 2600, 1.7, 0.6);
scene.add(starsFar, starsNear);

function makeConcentratedStars(count=300, radius=200, height=560){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const phases = new Float32Array(count);
  for (let i=0;i<count;i++){
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * (0.1 + Math.random()*0.9);
    const y = (Math.random()-0.5) * height;
    pos[i*3] = Math.cos(a) * r * 0.18;
    pos[i*3+1] = y;
    pos[i*3+2] = -60 + (Math.random()-0.5) * 48;
    phases[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size:1.9, transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending });
  return new THREE.Points(geo, mat);
}
const centerStars = makeConcentratedStars(360, 180, 640);
scene.add(centerStars);

/* ---------- Vertical nebula sprite ---------- */
function createNebulaSprite(width=240, height=920){
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
  const ctx = c.getContext('2d');
  // layered vertical gradient
  const grad = ctx.createLinearGradient(0,0,c.width,c.height);
  grad.addColorStop(0, 'rgba(20,16,34,0.0)');
  grad.addColorStop(0.18, 'rgba(40,28,80,0.08)');
  grad.addColorStop(0.38, 'rgba(24,46,92,0.10)');
  grad.addColorStop(0.58, 'rgba(20,40,120,0.12)');
  grad.addColorStop(0.78, 'rgba(20,14,36,0.06)');
  grad.addColorStop(1, 'rgba(6,6,10,0.0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,c.width,c.height);
  // horizontal noise streaks
  for (let i=0;i<200;i++){
    const y = Math.random() * c.height;
    ctx.globalAlpha = 0.02 + Math.random()*0.06;
    ctx.fillStyle = `rgba(255,255,255,${0.01 + Math.random()*0.02})`;
    ctx.fillRect(Math.random()*16 - 8, y, c.width + Math.random()*60, 1 + Math.random()*2);
  }
  ctx.globalAlpha = 1.0;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, opacity:0.82, blending:THREE.AdditiveBlending, depthWrite:false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(width, height, 1);
  spr.position.set(0, 0, -110);
  return spr;
}
const nebula = createNebulaSprite(220, 920);
scene.add(nebula);

/* ---------- Orbs + stardust rings ---------- */
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};
const CLUSTER_RADIUS = 220;

function createTranslucentMaterial(colorHex){
  const color = new THREE.Color(colorHex);
  const mat = new THREE.MeshPhysicalMaterial({
    color: color.clone().multiplyScalar(0.85),
    transparent: true,
    opacity: 0.18,
    roughness: 0.06,
    metalness: 0.02,
    transmission: 0.9,
    clearcoat: 0.18,
    reflectivity: 0.12,
    depthWrite: false
  });
  mat.emissive = color.clone().multiplyScalar(0.02);
  mat.emissiveIntensity = 0.6;
  return mat;
}

GENRES.forEach((g, idx) => {
  const coreRadius = 26 + Math.random()*10;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const coreMat = createTranslucentMaterial(g.color);
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);

  // glow rim sprite
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.16, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*7.4, coreRadius*7.4, 1);
  coreMesh.add(rim);

  // trail sprite - silver/white subtle
  const trailMat = new THREE.SpriteMaterial({ map: TRAIL_TEX, color: 0xffffff, transparent:true, opacity:0.28, depthWrite:false, blending:THREE.AdditiveBlending });
  const trail = new THREE.Sprite(trailMat);
  trail.scale.set(coreRadius*3.2, coreRadius*0.9, 1);
  trail.position.set(-coreRadius*0.6, 0, 0);
  coreMesh.add(trail);

  // stardust ring
  const ringCount = 140 + Math.floor(Math.random()*140);
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
  // complementary-ish color for ring (hue shift)
  const compColor = new THREE.Color(g.color).offsetHSL(0.45, -0.18, 0.04).getHex();
  const ringMat = new THREE.PointsMaterial({ size: 6.0, map: generateGlowTexture(compColor), transparent:true, opacity:0.82, depthWrite:false, blending:THREE.AdditiveBlending });
  ringMat.color = new THREE.Color(compColor).multiplyScalar(0.9);
  const ringPoints = new THREE.Points(ringGeo, ringMat);
  ringPoints.rotation.z = Math.random() * Math.PI*0.5;
  ringPoints.userData = { rotationSpeed: (idx%2===0 ? -0.004 : 0.004) * (0.8 + Math.random()*0.8) };

  // assemble container
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

/* ---------- UI: populate genre boxes & top list ---------- */
function luminance(hex){
  const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255;
  return (r*299 + g*587 + b*114)/1000;
}
function createGenreBoxes(){
  if (!genreGrid) return;
  genreGrid.innerHTML = '';
  GENRES.forEach(g=>{
    const box = document.createElement('div');
    box.className = 'genre-box';
    box.textContent = g.name.split(' ').slice(0,2).join(' ');
    box.style.background = toCssHex(g.color);
    box.style.color = (luminance(g.color) < 130) ? '#fff' : '#000';
    box.addEventListener('click', ()=> selectGenre(g.id));
    genreGrid.appendChild(box);
  });
}
createGenreBoxes();

function renderTop(genreId){
  if (!topRows) return;
  const arr = SAMPLE_TOP[genreId] || SAMPLE_TOP['pop'];
  topRows.innerHTML = '';
  for (let i=0;i<Math.min(50,arr.length);i++){
    const r = document.createElement('div'); r.className='row';
    const a = document.createElement('div'); a.className='artist'; a.textContent = `${i+1}. ${arr[i]}`;
    const c = document.createElement('div'); c.className='count'; c.textContent = String(Math.max(1, 50-i));
    r.appendChild(a); r.appendChild(c); topRows.appendChild(r);
  }
}

/* ---------- Simple audio loader for playlist tile ---------- */
let currentAudio = null;
const SAMPLE_AUDIO = {
  'hard-techno':'https://ccmixter.org/content/PaulBatchelor/PaulBatchelor_-_2009_-_Overdrive.mp3',
  'techno':'https://ccmixter.org/content/betabug/mixtape/samples/betabug_-_beat.mp3',
  'house':'https://ccmixter.org/content/hugo/imp/06-House.mp3',
  'dnb':'https://ccmixter.org/content/JamesLast/goodtrack/wav/24-Jazztronik.mp3',
  'dubstep':'https://ccmixter.org/content/djdiffer/dj/dubstep_sample.mp3',
  'electronic':'https://ccmixter.org/content/SaunajokiHarju/08-Space-Ambience.mp3',
  'pop':'https://ccmixter.org/content/troy/04-poploop.mp3'
};
function loadPlaylistForGenre(genreId){
  if (!playlistWrap) return;
  const url = SAMPLE_AUDIO[genreId] || SAMPLE_AUDIO['electronic'];
  // remove prior audio
  if (currentAudio) { try{ currentAudio.pause(); }catch(e){} currentAudio.remove(); currentAudio = null; }
  const a = document.createElement('audio');
  a.controls = true;
  a.src = url;
  a.loop = true;
  a.preload = 'auto';
  a.style.width = '100%';
  a.style.height = '100%';
  a.style.borderRadius = '8px';
  a.play().catch(()=>{/* autoplay blocked until user gesture — ok */});
  playlistWrap.innerHTML = '';
  playlistWrap.appendChild(a);
  currentAudio = a;
}

/* ---------- select genre logic (highlights orb + load UI) ---------- */
let selectedGenre = null;
function selectGenre(id){
  selectedGenre = id;
  const g = GENRES.find(x=>x.id===id);
  if (!g) return;
  // HUD text
  if (hud && hudText){ hud.style.display = 'flex'; hudText.textContent = g.name; }
  // load top & playlist
  renderTop(id);
  loadPlaylistForGenre(id);
  // tint nebula slightly (by changing sprite material color if available)
  if (nebula && nebula.material && nebula.material.color){
    nebula.material.color = new THREE.Color(g.color);
    nebula.material.opacity = 0.9;
  }
  // highlight orbs
  Object.values(ORB_MESHES).forEach(o=>{
    if (o.id === id){
      o.core.material.emissiveIntensity = 1.8;
      // small scale
      o.core.scale.lerp(new THREE.Vector3(1.06,1.06,1.06), 0.12);
    } else {
      o.core.material.emissiveIntensity = 0.45;
      o.core.scale.lerp(new THREE.Vector3(1,1,1), 0.08);
    }
  });
}

/* ---------- Raycast: tap to pick orb ---------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (ev) => {
  // convert to NDC
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const cores = [];
  ORB_GROUP.children.forEach(c => c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    // find container match
    let hit = hits[0].object;
    let parent = null;
    for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent){
      const idx = parent.userData.idx;
      const genre = GENRES[idx];
      if (genre) selectGenre(genre.id);
    }
  } else {
    // hide HUD after a bit
    if (hud) setTimeout(()=> hud.style.display = 'none', 1200);
  }
});

/* ---------- Resize handling ---------- */
function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // adjust nebula scale to suit portrait tallness
  const targetHeight = Math.max(720, Math.min(1400, window.innerHeight * 1.4));
  nebula.scale.set(220 * (window.innerWidth / 420), targetHeight, 1);
}
window.addEventListener('resize', onResize, { passive:true });
onResize();

/* ---------- Animation ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // stars rotate / twinkle
  starsFar.rotation.z += 0.00028 + Math.sin(t*0.13)*0.00002;
  starsNear.rotation.z -= 0.00048 + Math.cos(t*0.11)*0.00003;
  starsNear.material.opacity = 0.55 + Math.sin(t*0.9 + 3.1) * 0.08;
  starsFar.material.opacity = 0.88 + Math.cos(t*0.4 + 1.7) * 0.04;

  // center sparkle shimmer
  centerStars.material.opacity = 0.78 + Math.sin(t*1.8)*0.08;

  // nebula float
  nebula.position.y = Math.sin(t*0.36) * 8;
  nebula.material.opacity = 0.62 + Math.sin(t*0.22)*0.12;

  // orbit orbs around central vertical axis; alternate direction slightly for stagger
  const clusterSpeed = 0.18 + Math.sin(t*0.07)*0.01;
  ORB_GROUP.children.forEach((container, idx) => {
    const baseAngle = container.userData.baseAngle || (idx / ORB_GROUP.children.length) * Math.PI*2;
    const direction = (idx % 2 === 0) ? 1 : -1; // alternate
    const angle = t * (clusterSpeed * (1 + idx*0.018)) * direction + baseAngle;
    const ex = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.48 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);

    container.position.x = Math.cos(angle) * ex;
    container.position.y = Math.sin(angle * 1.02 + idx*0.31) * ey;
    container.position.z = Math.sin(t*(0.55 + idx*0.02))*8 - idx*2;

    // rotate ring
    const odata = ORB_MESHES[GENRES[idx].id];
    if (odata && odata.ring){
      odata.ring.rotation.z += (odata.ring.userData.rotationSpeed || 0.003) * (1 + Math.sin(t*0.7)*0.3);
      odata.ring.material.opacity = 0.85 - Math.abs(Math.sin(t*0.6 + idx))*0.14;
    }

    // orient trail to motion
    if (odata && odata.trail){
      const vAngle = t * (clusterSpeed * (1 + idx*0.018)) * direction + baseAngle + 0.06;
      const dirVec = new THREE.Vector3(Math.cos(vAngle)*ex, Math.sin(vAngle*1.02)*ey, 0);
      const angle2d = Math.atan2(dirVec.y, dirVec.x);
      odata.trail.rotation.z = angle2d;
      const sp = 1 + Math.min(1.6, Math.abs(Math.sin(t*0.2 + idx))*0.6);
      const rr = (odata.core.geometry.parameters.radius||32);
      odata.trail.scale.set(rr*4 * sp, rr*0.8 * (0.92 + (idx*0.01)), 1);
      odata.trail.material.opacity = 0.24 + Math.abs(Math.sin(t*0.8 + idx))*0.06;
    }

    // breathing scale & emissive pulse
    if (odata && odata.core){
      const pulse = 1 + (0.12 * Math.abs(Math.sin(t*0.9 + idx)));
      odata.core.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.06);
      odata.core.material.emissiveIntensity = 0.45 + Math.abs(Math.sin(t*0.9 + idx))*0.8;
    }
  });

  renderer.render(scene, camera);
}
animate();

/* ---------- initialization: default selection ---------- */
selectGenre(GENRES[2].id); // default = House

/* ---------- debugging info ---------- */
console.log('app.js initialized — orbs:', Object.keys(ORB_MESHES).length);
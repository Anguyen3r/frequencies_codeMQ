/* app.js — Unified scene with ribbon, orbiting bubbles, audio-reactive visuals
   Replace existing app.js with this file. Uses Three.js loaded in index.html.
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // paste your Firebase config here to enable realtime DB (optional)
const INTRO_TRACK_URL = 'https://soundcloud.com/user-200235414/wave-1'; // your SoundCloud track (intro)
const AUTO_INTRO_FADE_SECONDS = 2.0; // fade duration for intro overlay (seconds)
const INTRO_UI_DELAY = 2800; // milliseconds: show UI shortly after fade begins

/* ---------- Utilities ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* ---------- Persistence (Firebase optional / localStorage fallback) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch (e) {
    console.warn('Firebase init failed; falling back to localStorage', e);
    useFirebase = false;
  }
}
async function saveVote(genreId, artistName, b2b){
  const rec = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef) {
    await dbRef.child(genreId).push(rec);
  } else {
    const KEY='codemq_votes';
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    data[genreId] = data[genreId] || [];
    data[genreId].push(rec);
    if (data[genreId].length > 20000) data[genreId].splice(0, data[genreId].length-20000);
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

/* ---------- UI references (must match HTML) ---------- */
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
const canvasWrap = document.getElementById('canvasWrap');
const fadeOverlayEl = document.getElementById('fade-overlay') || document.getElementById('fadeOverlay');

/* Hide UI initially until user interacts (we'll reveal after intro) */
if (uiWrap){ uiWrap.style.opacity = '0'; uiWrap.style.pointerEvents = 'none'; }
if (legendWrap){ legendWrap.style.opacity = '0'; legendWrap.style.pointerEvents = 'none'; }

/* ---------- Genre data (colors etc) ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79, playlist:'https://soundcloud.com/your-hard-techno-playlist' },
  { id:'house', name:'House', color:0xffbf5f, playlist:'https://soundcloud.com/your-house-playlist' },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85, playlist:'https://soundcloud.com/your-dnb-playlist' },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff, playlist:'https://soundcloud.com/your-dubstep-playlist' },
  { id:'electronic', name:'Electronic / Dance', color:0x9f5fff, playlist:'https://soundcloud.com/your-electronic-playlist' },
  { id:'mainstream', name:'Mainstream / International', color:0xffffff, playlist:'https://soundcloud.com/your-mainstream-playlist' }
];

/* populate UI selects & legend */
GENRES.forEach(g => {
  if (genreSelect){
    const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.name; genreSelect.appendChild(opt);
  }
  if (legendList){
    const li = document.createElement('li'); li.textContent = g.name;
    li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
    const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
    li.style.color = lum >= 128 ? '#000' : '#fff';
    legendList.appendChild(li);
  }
});
if (toggleTop) toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));
if (genreSelect) genreSelect.addEventListener('change', ()=> computeAndRenderTop());

/* ---------- THREE.JS SCENE ---------- */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

/* Camera tuned so bubbles occupy ~4/5 height (you can tweak CAMERA_Z) */
const CAMERA_Z = 1000;
const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 12000);
camera.position.set(0, 18, CAMERA_Z);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000010, 1);
canvasWrap.appendChild(renderer.domElement);

/* Lights */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45); scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9); dirLight.position.set(10,20,10); scene.add(dirLight);

/* ---------- Starfield (two layered for twinkle) ---------- */
function makeStarLayer(count, spreadX=6000, spreadY=3600, spreadZ=6000, size=1.2, opacity=0.9){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5) * spreadX;
    pos[i*3+1] = (Math.random()-0.5) * spreadY;
    pos[i*3+2] = -Math.random() * spreadZ - 200;
    phase[i] = Math.random()*Math.PI*2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase,1));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const pts = new THREE.Points(geo, mat);
  return { pts, geo, mat };
}
const starsFar = makeStarLayer(1400, 7000, 4200, 7000, 1.1, 0.9);
const starsNear = makeStarLayer(700, 3800, 2600, 3800, 2.0, 0.65);
scene.add(starsFar.pts, starsNear.pts);

/* ---------- Dust plane (very far back) ---------- */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(9000, 4800), new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.04, depthWrite:false }));
dustPlane.position.set(0,0,-3000);
scene.add(dustPlane);

/* ---------- Procedural tiny textures for points/sprites ---------- */
function generateGlowTexture(hex){
  const size = 256;
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,6,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.25,'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, toCssRgba(hex, 0.3));
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTiny(){
  const s=48; const c=document.createElement('canvas'); c.width=c.height=s; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.2,'rgba(255,255,255,0.95)');
  g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }

/* ---------- Orbital cluster: bubbles, rings, gas ---------- */
const CLUSTER_RADIUS = 520;
const BUBBLE_GROUP = new THREE.Group(); scene.add(BUBBLE_GROUP);
const BUBBLES = {}; // keyed by genre id

function createStardustRing(coreRadius, colorHex, tilt, particleCount=260, size=9.0, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.9 + Math.random()*0.9);
  const positions = new Float32Array(particleCount*3);
  const sizes = new Float32Array(particleCount);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5) * (coreRadius*0.36);
    positions[i*3] = Math.cos(theta) * rr;
    positions[i*3+1] = Math.sin(theta) * rr;
    positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.5);
    sizes[i] = (Math.random()*1.6 + 1.8) * size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTiny(), transparent:true, opacity:0.95, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.95);
  const pts = new THREE.Points(geo, mat);
  group.add(pts);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*2.0, ringRadius*2.0, 1);
  group.add(glow);

  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.004 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, pts, mat, rotationSpeed, ringRadius };
}

GENRES.forEach((g, idx) => {
  const color = new THREE.Color(g.color);
  // larger bubble radii (user requested larger)
  const coreRadius = 60 + Math.random()*26;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 64, 64);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent:true, opacity:0.30, roughness:0.16, metalness:0.06,
    transmission: 0.72, emissive: color.clone().multiplyScalar(0.02), emissiveIntensity:0.6, clearcoat:0.22
  });
  coreMat.depthWrite = false; // allow overlapping blending

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);

  // subtle rim sprite
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*8.8, coreRadius*8.8, 1);
  coreMesh.add(rim);

  // container for orbit transforms
  const container = new THREE.Group();
  container.add(coreMesh);

  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  // initial elliptical placement (will be animated in loop)
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.55, -idx*8);

  // stardust ring (tilt variety, counter-rotating)
  const tilt = { x:(Math.random()*0.45 - 0.225), y:(Math.random()*0.45 - 0.225), z:(Math.random()*0.6 - 0.3) };
  const ringObj = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random()*160), 10.5, (idx % 2 === 0));
  container.add(ringObj.group);

  // gas halo
  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.035, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  BUBBLE_GROUP.add(container);
  BUBBLES[g.id] = { id:g.id, idx, container, core: coreMesh, ringObj, gas: gasMesh, baseAngle, coreRadius, genre:g };
});

/* ---------- Aurora/Smoke sprites ---------- */
function createAuroraSprite(colorStops, size=1600, opacity=0.3){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(size/2,size/2,20,size/2,size/2,size*0.95);
  colorStops.forEach(s=> g.addColorStop(s.offset, s.color));
  ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  return spr;
}

const smokeBack1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(120,40,200,0.12)'},{offset:0.8,color:'rgba(20,150,200,0.06)'},{offset:1,color:'rgba(0,0,0,0)'}], 2000, 0.42);
smokeBack1.scale.set(3000,1600,1); smokeBack1.position.set(-60,-120,-1800); scene.add(smokeBack1);
const smokeBack2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(200,40,140,0.10)'},{offset:0.6,color:'rgba(60,40,220,0.08)'},{offset:1,color:'rgba(0,0,0,0)'}], 1800, 0.3);
smokeBack2.scale.set(2600,1300,1); smokeBack2.position.set(120,-60,-1600); scene.add(smokeBack2);
const smokeFront1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(160,40,220,0.08)'},{offset:0.7,color:'rgba(30,200,220,0.07)'},{offset:1,color:'rgba(0,0,0,0)'}], 1400, 0.30);
smokeFront1.scale.set(2200,1100,1); smokeFront1.position.set(30,80,-320); scene.add(smokeFront1);
const smokeFront2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(240,120,100,0.06)'},{offset:0.7,color:'rgba(90,80,255,0.05)'},{offset:1,color:'rgba(0,0,0,0)'}], 1200, 0.24);
smokeFront2.scale.set(1800,900,1); smokeFront2.position.set(-80,40,-260); scene.add(smokeFront2);

/* corner gas blobs */
const cornerSpecs = [
  {x:-1,y:-1,color:'rgba(160,40,220,0.14)'},
  {x:1,y:-0.9,color:'rgba(40,200,220,0.11)'},
  {x:-0.9,y:1,color:'rgba(240,120,100,0.09)'},
  {x:0.9,y:0.9,color:'rgba(100,120,255,0.07)'}
];
const cornerSprites = [];
cornerSpecs.forEach((s,i)=>{
  const spr = createAuroraSprite([{offset:0,color:s.color},{offset:1,color:'rgba(0,0,0,0)'}], 900, 0.14);
  spr.scale.set(900,900,1);
  spr.position.set(s.x * 1200 * (0.6 + Math.random()*0.4), s.y * 700 * (0.6 + Math.random()*0.4), -320);
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- Ribbon (shader plane) ----------
   - horizontal across center, many segments
   - vertex displacement for wave + audio reaction
   - fragment uses gradient that shifts toward active genre color
*/
const RIBBON_WIDTH = 16.0;
const RIBBON_LENGTH = 2200;
const RIBBON_SEGMENTS = 800;

const ribbonGeo = new THREE.PlaneBufferGeometry(RIBBON_LENGTH, RIBBON_WIDTH, RIBBON_SEGMENTS, 8);
ribbonGeo.rotateX(-Math.PI/2);
ribbonGeo.rotateZ(Math.PI/12); // slight diagonal tilt (up-right)
const ribbonUniforms = {
  time: { value: 0.0 },
  amplitude: { value: 0.0 },
  colorA: { value: new THREE.Color(0x607d8b) },
  colorB: { value: new THREE.Color(0x102030) },
  opacity: { value: 0.85 },
  flowSpeed: { value: 1.0 }
};
/* simple shader to displace vertices along Z relative to X and time and amplitude */
const ribbonMat = new THREE.ShaderMaterial({
  uniforms: ribbonUniforms,
  vertexShader: `
    precision highp float;
    uniform float time;
    uniform float amplitude;
    uniform float flowSpeed;
    varying float vU;
    varying float vWave;
    void main(){
      vU = uv.x;
      float xPos = position.x;
      // base wave across X — several harmonics for organic feel
      float w = sin((xPos*0.006 + time*flowSpeed)*2.0) * 0.6;
      w += 0.5 * sin((xPos*0.01 + time*flowSpeed*1.3)*3.0);
      w += 0.25 * sin((xPos*0.02 + time*flowSpeed*0.7)*5.0);
      // audio amplitude drives displacement
      vWave = w;
      vec3 p = position;
      p.y += w * amplitude * 18.0; // vertical displacement
      p.z += cos(xPos*0.004 + time*flowSpeed) * amplitude * 8.0; // depth wobble
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
    }`,
  fragmentShader: `
    precision highp float;
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform float opacity;
    varying float vU;
    varying float vWave;
    void main(){
      // gradient across U, boosted by wave
      vec3 col = mix(colorB, colorA, smoothstep(0.15, 0.85, vU));
      // add a soft luminous stripe
      float stripe = exp(-pow((vU-0.5)*8.0,2.0));
      float glow = pow(abs(vWave)*0.8 + stripe*0.8, 1.4);
      vec3 finalColor = col + vec3(1.0,0.9,0.8) * glow * 0.25;
      gl_FragColor = vec4(finalColor, opacity * (0.6 + 0.4*stripe));
    }`,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
ribbonMesh.position.set(0, -6, -40);
scene.add(ribbonMesh);

/* ---------- Raycasting & pointer handling ---------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pointerToNDC(e){
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left)/rect.width) * 2 - 1,
    y: -((e.clientY - rect.top)/rect.height) * 2 + 1
  };
}

/* reveal UI on first interaction if not already visible */
function revealUIIfHidden(){
  if (uiWrap && uiWrap.style.opacity === '0'){ uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; }
  if (legendWrap && legendWrap.style.opacity === '0'){ legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }
}

/* handle pointer down for clicking bubbles */
function onPointerDown(e){
  revealUIIfHidden();
  const ndc = pointerToNDC(e);
  pointer.x = ndc.x; pointer.y = ndc.y;
  raycaster.setFromCamera(pointer, camera);
  // collect bubble cores (SphereGeometry meshes)
  const cores = [];
  BUBBLE_GROUP.children.forEach(c => c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    // find parent container
    let parent = null;
    for (const c of BUBBLE_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent){
      const found = Object.values(BUBBLES).find(o => o.container === parent);
      if (found) openCenteredModal(found.id);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Centered modal (glass/AR-like) ---------- */
let activeModal = null;
function closeModal(){ if (!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal=null; }
function openCenteredModal(genreId){
  closeModal();
  const G = GENRES.find(g=>g.id===genreId); if (!G) return;
  // build modal DOM
  const modal = document.createElement('div');
  modal.className = 'panel';
  modal.style.position = 'fixed'; modal.style.left='50%'; modal.style.top='50%';
  modal.style.transform = 'translate(-50%,-50%)'; modal.style.zIndex = 99999; modal.style.width='480px'; modal.style.maxWidth='92vw';
  modal.style.backdropFilter = 'blur(6px) saturate(140%)';
  modal.innerHTML = `
    <button class="closeX" aria-label="Close" style="position:absolute;right:12px;top:12px;border:none;background:transparent;color:#dfefff;font-size:20px;cursor:pointer">✕</button>
    <h3 style="margin-top:6px">${G.name}</h3>
    <p style="color:#cfd8e6;margin-top:4px;font-size:13px">Who's your favorite artist? (Dream B2B optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px;background:rgba(255,255,255,0.02);color:#fff" />
    <input class="b2b" placeholder="Dream B2B (optional)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px;background:rgba(255,255,255,0.02);color:#fff" />
    <textarea class="why" rows="3" placeholder="Why (optional)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px;background:rgba(255,255,255,0.02);color:#fff"></textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
      <div style="display:flex;gap:8px;align-items:center">
        <input id="modalAudioFile" type="file" accept="audio/*" style="display:none" />
        <button id="openAudioFile" class="btn" style="padding:8px;border-radius:6px;border:none;background:#222;color:#fff;cursor:pointer">Load Local Audio</button>
        <input id="modalAudioUrl" placeholder="Paste audio URL or SoundCloud link" style="padding:8px;border-radius:6px;border:none;width:220px;background:rgba(255,255,255,0.02);color:#fff" />
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost cancel" style="padding:8px;border-radius:6px;border:none;background:transparent;color:#fff">Cancel</button>
        <button class="btn submit" style="padding:8px;border-radius:6px;border:none;background:#1db954;color:#fff">Submit</button>
      </div>
    </div>
    <div class="audioContainer" style="margin-top:8px"></div>
  `;
  document.body.appendChild(modal);

  // interactions
  modal.querySelector('.closeX').addEventListener('click', ()=> closeModal());
  modal.querySelector('.cancel').addEventListener('click', ()=> closeModal());
  modal.querySelector('.submit').addEventListener('click', async ()=>{
    const artist = modal.querySelector('.artist').value.trim();
    if (!artist) { modal.querySelector('.artist').focus(); return; }
    const b2b = modal.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashBubble(genreId);
    computeAndRenderTop();
    closeModal();
  });

  // audio file + url loading
  const openAudioFile = modal.querySelector('#openAudioFile');
  const modalAudioFile = modal.querySelector('#modalAudioFile');
  const modalAudioUrl = modal.querySelector('#modalAudioUrl');
  openAudioFile.addEventListener('click', ()=> modalAudioFile.click());
  modalAudioFile.addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    await audioController.loadUrl(url);
    insertAudioPlayerInModal(modal, url, f.name);
  });
  modalAudioUrl.addEventListener('keydown', async (ev)=>{
    if (ev.key === 'Enter'){ const url = modalAudioUrl.value.trim(); if (!url) return; await audioController.loadUrl(url); insertAudioPlayerInModal(modal, url, url); }
  });

  activeModal = { dom: modal, genreId };
  setTimeout(()=> modal.querySelector('.artist').focus(), 120);
}

/* small audio player insert */
function insertAudioPlayerInModal(modal, src, label){
  let player = modal.querySelector('audio');
  if (!player){
    player = document.createElement('audio'); player.controls = true; player.style.width = '100%'; player.style.marginTop='8px';
    modal.querySelector('.audioContainer').appendChild(player);
  }
  player.src = src; player.play().catch(()=>{});
  let info = modal.querySelector('.audioLabel');
  if (!info){ info = document.createElement('div'); info.className='audioLabel'; info.style.fontSize='12px'; info.style.marginTop='6px'; modal.querySelector('.audioContainer').appendChild(info); }
  info.textContent = `Loaded: ${label}`;
}

/* ---------- UI Top list handling ---------- */
async function computeAndRenderTop(){
  const raw = await readAllVotesOnce();
  const perGenreCounts = {};
  GENRES.forEach(g=>{
    let arr = raw && raw[g.id] ? raw[g.id] : [];
    if (!Array.isArray(arr)) arr = Object.keys(arr||{}).map(k=>arr[k]);
    const counts = {};
    arr.forEach(r=>{ const k=(r.artist||'').trim(); if(!k) return; counts[k]=(counts[k]||0)+1; });
    const sorted = Object.keys(counts).map(a=>({artist:a,count:counts[a]})).sort((a,b)=>b.count-a.count);
    perGenreCounts[g.id]=sorted;
    updateBubbleHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });
  const sel = genreSelect.value || GENRES[0].id;
  const arr = perGenreCounts[sel] || []; let html='';
  for (let i=0;i<Math.min(50,arr.length);i++) html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  if (topList) topList.innerHTML = html;
}
function updateBubbleHighlight(genreId, topCount){
  const o = BUBBLES[genreId]; if (!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount)*0.9);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount)*0.12);
  o.core.scale.set(base, base, base);
}

/* small feedback flash on vote */
function flashBubble(genreId){
  const o = BUBBLES[genreId]; if (!o) return;
  const mat = o.core.material;
  const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.6, orig * 2.6);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ---------- AUDIO controller + analyzer ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, dataArray=null, audioEl=null, active=false, autoplayOncePlayed=false;
  async function ensure(){
    if (!audioCtx){ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048; dataArray = new Uint8Array(analyser.frequencyBinCount); }
  }
  // loads a URL into a media element and connects to analyser
  async function loadUrl(url, { loop=true, autoplay=true } = {}){
    try {
      await ensure();
      if (!audioEl){
        audioEl = document.createElement('audio');
        audioEl.crossOrigin='anonymous';
        audioEl.controls = false;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
      }
      if (source) try{ source.disconnect(); }catch(e){}
      audioEl.src = url;
      audioEl.loop = !!loop;
      await audioEl.play().catch(()=>{ /* may be blocked until interaction */ });
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      // attach small visible player into spotifyEmbed area (for user control)
      if (spotifyEmbed){
        spotifyEmbed.innerHTML = '';
        const clone = audioEl.cloneNode(true);
        clone.controls = true; clone.style.width='100%';
        clone.src = url;
        spotifyEmbed.appendChild(clone);
        clone.play().catch(()=>{});
      }
      return true;
    } catch(err){
      console.warn('audio load failed', err);
      active = false;
      return false;
    }
  }
  function stop(){ if (audioEl) try{ audioEl.pause(); }catch(e){} if (audioCtx && audioCtx.state!=='closed') try{ audioCtx.suspend(); }catch(e){} active=false; }
  function getAmps(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    // bass: average of lowest bins
    const lowCount = Math.max(1, Math.floor(dataArray.length * 0.03));
    let bass=0; for (let i=0;i<lowCount;i++) bass += dataArray[i];
    bass = bass/lowCount/255;
    // compute RMS for general energy
    let sum=0; for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length) / 255;
    return { bass, rms, raw: dataArray };
  }
  return { loadUrl, stop, getAmps, isActive: ()=> active };
})();

/* ---------- Star twinkle helper (per-star phase) ---------- */
function updateStarTwinkle(layer, time, amp){
  const phases = layer.geo.attributes.phase.array;
  // individual star opacities could be updated per-vertex via shader — simplified by modulating PointsMaterial.opacity
  // We'll modulate opacity globally per layer for efficiency, adding slight phase offsets.
  // Already in animate we update mat.opacity using time and amplitude.
}

/* ---------- Click -> switch playlist behavior ----------
   When user clicks a bubble (or opens modal), optionally load genre playlist.
*/
function loadGenreAudio(genreId){
  const genre = GENRES.find(g=>g.id===genreId);
  if (!genre) return;
  const url = genre.playlist || null;
  if (!url) return;
  audioController.loadUrl(url, { loop:true }).then(ok => {
    if (!ok) console.warn('failed loading genre playlist');
    // adapt ribbon color toward the genre color
    ribbonUniforms.colorA.value = new THREE.Color(genre.color);
    ribbonUniforms.colorB.value = new THREE.Color(0x08101a);
  });
}

/* ---------- Intro fade + autoplay once ---------- */
function playIntroOnce(){
  try {
    // session control: only auto-play intro once per session
    const already = sessionStorage.getItem('introPlayed_v1');
    if (already) return;
    sessionStorage.setItem('introPlayed_v1','1');

    // begin load + play intro track
    // attempt to load via audioController for analyzer compatibility
    audioController.loadUrl(INTRO_TRACK_URL, { loop:false }).then(ok=>{
      // if play is blocked, audioController will catch; UI reveal will wait for interaction
    }).catch(()=>{});
  } catch(e){ console.warn(e); }
  // fade overlay: we expect #fade-overlay exists (index.html)
  const overlay = document.getElementById('fade-overlay') || document.getElementById('fadeOverlay');
  if (overlay){
    // ensure overlay is visible initially (css has it), then fade
    overlay.style.transition = `opacity ${AUTO_INTRO_FADE_SECONDS}s ease`;
    // start fade immediately
    requestAnimationFrame(()=> {
      overlay.style.opacity = '0';
    });
    // remove overlay after fade
    setTimeout(()=> { try{ overlay.remove(); } catch(e){} }, AUTO_INTRO_FADE_SECONDS*1000 + 120);
    // reveal UI slightly after
    setTimeout(()=> { if (uiWrap){ uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; } if (legendWrap){ legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto'; } }, INTRO_UI_DELAY);
  } else {
    // if no overlay present then just reveal UI after short delay
    setTimeout(()=> { if (uiWrap){ uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; } if (legendWrap){ legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto'; } }, 400);
  }
}

/* ---------- Initial load: attempt intro (on first user gesture if blocked) ---------- */
window.addEventListener('load', ()=> {
  // If autoplay blocked, wait for first user interaction to play intro
  playIntroOnce();
  // If blocked, ensure user gesture will resume audio context
  document.body.addEventListener('pointerdown', function oncePlay(){ try{ audioController.loadUrl(INTRO_TRACK_URL, { loop:false }); }catch(e){} document.body.removeEventListener('pointerdown', oncePlay); }, { once:true });
});

/* ---------- Raycast pointer to open UI; already wired above ---------- */

/* ---------- Animation loop (single loop) ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const t = (now - start) * 0.001;

  // analyser-driven values
  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : 0.0;
  const rms = amps ? amps.rms : 0.06 + Math.sin(t*0.25)*0.02;

  // stars rotation + twinkle
  starsFar.pts.rotation.z += 0.00035 + bass*0.0008;
  starsNear.pts.rotation.z -= 0.00048 + rms*0.001;
  starsNear.mat.opacity = clamp(0.5 + Math.sin(t*0.9 + 3.1) * 0.08 + rms * 0.12, 0.2, 1.0);
  starsFar.mat.opacity = clamp(0.78 + Math.cos(t*0.4 + 1.7) * 0.04 + bass * 0.06, 0.2, 1.0);

  // dust plane slow rotate
  dustPlane.rotation.z += 0.00008;

  // ribbon uniforms update (amplitude reacts to bass + rms)
  ribbonUniforms.time.value = t;
  ribbonUniforms.amplitude.value = clamp(rms*1.6 + bass*0.8, 0.02, 1.6);
  ribbonUniforms.flowSpeed.value = 1.0 + bass*1.6;

  // smoke pulsing by audio
  const smokePulse = 0.6 + Math.sin(t*0.9)*0.12 + bass*0.9;
  smokeBack1.material.opacity = clamp(0.28 * smokePulse, 0.03, 0.8);
  smokeBack2.material.opacity = clamp(0.22 * (0.9 + Math.cos(t*0.7)*0.06 + bass*0.4), 0.02, 0.6);
  smokeFront1.material.opacity = clamp(0.24 * (0.9 + Math.sin(t*0.5)*0.06 + rms*0.9), 0.02, 0.6);
  smokeFront2.material.opacity = clamp(0.20 * (1 + Math.cos(t*0.63)*0.05 + bass*0.6), 0.02, 0.6);
  cornerSprites.forEach((s,i)=> s.material.opacity = clamp(0.12 + Math.sin(t*0.7 + i)*0.03 + bass*0.06, 0.02, 0.6));

  // camera subtle breathing and bass push
  const baseZ = CAMERA_Z;
  camera.position.z = baseZ + Math.sin(t*0.08) * 6 + bass * 100;
  camera.position.x = Math.sin(t*0.04) * 12 * (0.7 + rms * 0.8);
  camera.position.y = Math.cos(t*0.03) * 6 * (0.7 + rms * 0.6);
  camera.lookAt(0,0,0);

  // cluster orbit: single unified orbit (diagonal horizontal oval)
  // We compute an eccentric ellipse then rotate it (tilt) so it's diagonal up-right
  const clusterSpeed = 0.12 + bass * 0.45;
  const tiltAngle = Math.PI * 0.12; // tilt up-right
  const cosTilt = Math.cos(tiltAngle), sinTilt = Math.sin(tiltAngle);
  GENRES.forEach((g, idx) => {
    const o = BUBBLES[g.id];
    if (!o) return;
    const phaseOffset = o.baseAngle;
    const angle = t * clusterSpeed + phaseOffset * (0.6 + idx*0.06);
    // ellipse radii
    const rx = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    const ry = CLUSTER_RADIUS * 0.55 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);
    // position on ellipse before tilt
    let x = Math.cos(angle) * rx;
    let y = Math.sin(angle * 1.02 + idx*0.31) * ry;
    // apply tilt rotation around Z (diagonal)
    const tx = x * cosTilt - y * sinTilt;
    const ty = x * sinTilt + y * cosTilt;
    // small jitter/stagger so they don't cluster in triples
    o.container.position.x = tx + (idx - (GENRES.length-1)/2) * Math.sin(t*0.03)*2.0;
    o.container.position.y = ty + Math.cos(idx*0.5 + t*0.2)*3.6;
    o.container.position.z = Math.sin(t*(0.55 + idx*0.02))*10 - idx*4;

    // uniform rotation but stagger slightly; allow overlapping
    o.core.rotation.y += 0.0024 + idx*0.00024;
    o.core.rotation.x += 0.0011;

    // rings rotate opposite direction (counter-rotate design), with audio reaction
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass * 0.9);
    o.ringObj.mat.opacity = clamp(0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms * 0.22, 0.2, 1.0);

    // gas breathing
    o.gas.material.opacity = clamp(0.035 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.018, 0.01, 0.18);

    // rim sprite pulse
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.14 + rms * 0.28; });
  });

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize handling ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------- Playlist UI loader (top-right) ---------- */
if (loadSpotify){
  loadSpotify.addEventListener('click', async ()=>{
    const v = (spotifyInput.value||'').trim();
    if (!v) return;
    // If user gives a SoundCloud page URL, try to use it directly for audioController load.
    // Note: SoundCloud often requires oEmbed or streaming API; the raw URL may not be directly loadable due to CORS.
    // We'll just pass the URL to audioController.loadUrl — the user can paste direct MP3/OGG links for best compatibility.
    await audioController.loadUrl(v, { loop:true });
  });
}

/* ---------- Init compute + firebase listener ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());

/* ---------- Sanity ---------- */
setTimeout(()=> { if (!Object.keys(BUBBLES).length) console.error('Bubbles not initialized — check Three.js load'); }, 1200);

/* ---------- Helper: Load genre if user clicks bubble (wired via modal on submit) ---------- */
/* We'll allow modal's "Load Local Audio" to set audio; also clicking a bubble will call loadGenreAudio in openCenteredModal flow
   If you want direct immediate load on bubble click (without modal), uncomment loadGenreAudio in onPointerDown when found.
*/

/* End of app.js */

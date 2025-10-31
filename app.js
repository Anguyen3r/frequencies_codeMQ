/* app.js — complete, orbiting translucent bubbles + audio-reactive ribbon
   - Uses existing <canvas id="canvas"> if present; otherwise creates a renderer canvas.
   - Defensive about missing UI nodes (won't throw).
   - Orbits & subtle audio-pulse on bubbles (translucent / dreamlike).
   - Fade/overlay logic intentionally removed.
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // optional firebase config

/* ---------- Small Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* safe DOM getter / placeholder creator so script won't crash if your HTML is missing nodes */
function getEl(id, tag='div', createIfMissing=false, attrs={}){
  let el = document.getElementById(id);
  if (!el && createIfMissing){
    el = document.createElement(tag);
    el.id = id;
    Object.keys(attrs).forEach(k=>el.setAttribute(k, attrs[k]));
    // keep it visually hidden but present for script references
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    document.body.appendChild(el);
  }
  return el;
}

/* ---------- Persistence (Firebase optional / fallback localStorage) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch(e) {
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

/* ---------- UI refs & initial hidden state (defensive) ---------- */
/* original script expects various nodes; create harmless placeholders if missing */
const uiWrap       = getEl('ui', 'div', true);
const legendWrap   = getEl('legend', 'div', true);
const genreSelect  = getEl('genreSelect', 'select', true);
const topList      = getEl('topList', 'div', true);
const toggleTop    = getEl('toggleTop', 'button', true);
const leftPanel    = getEl('leftPanel', 'div', true);
const spotifyInput = getEl('spotifyInput', 'input', true);
const loadSpotify  = getEl('loadSpotify', 'button', true);
const spotifyEmbed = getEl('spotifyEmbed', 'div', true);
const legendList   = getEl('legendList', 'ul', true);

/* Hide UI and legend initially (appear on first interaction) — only if we found real elements */
if (uiWrap) { uiWrap.style.opacity = '0'; uiWrap.style.pointerEvents = 'none'; }
if (legendWrap) { legendWrap.style.opacity = '0'; legendWrap.style.pointerEvents = 'none'; }

/* ---------- Genres & Colors ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79 },
  { id:'house', name:'House', color:0xffbf5f },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },
  { id:'electronic', name:'Electronic / Dance', color:0x9f5fff },
  { id:'pop', name:'Pop', color:0xffffff }
];
GENRES.forEach(g=>{
  if (genreSelect && genreSelect.tagName === 'SELECT'){
    const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
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

/* ---------- Three.js core ---------- */
const wrap = getEl('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

const CAMERA_Z = 850;
const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 18, CAMERA_Z);
camera.lookAt(0,0,0);

/* use existing canvas if present (keeps DOM consistent) */
const existingCanvas = document.getElementById('canvas');
let renderer;
if (existingCanvas) {
  renderer = new THREE.WebGLRenderer({ canvas: existingCanvas, antialias:true, alpha:true });
} else {
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.domElement.style.position = 'fixed';
  wrap.appendChild(renderer.domElement);
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000010, 1);

const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

/* ---------- Starfield & Dust ---------- */
function makeStarLayer(count, spreadX=5000, spreadY=3000, spreadZ=5000, size=1.2, opacity=0.9){
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
  const points = new THREE.Points(geo, mat);
  return { points, geo, mat };
}
const starsFar = makeStarLayer(1400, 6000, 3600, 6000, 1.0, 0.9);
const starsNear = makeStarLayer(600, 3500, 2200, 3500, 1.8, 0.6);
scene.add(starsFar.points, starsNear.points);

const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800),
  new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false })
);
dustPlane.position.set(0,0,-2600);
scene.add(dustPlane);

/* ---------- Procedural small textures ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,6,size/2,size/2,size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, toCssRgba(colorHex, 0.28));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}

/* small helper for translucent material */
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
  return mat;
}

/* ---------- ORB cluster (translucent bubbles) ---------- */
const CLUSTER_RADIUS = 420;
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};

function createStardustRing(coreRadius, colorHex, tilt, particleCount=200, size=6.5, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.7);
  const positions = new Float32Array(particleCount*3);
  const sizes = new Float32Array(particleCount);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5) * (coreRadius*0.32);
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.5);
    sizes[i] = (Math.random()*1.2 + 1.2) * size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.75, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);
  const points = new THREE.Points(geo, mat);
  group.add(points);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*2.0, ringRadius*2.0, 1);
  group.add(glow);
  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.004 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, points, mat, rotationSpeed, ringRadius };
}

GENRES.forEach((g, idx) => {
  const color = new THREE.Color(g.color);
  const coreRadius = 36 + Math.random()*12;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const coreMat = createTranslucentMaterial(g.color);
  coreMat.emissive = color.clone().multiplyScalar(0.02);
  coreMat.emissiveIntensity = 0.6;

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  // rim glow sprite to give soft halo
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.18, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*8.6, coreRadius*8.6, 1);
  coreMesh.add(rim);

  const container = new THREE.Group();
  container.add(coreMesh);

  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.6, -idx*6);

  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  const ringObj = createStardustRing(coreRadius, g.color, tilt, 180 + Math.floor(Math.random()*120), 8.0, (idx % 2 === 0));
  container.add(ringObj.group);

  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.035, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core: coreMesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- Aurora/smoke layers ---------- */
function createAuroraSprite(colorStops, size=1600, opacity=0.3){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,20,size/2,size/2,size*0.95);
  colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
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

const cornerSpecs = [
  {x:-1.0,y:-1.0,color:'rgba(160,40,220,0.14)'},
  {x:1.0,y:-0.9,color:'rgba(40,200,220,0.11)'},
  {x:-0.9,y:1.0,color:'rgba(240,120,100,0.09)'},
  {x:0.9,y:0.9,color:'rgba(100,120,255,0.07)'}
];
const cornerSprites = [];
cornerSpecs.forEach((s,i)=>{
  const spr = createAuroraSprite([{offset:0,color:s.color},{offset:1,color:'rgba(0,0,0,0)'}], 900, 0.14);
  spr.scale.set(900,900,1);
  spr.position.set(s.x * 1200 * (0.6 + Math.random()*0.4), s.y * 700 * (0.6 + Math.random()*0.4), -320);
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- Audio / WebAudio Controller ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, freqData=null, timeData=null, audioEl=null, active=false;
  async function ensure(){
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.frequencyBinCount);
    }
  }
  async function loadUrl(url, { loop = true } = {}){
    try {
      await ensure();
      if (!audioEl){ audioEl = document.createElement('audio'); audioEl.crossOrigin='anonymous'; audioEl.controls=true; audioEl.style.width='100%'; }
      audioEl.src = url;
      audioEl.loop = !!loop;
      // attempt play (may be blocked until user gesture)
      audioEl.play().catch(()=>{});
      if (source) try{ source.disconnect(); }catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      if (spotifyEmbed) { spotifyEmbed.innerHTML = ''; spotifyEmbed.appendChild(audioEl); }
      return true;
    } catch(err){
      console.warn('audio load failed', err); active=false; return false;
    }
  }
  function stop(){
    if (audioEl) try{ audioEl.pause(); audioEl.currentTime = 0; }catch(e){}
    if (audioCtx && audioCtx.state!=='closed') try{ audioCtx.suspend(); }catch(e){}
    active=false;
  }
  function getAmps(){
    if (!analyser || !freqData) return null;
    analyser.getByteFrequencyData(freqData);
    const lowCount = Math.max(1, Math.floor(freqData.length * 0.02));
    let bass=0; for (let i=0;i<lowCount;i++) bass += freqData[i];
    bass = bass / lowCount / 255;
    let sum=0; for (let i=0;i<freqData.length;i++) sum += freqData[i]*freqData[i];
    const rms = Math.sqrt(sum / freqData.length) / 255;
    return { bass, rms, rawFreq: freqData };
  }
  function getTimeDomain(){
    if (!analyser || !timeData) return null;
    analyser.getByteTimeDomainData(timeData);
    return timeData; // Uint8Array 0..255
  }
  function isActive(){ return active; }
  return { loadUrl, stop, getAmps, getTimeDomain, isActive };
})();

/* ---------- Ribbon (uses time-domain waveform) ---------- */
const RIBBON = {};
function initRibbon(){
  const POINTS = 256;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(POINTS * 3);
  const colors = new Float32Array(POINTS * 3);
  function worldWidthAtZ(z) {
    const vFOV = camera.fov * Math.PI / 180;
    const height = 2 * Math.tan(vFOV / 2) * Math.abs(camera.position.z - z);
    const width = height * camera.aspect;
    return width;
  }
  const width = worldWidthAtZ(0) * 1.05;
  for (let i=0;i<POINTS;i++){
    const x = -width/2 + (i/(POINTS-1)) * width;
    positions[i*3] = x;
    positions[i*3+1] = Math.sin(i/6) * 10;
    positions[i*3+2] = -120;
    colors[i*3] = 0.8; colors[i*3+1] = 0.7; colors[i*3+2] = 1.0;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending });
  const line = new THREE.Line(geometry, mat);
  line.frustumCulled = false;
  scene.add(line);

  const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,c.width,0);
  g.addColorStop(0, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.06)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,c.width,c.height);
  const glowTex = new THREE.CanvasTexture(c);
  const spriteMat = new THREE.SpriteMaterial({ map: glowTex, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(width*1.05, Math.max(40, width*0.035), 1);
  sprite.position.set(0, -8, -140);
  scene.add(sprite);

  RIBBON.line = line;
  RIBBON.sprite = sprite;
  RIBBON.geometry = geometry;
  RIBBON.points = POINTS;
     RIBBON.update = function(dt){
    const timeData = audioController.getTimeDomain?.();
    const pos = RIBBON.geometry.attributes.position.array;
    if (timeData){
      const scaleY = 240;
      for (let i=0;i<RIBBON.points;i++){
        const y = ((timeData[i]||128) - 128) / 128 * scaleY;
        pos[i*3+1] = y * 0.2 + Math.sin(i*0.08 + dt*1.8)*6;
      }
      RIBBON.geometry.attributes.position.needsUpdate = true;
    }
    const amps = audioController.getAmps?.();
    if (amps){
      const baseScale = 1.0 + amps.bass * 0.3;
      RIBBON.sprite.scale.y = Math.max(40, RIBBON.sprite.scale.x*0.035*baseScale);
      RIBBON.sprite.material.opacity = 0.45 + amps.rms * 0.55;
    }
  };
}
initRibbon();

/* ---------- Compute Top Artists (fake / placeholder) ---------- */
async function computeAndRenderTop(){
  const all = await readAllVotesOnce();
  const genreId = genreSelect?.value || GENRES[0].id;
  const arr = (all[genreId] || []).slice(-500);
  const counts = {};
  arr.forEach(v=>{
    const name = v.artist?.trim();
    if (!name) return;
    counts[name] = (counts[name]||0)+1;
  });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if (topList){
    topList.innerHTML = top.map(([n,c])=>`<div>${escapeHtml(n)} <small>×${c}</small></div>`).join('');
  }
}

/* ---------- Animation Loop ---------- */
let lastT = 0;
function animate(t){
  requestAnimationFrame(animate);
  const dt = (t - lastT)/1000; lastT = t;
  const amps = audioController.getAmps?.();

  // orbit + pulsate each orb
  const time = t * 0.0002;
  for (const g of GENRES){
    const obj = ORB_MESHES[g.id];
    if (!obj) continue;
    const speed = 0.25 + obj.idx * 0.07;
    const r = CLUSTER_RADIUS * (0.9 + Math.sin(time*0.5 + obj.idx)*0.05);
    const ang = obj.baseAngle + time*speed;
    obj.container.position.x = Math.cos(ang) * r;
    obj.container.position.y = Math.sin(ang*0.9) * r*0.55;
    obj.container.rotation.y += dt*obj.ringObj.rotationSpeed*0.5;
    obj.container.rotation.x += dt*obj.ringObj.rotationSpeed*0.2;
    const pulse = 1 + (amps?.bass||0)*0.25 + Math.sin(t*0.002+obj.idx)*0.05;
    obj.core.scale.set(pulse,pulse,pulse);
    obj.gas.material.opacity = 0.03 + (amps?.rms||0)*0.05;
  }

  // rotate smoke layers slightly
  smokeBack1.rotation.z += dt*0.01;
  smokeBack2.rotation.z -= dt*0.008;
  smokeFront1.rotation.z += dt*0.014;
  smokeFront2.rotation.z -= dt*0.012;
  cornerSprites.forEach((s,i)=> s.rotation.z += (i%2?-1:1)*dt*0.015);

  // subtle camera motion
  camera.position.x = Math.sin(time*0.4)*50;
  camera.position.y = Math.sin(time*0.8)*20 + 10;
  camera.lookAt(0,0,0);

  // ribbon
  RIBBON.update?.(t*0.001);

  // twinkle stars
  [starsFar, starsNear].forEach(layer=>{
    const pos = layer.geo.attributes.position.array;
    const phase = layer.geo.attributes.phase.array;
    for (let i=0;i<phase.length;i++){
      const s = 0.9 + Math.sin(t*0.001 + phase[i])*0.1;
      pos[i*3+1] += Math.sin(t*0.0008 + i)*0.01;
      layer.mat.size = s * (layer===starsFar?1.0:1.8);
    }
  });

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

/* ---------- Resize ---------- */
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- Basic Interaction ---------- */
if (loadSpotify){
  loadSpotify.addEventListener('click', ()=>{
    const url = spotifyInput?.value?.trim();
    if (url) audioController.loadUrl(url);
  });
}
if (spotifyEmbed){
  spotifyEmbed.addEventListener('click', ()=>{
    if (!audioController.isActive()){
      audioController.loadUrl('https://cdn.pixabay.com/audio/2023/03/21/audio_7a0f4ad28a.mp3');
    }
  });
}

/* show UI after a short delay */
setTimeout(()=>{
  if (uiWrap) { uiWrap.style.transition='opacity 1s'; uiWrap.style.opacity='1'; uiWrap.style.pointerEvents='auto'; }
  if (legendWrap) { legendWrap.style.transition='opacity 1s'; legendWrap.style.opacity='1'; legendWrap.style.pointerEvents='auto'; }
}, 1000);

computeAndRenderTop();

  RIBBON.width = width;
  RIBBON.baseY = 0;
  RIBBON.currentGenre = null;
}
initRibbon();

/* ---------- Map genres to SoundCloud playlist URLs (placeholders) ---------- */
const GENRE_PLAYLISTS = {
  'techno': 'https://soundcloud.com/your-hard-techno-playlist',
  'house':  'https://soundcloud.com/your-house-playlist',
  'dnb':    'https://soundcloud.com/your-dnb-playlist',
  'dubstep':'https://soundcloud.com/your-dubstep-playlist',
  'electronic':'https://soundcloud.com/your-electronic-playlist',
  'pop':    'https://soundcloud.com/your-pop-playlist'
};

/* ---------- Play genre and tint ribbon ---------- */
let currentGenreId = null;
async function playGenreAudio(genreId){
  const url = GENRE_PLAYLISTS[genreId] || GENRE_PLAYLISTS['electronic'];
  await audioController.loadUrl(url, { loop: true });
  currentGenreId = genreId;
  const g = GENRES.find(x=>x.id===genreId);
  if (g && RIBBON.geometry){
    const colors = RIBBON.geometry.attributes.color.array;
    const tr = ((g.color>>16)&255)/255, tg = ((g.color>>8)&255)/255, tb = (g.color&255)/255;
    for (let i=0;i<RIBBON.points;i++){
      const idx = i*3;
      colors[idx] = 0.25 + tr * 0.75;
      colors[idx+1] = 0.25 + tg * 0.75;
      colors[idx+2] = 0.25 + tb * 0.75;
    }
    RIBBON.geometry.attributes.color.needsUpdate = true;
    if (RIBBON.sprite && RIBBON.sprite.material) {
      RIBBON.sprite.material.color = new THREE.Color(g.color);
      RIBBON.sprite.material.opacity = 0.6;
    }
  }
}

/* ---------- Raycast / Click handling (plays genre audio on orb click) ---------- */
const raycaster = new THREE.Raycaster();
const ndcMouse = new THREE.Vector2();

function onPointerDown(e){
  if (uiWrap) { uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; }
  if (legendWrap) { legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }

  const rect = renderer.domElement.getBoundingClientRect();
  ndcMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndcMouse, camera);

  const cores = [];
  ORB_GROUP.children.forEach(c => { c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }); });
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length > 0){
    let hit = hits[0].object;
    let parent = null;
    for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
    if (parent){
      const found = Object.values(ORB_MESHES).find(o => o.container === parent);
      if (found) {
        playGenreAudio(found.id).catch(()=>{});
        openCenteredModal(found.id);
      }
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Centered modal (unchanged behavior) ---------- */
let activeModal = null;
function closeModal(){ if(!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal=null; }
function openCenteredModal(genreId){
  closeModal();
  const g = GENRES.find(x=>x.id===genreId); if (!g) return;
  const modal = document.createElement('div');
  modal.className = 'panel';
  modal.style.position = 'fixed';
  modal.style.left = '50%';
  modal.style.top = '50%';
  modal.style.transform = 'translate(-50%,-50%)';
  modal.style.zIndex = 9999;
  modal.style.width = '420px';
  modal.style.maxWidth = '90vw';
  modal.style.textAlign = 'left';
  modal.style.backdropFilter = 'blur(6px)';
  modal.innerHTML = `
    <button class="closeX" aria-label="Close" style="position:absolute;right:12px;top:12px;border:none;background:transparent;color:#dfefff;font-size:20px;cursor:pointer">✕</button>
    <h3 style="margin-top:4px">${g.name}</h3>
    <p style="color:#cfd8e6;margin-top:4px;font-size:13px">Who's your favorite artist? (Dream B2B optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px" />
    <input class="b2b" placeholder="Dream B2B (optional)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px" />
    <textarea class="why" rows="3" placeholder="Why (optional)" style="width:100%;padding:8px;border-radius:6px;border:none;margin-top:8px"></textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
      <div style="display:flex;gap:8px;align-items:center">
        <input id="modalAudioFile" type="file" accept="audio/*" style="display:none" />
        <button id="openAudioFile" class="btn" style="padding:8px;border-radius:6px;border:none;background:#222;color:#fff;cursor:pointer">Load Local Audio</button>
        <input id="modalAudioUrl" placeholder="Paste MP3/OGG URL" style="padding:8px;border-radius:6px;border:none;width:220px;background:rgba(255,255,255,0.02);color:#fff" />
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost cancel" style="padding:8px;border-radius:6px;border:none;background:transparent;color:#fff">Cancel</button>
        <button class="btn submit" style="padding:8px;border-radius:6px;border:none;background:#1db954;color:#fff">Submit</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.closeX').addEventListener('click', ()=> closeModal());
  modal.querySelector('.cancel').addEventListener('click', ()=> closeModal());
  modal.querySelector('.submit').addEventListener('click', async ()=>{
    const artist = modal.querySelector('.artist').value.trim(); if (!artist) { modal.querySelector('.artist').focus(); return; }
    const b2b = modal.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashOrb(genreId);
    computeAndRenderTop();
    closeModal();
  });
  const openAudioFile = modal.querySelector('#openAudioFile');
  const modalAudioFile = modal.querySelector('#modalAudioFile');
  const modalAudioUrl = modal.querySelector('#modalAudioUrl');
  openAudioFile.addEventListener('click', ()=> modalAudioFile.click());
  modalAudioFile.addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    await audioController.loadUrl(url, { loop: true });
    insertAudioPlayerInModal(modal, url, f.name);
    currentGenreId = null;
  });
  modal.querySelector('#modalAudioUrl').addEventListener('keydown', async (ev)=>{
    if (ev.key === 'Enter'){ const url = modalAudioUrl.value.trim(); if (!url) return; await audioController.loadUrl(url, { loop: true }); insertAudioPlayerInModal(modal, url, url); currentGenreId = null; }
  });
  activeModal = { dom: modal, genreId };
  if (uiWrap) { uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; }
  if (legendWrap) { legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }
  setTimeout(()=> modal.querySelector('.artist').focus(), 120);
}

function insertAudioPlayerInModal(modal, src, label){
  let player = modal.querySelector('audio');
  if (!player){
    player = document.createElement('audio'); player.controls = true; player.style.width = '100%'; player.style.marginTop='8px';
    modal.appendChild(player);
  }
  player.src = src; player.play().catch(()=>{});
  let info = modal.querySelector('.audioLabel');
  if (!info){ info = document.createElement('div'); info.className = 'audioLabel'; info.style.fontSize='12px'; info.style.marginTop='6px'; modal.appendChild(info); }
  info.textContent = `Loaded: ${label}`;
}

/* ---------- flash feedback ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const mat = o.core.material; const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.6, orig * 2.5);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ---------- Top computation UI ---------- */
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
    updateOrbHighlight(g.id, sorted[0] ? sorted[0].count : 0);
  });
  const sel = (genreSelect && genreSelect.value) ? genreSelect.value : GENRES[0].id;
  const arr = perGenreCounts[sel] || []; let html='';
  for (let i=0;i<Math.min(50,arr.length);i++) html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  if (!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  if (topList) topList.innerHTML = html;
}
function updateOrbHighlight(genreId, topCount){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount)*0.9);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount)*0.12);
  o.core.scale.set(base, base, base);
}

/* ---------- Animation / render loop (restored orb orbit + audio pulse) ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  const amps = audioController.getAmps();
  const bass = amps ? amps.bass : 0;
  const rms = amps ? amps.rms : 0.06 + Math.sin(t*0.25)*0.02;

  // stars twinkle
  starsFar.points.rotation.z += 0.00035;
  starsNear.points.rotation.z -= 0.00048;
  starsNear.mat.opacity = 0.55 + Math.sin(t*0.9 + 3.1) * 0.08 + rms * 0.12;
  starsFar.mat.opacity = 0.88 + Math.cos(t*0.4 + 1.7) * 0.04 + bass * 0.06;

  dustPlane.rotation.z += 0.00012;

  // smoke pulse
  const smokePulse = 0.6 + Math.sin(t*0.9) * 0.12 + bass * 0.9;
  smokeBack1.material.opacity = 0.28 * smokePulse;
  smokeBack2.material.opacity = 0.22 * (0.9 + Math.cos(t*0.7)*0.06 + bass*0.4);
  smokeFront1.material.opacity = 0.24 * (0.9 + Math.sin(t*0.5)*0.06 + rms*0.9);
  smokeFront2.material.opacity = 0.20 * (1 + Math.cos(t*0.63)*0.05 + bass*0.6);
  cornerSprites.forEach((s,i)=> s.material.opacity = (0.12 + Math.sin(t*0.7 + i)*0.03 + bass*0.06));

  // camera subtle move
  const baseZ = CAMERA_Z;
  camera.position.z = baseZ + Math.sin(t*0.08) * 6 + bass * 80;
  camera.position.x = Math.sin(t*0.04) * 12 * (0.7 + rms * 0.8);
  camera.position.y = Math.cos(t*0.03) * 6 * (0.7 + rms * 0.6);
  camera.lookAt(0,0,0);

  // ---------- ORB orbit + pulse (restored) ----------
  const clusterSpeed = 0.12 + bass * 0.4 + 0.02;
  ORB_GROUP.children.forEach((container, idx) => {
    const odata = ORB_MESHES[GENRES[idx].id];
    const phaseOffset = container.userData.baseAngle || (idx / ORB_GROUP.children.length) * Math.PI*2;
    const angle = t * (clusterSpeed * (1 + idx * 0.02)) + phaseOffset * (0.6 + idx*0.08);
    const ex = CLUSTER_RADIUS * (1 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.6 * (1 + Math.cos(idx*0.7 + t*0.11)*0.02);
    // orbit (x,y)
    container.position.x = Math.cos(angle) * ex + (idx - 2.5) * Math.sin(t*0.03)*2;
    container.position.y = Math.sin(angle * 1.02 + idx*0.31) * ey + Math.cos(idx*0.5 + t*0.2)*4;
    // z-depth bob
    container.position.z = Math.sin(t*(0.55 + idx*0.02))*10 - idx*4;

    // gentle spin
    container.children.forEach(ch => { if (ch.isMesh) { ch.rotation.y += 0.0015 + idx*0.0003; ch.rotation.x += 0.0009; } });

    // ring rotation and opacity subtle mod
    if (odata && odata.ringObj){
      odata.ringObj.group.rotation.z += odata.ringObj.rotationSpeed * (1 + bass * 0.8);
      odata.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms * 0.22;
    }

    // gas opacity subtle
    if (odata && odata.gas) {
      odata.gas.material.opacity = 0.035 + 0.008 * Math.sin(t*0.9 + idx) + bass*0.02;
    }

    // audio-driven pulse: scale bubble slightly by bass & RMS (soft, dreamlike)
    const pulse = 1 + (bass * 0.35) + (rms * 0.12);
    if (odata && odata.core) {
      const targetScale = 1.0 + Math.min(0.5, (pulse - 1) * (1 + idx*0.05));
      odata.core.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
      // also nudge emissive intensity with music
      odata.core.material.emissiveIntensity = 0.5 + Math.min(1.8, (bass * 1.8 + rms * 0.8));
      // rim sprite opacity
      odata.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.14 + rms * 0.28; });
    }
  });

  /* --- Ribbon update: time-domain or idle --- */
  try {
    if (RIBBON && RIBBON.geometry){
      const pos = RIBBON.geometry.attributes.position.array;
      const pts = RIBBON.points;
      const timeData = audioController.getTimeDomain();
      if (timeData && timeData.length > 0){
        const step = Math.floor(timeData.length / pts) || 1;
        for (let i=0;i<pts;i++){
          const td = timeData[Math.min(timeData.length-1, i*step)];
          const v = (td / 128.0) - 1.0;
          const amplitude = 120 + (currentGenreId ? 80 : 0);
          const y = v * amplitude * (0.7 + Math.sin(i*0.2 + t*0.7) * 0.14);
          const idx = i*3;
          pos[idx+1] = y + -10;
          pos[idx+2] = -120 + Math.sin(t*0.3 + i*0.06)*6;
        }
        const amps2 = audioController.getAmps();
        const brightness = amps2 ? (0.3 + amps2.rms*1.4) : 0.4;
        if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = Math.min(0.95, 0.25 + brightness);
      } else {
        for (let i=0;i<pts;i++){
          const idx = i*3;
          pos[idx+1] = Math.sin(i*0.12 + t*0.9) * 14 + Math.sin(i*0.09 + t*0.3)*6 - 8;
          pos[idx+2] = -120 + Math.sin(t*0.12 + i*0.03)*4;
        }
        if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = 0.45;
      }
      RIBBON.geometry.attributes.position.needsUpdate = true;
    }
  } catch(e){ /* ribbon safe */ }

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize (update everything that depends on camera/frustum) ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  if (RIBBON && RIBBON.width){
    const width = (2 * Math.tan(camera.fov * Math.PI/180 / 2) * Math.abs(camera.position.z)) * camera.aspect * 1.05;
    RIBBON.width = width;
    if (RIBBON.sprite) RIBBON.sprite.scale.set(width*1.05, Math.max(40, width*0.035), 1);
    const pos = RIBBON.geometry.attributes.position.array;
    for (let i=0;i<RIBBON.points;i++){
      const x = -width/2 + (i/(RIBBON.points-1)) * width;
      pos[i*3] = x;
    }
    RIBBON.geometry.attributes.position.needsUpdate = true;
  }
});

/* ---------- Startup ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 900);

console.log('app.js loaded — translucent orbiting bubbles + ribbon active.');

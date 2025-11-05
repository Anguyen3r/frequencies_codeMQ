/* app.js
   FULL integrated app.js with audio-reactive horizontal ribbon (soft glow)
   Keeps your existing orbs, pillars, firebase/localStorage vote code, etc.
   - Additions:
     * radial glow for the ribbon (removes rectangular artifact)
     * small "Load audio for visuals" control in the playlist area (local file or URL)
     * uses existing audioController to feed analyser -> ribbon
     * graceful idle fallback when no analyzable audio is present (e.g. Spotify iframe)
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // optional firebase config (leave null to use localStorage)

/* ---------- Small Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){
  const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255;
  return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function safeAppend(el, child){ try{ el.appendChild(child); }catch(e){} }

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

/* ---------- UI refs (guarded) ---------- */
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

/* keep UI visible by default (per your request) */
if (uiWrap){
  uiWrap.style.opacity = '1';
  uiWrap.style.pointerEvents = 'auto';
}
if (legendWrap){
  legendWrap.style.opacity = '1';
  legendWrap.style.pointerEvents = 'auto';
}

/* ---------- GENRES & COLORS (7 genres) ---------- */
const GENRES = [
  { id:'hard-techno', name:'Hard Techno', color:0xff2b6a, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX9sIqqvKsjG8' },
  { id:'techno', name:'Techno', color:0x8a5fff, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX6f9r4Vf1D3K' },
  { id:'house', name:'House', color:0xff9b3f, spotify:'https://open.spotify.com/playlist/37i9dQZF1DXa2PvUpywmrr' },
  { id:'dnb', name:'Drum & Bass', color:0x4cff7b, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY' },
  { id:'electronic', name:'Electronic / Dance', color:0x3f7bff, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n' },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY' },
  { id:'pop', name:'Pop', color:0xff89d9, spotify:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' }
];
// populate legend/select if present
if (genreSelect && legendList){
  legendList.innerHTML = '';
  GENRES.forEach(g=>{
    const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
    const li = document.createElement('li');
    li.className = 'legend-row';
    li.innerHTML = `<span class="swatch" style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:middle;background:${toCssHex(g.color)}"></span>${g.name}`;
    li.style.padding = '6px 10px';
    li.style.marginBottom = '6px';
    li.style.borderRadius = '8px';
    li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.01), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
    const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
    li.style.color = lum >= 140 ? '#000' : '#fff';
    legendList.appendChild(li);
    li.addEventListener('click', ()=> {
      playGenreAudio(g.id);
      highlightLegend(g.id);
    });
  });
  genreSelect.addEventListener('change', ()=> computeAndRenderTop());
}
function highlightLegend(genreId){
  if (!legendList) return;
  Array.from(legendList.children).forEach((li, i) => {
    li.style.boxShadow = (GENRES[i].id === genreId) ? '0 6px 18px rgba(0,0,0,0.45)' : 'none';
    li.style.transform = (GENRES[i].id === genreId) ? 'translateY(-2px)' : 'none';
  });
}
if (toggleTop && leftPanel) toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));

/* ---------- Three.js core ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

const CAMERA_Z = 850;
const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 18, CAMERA_Z);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000010, 0);
if (wrap) wrap.appendChild(renderer.domElement);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';

const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

/* ---------- Starfield & Dust (background layers) ---------- */
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
const starsFar = makeStarLayer(1800, 6000, 3600, 6000, 1.1, 0.9);
const starsNear = makeStarLayer(700, 3500, 2200, 3500, 1.9, 0.6);
scene.add(starsFar.points, starsNear.points);

const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800),
  new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false })
);
dustPlane.position.set(0,0,-2600);
scene.add(dustPlane);

/* ---------- Procedural textures (glow/star) ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,4,size/2,size/2,size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.42, toCssRgba(colorHex, 0.35));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
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

/* ---------- ORB cluster (planets/bubbles) ---------- */
const CLUSTER_RADIUS = 420;
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};
function createStardustRing(coreRadius, colorHex, tilt, particleCount=240, size=8.5, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.85);
  const positions = new Float32Array(particleCount*3);
  const sizes = new Float32Array(particleCount);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5) * (coreRadius*0.36);
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.5);
    sizes[i] = (Math.random()*1.6 + 1.2) * size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.94);
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
  const coreRadius = 40 + Math.random()*10;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent:true,
    opacity:0.30,
    roughness:0.16,
    metalness:0.08,
    transmission:0.7,
    emissive: color.clone().multiplyScalar(0.035),
    emissiveIntensity:0.6,
    clearcoat:0.2
  });
  coreMat.depthWrite = false;

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rim.scale.set(coreRadius*9.8, coreRadius*9.8, 1);
  coreMesh.add(rim);

  const container = new THREE.Group();
  container.add(coreMesh);

  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.6, -idx*6);

  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  const ringObj = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random()*160), 9.5, (idx % 2 === 0));
  container.add(ringObj.group);

  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent:true, opacity:0.035, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core: coreMesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- Aurora / Haze layers — make them circular/soft to avoid rectangular look ---------- */
function createAuroraSprite(colorStops, size=1600, opacity=0.3){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  // use elliptical radial gradient centered off-center for soft shape
  const cx = size * (0.45 + (Math.random()-0.5)*0.08);
  const cy = size * (0.45 + (Math.random()-0.5)*0.08);
  const grad = ctx.createRadialGradient(cx,cy,20,cx,cy,size*0.95);
  colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  return spr;
}

const smokeBack1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.14,color:'rgba(120,40,200,0.12)'},{offset:0.78,color:'rgba(20,150,200,0.06)'},{offset:1,color:'rgba(0,0,0,0)'}], 2000, 0.42);
smokeBack1.scale.set(3000,1600,1); smokeBack1.position.set(-60,-120,-1800); scene.add(smokeBack1);

const smokeBack2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.18,color:'rgba(200,40,140,0.10)'},{offset:0.6,color:'rgba(60,40,220,0.08)'},{offset:1,color:'rgba(0,0,0,0)'}], 1800, 0.3);
smokeBack2.scale.set(2600,1300,1); smokeBack2.position.set(120,-60,-1600); scene.add(smokeBack2);

const smokeFront1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.18,color:'rgba(160,40,220,0.08)'},{offset:0.7,color:'rgba(30,200,220,0.07)'},{offset:1,color:'rgba(0,0,0,0)'}], 1400, 0.30);
smokeFront1.scale.set(2200,1100,1); smokeFront1.position.set(30,80,-320); scene.add(smokeFront1);

const smokeFront2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.18,color:'rgba(240,120,100,0.06)'},{offset:0.7,color:'rgba(90,80,255,0.05)'},{offset:1,color:'rgba(0,0,0,0)'}], 1200, 0.24);
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

/* ---------- Audio / WebAudio Controller (for local audio & direct URLs) ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, freqData=null, timeData=null, audioEl=null, active=false;
  async function ensure(){
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 4096; // higher resolution for smoother waveform
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.frequencyBinCount);
    }
  }
  async function loadUrl(url, { loop = true } = {}){
    try {
      await ensure();
      if (!audioEl){ audioEl = document.createElement('audio'); audioEl.crossOrigin='anonymous'; audioEl.controls=true; audioEl.style.width='100%'; audioEl.id='visualAudioElement'; }
      audioEl.src = url;
      audioEl.loop = !!loop;
      // user gesture may be required to play; try to play anyway
      audioEl.play().catch(()=>{});
      if (source) try{ source.disconnect(); }catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      // show local audio element in spotifyEmbed area for visibility (if present)
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
  // expose the audio element too
  function getAudioEl(){ return audioEl; }
  return { loadUrl, stop, getAmps, getTimeDomain, isActive, getAudioEl };
})();

/* ---------- Horizontal Ribbon: smooth waveform energy trail ---------- */
const RIBBON = {};
function initRibbon(){
  const POINTS = 512;
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
    positions[i*3+1] = Math.sin(i/6) * 6;
    positions[i*3+2] = -120;
    colors[i*3] = 0.8; colors[i*3+1] = 0.7; colors[i*3+2] = 1.0;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Keep line basic material (works across environments)
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending });
  const line = new THREE.Line(geometry, mat);
  line.frustumCulled = false;
  scene.add(line);

  // ---------- Replace rectangle glow with radial/elliptical glow ----------
  const size = 2048;
  const c = document.createElement('canvas'); c.width = size; c.height = size/6; // wide but not rectangular-looking when used as sprite
  const ctx = c.getContext('2d');

  // create an elliptical radial gradient for soft non-rectangular glow
  const cx = c.width * 0.5;
  const cy = c.height * 0.45;
  const rx = c.width * 0.55;
  const ry = c.height * 0.95;
  // draw filled ellipse with radial gradient
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.08, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.20)');
  grad.addColorStop(0.48, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = grad;
  // draw elliptical mask by scaling
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI*2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // feather edges lightly
  ctx.globalCompositeOperation = 'lighter';
  const edgeGrad = ctx.createLinearGradient(0,0,c.width,c.height);
  edgeGrad.addColorStop(0, 'rgba(255,255,255,0.00)');
  edgeGrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  edgeGrad.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0,0,c.width,c.height);

  const glowTex = new THREE.CanvasTexture(c);
  glowTex.needsUpdate = true;
  const spriteMat = new THREE.SpriteMaterial({ map: glowTex, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(width*1.05, Math.max(34, width*0.03), 1);
  sprite.position.set(0, -8, -140);
  scene.add(sprite);
  // ---------- end glow replacement ----------
   
// ---------- Ribbon update integration ----------
let ribbonLine = null;

function finalizeRibbon(line, positions, colors) {
  RIBBON.line = line;
  RIBBON.positions = positions;
  RIBBON.colors = colors;
}

function updateRibbon() {
  if (!RIBBON.line || !audioController.isActive()) return;

  const amps = audioController.getAmps();
  if (!amps) return;
  const { rawFreq } = amps;
  const pos = RIBBON.positions.array;
  const col = RIBBON.colors.array;

  for (let i = 0; i < rawFreq.length && i < pos.length / 3; i++) {
    const amp = rawFreq[i] / 255;
    const y = Math.sin(i * 0.15) * 10 + amp * 80;
    pos[i * 3 + 1] = y;
    col[i * 3] = 0.6 + amp * 0.4;
    col[i * 3 + 1] = 0.4 + amp * 0.3;
    col[i * 3 + 2] = 1.0;
  }

  RIBBON.positions.needsUpdate = true;
  RIBBON.colors.needsUpdate = true;
}

// attach the line when created
const line = new THREE.Line(geometry, mat);
finalizeRibbon(line, geometry.getAttribute('position'), geometry.getAttribute('color'));
scene.add(line);

  const prevY = new Float32Array(POINTS);
  for (let i=0;i<POINTS;i++) prevY[i] = positions[i*3+1];

  RIBBON.line = line;
  RIBBON.sprite = sprite;
  RIBBON.geometry = geometry;
  RIBBON.points = POINTS;
  RIBBON.width = width;
  RIBBON.baseY = 0;
  RIBBON.currentGenre = null;
  RIBBON._prevY = prevY;
  RIBBON.smoothAlpha = 0.18;
}
initRibbon();

/* ---------- Vertical Pillar Ribbons (one per genre) ---------- */
const PILLAR_RIBBONS = [];
function makePillarTexture(colorHex, h=1024, w=192){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,h);
  const rgba = (a)=> toCssRgba(colorHex, a);
  grad.addColorStop(0.00, rgba(0.0));
  grad.addColorStop(0.08, rgba(0.06));
  grad.addColorStop(0.25, rgba(0.12));
  grad.addColorStop(0.45, rgba(0.18));
  grad.addColorStop(0.65, rgba(0.12));
  grad.addColorStop(0.92, rgba(0.06));
  grad.addColorStop(1.00, rgba(0.0));
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);
  // subtle horizontal sheen
  const hg = ctx.createLinearGradient(0,0,w,0);
  hg.addColorStop(0, 'rgba(255,255,255,0.00)');
  hg.addColorStop(0.45, 'rgba(255,255,255,0.04)');
  hg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  hg.addColorStop(0.55, 'rgba(255,255,255,0.04)');
  hg.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hg; ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
function initPillarRibbons(){
  const pillarHeight = 1200;
  const pillarWidth = 160;
  const hSegs = 48;
  const wSegs = 10;
  GENRES.forEach((g, idx) => {
    const geo = new THREE.PlaneGeometry(pillarWidth, pillarHeight, wSegs, hSegs);
    const tex = makePillarTexture(g.color, 1024, 192);
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true, opacity:0.20, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.rotation.x = -Math.PI/2 + 0.02;
    mesh.rotation.y = 0.06 * (idx % 2 === 0 ? 1 : -1);
    mesh.position.set(0, -80, -180 - idx*6);
    mesh.userData = { idx, baseX: 0, baseZ: mesh.position.z, width: pillarWidth, height: pillarHeight, wSegs, hSegs, color: g.color };
    scene.add(mesh);
    PILLAR_RIBBONS.push({ mesh, geo, mat, idx, baseX:0 });
  });
}
initPillarRibbons();

/* ---------- Genre -> Spotify mapping (used to place embed iframe) ---------- */
const GENRE_SPOTIFY = {};
GENRES.forEach(g => { GENRE_SPOTIFY[g.id] = g.spotify || null; });

/* ---------- Play selected genre: prefer Spotify embed if available, fallback to internal audioController ------- */
let currentGenreId = null;
function clearSpotifyEmbed(){
  if (!spotifyEmbed) return;
  spotifyEmbed.innerHTML = '';
}
function embedSpotify(uri){
  if (!spotifyEmbed) return;
  spotifyEmbed.innerHTML = '';
  try {
    const u = new URL(uri);
    if (u.hostname.includes('spotify')) {
      const pathParts = u.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2){
        const embedPath = `/embed/${pathParts[0]}/${pathParts[1]}`;
        const iframe = document.createElement('iframe');
        iframe.src = `https://open.spotify.com${embedPath}`;
        iframe.width = '300';
        iframe.height = '80';
        iframe.frameBorder = '0';
        iframe.allow = 'encrypted-media; clipboard-write';
        iframe.style.borderRadius = '8px';
        iframe.style.width = '100%';
        iframe.style.maxWidth = '420px';
        spotifyEmbed.appendChild(iframe);
        return;
      }
    }
  } catch(e){}
  const iframe = document.createElement('iframe');
  iframe.src = uri;
  iframe.width = '300';
  iframe.height = '80';
  iframe.frameBorder = '0';
  iframe.allow = 'encrypted-media; clipboard-write';
  iframe.style.borderRadius = '8px';
  iframe.style.width = '100%';
  iframe.style.maxWidth = '420px';
  spotifyEmbed.appendChild(iframe);
}
async function playGenreAudio(genreId){
  currentGenreId = genreId;
  const spotifyUri = GENRE_SPOTIFY[genreId];
  if (spotifyUri && spotifyEmbed){
    try { audioController.stop(); } catch(e){}
    clearSpotifyEmbed();
    embedSpotify(spotifyUri);
  } else {
    const url = (GENRE_PLAYLISTS && GENRE_PLAYLISTS[genreId]) ? GENRE_PLAYLISTS[genreId] : null;
    if (url) {
      await audioController.loadUrl(url, { loop: true });
    } else {
      try { audioController.stop(); } catch(e){}
      clearSpotifyEmbed();
    }
  }
  // colorize horizontal ribbon
  const g = GENRES.find(x=>x.id===genreId);
  if (g && RIBBON.geometry && RIBBON.geometry.attributes.color){
    const colors = RIBBON.geometry.attributes.color.array;
    const tr = ((g.color>>16)&255)/255, tg = ((g.color>>8)&255)/255, tb = (g.color&255)/255;
    for (let i=0;i<RIBBON.points;i++){
      const idx = i*3;
      colors[idx] = 0.14 + tr * 0.86;
      colors[idx+1] = 0.14 + tg * 0.86;
      colors[idx+2] = 0.14 + tb * 0.86;
    }
    RIBBON.geometry.attributes.color.needsUpdate = true;
    if (RIBBON.sprite && RIBBON.sprite.material) {
      RIBBON.sprite.material.color = new THREE.Color(g.color);
      RIBBON.sprite.material.opacity = 0.62;
    }
    const foundIdx = GENRES.findIndex(x=>x.id===genreId);
    PILLAR_RIBBONS.forEach((p, i)=> {
      p.mesh.material.opacity = (i === foundIdx) ? 0.34 : 0.16;
    });
    highlightLegend(genreId);
  }
}

/* Add an accessible manual Spotify loader (UI element might exist) */
if (loadSpotify && spotifyInput){
  loadSpotify.addEventListener('click', ()=>{
    const v = spotifyInput.value && spotifyInput.value.trim();
    if (!v) return;
    embedSpotify(v);
    try { audioController.stop(); } catch(e){}
  });
}

/* ---------- GENRE_PLAYLISTS (fallback direct audio URLs if desired) ---------- */
const GENRE_PLAYLISTS = {
  'hard-techno': null,
  'techno':      null,
  'house':       null,
  'dnb':         null,
  'electronic':  null,
  'dubstep':     null,
  'pop':         null
};

/* ---------- Raycast / Click handling for orbs ---------- */
const raycaster = new THREE.Raycaster();
const ndcMouse = new THREE.Vector2();

function onPointerDown(e){
  if (uiWrap && uiWrap.style && uiWrap.style.opacity === '0') {
    uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto';
    if (legendWrap){ legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }
  }

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

/* ---------- Centered modal (unchanged UX but supports local audio upload / URL) ---------- */
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
  if (uiWrap){ uiWrap.style.opacity = '1'; uiWrap.style.pointerEvents = 'auto'; }
  if (legendWrap){ legendWrap.style.opacity = '1'; legendWrap.style.pointerEvents = 'auto'; }
  setTimeout(()=> { try { modal.querySelector('.artist').focus(); } catch(e){} }, 120);
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

/* ---------- flashOrb (visual feedback) ---------- */
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

/* ---------- Audio Visual Controls (small UI injected into playlistPanel) ----------
   Adds a minimal "Load audio for visuals" control so user can paste a direct MP3/OGG URL or upload a file.
   Spotify iframe cannot be used for analyser data; this control is the recommended workflow for visuals.
*/
function injectAudioVisualControls(){
  const playlistPanel = document.getElementById('playlistPanel');
  if (!playlistPanel) return;
  // don't inject twice
  if (playlistPanel.querySelector('.visual-controls')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'visual-controls';
  wrapper.style.marginTop = '10px';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '8px';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'space-between';

  const left = document.createElement('div');
  left.style.flex = '1';
  left.innerHTML = `
    <input id="visualAudioUrl" placeholder="Paste MP3/OGG URL for visuals" style="width:100%;padding:8px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff;font-size:13px" />
  `;
  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '8px';
  right.innerHTML = `
    <input id="visualAudioFile" type="file" accept="audio/*" style="display:none" />
    <button id="loadVisualFile" class="btn" style="padding:8px;border-radius:8px;border:none;background:#222;color:#fff;cursor:pointer">Upload</button>
    <button id="loadVisualUrl" class="btn" style="padding:8px;border-radius:8px;border:none;background:#1db954;color:#fff;cursor:pointer">Load</button>
    <button id="stopVisuals" class="btn" style="padding:8px;border-radius:8px;border:none;background:#cc3333;color:#fff;cursor:pointer">Stop</button>
  `;

  wrapper.appendChild(left);
  wrapper.appendChild(right);
  playlistPanel.appendChild(wrapper);

  const fileInput = wrapper.querySelector('#visualAudioFile');
  const uploadBtn = wrapper.querySelector('#loadVisualFile');
  const loadBtn = wrapper.querySelector('#loadVisualUrl');
  const stopBtn = wrapper.querySelector('#stopVisuals');
  const urlInput = wrapper.querySelector('#visualAudioUrl');

  uploadBtn.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', async (e)=>{
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    const ok = await audioController.loadUrl(url, { loop: true });
    if (ok) {
      // reflect in UI: small confirmation
      uploadBtn.textContent = 'Loaded';
      setTimeout(()=> uploadBtn.textContent = 'Upload', 900);
    }
  });

  loadBtn.addEventListener('click', async ()=>{
    const url = urlInput.value && urlInput.value.trim(); if (!url) return;
    const ok = await audioController.loadUrl(url, { loop: true });
    if (ok) { loadBtn.textContent = 'Loaded'; setTimeout(()=> loadBtn.textContent = 'Load', 900); }
  });

  stopBtn.addEventListener('click', ()=> {
    audioController.stop();
    stopBtn.textContent = 'Stopped';
    setTimeout(()=> stopBtn.textContent = 'Stop', 900);
    // restore spotify embed display if needed
    if (spotifyEmbed && currentGenreId){
      clearSpotifyEmbed();
      embedSpotify(GENRE_SPOTIFY[currentGenreId] || GENRE_SPOTIFY[Object.keys(GENRE_SPOTIFY)[0]]);
    }
  });
}
injectAudioVisualControls();

/* ---------- Animation / render loop ---------- */
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

  // cluster / bubbles orbit
  const clusterSpeed = 0.12 + bass * 0.38;
  const tiltAngle = -Math.PI / 4;
  const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);

  let centerOffsetX = 0, centerOffsetY = 0;
  if (leftPanel && leftPanel.getBoundingClientRect){
    try {
      const lr = leftPanel.getBoundingClientRect();
      centerOffsetX = (lr.width / Math.max(window.innerWidth, 600)) * (CLUSTER_RADIUS * 0.85);
      centerOffsetY = -Math.min(120, lr.height * 0.08);
    } catch(e){}
  }

  GENRES.forEach((g, idx) => {
    const o = ORB_MESHES[g.id];
    if (!o) return;
    const phaseOffset = o.baseAngle;
    const angle = t * clusterSpeed + phaseOffset * (0.6 + idx*0.08);

    const ex = CLUSTER_RADIUS * (0.86 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.48 * (0.9 + Math.cos(idx*0.7 + t*0.11)*0.02);

    const rawX = Math.cos(angle) * ex;
    const rawY = Math.sin(angle) * ey;

    const rx = rawX * cosT - rawY * sinT;
    const ry = rawX * sinT + rawY * cosT;

    const jitterX = Math.sin(t*0.27 + idx*0.64) * 6;
    const jitterY = Math.cos(t*0.31 + idx*0.41) * 3;

    o.container.position.x = rx + centerOffsetX + jitterX + (idx - (GENRES.length-1)/2) * Math.sin(t*0.02) * 0.7;
    o.container.position.y = ry + centerOffsetY + jitterY + Math.cos(idx*0.5 + t*0.2)*4;
    o.container.position.z = Math.sin(t*(0.45 + idx*0.02))*8 - idx*3;

    o.core.rotation.y += 0.002 + idx*0.0003;
    o.core.rotation.x += 0.0011;

    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass * 0.8);
    o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms * 0.22;

    o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.018;

    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.16 + rms * 0.28; });

    // sync pillar position to orb
    const pillar = PILLAR_RIBBONS[idx];
    if (pillar){
      pillar.mesh.userData.baseX = o.container.position.x;
      pillar.mesh.position.z = o.container.position.z - 50 - idx*2;
    }
  });

  /* --- Horizontal Ribbon update (audio-reactive if analyser available) --- */
  try {
    if (RIBBON && RIBBON.geometry){
      const pos = RIBBON.geometry.attributes.position.array;
      const pts = RIBBON.points;
      const timeData = audioController.getTimeDomain();
      const prevY = RIBBON._prevY;
      const alpha = RIBBON.smoothAlpha;
      if (timeData && timeData.length > 0){
        const tdLen = timeData.length;
        for (let i=0;i<pts;i++){
          const f = (i / (pts-1)) * (tdLen - 1);
          const i0 = Math.floor(f), i1 = Math.min(tdLen-1, i0+1);
          const frac = f - i0;
          const td0 = timeData[i0], td1 = timeData[i1];
          const td = td0 * (1 - frac) + td1 * frac;
          const v = (td / 128.0) - 1.0;
          const amplitude = 120 + (currentGenreId ? 80 : 0);
          const baseOsc = Math.sin(i*0.09 + t*0.7) * 0.14;
          const targetY = v * amplitude * (0.7 + baseOsc);
          const idx = i*3;
          prevY[i] = prevY[i] * (1 - alpha) + targetY * alpha;
          pos[idx+1] = prevY[i] - 10;
          pos[idx+2] = -120 + Math.sin(t*0.28 + i*0.04) * 5;
        }
        const amps = audioController.getAmps();
        const brightness = amps ? (0.28 + amps.rms*1.4) : 0.36;
        if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = Math.min(0.95, 0.22 + brightness);
      } else {
        // gentle idle waving when no analyzable audio
        for (let i=0;i<pts;i++){
          const idx = i*3;
          const targetY = (Math.sin(i*0.08 + t*0.9) * 12 + Math.sin(i*0.06 + t*0.3)*6 - 8);
          prevY[i] = prevY[i] * (1 - alpha) + targetY * alpha;
          pos[idx+1] = prevY[i];
          pos[idx+2] = -120 + Math.sin(t*0.12 + i*0.03)*4;
        }
        if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = 0.45;
      }
      RIBBON.geometry.attributes.position.needsUpdate = true;
    }
  } catch(e){ /* safe */ }

  /* --- Pillar ribbon weave update (gentle waving) --- */
  try {
    const globalAmp = 22 + bass * 140;
    const freq = 0.9 + (rms * 6.0);
    PILLAR_RIBBONS.forEach((p, pIdx) => {
      const mesh = p.mesh;
      const geo = mesh.geometry;
      const posAttr = geo.attributes.position;
      const arr = posAttr.array;
      const wSegs = mesh.userData.wSegs || 10;
      const hSegs = mesh.userData.hSegs || 48;
      const baseX = mesh.userData.baseX || mesh.position.x;
      const baseZ = mesh.userData.baseZ || mesh.position.z;
      const phase = pIdx * 0.6;
      let vi = 0;
      for (let iy = 0; iy <= hSegs; iy++){
        const vNorm = iy / hSegs;
        const yFactor = (vNorm - 0.5) * mesh.userData.height;
        for (let ix = 0; ix <= wSegs; ix++){
          const idx = vi * 3;
          const xBaseLocal = (-mesh.userData.width/2) + (ix / wSegs) * mesh.userData.width;
          const disp = Math.sin((vNorm * Math.PI * 4.0) + (t * freq) + phase + ix*0.18) * (globalAmp * (0.14 + (ix/wSegs)*0.5));
          arr[idx] = baseX + xBaseLocal + disp * 0.012;
          arr[idx+1] = yFactor - 80;
          arr[idx+2] = baseZ + Math.sin(t*0.6 + ix*0.07 + iy*0.03) * 6;
          vi++;
        }
      }
      posAttr.needsUpdate = true;
      if (mesh.material) mesh.material.opacity = 0.14 + Math.min(0.4, rms * 0.6) + (pIdx === GENRES.findIndex(g=>g.id===currentGenreId) ? 0.06 : 0);
      mesh.rotation.z = Math.sin(t*0.23 + pIdx*0.5) * 0.015;
    });
  } catch(e){ /* safe */ }

  renderer.render(scene, camera);
}
animate();

/* ---------- Resize handler ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  if (RIBBON && RIBBON.width){
    const width = (2 * Math.tan(camera.fov * Math.PI/180 / 2) * Math.abs(camera.position.z)) * camera.aspect * 1.05;
    RIBBON.width = width;
    if (RIBBON.sprite) RIBBON.sprite.scale.set(width*1.05, Math.max(34, width*0.03), 1);
    const pos = RIBBON.geometry.attributes.position.array;
    for (let i=0;i<RIBBON.points;i++){
      const x = -width/2 + (i/(RIBBON.points-1)) * width;
      pos[i*3] = x;
    }
    RIBBON.geometry.attributes.position.needsUpdate = true;
  }
  PILLAR_RIBBONS.forEach(p => {
    try { if (p.mesh && p.mesh.material && p.mesh.material.map) p.mesh.material.map.needsUpdate = true; } catch(e){}
  });
});

/* ---------- Startup ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 900);

console.log('app.js loaded — full integration: smooth horizontal ribbon (audio-reactive), diagonal elliptical orbits, 7 genre pillars, Spotify embed integrated.');

// ---------- Animate and render ----------
function animate() {
  requestAnimationFrame(animate);
  updateRibbon(); // continuously make ribbon respond to sound
  renderer.render(scene, camera);
}
animate();


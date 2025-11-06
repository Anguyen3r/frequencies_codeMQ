/* app.js
   Full integrated app.js — smoothing for horizontal ribbon, diagonal elliptical orbit,
   7 genres/bubbles, pillars weave follow, UI color sync. Based on your working base.
   FULL integrated app.js
   - Horizontal ribbon: smooth, higher-resolution time-domain mapping + idle gentle waving
   - Diagonal elliptical orbit for orbs (top-left → bottom-right)
   - 7 genre bubbles + 7 vertical weaving pillar ribbons that follow bubbles
   - Legend / UI synchronized colors
   - Spotify embed integrated (click a genre to open its Spotify embed; local audio still supported)
   - Soft, non-rectangular aurora (sprite gradients are circular/elliptical by design)
   - Preserves your original behaviors and augments them with fixes
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // optional firebase config
const FIREBASE_CONFIG = null; // optional firebase config (leave null to use localStorage)

/* ---------- Small Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function safeAppend(el, child){ try{ el.appendChild(child); }catch(e){} }

/* ---------- Persistence (Firebase optional / fallback localStorage) ---------- */
let dbRef = null, useFirebase = false;
@@ -49,8 +56,7 @@ async function readAllVotesOnce(){
}
if (!useFirebase) window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* ---------- UI refs ---------- */
/* Note: some of these may not exist in your index.html — guard before use */
/* ---------- UI refs (guarded) ---------- */
const uiWrap = document.getElementById('ui');
const legendWrap = document.getElementById('legend');
const genreSelect = document.getElementById('genreSelect');
@@ -62,7 +68,7 @@ const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');
const legendList = document.getElementById('legendList');

/* ---------- IMPORTANT: do NOT hide UI by default anymore ---------- */
/* keep UI visible by default (per your request) */
if (uiWrap){
  uiWrap.style.opacity = '1';
  uiWrap.style.pointerEvents = 'auto';
@@ -72,22 +78,23 @@ if (legendWrap){
  legendWrap.style.pointerEvents = 'auto';
}

/* ---------- Genres & Colors (7 genres, matches 7 bubbles) ---------- */
/* ---------- GENRES & COLORS (7 genres) ---------- */
const GENRES = [
  { id:'hard-techno', name:'Hard Techno', color:0xff2b6a },   // red/pink
  { id:'techno', name:'Techno', color:0x8a5fff },            // purple (adjusted slightly for contrast)
  { id:'house', name:'House', color:0xff9b3f },              // orange
  { id:'dnb', name:'Drum & Bass', color:0x4cff7b },         // green
  { id:'electronic', name:'Electronic / Dance', color:0x3f7bff }, // sapphire/blue
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },          // cyan
  { id:'pop', name:'Pop', color:0xff89d9 }                   // pink
  { id:'hard-techno', name:'Hard Techno', color:0xff2b6a, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX9sIqqvKsjG8' },
  { id:'techno', name:'Techno', color:0x8a5fff, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX6f9r4Vf1D3K' },
  { id:'house', name:'House', color:0xff9b3f, spotify:'https://open.spotify.com/playlist/37i9dQZF1DXa2PvUpywmrr' },
  { id:'dnb', name:'Drum & Bass', color:0x4cff7b, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY' },
  { id:'electronic', name:'Electronic / Dance', color:0x3f7bff, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n' },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff, spotify:'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY' },
  { id:'pop', name:'Pop', color:0xff89d9, spotify:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' }
];
// populate select/legend if present
// populate legend/select if present
if (genreSelect && legendList){
  legendList.innerHTML = ''; // clear and repopulate
  legendList.innerHTML = '';
  GENRES.forEach(g=>{
    const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
    const li = document.createElement('li');
    li.className = 'legend-row';
    li.innerHTML = `<span class="swatch" style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:middle;background:${toCssHex(g.color)}"></span>${g.name}`;
    li.style.padding = '6px 10px';
    li.style.marginBottom = '6px';
@@ -96,9 +103,20 @@ if (genreSelect && legendList){
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
@@ -114,17 +132,16 @@ camera.lookAt(0,0,0);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Transparent so page background can show
renderer.setClearColor(0x000010, 0);
wrap.appendChild(renderer.domElement);
if (wrap) wrap.appendChild(renderer.domElement);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';

const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

/* ---------- Starfield & Dust ---------- */
/* ---------- Starfield & Dust (background layers) ---------- */
function makeStarLayer(count, spreadX=5000, spreadY=3000, spreadZ=5000, size=1.2, opacity=0.9){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
@@ -152,18 +169,20 @@ const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800),
dustPlane.position.set(0,0,-2600);
scene.add(dustPlane);

/* ---------- Procedural small textures ---------- */
/* ---------- Procedural textures (glow/star) ---------- */
function generateGlowTexture(colorHex){
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,6,size/2,size/2,size/2);
  const grad = ctx.createRadialGradient(size/2,size/2,4,size/2,size/2,size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, toCssRgba(colorHex, 0.28));
  grad.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.42, toCssRgba(colorHex, 0.35));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
@@ -175,14 +194,12 @@ function generateStarTexture(){
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }

/* ---------- ORB cluster (planets/bubbles) ---------- */
const CLUSTER_RADIUS = 420;
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {};

function createStardustRing(coreRadius, colorHex, tilt, particleCount=260, size=8.5, counterClockwise=true){
function createStardustRing(coreRadius, colorHex, tilt, particleCount=240, size=8.5, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.85);
  const positions = new Float32Array(particleCount*3);
@@ -193,31 +210,39 @@ function createStardustRing(coreRadius, colorHex, tilt, particleCount=260, size=
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.5);
    sizes[i] = (Math.random()*1.6 + 1.6) * size;
    sizes[i] = (Math.random()*1.6 + 1.2) * size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);
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
    color: 0xffffff, transparent:true, opacity:0.30, roughness:0.16, metalness:0.08, transmission:0.7,
    emissive: color.clone().multiplyScalar(0.02), emissiveIntensity:0.6, clearcoat:0.2
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

@@ -232,7 +257,6 @@ GENRES.forEach((g, idx) => {
  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  container.userData.baseAngle = baseAngle;
  container.userData.idx = idx;
  // initial placement in a ring (will be animated)
  container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.6, -idx*6);

  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
@@ -248,27 +272,31 @@ GENRES.forEach((g, idx) => {
  ORB_MESHES[g.id] = { id:g.id, idx, container, core: coreMesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- Aurora/smoke layers ---------- */
/* ---------- Aurora / Haze layers — make them circular/soft to avoid rectangular look ---------- */
function createAuroraSprite(colorStops, size=1600, opacity=0.3){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,20,size/2,size/2,size*0.95);
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

const smokeBack1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(120,40,200,0.12)'},{offset:0.8,color:'rgba(20,150,200,0.06)'},{offset:1,color:'rgba(0,0,0,0)'}], 2000, 0.42);
const smokeBack1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.14,color:'rgba(120,40,200,0.12)'},{offset:0.78,color:'rgba(20,150,200,0.06)'},{offset:1,color:'rgba(0,0,0,0)'}], 2000, 0.42);
smokeBack1.scale.set(3000,1600,1); smokeBack1.position.set(-60,-120,-1800); scene.add(smokeBack1);

const smokeBack2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(200,40,140,0.10)'},{offset:0.6,color:'rgba(60,40,220,0.08)'},{offset:1,color:'rgba(0,0,0,0)'}], 1800, 0.3);
const smokeBack2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.18,color:'rgba(200,40,140,0.10)'},{offset:0.6,color:'rgba(60,40,220,0.08)'},{offset:1,color:'rgba(0,0,0,0)'}], 1800, 0.3);
smokeBack2.scale.set(2600,1300,1); smokeBack2.position.set(120,-60,-1600); scene.add(smokeBack2);

const smokeFront1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(160,40,220,0.08)'},{offset:0.7,color:'rgba(30,200,220,0.07)'},{offset:1,color:'rgba(0,0,0,0)'}], 1400, 0.30);
const smokeFront1 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.18,color:'rgba(160,40,220,0.08)'},{offset:0.7,color:'rgba(30,200,220,0.07)'},{offset:1,color:'rgba(0,0,0,0)'}], 1400, 0.30);
smokeFront1.scale.set(2200,1100,1); smokeFront1.position.set(30,80,-320); scene.add(smokeFront1);

const smokeFront2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.2,color:'rgba(240,120,100,0.06)'},{offset:0.7,color:'rgba(90,80,255,0.05)'},{offset:1,color:'rgba(0,0,0,0)'}], 1200, 0.24);
const smokeFront2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.18,color:'rgba(240,120,100,0.06)'},{offset:0.7,color:'rgba(90,80,255,0.05)'},{offset:1,color:'rgba(0,0,0,0)'}], 1200, 0.24);
smokeFront2.scale.set(1800,900,1); smokeFront2.position.set(-80,40,-260); scene.add(smokeFront2);

const cornerSpecs = [
@@ -285,7 +313,7 @@ cornerSpecs.forEach((s,i)=>{
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- Audio / WebAudio Controller ---------- */
/* ---------- Audio / WebAudio Controller (for local audio & direct URLs) ---------- */
const audioController = (function(){
  let audioCtx=null, analyser=null, source=null, freqData=null, timeData=null, audioEl=null, active=false;
  async function ensure(){
@@ -303,12 +331,14 @@ const audioController = (function(){
      if (!audioEl){ audioEl = document.createElement('audio'); audioEl.crossOrigin='anonymous'; audioEl.controls=true; audioEl.style.width='100%'; }
      audioEl.src = url;
      audioEl.loop = !!loop;
      // play might be blocked until user gesture; catch the error
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
@@ -339,10 +369,10 @@ const audioController = (function(){
  return { loadUrl, stop, getAmps, getTimeDomain, isActive };
})();

/* ---------- Horizontal Ribbon: energy trail that uses time-domain waveform ---------- */
/* ---------- Horizontal Ribbon: smooth waveform energy trail ---------- */
const RIBBON = {};
function initRibbon(){
  const POINTS = 512; // increased resolution for smoother curve
  const POINTS = 512;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(POINTS * 3);
  const colors = new Float32Array(POINTS * 3);
@@ -363,29 +393,37 @@ function initRibbon(){
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, linewidth: 2 });
  // Use Line2 / wide lines are not universally supported — keep LineBasicMaterial and sprite glow for width illusion
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending });
  const line = new THREE.Line(geometry, mat);
  line.frustumCulled = false;
  scene.add(line);

  // soft glow sprite behind
  // soft glow sprite behind the ribbon (helps mask any sharp rectangular artifacts)
  const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,c.width,0);
  g.addColorStop(0, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.06)');
  g.addColorStop(0, 'rgba(255,255,255,0.00)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.06)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.82, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g; ctx.fillRect(0,0,c.width,c.height);
  // add subtle feathered vertical edges to reduce rectangular look
  ctx.globalCompositeOperation = 'lighter';
  const vgrad = ctx.createLinearGradient(0,0,c.width,c.height);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.00)');
  vgrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  vgrad.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = vgrad; ctx.fillRect(0,0,c.width,c.height);
  ctx.globalCompositeOperation = 'source-over';
  const glowTex = new THREE.CanvasTexture(c);
  const spriteMat = new THREE.SpriteMaterial({ map: glowTex, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(width*1.05, Math.max(40, width*0.035), 1);
  sprite.position.set(0, -8, -140);
  scene.add(sprite);

  // smoothing buffers for nice interpolation
  const prevY = new Float32Array(POINTS);
  for (let i=0;i<POINTS;i++) prevY[i] = positions[i*3+1];

@@ -397,20 +435,13 @@ function initRibbon(){
  RIBBON.baseY = 0;
  RIBBON.currentGenre = null;
  RIBBON._prevY = prevY;
  RIBBON.smoothAlpha = 0.18; // lerp factor: lower = smoother/slower
  RIBBON.smoothAlpha = 0.18;
}
initRibbon();

/* ---------- Vertical Pillar Ribbons (one per genre/orb) ---------- */
/* Plan:
   - create a tall plane for each genre behind its orb
   - plane has gradient texture derived from genre color (soft translucent)
   - plane geometry subdivided horizontally to allow weaving (per-vertex x displacement)
   - in animate loop we'll offset vertices with sine waves to create weaving
*/
const PILLAR_RIBBONS = []; // { mesh, geo, baseX, baseZ, idx, width, height, color }
function makePillarTexture(colorHex, h=1024, w=128){
  // vertical gradient canvas
/* ---------- Vertical Pillar Ribbons (one per genre) ---------- */
const PILLAR_RIBBONS = [];
function makePillarTexture(colorHex, h=1024, w=192){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,h);
@@ -424,7 +455,7 @@ function makePillarTexture(colorHex, h=1024, w=128){
  grad.addColorStop(1.00, rgba(0.0));
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);
  // a faint horizontal soft-edge to add width highlight
  // subtle horizontal sheen
  const hg = ctx.createLinearGradient(0,0,w,0);
  hg.addColorStop(0, 'rgba(255,255,255,0.00)');
  hg.addColorStop(0.45, 'rgba(255,255,255,0.04)');
@@ -434,29 +465,25 @@ function makePillarTexture(colorHex, h=1024, w=128){
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hg; ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation = 'source-over';
  return new THREE.CanvasTexture(c);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function initPillarRibbons(){
  // chosen visual dims (world units). Pillars are tall and narrow.
  const pillarHeight = 1200;
  const pillarWidth = 160; // world width
  const hSegs = 48; // vertical subdivisions
  const wSegs = 10; // horizontal subdivisions (for weaving)
  const pillarWidth = 160;
  const hSegs = 48;
  const wSegs = 10;
  GENRES.forEach((g, idx) => {
    // plane geometry with subdivisions
    const geo = new THREE.PlaneGeometry(pillarWidth, pillarHeight, wSegs, hSegs);
    // material with gradient texture based on genre color — translucent, additive
    const tex = makePillarTexture(g.color, 1024, 192);
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true, opacity:0.20, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    // rotate to stand vertically and face forward slightly
    mesh.rotation.x = -Math.PI/2 + 0.02; // stand up (x axis)
    mesh.rotation.y = 0.06 * (idx % 2 === 0 ? 1 : -1); // slight slant to left/right for weaving feel
    // place behind the orbs along z and at roughly same x (we'll sync in animate)
    mesh.rotation.x = -Math.PI/2 + 0.02;
    mesh.rotation.y = 0.06 * (idx % 2 === 0 ? 1 : -1);
    mesh.position.set(0, -80, -180 - idx*6);
    mesh.userData = { idx, baseX: 0, baseZ: mesh.position.z, width: pillarWidth, height: pillarHeight, wSegs, hSegs, color: g.color };
    scene.add(mesh);
@@ -465,54 +492,124 @@ function initPillarRibbons(){
}
initPillarRibbons();

/* ---------- GENRE PLAYLIST MAP ---------- */
const GENRE_PLAYLISTS = {
  'hard-techno': 'https://soundcloud.com/your-hard-techno-playlist',
  'techno':      'https://soundcloud.com/your-techno-playlist',
  'house':       'https://soundcloud.com/your-house-playlist',
  'dnb':         'https://soundcloud.com/your-dnb-playlist',
  'electronic':  'https://soundcloud.com/your-electronic-playlist',
  'dubstep':     'https://soundcloud.com/your-dubstep-playlist',
  'pop':         'https://soundcloud.com/your-pop-playlist'
};
/* ---------- Genre -> Spotify mapping (used to place embed iframe) ---------- */
const GENRE_SPOTIFY = {};
GENRES.forEach(g => { GENRE_SPOTIFY[g.id] = g.spotify || null; });

/* ---------- Play selected genre audio and adapt horizontal ribbon color ---------- */
/* ---------- Play selected genre: prefer Spotify embed if available, fallback to internal audioController ------- */
let currentGenreId = null;
function clearSpotifyEmbed(){
  if (!spotifyEmbed) return;
  spotifyEmbed.innerHTML = '';
}
function embedSpotify(uri){
  if (!spotifyEmbed) return;
  spotifyEmbed.innerHTML = '';
  // try to detect if the uri is already a full URL; convert to embed path
  // spotify embed url format: https://open.spotify.com/embed/playlist/{id} OR /track/{id}
  try {
    const u = new URL(uri);
    // allow open.spotify.com links directly
    if (u.hostname.includes('spotify')) {
      // replace path with /embed + original path without trailing query
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
  // If not parseable, try to create a generic embed with the string appended (best-effort)
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
  const url = GENRE_PLAYLISTS[genreId] || GENRE_PLAYLISTS['electronic'];
  try { await audioController.loadUrl(url, { loop: true }); } catch(e){ /* noop */ }
  // Primary: Spotify embed if mapping exists
  currentGenreId = genreId;
  const spotifyUri = GENRE_SPOTIFY[genreId];
  if (spotifyUri && spotifyEmbed){
    // Stop local audioController (if active) — we can't analyze Spotify embed audio for visuals
    try { audioController.stop(); } catch(e){}
    clearSpotifyEmbed();
    embedSpotify(spotifyUri);
  } else {
    // fallback: play configured direct URL (if you want to place direct MP3s, update GENRE_PLAYLISTS below)
    const url = (GENRE_PLAYLISTS && GENRE_PLAYLISTS[genreId]) ? GENRE_PLAYLISTS[genreId] : null;
    if (url) {
      await audioController.loadUrl(url, { loop: true });
    } else {
      // nothing to play
      try { audioController.stop(); } catch(e){}
      clearSpotifyEmbed();
    }
  }
  // colorize horizontal ribbon (exact match to genre color per your instruction)
  const g = GENRES.find(x=>x.id===genreId);
  if (g && RIBBON.geometry && RIBBON.geometry.attributes.color){
    const colors = RIBBON.geometry.attributes.color.array;
    const tr = ((g.color>>16)&255)/255, tg = ((g.color>>8)&255)/255, tb = (g.color&255)/255;
    for (let i=0;i<RIBBON.points;i++){
      const idx = i*3;
      colors[idx] = 0.25 + tr * 0.75;
      colors[idx+1] = 0.25 + tg * 0.75;
      colors[idx+2] = 0.25 + tb * 0.75;
      colors[idx] = 0.14 + tr * 0.86;
      colors[idx+1] = 0.14 + tg * 0.86;
      colors[idx+2] = 0.14 + tb * 0.86;
    }
    RIBBON.geometry.attributes.color.needsUpdate = true;
    if (RIBBON.sprite && RIBBON.sprite.material) {
      RIBBON.sprite.material.color = new THREE.Color(g.color);
      RIBBON.sprite.material.opacity = 0.6;
      RIBBON.sprite.material.opacity = 0.62;
    }
    // also tint corresponding pillar more strongly
    // pillar emphasis
    const foundIdx = GENRES.findIndex(x=>x.id===genreId);
    PILLAR_RIBBONS.forEach((p, i)=> {
      p.mesh.material.opacity = (i === foundIdx) ? 0.34 : 0.16;
    });
    // highlight legend entry if present
    if (legendList){
      Array.from(legendList.children).forEach((li, i) => {
        li.style.boxShadow = (i === foundIdx) ? '0 6px 18px rgba(0,0,0,0.45)' : 'none';
        li.style.transform = (i === foundIdx) ? 'translateY(-2px)' : 'none';
      });
    }
    highlightLegend(genreId);
  }
}

/* ---------- Raycast / Click handling ---------- */
/* Add an accessible manual Spotify loader (UI element might exist) */
if (loadSpotify && spotifyInput){
  loadSpotify.addEventListener('click', ()=>{
    const v = spotifyInput.value && spotifyInput.value.trim();
    if (!v) return;
    // If user pastes a Spotify link, embed it
    embedSpotify(v);
    // stop local audio since embed is used
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

@@ -545,7 +642,7 @@ function onPointerDown(e){
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- Centered modal code (unchanged) ---------- */
/* ---------- Centered modal (unchanged UX but supports local audio upload / URL) ---------- */
let activeModal = null;
function closeModal(){ if(!activeModal) return; try{ activeModal.dom.remove(); }catch(e){} activeModal=null; }
function openCenteredModal(genreId){
@@ -624,7 +721,7 @@ function insertAudioPlayerInModal(modal, src, label){
  info.textContent = `Loaded: ${label}`;
}

/* ---------- flash feedback (orb highlight) ---------- */
/* ---------- flashOrb (visual feedback) ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if (!o) return;
  const mat = o.core.material; const orig = mat.emissiveIntensity || 0.6;
@@ -659,7 +756,7 @@ function updateOrbHighlight(genreId, topCount){
  o.core.scale.set(base, base, base);
}

/* ---------- Animation / render loop (includes horizontal ribbon + pillar weave) ---------- */
/* ---------- Animation / render loop ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
@@ -694,45 +791,39 @@ function animate(){

  // cluster / bubbles orbit: diagonal elliptical, more center-uniform
  const clusterSpeed = 0.12 + bass * 0.38;
  // tilt the major axis to diagonal: rotate ellipse by -45deg (top-left to bottom-right)
  const tiltAngle = -Math.PI / 4;
  const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);
  // optionally push the whole cluster slightly to the right if leftPanel exists so orbs avoid left UI

  // avoid left UI by pushing cluster right if leftPanel present
  let centerOffsetX = 0, centerOffsetY = 0;
  if (leftPanel && leftPanel.getBoundingClientRect){
    try {
      const lr = leftPanel.getBoundingClientRect();
      // convert pixel offset to world-like offset by a simple heuristic
      centerOffsetX = (lr.width / Math.max(window.innerWidth, 600)) * (CLUSTER_RADIUS * 0.85);
      centerOffsetY = -Math.min(120, lr.height * 0.08);
    } catch(e){}
  }

  GENRES.forEach((g, idx) => {
    const o = ORB_MESHES[g.id];
    if (!o) return;
    const phaseOffset = o.baseAngle;
    const angle = t * clusterSpeed + phaseOffset * (0.6 + idx*0.08);

    // elliptical radii — vary slightly per-index for organic look
    const ex = CLUSTER_RADIUS * (0.86 + Math.sin(idx + t*0.12)*0.02); // major
    const ey = CLUSTER_RADIUS * 0.48 * (0.9 + Math.cos(idx*0.7 + t*0.11)*0.02); // minor - more compact vertically
    const ex = CLUSTER_RADIUS * (0.86 + Math.sin(idx + t*0.12)*0.02);
    const ey = CLUSTER_RADIUS * 0.48 * (0.9 + Math.cos(idx*0.7 + t*0.11)*0.02);

    // raw ellipse coords (centered at origin)
    const rawX = Math.cos(angle) * ex;
    const rawY = Math.sin(angle) * ey;

    // rotate ellipse to diagonal
    const rx = rawX * cosT - rawY * sinT;
    const ry = rawX * sinT + rawY * cosT;

    // subtle per-orb jitter and index-based offset to avoid perfect symmetry
    const jitterX = Math.sin(t*0.27 + idx*0.64) * 6;
    const jitterY = Math.cos(t*0.31 + idx*0.41) * 3;

    // apply center offset (so cluster doesn't go behind left UI)
    o.container.position.x = rx + centerOffsetX + jitterX + (idx - (GENRES.length-1)/2) * Math.sin(t*0.02) * 0.7;
    o.container.position.y = ry + centerOffsetY + jitterY + Math.cos(idx*0.5 + t*0.2)*4;
    // keep z shallow range so orbs don't disappear behind deep elements; controlled per-index for depth
    o.container.position.z = Math.sin(t*(0.45 + idx*0.02))*8 - idx*3;

    o.core.rotation.y += 0.002 + idx*0.0003;
@@ -745,49 +836,45 @@ function animate(){

    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.16 + rms * 0.28; });

    // sync corresponding pillar base X to orb X (pillars follow bubbles)
    // sync pillar position to orb
    const pillar = PILLAR_RIBBONS[idx];
    if (pillar){
      pillar.mesh.userData.baseX = o.container.position.x;
      // small Z sync subtle depth parallax
      pillar.mesh.position.z = o.container.position.z - 50 - idx*2;
    }
  });

  /* --- Horizontal Ribbon update: use time-domain data if available, otherwise idle motion --- */
  /* --- Horizontal Ribbon update --- */
  try {
    if (RIBBON && RIBBON.geometry){
      const pos = RIBBON.geometry.attributes.position.array;
      const pts = RIBBON.points;
      // Use time-domain when audioController active; note: Spotify embeds cannot be analyzed, so visuals fall back to idle
      const timeData = audioController.getTimeDomain();
      const prevY = RIBBON._prevY;
      const alpha = RIBBON.smoothAlpha; // lerp factor
      const alpha = RIBBON.smoothAlpha;
      if (timeData && timeData.length > 0){
        // map time-domain smoothly across pts using interpolation step and smoothing
        const tdLen = timeData.length;
        for (let i=0;i<pts;i++){
          // sample fractional index into timeData for smoother mapping
          const f = (i / (pts-1)) * (tdLen - 1);
          const i0 = Math.floor(f), i1 = Math.min(tdLen-1, i0+1);
          const frac = f - i0;
          const td0 = timeData[i0], td1 = timeData[i1];
          const td = td0 * (1 - frac) + td1 * frac; // linear interp
          const v = (td / 128.0) - 1.0; // -1..1
          const td = td0 * (1 - frac) + td1 * frac;
          const v = (td / 128.0) - 1.0;
          const amplitude = 120 + (currentGenreId ? 80 : 0);
          const baseOsc = Math.sin(i*0.09 + t*0.7) * 0.14;
          const targetY = v * amplitude * (0.7 + baseOsc);
          const idx = i*3;
          // lerp previous y to target for smoothing
          prevY[i] = prevY[i] * (1 - alpha) + targetY * alpha;
          pos[idx+1] = prevY[i] - 10;
          // subtle smooth z wobble
          pos[idx+2] = -120 + Math.sin(t*0.28 + i*0.04) * 5;
        }
        const amps = audioController.getAmps();
        const brightness = amps ? (0.28 + amps.rms*1.4) : 0.36;
        if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = Math.min(0.95, 0.22 + brightness);
      } else {
        // idle motion with smoothing (lerp toward target idle wave)
        // gentle idle waving when no analyzable audio
        for (let i=0;i<pts;i++){
          const idx = i*3;
          const targetY = (Math.sin(i*0.08 + t*0.9) * 12 + Math.sin(i*0.06 + t*0.3)*6 - 8);
@@ -801,10 +888,9 @@ function animate(){
    }
  } catch(e){ /* safe */ }

  /* --- Pillar ribbon weave update --- */
  /* --- Pillar ribbon weave update (gentle waving) --- */
  try {
    // global weave settings
    const globalAmp = 22 + bass * 140; // amplitude grows with bass
    const globalAmp = 22 + bass * 140;
    const freq = 0.9 + (rms * 6.0);
    PILLAR_RIBBONS.forEach((p, pIdx) => {
      const mesh = p.mesh;
@@ -821,9 +907,9 @@ function animate(){
        const vNorm = iy / hSegs;
        const yFactor = (vNorm - 0.5) * mesh.userData.height;
        for (let ix = 0; ix <= wSegs; ix++){
          const idx = vi * 3; // x,y,z
          const idx = vi * 3;
          const xBaseLocal = (-mesh.userData.width/2) + (ix / wSegs) * mesh.userData.width;
          const disp = Math.sin((vNorm * Math.PI * 4.0) + (t * freq) + phase + ix*0.18) * (globalAmp * (0.18 + (ix/wSegs)*0.6));
          const disp = Math.sin((vNorm * Math.PI * 4.0) + (t * freq) + phase + ix*0.18) * (globalAmp * (0.14 + (ix/wSegs)*0.5));
          arr[idx] = baseX + xBaseLocal + disp * 0.012;
          arr[idx+1] = yFactor - 80;
          arr[idx+2] = baseZ + Math.sin(t*0.6 + ix*0.07 + iy*0.03) * 6;
@@ -840,11 +926,10 @@ function animate(){
}
animate();

/* ---------- Resize ---------- */
/* ---------- Resize handler ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  // recompute horizontal ribbon width and sprite scale
  if (RIBBON && RIBBON.width){
    const width = (2 * Math.tan(camera.fov * Math.PI/180 / 2) * Math.abs(camera.position.z)) * camera.aspect * 1.05;
    RIBBON.width = width;
@@ -856,7 +941,6 @@ window.addEventListener('resize', ()=>{
    }
    RIBBON.geometry.attributes.position.needsUpdate = true;
  }
  // update pillar textures anisotropy if needed
  PILLAR_RIBBONS.forEach(p => {
    try { if (p.mesh && p.mesh.material && p.mesh.material.map) p.mesh.material.map.needsUpdate = true; } catch(e){}
  });
@@ -867,5 +951,4 @@ computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 900);

/* ---------- Sanity log ---------- */
console.log('app.js loaded — horizontal ribbon smoothed, diagonal elliptical orbit, 7 vertical weaving pillar ribbons enabled.');
console.log('app.js loaded — full integration: smooth horizontal ribbon, diagonal elliptical orbits, 7 genre pillars, Spotify embed integrated.');

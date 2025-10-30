/* app.js — Final build
   - Zoomed-out camera so all orbs remain visible
   - Stacked aurora smoke layers (back + front), corner gas blobs
   - Per-orb tilted stardust rings (counter-rotating)
   - Large starfield with twinkle (fade in/out)
   - WebAudio analyzer (load URL or local file) to pulse aurora and rings rhythmically
   - Preserves UI IDs: genreSelect, topList, toggleTop, leftPanel, spotifyInput, loadSpotify, spotifyEmbed, legendList
   - Uses Three.js already included in index.html
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null; // leave null if you want local storage

/* ---------- small helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex, a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- persistence (firebase optional / fallback localStorage) ---------- */
let dbRef = null, useFirebase = false;
if (FIREBASE_CONFIG){
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const database = firebase.database();
    dbRef = database.ref('codemq/arts');
    useFirebase = true;
    console.log('Firebase enabled');
  } catch(e){
    console.warn('Firebase init failed — using localStorage', e);
    useFirebase = false;
  }
}
async function saveVote(genreId, artistName, b2b){
  const rec = { artist: artistName.trim(), b2b: (b2b||'').trim(), ts: Date.now() };
  if (useFirebase && dbRef){
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
  if (useFirebase && dbRef){
    const snap = await dbRef.get();
    return snap.exists() ? snap.val() : {};
  } else {
    return JSON.parse(localStorage.getItem('codemq_votes') || '{}');
  }
}
if (!useFirebase) window.addEventListener('codemq_local_update', ()=> computeAndRenderTop());

/* ---------- UI refs (must match index.html) ---------- */
const genreSelect = document.getElementById('genreSelect');
const topList = document.getElementById('topList');
const toggleTop = document.getElementById('toggleTop');
const leftPanel = document.getElementById('leftPanel');

const spotifyInput = document.getElementById('spotifyInput');
const loadSpotify = document.getElementById('loadSpotify');
const spotifyEmbed = document.getElementById('spotifyEmbed');

const legendList = document.getElementById('legendList');

/* ---------- genres ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79 },
  { id:'house', name:'House', color:0xffbf5f },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85 },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff },
  { id:'electronic', name:'Electronic', color:0x9f5fff },
  { id:'mainstream', name:'Mainstream/International', color:0xffffff }
];

/* populate selects + legend */
GENRES.forEach(g=>{
  const opt = document.createElement('option'); opt.value=g.id; opt.textContent=g.name; genreSelect.appendChild(opt);
  const li = document.createElement('li'); li.textContent=g.name;
  li.style.background = `linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`;
  // contrast
  const lum = (((g.color>>16)&255)*299 + (((g.color>>8)&255)*587) + ((g.color&255)*114))/1000;
  li.style.color = lum >=128 ? '#000' : '#fff';
  legendList.appendChild(li);
});
toggleTop.addEventListener('click', ()=> leftPanel.classList.toggle('hidden'));

/* spotify / audio UI: keep embed behavior but add audio analyzer controls */
/* we'll add a small "Load local file" button dynamically so user can test audio reaction */
(function augmentPlaylistPanel(){
  const panel = document.querySelector('#playlistPanel');
  if (!panel) return;
  // add small file input
  const fileRow = document.createElement('div');
  fileRow.style.display='flex'; fileRow.style.gap='6px'; fileRow.style.marginTop='8px';
  const fileInput = document.createElement('input'); fileInput.type='file'; fileInput.accept='audio/*';
  const loadFileBtn = document.createElement('button'); loadFileBtn.textContent='Load local file'; loadFileBtn.className='btn';
  fileRow.appendChild(fileInput); fileRow.appendChild(loadFileBtn);
  panel.appendChild(fileRow);

  // handle loadSpotify click: if direct audio url is entered we'll try to use it as analyzer source
  loadSpotify.addEventListener('click', async ()=>{
    const v = (spotifyInput.value||'').trim();
    spotifyEmbed.innerHTML = '';
    if (!v) return;
    if (v.includes('open.spotify.com') || v.includes('spotify:')){
      // embed Spotify (analysis unavailable)
      let embedUrl = v;
      if (v.startsWith('spotify:playlist:')) { const id=v.split(':').pop(); embedUrl = `https://open.spotify.com/embed/playlist/${id}`; }
      else if (v.includes('open.spotify.com')) embedUrl = v.replace('open.spotify.com','open.spotify.com/embed');
      spotifyEmbed.innerHTML = `<iframe src="${embedUrl}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
        <div style="margin-top:6px"><a target="_blank" rel="noreferrer" href="${embedUrl}">Open in Spotify</a></div>`;
      // stop audio analyzer (can't access embed)
      audioController.stop();
      return;
    } else {
      // assume direct audio URL (mp3/ogg) — attempt to load into audio analyzer
      await audioController.loadUrl(v);
      spotifyEmbed.innerHTML = `<div style="font-size:12px;color:#ccc;padding:6px;border-radius:6px;background:rgba(255,255,255,0.02)">Analyzing audio from URL</div>`;
    }
  });

  // load local file button behavior
  loadFileBtn.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    await audioController.loadUrl(url);
    spotifyEmbed.innerHTML = `<div style="font-size:12px;color:#ccc;padding:6px;border-radius:6px;background:rgba(255,255,255,0.02)">${escapeHtml(f.name)} — analyzing</div>`;
  });
})();

/* ---------- three.js scene ---------- */
const wrap = document.getElementById('canvasWrap') || document.body;
const scene = new THREE.Scene();
// set low fog so things don't vanish
scene.fog = new THREE.FogExp2(0x000012, 0.00012);

/* camera: zoom out and keep all orbs visible. pick z large enough.
   Camera will have slight subtle motion but not fixed at one distance to the cluster. */
const camera = new THREE.PerspectiveCamera(48, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 20, 520); // pulled back to show the full cluster reliably
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

/* lights */
const ambient = new THREE.AmbientLight(0xffffff, 0.45); scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9); dirLight.position.set(10,20,10); scene.add(dirLight);

/* ---------- starfield (two layers for twinkle & parallax) ---------- */
function makeStarLayer(count, spreadX=5000, spreadY=3000, spreadZ=5000, size=1.2, opacity=0.95){
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  for (let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5)*spreadX;
    pos[i*3+1] = (Math.random()-0.5)*spreadY;
    pos[i*3+2] = -Math.random()*spreadZ - 200;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
  const pts = new THREE.Points(g, mat);
  return { pts, geom:g, mat };
}
const starLayerFar = makeStarLayer(2200, 6000, 3600, 6000, 1.2, 0.92);
const starLayerNear = makeStarLayer(900, 3600, 2200, 3600, 1.8, 0.65);
scene.add(starLayerFar.pts, starLayerNear.pts);

/* dust background */
const dustTex = new THREE.TextureLoader().load('https://assets.codepen.io/982762/clouds.png');
const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000,3800), new THREE.MeshBasicMaterial({ map:dustTex, transparent:true, opacity:0.05, depthWrite:false }));
dustPlane.position.set(0,0,-2600);
scene.add(dustPlane);

/* ---------- helpers: small procedural textures ---------- */
function generateGlowTexture(colorHex){
  const size=256; const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,8,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.2,'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5,toCssRgba(colorHex,0.34));
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
function generateStarTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s; const ctx=c.getContext('2d');
  const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.25,'rgba(255,255,255,0.95)'); g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
function toCssRgba(hex,a=1){ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255; return `rgba(${r},${g},${b},${a})`; }

/* ---------- ORBS + RINGS + GAS ---------- */
const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
const ORB_MESHES = {}; // map by genre id

function createStardustRing(coreRadius, colorHex, tilt, particleCount=240, size=8.0, counterClockwise=true){
  const group = new THREE.Group();
  const ringRadius = coreRadius * (1.8 + Math.random()*0.9);
  const positions = new Float32Array(particleCount*3);
  const sizes = new Float32Array(particleCount);
  for (let i=0;i<particleCount;i++){
    const theta = (i/particleCount) * Math.PI*2;
    const rr = ringRadius + (Math.random()-0.5)*(coreRadius*0.36);
    positions[i*3] = Math.cos(theta)*rr;
    positions[i*3+1] = Math.sin(theta)*rr;
    positions[i*3+2] = (Math.random()-0.5)*(coreRadius*0.5);
    sizes[i] = (Math.random()*1.6 + 1.6) * size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({
    size: size,
    map: generateStarTexture(),
    transparent:true,
    opacity:0.92,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  mat.color = new THREE.Color(colorHex).multiplyScalar(0.9);
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // glow sprite for ring
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), color: colorHex, transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(ringRadius*2.1, ringRadius*2.1, 1); group.add(glow);

  group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
  const baseSpeed = 0.0045 + Math.random()*0.006;
  const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
  return { group, points, mat, rotationSpeed };
}

/* build orbs */
GENRES.forEach((g, idx)=>{
  const color = new THREE.Color(g.color);
  const coreRadius = 26 + Math.random()*9;
  const coreGeo = new THREE.SphereGeometry(coreRadius, 64, 64);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent:true, opacity:0.28, roughness:0.16, metalness:0.08,
    transmission:0.7, emissive: color.clone().multiplyScalar(0.02), emissiveIntensity:0.6, clearcoat:0.25
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  const rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(g.color), color: g.color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rimSprite.scale.set(coreRadius*9.6, coreRadius*9.6, 1);
  coreMesh.add(rimSprite);

  const container = new THREE.Group();
  container.add(coreMesh);

  const baseAngle = (idx / GENRES.length) * Math.PI*2;
  const clusterRadius = 420;
  container.position.set(Math.cos(baseAngle)*clusterRadius, Math.sin(baseAngle)*clusterRadius*0.6, -idx*8);

  const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
  const ringObj = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random()*160), 9.0, true);
  container.add(ringObj.group);

  const gasGeo = new THREE.SphereGeometry(coreRadius*1.9, 32, 32);
  const gasMat = new THREE.MeshBasicMaterial({ color:g.color, transparent:true, opacity:0.055, blending:THREE.AdditiveBlending, depthWrite:false });
  const gasMesh = new THREE.Mesh(gasGeo, gasMat);
  container.add(gasMesh);

  ORB_GROUP.add(container);
  ORB_MESHES[g.id] = { id:g.id, idx, container, core:coreMesh, ringObj, gas:gasMesh, baseAngle };
});

/* ---------- Aurora / smoke layers (back + front) + corner blobs ---------- */
function createAuroraTexture(stops, size=1600){
  const c = document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2,size/2,40,size/2,size/2,size*0.95);
  stops.forEach(s=> grad.addColorStop(s.offset, s.color));
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}

const backStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.18, color:'rgba(120,30,200,0.12)'},
  {offset:0.48, color:'rgba(30,180,200,0.08)'},
  {offset:0.78, color:'rgba(240,110,180,0.06)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];
const frontStops = [
  {offset:0, color:'rgba(0,0,0,0)'},
  {offset:0.2, color:'rgba(200,40,140,0.10)'},
  {offset:0.5, color:'rgba(80,40,220,0.12)'},
  {offset:0.85, color:'rgba(30,180,200,0.10)'},
  {offset:1, color:'rgba(0,0,0,0)'}
];

const backTex = createAuroraTexture(backStops, 2000);
const backSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:backTex, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false }));
backSprite.scale.set(3000,1600,1); backSprite.position.set(0,-180,-2000); scene.add(backSprite);

const frontTex = createAuroraTexture(frontStops, 1600);
const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:frontTex, transparent:true, opacity:0.34, blending:THREE.AdditiveBlending, depthWrite:false }));
frontSprite.scale.set(2200,1100,1); frontSprite.position.set(60,40,-300); scene.add(frontSprite);

// corner blobs
const cornerSpecs = [
  {x:-1.0,y:-1.0,c:'rgba(160,40,220,0.18)'},
  {x:1.0,y:-0.9,c:'rgba(40,200,220,0.12)'},
  {x:-0.9,y:1.0,c:'rgba(240,120,100,0.10)'},
  {x:0.9,y:0.9,c:'rgba(100,120,255,0.08)'}
];
const cornerSprites = [];
cornerSpecs.forEach((s,i)=>{
  const tex = createAuroraTexture([{offset:0,color:s.c},{offset:1,color:'rgba(0,0,0,0)'}], 900);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:0.14 + Math.random()*0.06, blending:THREE.AdditiveBlending, depthWrite:false }));
  spr.scale.set(900,900,1);
  const px = s.x * 1200 * (0.6 + Math.random()*0.4);
  const py = s.y * 700 * (0.6 + Math.random()*0.4);
  spr.position.set(px,py,-320);
  scene.add(spr); cornerSprites.push(spr);
});

/* ---------- raycast clicks & prompt anchors ---------- */
const raycaster = new THREE.Raycaster();
const ndcMouse = new THREE.Vector2();

function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  ndcMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndcMouse, camera);

  const cores = [];
  ORB_GROUP.children.forEach(c => c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === 'SphereGeometry') cores.push(n); }));
  const hits = raycaster.intersectObjects(cores, true);
  if (hits.length>0){
    let hit = hits[0].object;
    // find parent container
    let parent=null;
    for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c===hit || c.children.includes(hit.parent)){ parent=c; break; } }
    if (parent){
      const found = Object.values(ORB_MESHES).find(o=>o.container===parent);
      if (found) openPromptAnchored(found.id);
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

/* ---------- anchored prompt (exit/cancel/submit) ---------- */
let activePrompt = null;
function closeActivePrompt(){ if(!activePrompt) return; try{ cancelAnimationFrame(activePrompt.raf); }catch(e){} try{ activePrompt.dom.remove(); }catch(e){} activePrompt=null; }
function openPromptAnchored(genreId){
  closeActivePrompt();
  const g = GENRES.find(x=>x.id===genreId); if(!g) return;
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
  dom.querySelector('.closeX').addEventListener('click', ()=> closeActivePrompt());
  dom.querySelector('.cancel').addEventListener('click', ()=> closeActivePrompt());
  dom.querySelector('.submit').addEventListener('click', async ()=>{
    const artist = dom.querySelector('.artist').value.trim(); if(!artist){ dom.querySelector('.artist').focus(); return; }
    const b2b = dom.querySelector('.b2b').value.trim();
    await saveVote(genreId, artist, b2b);
    flashOrb(genreId); computeAndRenderTop(); closeActivePrompt();
  });

  activePrompt = { dom, angle: Math.random()*Math.PI*2, radius: 160, genreId, raf:null };
  function loop(){
    if(!activePrompt) return;
    activePrompt.angle += 0.012;
    const o = ORB_MESHES[genreId]; if(!o) return;
    const worldPos = new THREE.Vector3(); o.container.getWorldPosition(worldPos);
    worldPos.project(camera);
    const sx = (worldPos.x * 0.5 + 0.5)*window.innerWidth;
    const sy = (-worldPos.y * 0.5 + 0.5)*window.innerHeight;
    const x = sx + Math.cos(activePrompt.angle)*activePrompt.radius - dom.offsetWidth/2;
    const y = sy + Math.sin(activePrompt.angle)*activePrompt.radius - dom.offsetHeight/2;
    dom.style.left = Math.max(8, Math.min(window.innerWidth - dom.offsetWidth - 8, x)) + 'px';
    dom.style.top = Math.max(8, Math.min(window.innerHeight - dom.offsetHeight - 8, y)) + 'px';
    activePrompt.raf = requestAnimationFrame(loop);
  }
  loop(); setTimeout(()=> dom.querySelector('.artist').focus(), 120);
}

/* ---------- feedback flash ---------- */
function flashOrb(genreId){
  const o = ORB_MESHES[genreId]; if(!o) return;
  const mat = o.core.material; const orig = mat.emissiveIntensity || 0.6;
  mat.emissiveIntensity = Math.max(1.6, orig*2.4);
  setTimeout(()=> mat.emissiveIntensity = orig, 900);
}

/* ---------- top list compute ---------- */
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
  const sel = genreSelect.value || GENRES[0].id;
  const arr = perGenreCounts[sel] || []; let html='';
  for (let i=0;i<Math.min(50,arr.length);i++) html += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i].artist)}</strong><span class="score">${arr[i].count}</span></div>`;
  if(!html) html = '<div style="padding:8px;color:#bbb">No suggestions yet — be the first!</div>';
  topList.innerHTML = html;
}
function updateOrbHighlight(genreId, topCount){
  const o = ORB_MESHES[genreId]; if(!o) return;
  const val = Math.min(4, 0.6 + Math.log10(1 + topCount)*0.9);
  o.core.material.emissiveIntensity = val;
  const base = 1.0 + Math.min(0.6, Math.log10(1 + topCount)*0.12);
  o.core.scale.set(base, base, base);
}

/* ---------- WebAudio analyzer (reactive aurora + rings) ---------- */
const audioController = (function(){
  let audioCtx = null, source = null, analyser = null, dataArray = null, audioEl = null;
  let active = false;

  async function ensureAudio(){
    if (!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }
  }

  async function loadUrl(url){
    try {
      await ensureAudio();
      // create or reuse audio element
      if (!audioEl){
        audioEl = document.createElement('audio');
        audioEl.crossOrigin = "anonymous";
        audioEl.controls = true;
        audioEl.style.width = '100%';
        spotifyEmbed.innerHTML = ''; spotifyEmbed.appendChild(audioEl);
      } else {
        audioEl.pause(); audioEl.src = '';
      }
      audioEl.src = url;
      await audioEl.play().catch(()=>{}); // user gesture might be required
      // connect to audio context
      if (source) try{ source.disconnect(); } catch(e){}
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      active = true;
      return true;
    } catch(err){
      console.warn('audio load error', err);
      active = false;
      return false;
    }
  }

  function stop(){
    if (audioEl){ try{ audioEl.pause(); } catch(e){} }
    if (audioCtx && audioCtx.state !== 'closed'){ try{ audioCtx.suspend(); } catch(e){} }
    active = false;
  }

  function getAmplitudes(){
    if (!analyser || !dataArray) return null;
    analyser.getByteFrequencyData(dataArray);
    // compute low frequency energy (bass) and overall RMS
    const lowEnd = Math.floor(dataArray.length * 0.02); // lowest 2% bins ~ bass
    let bassSum = 0;
    for (let i=0;i<Math.max(1,lowEnd);i++) bassSum += dataArray[i];
    const bassAvg = bassSum / Math.max(1,lowEnd);
    let sum = 0;
    for (let i=0;i<dataArray.length;i++) sum += dataArray[i]*dataArray[i];
    const rms = Math.sqrt(sum / dataArray.length);
    return { bass: bassAvg/255, rms: rms/255, raw: dataArray };
  }

  return { loadUrl, stop, getAmplitudes, isActive: ()=> !!active };
})();

/* ---------- animation loop: orbs + rings + aurora + stars ---------- */
let start = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t = (performance.now() - start) * 0.001;

  // audio-driven amplitude
  const amp = audioController.getAmplitudes();
  const bass = amp ? amp.bass : 0;
  const rms = amp ? amp.rms : 0.08 + Math.sin(t*0.25)*0.03; // breathing default if no audio

  // aurora independent motion + reaction to music
  backSprite.rotation.z = Math.sin(t*0.03) * 0.04 + bass * 0.18;
  backSprite.material.opacity = 0.42 + Math.sin(t*0.08)*0.03 + bass*0.12;
  frontSprite.rotation.z = Math.cos(t*0.12) * 0.06 - bass * 0.08;
  frontSprite.material.opacity = 0.28 + Math.cos(t*0.1)*0.03 + rms*0.12;

  // corner blobs subtle float + tiny reaction
  cornerSprites.forEach((s,i)=>{
    s.position.x += Math.sin(t*0.05 + i)*0.01 + (i-1.5)*bass*3e-2;
    s.position.y += Math.cos(t*0.04 + i*1.2)*0.01 + (i-1.5)*rms*1.5e-2;
    s.material.opacity = 0.12 + 0.04 * Math.sin(t*0.7 + i) + bass*0.06;
  });

  // star twinkle + slight parallax
  starLayerFar.pts.rotation.z += 0.00035;
  starLayerNear.pts.rotation.z -= 0.00048;
  // twinkle: change near layer opacity slightly different per star cloud
  starLayerNear.mat.opacity = 0.55 + Math.sin(t*0.9)*0.08 + rms*0.12;
  starLayerFar.mat.opacity = 0.88 + Math.cos(t*0.4)*0.04 + bass*0.08;

  // dust plane slow rotation
  dustPlane.rotation.z += 0.00012;

  // subtle camera bob / parallax driven by rms/bass
  const camBaseZ = 520; // keep base zoom solid so orbs stay visible
  camera.position.z = camBaseZ + Math.sin(t*0.17)*6 + bass*65; // bass expands slightly outward
  camera.position.x = Math.sin(t*0.04)*12 * (0.8 + rms*0.8);
  camera.position.y = Math.cos(t*0.03)*6 * (0.8 + rms*0.6);
  camera.lookAt(0,0,0);

  // animate orbs cluster movement + local motion
  GENRES.forEach((g, idx)=>{
    const o = ORB_MESHES[g.id];
    if (!o) return;
    const speed = 0.12 + idx*0.02;
    const ampX = 420, ampY = 160;
    const nx = Math.cos(t*speed + idx) * ampX;
    const ny = Math.sin(t*speed*1.05 + idx*1.3) * ampY;
    // slightly push outward with bass so user sees breathing
    o.container.position.x = nx + bass*18;
    o.container.position.y = ny + rms*10;
    o.container.position.z = Math.sin(t*(0.6 + idx*0.04)) * 8;

    // core gentle spin
    o.core.rotation.y += 0.002 + idx*0.0002;
    o.core.rotation.x += 0.0012;

    // ring rotates opposite direction
    o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass*0.6);
    // ring opacity + size react to rms a bit
    o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms*0.25;
    // gas breathing
    o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.02;
    // rim sprite pulse
    o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.18 + rms*0.28; });
  });

  renderer.render(scene, camera);
}
animate();

/* ---------- resize ---------- */
window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
});

/* ---------- initial UI data ---------- */
computeAndRenderTop();
if (useFirebase && dbRef) dbRef.on('value', ()=> computeAndRenderTop());

/* quick sanity log */
setTimeout(()=> { if (!Object.keys(ORB_MESHES).length) console.error('Orbs not initialized — check Three.js load'); }, 800);

import * as THREE from "three";

/*
  Full, expanded App.js
  - 7 correct genres: Hard Techno, Techno, Drum & Bass, Dubstep, House, Electronic/Dance, Pop/International
  - Spotify embed per-genre (top-playlist links included as examples)
  - Local audio file / URL loader (WebAudio analyser) for waveform-driven visuals
  - Full Three.js scene: orbs, stardust rings, aurora sprites, horizontal ribbon, pillar ribbons
  - UI: Now Playing panel (spotify/embed or local audio), file/url loader, Genre panel showing 7 items
  - All logic explicitly written and commented for easy editing
  Full integrated src/App.js
  - EXACT seven genres (order & names you requested)
  - Real Spotify embed switching (click a genre -> loads embed playlist)
  - Fixed top-right UI cluster (Now Playing + Genres)
  - Three.js scene: orbs cluster, horizontal ribbon (gentle waving / waveform when local audio loaded),
    pillar ribbons that follow orbs, soft aurora sprites
  - Local audio upload/URL analysis for visuals (Spotify embed won't be analyzable)
  - Clean cleanup on unmount
*/

/* ------------------------- CONFIG / GENRES ------------------------- */
const GENRES = [
  { id: "hard-techno", name: "Hard Techno", color: 0xff2b6a, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWVY4eLfA3XFQ" },
  { id: "techno", name: "Techno", color: 0x8a5fff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675" },
  { id: "dnb", name: "Drum & Bass", color: 0x4cff7b, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX8ymr6UES7vc" },
  { id: "drum-and-bass", name: "Drum & Bass", color: 0x4cff7b, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY" },
  { id: "dubstep", name: "Dubstep", color: 0x5fc9ff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWYWddJiPzbvb" },
  { id: "house", name: "House", color: 0xff9b3f, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX2TRYkJECvfC" },
  { id: "electronic", name: "Electronic / Dance", color: 0x3f7bff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n" },
  { id: "house", name: "House", color: 0xff9b3f, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX2TRYkJECvfC" },
  { id: "pop", name: "Pop / International", color: 0xff89d9, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }
];

function toCssHex(n) { return "#" + ("000000" + (n.toString(16))).slice(-6); }
function toCssRgba(hex, a = 1) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
function toCssHex(n){
  return "#"+("000000"+(n.toString(16))).slice(-6);
}
function toCssRgba(hex, a=1){
  const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
  return `rgba(${r},${g},${b},${a})`;
}
function makeSpotifyEmbedUrl(spotifyUrl){
  // convert an open.spotify.com/playlist/{id} into /embed/playlist/{id}
  try {
    const u = new URL(spotifyUrl);
    if (u.hostname.includes("spotify")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }
  } catch(e){}
  // fallback: return raw input (may work if already embed)
  return spotifyUrl;
}

/* ------------------------- React component ------------------------- */
export default function App() {
  // DOM refs
export default function App(){
  const mountRef = useRef(null);
  const spotifyRef = useRef(null);
  const audioElementRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  // state
  const [selectedGenre, setSelectedGenre] = useState(GENRES[1].id); // default to 'techno'
  const [mounted, setMounted] = useState(false);

  // Three.js & audio refs
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const orbsRef = useRef({});
  const pillarsRef = useRef([]);
  const ribbonRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animRequestRef = useRef(null);
  const animIdRef = useRef(null);

  const [selectedGenre, setSelectedGenre] = useState(GENRES[1].id); // default 'techno'
  const [mounted, setMounted] = useState(false);

  /* ------------------------- Lifecycle: init Three + visuals ------------------------- */
  // Initialize Three.js scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* ---------- Scene / Camera / Renderer ---------- */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x00000c, 0.00009);
    sceneRef.current = scene;

    const CAMERA_Z = 850;
    const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 10000);
    const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 10000);
    camera.position.set(0, 18, CAMERA_Z);
    camera.lookAt(0, 0, 0);
    camera.lookAt(0,0,0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000010, 0);
@@ -79,35 +90,34 @@ export default function App() {

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10, 20, 10); scene.add(dir);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10,20,10); scene.add(dir);

    /* ---------- Utilities: tiny procedural textures ---------- */
    function generateGlowTexture(colorHex) {
    // helper textures
    function generateGlowTexture(colorHex){
      const size = 256;
      const c = document.createElement("canvas"); c.width = c.height = size;
      const ctx = c.getContext("2d");
      const grad = ctx.createRadialGradient(size/2, size/2, 4, size/2, size/2, size/2);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.18, "rgba(255,255,255,0.9)");
      const c = document.createElement('canvas'); c.width=c.height=size;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(size/2,size/2,4,size/2,size/2,size/2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.42, toCssRgba(colorHex, 0.35));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      return tex;
    }
    function generateStarTexture() {
      const s = 64; const c = document.createElement("canvas"); c.width = c.height = s; const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.95)");
      g.addColorStop(0.6, "rgba(255,255,255,0.2)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
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

    /* ---------- Starfields + dust plane ---------- */
    // star layers
    function makeStarLayer(count, spreadX=5000, spreadY=3000, spreadZ=5000, size=1.2, opacity=0.9){
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
@@ -116,27 +126,25 @@ export default function App() {
        pos[i*3] = (Math.random()-0.5) * spreadX;
        pos[i*3+1] = (Math.random()-0.5) * spreadY;
        pos[i*3+2] = -Math.random()*spreadZ - 200;
        phases[i] = Math.random() * Math.PI * 2;
        phases[i] = Math.random()*Math.PI*2;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
      const mat = new THREE.PointsMaterial({ color: 0xffffff, size, transparent:true, opacity, depthWrite:false });
      const pts = new THREE.Points(geo, mat);
      return { points: pts, geo, mat };
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
      const mat = new THREE.PointsMaterial({ color:0xffffff, size, transparent:true, opacity, depthWrite:false });
      const points = new THREE.Points(geo, mat);
      return { points, geo, mat };
    }
    const starsFar = makeStarLayer(1200, 6000, 3600, 6000, 1.1, 0.9);
    const starsNear = makeStarLayer(600, 3500, 2200, 3500, 1.9, 0.6);
    const starsFar = makeStarLayer(1400, 6000, 3600, 6000, 1.1, 0.9);
    const starsNear = makeStarLayer(650, 3500, 2200, 3500, 1.9, 0.6);
    scene.add(starsFar.points, starsNear.points);

    const textureLoader = new THREE.TextureLoader();
    const dustTex = textureLoader.load("https://assets.codepen.io/982762/clouds.png");
    const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000,3800),
      new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false })
    );
    dustPlane.position.set(0,0,-2600);
    scene.add(dustPlane);
    // dust plane
    const loader = new THREE.TextureLoader();
    const dustTex = loader.load("https://assets.codepen.io/982762/clouds.png");
    const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800), new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false }));
    dustPlane.position.set(0,0,-2600); scene.add(dustPlane);

    /* ---------- Orbs & stardust rings ---------- */
    // ORBs (planets/bubbles)
    const CLUSTER_RADIUS = 420;
    const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
    orbsRef.current = {};
@@ -147,43 +155,44 @@ export default function App() {
      const positions = new Float32Array(particleCount*3);
      const sizes = new Float32Array(particleCount);
      for (let i=0;i<particleCount;i++){
        const theta = (i/particleCount) * Math.PI * 2;
        const theta = (i/particleCount) * Math.PI*2;
        const rr = ringRadius + (Math.random()-0.5) * (coreRadius*0.36);
        positions[i*3] = Math.cos(theta) * rr;
        positions[i*3+1] = Math.sin(theta) * rr;
        positions[i*3] = Math.cos(theta)*rr;
        positions[i*3+1] = Math.sin(theta)*rr;
        positions[i*3+2] = (Math.random()-0.5) * (coreRadius*0.5);
        sizes[i] = (Math.random()*1.6 + 1.2) * size;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("pSize", new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
      geo.setAttribute('pSize', new THREE.BufferAttribute(sizes,1));
      const mat = new THREE.PointsMaterial({ size, map: generateStarTexture(), transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending });
      mat.color = new THREE.Color(colorHex).multiplyScalar(0.94);
      const pts = new THREE.Points(geo, mat);
      group.add(pts);
      const points = new THREE.Points(geo, mat);
      group.add(points);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: generateGlowTexture(colorHex), transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false }));
      glow.scale.set(ringRadius*2.0, ringRadius*2.0, 1);
      group.add(glow);
      group.rotation.set(tilt.x||0, tilt.y||0, tilt.z||0);
      const baseSpeed = 0.004 + Math.random()*0.006;
      const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
      return { group, points: pts, mat, rotationSpeed, ringRadius };
      return { group, points, mat, rotationSpeed, ringRadius };
    }

    // create orbs and store them
    GENRES.forEach((g, idx) => {
      const color = new THREE.Color(g.color);
      const coreRadius = 40 + Math.random() * 10;
      const coreRadius = 40 + Math.random()*10;
      const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
      const coreMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.30,
        roughness: 0.16,
        metalness: 0.08,
        transmission: 0.7,
        transparent:true,
        opacity:0.30,
        roughness:0.16,
        metalness:0.08,
        transmission:0.7,
        emissive: color.clone().multiplyScalar(0.035),
        emissiveIntensity: 0.6,
        clearcoat: 0.2
        emissiveIntensity:0.6,
        clearcoat:0.2
      });
      coreMat.depthWrite = false;
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
@@ -193,11 +202,10 @@ export default function App() {

      const container = new THREE.Group();
      container.add(coreMesh);

      const baseAngle = (idx / GENRES.length) * Math.PI * 2;
      const baseAngle = (idx / GENRES.length) * Math.PI*2;
      container.userData.baseAngle = baseAngle;
      container.userData.idx = idx;
      container.position.set(Math.cos(baseAngle) * CLUSTER_RADIUS, Math.sin(baseAngle) * CLUSTER_RADIUS * 0.6, -idx * 6);
      container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.6, -idx*6);

      const tilt = { x:(Math.random()*0.9 - 0.45)*Math.PI/2, y:(Math.random()*0.9 - 0.45)*Math.PI/2, z:(Math.random()*0.6 - 0.3)*Math.PI/6 };
      const ringObj = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random()*160), 9.5, (idx % 2 === 0));
@@ -212,14 +220,14 @@ export default function App() {
      orbsRef.current[g.id] = { id: g.id, idx, container, core: coreMesh, ringObj, gas: gasMesh, baseAngle };
    });

    /* ---------- Aurora / haze sprites ---------- */
    // aurora / haze sprites (soft circular shapes)
    function createAuroraSprite(colorStops, size=1600, opacity=0.3){
      const c = document.createElement("canvas"); c.width = c.height = size; const ctx = c.getContext("2d");
      const c = document.createElement('canvas'); c.width=c.height=size; const ctx = c.getContext('2d');
      const cx = size * (0.45 + (Math.random()-0.5)*0.08);
      const cy = size * (0.45 + (Math.random()-0.5)*0.08);
      const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, size*0.95);
      colorStops.forEach(s => grad.addColorStop(s.offset, s.color));
      ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
      const grad = ctx.createRadialGradient(cx,cy,20,cx,cy,size*0.95);
      colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
      ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
      return spr;
@@ -233,15 +241,31 @@ export default function App() {
    const smokeFront2 = createAuroraSprite([{offset:0,color:'rgba(0,0,0,0)'},{offset:0.18,color:'rgba(240,120,100,0.06)'},{offset:0.7,color:'rgba(90,80,255,0.05)'},{offset:1,color:'rgba(0,0,0,0)'}], 1200, 0.24);
    smokeFront2.scale.set(1800,900,1); smokeFront2.position.set(-80,40,-260); scene.add(smokeFront2);

    /* ---------- Horizontal ribbon (512 points) ---------- */
    // corner soft sprites
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

    // Horizontal ribbon (512 points)
    const POINTS = 512;
    const ribbonGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(POINTS * 3);
    const colors = new Float32Array(POINTS * 3);
    function worldWidthAtZ(z){
    function worldWidthAtZ(z) {
      const vFOV = camera.fov * Math.PI / 180;
      const height = 2 * Math.tan(vFOV / 2) * Math.abs(camera.position.z - z);
      return height * camera.aspect;
      const width = height * camera.aspect;
      return width;
    }
    const width = worldWidthAtZ(0) * 1.05;
    for (let i=0;i<POINTS;i++){
@@ -251,85 +275,83 @@ export default function App() {
      positions[i*3+2] = -120;
      colors[i*3] = 0.8; colors[i*3+1] = 0.7; colors[i*3+2] = 1.0;
    }
    ribbonGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    ribbonGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    ribbonGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ribbonMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending });
    const ribbonLine = new THREE.Line(ribbonGeo, ribbonMat);
    ribbonLine.frustumCulled = false;
    scene.add(ribbonLine);

    // sprite glow behind ribbon
    const canvasGlow = document.createElement("canvas"); canvasGlow.width = 2048; canvasGlow.height = 256;
    const ctx = canvasGlow.getContext("2d");
    const lg = ctx.createLinearGradient(0,0,canvasGlow.width,0);
    lg.addColorStop(0, 'rgba(255,255,255,0.00)');
    lg.addColorStop(0.18, 'rgba(255,255,255,0.06)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    lg.addColorStop(0.82, 'rgba(255,255,255,0.06)');
    lg.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = lg; ctx.fillRect(0,0,canvasGlow.width, canvasGlow.height);
    // ribbon sprite
    const c = document.createElement('canvas'); c.width=2048; c.height=256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0,0,c.width,0);
    g.addColorStop(0, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = g; ctx.fillRect(0,0,c.width,c.height);
    ctx.globalCompositeOperation = 'lighter';
    const vgrad = ctx.createLinearGradient(0,0,canvasGlow.width, canvasGlow.height);
    const vgrad = ctx.createLinearGradient(0,0,c.width,c.height);
    vgrad.addColorStop(0, 'rgba(255,255,255,0.00)');
    vgrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    vgrad.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = vgrad; ctx.fillRect(0,0,canvasGlow.width, canvasGlow.height);
    ctx.fillStyle = vgrad; ctx.fillRect(0,0,c.width,c.height);
    ctx.globalCompositeOperation = 'source-over';
    const glowTex = new THREE.CanvasTexture(canvasGlow);
    const glowTex = new THREE.CanvasTexture(c);
    const spriteMat = new THREE.SpriteMaterial({ map: glowTex, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(width * 1.05, Math.max(40, width * 0.035), 1);
    sprite.position.set(0, -8, -140);
    scene.add(sprite);

    ribbonRef.current = { line: ribbonLine, sprite, geo: ribbonGeo, points: POINTS, _prevY: new Float32Array(POINTS) };
    // initialize _prevY to current Y positions
    for (let i=0;i<POINTS;i++) ribbonRef.current._prevY[i] = positions[i*3+1];
    ribbonRef.current = { line: ribbonLine, sprite, geo: ribbonGeo, points: POINTS, _prevY: new Float32Array(Array.from({length:POINTS}, (_,i)=>positions[i*3+1])) };

    /* ---------- Pillar ribbons (one per genre) ---------- */
    // Pillar ribbons
    const PILLAR_RIBBONS = [];
    function makePillarTexture(colorHex, h=1024, w=192){
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const cx = c.getContext("2d");
      const grad = cx.createLinearGradient(0,0,0,h);
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      const ctx2 = c.getContext('2d');
      const grad2 = ctx2.createLinearGradient(0,0,0,h);
      const rgba = a => toCssRgba(colorHex, a);
      grad.addColorStop(0.00, rgba(0.0));
      grad.addColorStop(0.08, rgba(0.06));
      grad.addColorStop(0.25, rgba(0.12));
      grad.addColorStop(0.45, rgba(0.18));
      grad.addColorStop(0.65, rgba(0.12));
      grad.addColorStop(0.92, rgba(0.06));
      grad.addColorStop(1.00, rgba(0.0));
      cx.fillStyle = grad; cx.fillRect(0,0,w,h);
      cx.globalCompositeOperation = 'lighter';
      const hg = cx.createLinearGradient(0,0,w,0);
      grad2.addColorStop(0.00, rgba(0.0));
      grad2.addColorStop(0.08, rgba(0.06));
      grad2.addColorStop(0.25, rgba(0.12));
      grad2.addColorStop(0.45, rgba(0.18));
      grad2.addColorStop(0.65, rgba(0.12));
      grad2.addColorStop(0.92, rgba(0.06));
      grad2.addColorStop(1.00, rgba(0.0));
      ctx2.fillStyle = grad2; ctx2.fillRect(0,0,w,h);
      ctx2.globalCompositeOperation = 'lighter';
      const hg = ctx2.createLinearGradient(0,0,w,0);
      hg.addColorStop(0, 'rgba(255,255,255,0.00)');
      hg.addColorStop(0.45, 'rgba(255,255,255,0.04)');
      hg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      hg.addColorStop(0.55, 'rgba(255,255,255,0.04)');
      hg.addColorStop(1, 'rgba(255,255,255,0.00)');
      cx.fillStyle = hg; cx.fillRect(0,0,w,h);
      cx.globalCompositeOperation = 'source-over';
      ctx2.fillStyle = hg; ctx2.fillRect(0,0,w,h);
      ctx2.globalCompositeOperation = 'source-over';
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      return tex;
    }
    const pillarHeight = 1200; const pillarWidth = 160; const hSegs = 48; const wSegs = 10;
    GENRES.forEach((g, idx) => {
      const geo = new THREE.PlaneGeometry(pillarWidth, pillarHeight, wSegs, hSegs);
      const tex = makePillarTexture(g.color, 1024, 192);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true, opacity:0.20, depthWrite:false, blending:THREE.AdditiveBlending, side: THREE.DoubleSide });
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true, opacity:0.20, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.rotation.x = -Math.PI/2 + 0.02;
      mesh.rotation.y = 0.06 * (idx % 2 === 0 ? 1 : -1);
      mesh.position.set(0, -80, -180 - idx*6);
      mesh.userData = { idx, baseX: 0, baseZ: mesh.position.z, width: pillarWidth, height: pillarHeight, wSegs, hSegs, color: g.color };
      scene.add(mesh);
      PILLAR_RIBBONS.push({ mesh, geo, mat, idx, baseX: 0 });
      PILLAR_RIBBONS.push({ mesh, geo, mat, idx, baseX:0 });
    });
    pillarsRef.current = PILLAR_RIBBONS;

    /* ---------- Raycast / interaction for orbs ---------- */
    // Raycast for clicks on orbs
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2();
    function onPointerDown(e){
@@ -346,90 +368,102 @@ export default function App() {
        for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
        if (parent){
          const found = Object.values(orbsRef.current).find(o => o.container === parent);
          if (found) handleGenreSelect(found.id);
          if (found) {
            handleGenreSelect(found.id);
          }
        }
      }
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    /* ---------- Animation loop ---------- */
    // Animation
    let start = performance.now();
    function getAmps(){
      if (!analyserRef.current) return null;
      const freqData = new Uint8Array(analyserRef.current.frequencyBinCount || 1024);
      analyserRef.current.getByteFrequencyData(freqData);
      const lowCount = Math.max(1, Math.floor(freqData.length * 0.02));
      let bass = 0; for (let i=0;i<lowCount;i++) bass += freqData[i];
      bass = bass / lowCount / 255;
      let sum = 0; for (let i=0;i<freqData.length;i++) sum += freqData[i]*freqData[i];
      const rms = Math.sqrt(sum / freqData.length) / 255;
      return { bass, rms, rawFreq: freqData };
    }

    function animate(){
      animRequestRef.current = requestAnimationFrame(animate);
      animIdRef.current = requestAnimationFrame(animate);
      const t = (performance.now() - start) * 0.001;

      // audio-derived amplitudes if analyser present
      const amps = analyserRef.current ? getAmps() : null;
      const bass = amps ? amps.bass : 0;
      const rms = amps ? amps.rms : 0.06 + Math.sin(t * 0.25) * 0.02;
      const rms = amps ? amps.rms : 0.06 + Math.sin(t*0.25)*0.02;

      // stars
      // stars twinkle
      starsFar.points.rotation.z += 0.00035;
      starsNear.points.rotation.z -= 0.00048;
      starsNear.mat.opacity = 0.55 + Math.sin(t*0.9 + 3.1) * 0.08 + rms * 0.12;
      starsFar.mat.opacity = 0.88 + Math.cos(t*0.4 + 1.7) * 0.04 + bass * 0.06;

      dustPlane.rotation.z += 0.00012;

      // smoke pulse
      const smokePulse = 0.6 + Math.sin(t*0.9) * 0.12 + bass * 0.9;
      smokeBack1.material.opacity = 0.28 * smokePulse;
      smokeBack2.material.opacity = 0.22 * (0.9 + Math.cos(t*0.7) * 0.06 + bass * 0.4);
      smokeFront1.material.opacity = 0.24 * (0.9 + Math.sin(t*0.5) * 0.06 + rms * 0.9);
      smokeFront2.material.opacity = 0.20 * (1 + Math.cos(t*0.63) * 0.05 + bass * 0.6);
      smokeBack2.material.opacity = 0.22 * (0.9 + Math.cos(t*0.7)*0.06 + bass*0.4);
      smokeFront1.material.opacity = 0.24 * (0.9 + Math.sin(t*0.5)*0.06 + rms*0.9);
      smokeFront2.material.opacity = 0.20 * (1 + Math.cos(t*0.63)*0.05 + bass*0.6);

      // camera subtle motion
      // camera subtle move
      camera.position.z = 850 + Math.sin(t*0.08) * 6 + bass * 80;
      camera.position.x = Math.sin(t*0.04) * 12 * (0.7 + rms * 0.8);
      camera.position.y = Math.cos(t*0.03) * 6 * (0.7 + rms * 0.6);
      camera.lookAt(0,0,0);

      // cluster/orbits (diagonal ellipse)
      // cluster / orbits diagonal ellipse
      const clusterSpeed = 0.12 + bass * 0.38;
      const tiltAngle = -Math.PI / 4;
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);
      let centerOffsetX = 0, centerOffsetY = 0; // could push if you add left panels

      GENRES.forEach((g, idx) => {
        const o = orbsRef.current[g.id];
        if (!o) return;
        const phaseOffset = o.baseAngle;
        const angle = t * clusterSpeed + phaseOffset * (0.6 + idx * 0.08);
        const ex = CLUSTER_RADIUS * (0.86 + Math.sin(idx + t*0.12) * 0.02);
        const ey = CLUSTER_RADIUS * 0.48 * (0.9 + Math.cos(idx*0.7 + t*0.11) * 0.02);
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
        o.container.position.y = ry + centerOffsetY + jitterY + Math.cos(idx*0.5 + t*0.2) * 4;
        o.container.position.z = Math.sin(t*(0.45 + idx*0.02)) * 8 - idx*3;
        o.container.position.x = rx + jitterX + (idx - (GENRES.length-1)/2) * Math.sin(t*0.02) * 0.7;
        o.container.position.y = ry + jitterY + Math.cos(idx*0.5 + t*0.2)*4;
        o.container.position.z = Math.sin(t*(0.45 + idx*0.02))*8 - idx*3;

        o.core.rotation.y += 0.002 + idx*0.0003;
        o.core.rotation.x += 0.0011;

        o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass * 0.8);
        o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx)) * 0.18 + rms * 0.22;
        o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx) + bass * 0.018;
        o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms * 0.22;

        // sync pillar
        const pillar = PILLAR_RIBBONS[idx];
        if (pillar){
        o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.018;

        // sync pillar to orb
        const pillar = pillarsRef.current[idx];
        if (pillar) {
          pillar.mesh.userData.baseX = o.container.position.x;
          pillar.mesh.position.z = o.container.position.z - 50 - idx*2;
        }
      });

      // horizontal ribbon: time-domain (if analyser) else idle gentle waving
      // ribbon update (time-domain if local audio loaded, else idle gentle waving)
      try {
        const posAttr = ribbonRef.current.geo.attributes.position;
        const posArr = posAttr.array;
        const pts = ribbonRef.current.points;
        const prev = ribbonRef.current._prevY;
        const alpha = 0.18;
        // time domain from analyser if available
        let timeData = null;
        if (analyserRef.current) {
          const td = new Uint8Array(analyserRef.current.fftSize || 2048);
@@ -443,37 +477,34 @@ export default function App() {
            const i0 = Math.floor(f), i1 = Math.min(tdLen-1, i0+1);
            const frac = f - i0;
            const td0 = timeData[i0], td1 = timeData[i1];
            const td = td0 * (1-frac) + td1 * frac;
            const td = td0 * (1 - frac) + td1 * frac;
            const v = (td / 128.0) - 1.0;
            const amplitude = 120 + (selectedGenre ? 80 : 0);
            const baseOsc = Math.sin(i * 0.09 + t * 0.7) * 0.14;
            const baseOsc = Math.sin(i*0.09 + t*0.7) * 0.14;
            const targetY = v * amplitude * (0.7 + baseOsc);
            const idx3 = i * 3;
            const idx3 = i*3;
            prev[i] = prev[i] * (1 - alpha) + targetY * alpha;
            posArr[idx3 + 1] = prev[i] - 10;
            posArr[idx3 + 2] = -120 + Math.sin(t*0.28 + i*0.04) * 5;
            posArr[idx3+1] = prev[i] - 10;
            posArr[idx3+2] = -120 + Math.sin(t*0.28 + i*0.04) * 5;
          }
          posAttr.needsUpdate = true;
          sprite.material.opacity = Math.min(0.95, 0.22 + (analyserRef.current ? (getAmps().rms * 1.4) : 0.36));
          ribbonRef.current.sprite.material.opacity = Math.min(0.95, 0.22 + (analyserRef.current ? (getAmps().rms * 1.4) : 0.36));
        } else {
          // idle gentle waving
          for (let i=0;i<pts;i++){
            const idx3 = i*3;
            const targetY = (Math.sin(i*0.08 + t*0.9) * 12 + Math.sin(i*0.06 + t*0.3)*6 - 8);
            prev[i] = prev[i] * (1 - alpha) + targetY * alpha;
            posArr[idx3 + 1] = prev[i];
            posArr[idx3 + 2] = -120 + Math.sin(t*0.12 + i*0.03)*4;
            posArr[idx3+1] = prev[i];
            posArr[idx3+2] = -120 + Math.sin(t*0.12 + i*0.03)*4;
          }
          posAttr.needsUpdate = true;
          sprite.material.opacity = 0.45;
          ribbonRef.current.sprite.material.opacity = 0.45;
        }
      } catch (err) {
        // ignore safely
      }
      } catch(e){ /* safe */ }

      // pillar weave (gentle waving)
      try {
        PILLAR_RIBBONS.forEach((p, pIdx) => {
        pillarsRef.current.forEach((p, pIdx) => {
          const mesh = p.mesh;
          const posAttr = mesh.geometry.attributes.position;
          const arr = posAttr.array;
@@ -491,192 +522,154 @@ export default function App() {
            for (let ix = 0; ix <= wSegs; ix++){
              const idx = vi * 3;
              const xBaseLocal = (-mesh.userData.width/2) + (ix / wSegs) * mesh.userData.width;
              const disp = Math.sin((vNorm * Math.PI * 4.0) + (t * freq) + phase + ix * 0.18) * (globalAmp * (0.14 + (ix / wSegs) * 0.5));
              const disp = Math.sin((vNorm * Math.PI * 4.0) + (t * freq) + phase + ix*0.18) * (globalAmp * (0.14 + (ix/wSegs)*0.5));
              arr[idx] = baseX + xBaseLocal + disp * 0.012;
              arr[idx+1] = yFactor - 80;
              arr[idx+2] = baseZ + Math.sin(t*0.6 + ix*0.07 + iy*0.03) * 6;
              vi++;
            }
          }
          posAttr.needsUpdate = true;
          if (mesh.material) mesh.material.opacity = 0.14 + Math.min(0.4, rms * 0.6) + (pIdx === GENRES.findIndex(g => g.id === selectedGenre) ? 0.06 : 0);
          if (mesh.material) mesh.material.opacity = 0.14 + Math.min(0.4, (analyserRef.current ? getAmps().rms : 0.06) * 0.6) + (pIdx === GENRES.findIndex(g=>g.id===selectedGenre) ? 0.06 : 0);
          mesh.rotation.z = Math.sin(t*0.23 + pIdx*0.5) * 0.015;
        });
      } catch (e) { /* safe */ }
      } catch(e){ /* safe */ }

      renderer.render(scene, camera);
    }
    animate();

    // helper for amplitude extraction
    function getAmps(){
      if (!analyserRef.current) return null;
      const freqData = new Uint8Array(analyserRef.current.frequencyBinCount || 1024);
      analyserRef.current.getByteFrequencyData(freqData);
      const lowCount = Math.max(1, Math.floor(freqData.length * 0.02));
      let bass = 0; for (let i=0;i<lowCount;i++) bass += freqData[i];
      bass = bass / lowCount / 255;
      let sum = 0; for (let i=0;i<freqData.length;i++) sum += freqData[i]*freqData[i];
      const rms = Math.sqrt(sum / freqData.length) / 255;
      return { bass, rms, rawFreq: freqData };
    }

    /* ---------- Resize handler ---------- */
    // On resize
    function onResize(){
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w,h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      try {
        const newWidth = (2 * Math.tan(camera.fov * Math.PI/180 / 2) * Math.abs(camera.position.z)) * camera.aspect * 1.05;
        sprite.scale.set(newWidth * 1.05, Math.max(40, newWidth * 0.035), 1);
        const newWidth = worldWidthAtZ(0) * 1.05;
        ribbonRef.current.sprite.scale.set(newWidth*1.05, Math.max(40, newWidth*0.035), 1);
        const posArr = ribbonRef.current.geo.attributes.position.array;
        for (let i=0;i<ribbonRef.current.points;i++){
          const x = -newWidth/2 + (i/(ribbonRef.current.points-1)) * newWidth;
          posArr[i*3] = x;
        }
        ribbonRef.current.geo.attributes.position.needsUpdate = true;
      } catch(e){ /* safe */ }
      } catch(e){}
    }
    window.addEventListener("resize", onResize);

    // mark as mounted for the UI effect to trigger selection load
    // state mounted
    setMounted(true);

    /* ---------- Cleanup on unmount ---------- */
    // cleanup
    return () => {
      cancelAnimationFrame(animRequestRef.current);
      try { renderer.domElement.removeEventListener("pointerdown", onPointerDown); } catch(e){}
      cancelAnimationFrame(animIdRef.current);
      try { renderer.domElement.removeEventListener('pointerdown', onPointerDown); } catch(e){}
      window.removeEventListener("resize", onResize);
      try { renderer.dispose(); } catch(e){}
      try { mount.removeChild(renderer.domElement); } catch(e){}
      // stop audio / close context
      try {
        if (audioElRef.current) {
          audioElRef.current.pause(); audioElRef.current.src = ""; audioElRef.current = null;
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current.src = "";
          audioElementRef.current = null;
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close(); audioCtxRef.current = null; analyserRef.current = null;
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
      } catch(e){}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once
  }, []);

  // helper getAmps exposed inside effect usage
  function getAmps(){
    if (!analyserRef.current) return { bass: 0, rms: 0.06 };
    const freqData = new Uint8Array(analyserRef.current.frequencyBinCount || 1024);
    analyserRef.current.getByteFrequencyData(freqData);
    const lowCount = Math.max(1, Math.floor(freqData.length * 0.02));
    let bass = 0; for (let i=0;i<lowCount;i++) bass += freqData[i];
    bass = bass / lowCount / 255;
    let sum = 0; for (let i=0;i<freqData.length;i++) sum += freqData[i]*freqData[i];
    const rms = Math.sqrt(sum / freqData.length) / 255;
    return { bass, rms, rawFreq: freqData };
  }

  /* ------------------------- handle selection, spotify embed, visuals colorizing ------------------------- */
  async function handleGenreSelect(genreId) {
  // handle genre selection: embed spotify & colorize visuals
  async function handleGenreSelect(genreId){
    setSelectedGenre(genreId);
    const g = GENRES.find(x => x.id === genreId);
    const g = GENRES.find(x=>x.id===genreId);
    if (!g) return;

    // embed spotify (preferred) into spotifyRef panel
    // insert embed into spotifyRef
    if (spotifyRef.current){
      spotifyRef.current.innerHTML = "";
      try {
        const u = new URL(g.spotify);
        if (u.hostname.includes("spotify")){
          const parts = u.pathname.split("/").filter(Boolean);
          // pattern /playlist/{id} or /track/{id}
          if (parts.length >= 2){
            const embedPath = `/embed/${parts[0]}/${parts[1]}`;
            const iframe = document.createElement("iframe");
            iframe.src = `https://open.spotify.com${embedPath}`;
            iframe.width = "300";
            iframe.height = "80";
            iframe.frameBorder = "0";
            iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
            iframe.style.borderRadius = "10px";
            iframe.style.width = "100%";
            iframe.loading = "lazy";
            spotifyRef.current.appendChild(iframe);
          } else {
            // fallback raw url
            const iframe = document.createElement("iframe");
            iframe.src = g.spotify;
            iframe.width = "300";
            iframe.height = "80";
            iframe.frameBorder = "0";
            iframe.style.borderRadius = "10px";
            iframe.style.width = "100%";
            spotifyRef.current.appendChild(iframe);
          }
        } else {
          const iframe = document.createElement("iframe");
          iframe.src = g.spotify;
          iframe.width = "300";
          iframe.height = "80";
          iframe.frameBorder = "0";
          iframe.style.borderRadius = "10px";
          iframe.style.width = "100%";
          spotifyRef.current.appendChild(iframe);
        }
      } catch(e){
        // if parsing fails, use raw string
        const iframe = document.createElement("iframe");
        iframe.src = g.spotify;
        iframe.width = "300";
        iframe.height = "80";
        iframe.frameBorder = "0";
        iframe.style.borderRadius = "10px";
        iframe.style.width = "100%";
        spotifyRef.current.appendChild(iframe);
      }
      const embed = makeSpotifyEmbedUrl(g.spotify);
      const iframe = document.createElement("iframe");
      iframe.src = embed;
      iframe.width = "300";
      iframe.height = "80";
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      iframe.style.borderRadius = "10px";
      iframe.style.width = "100%";
      iframe.loading = "lazy";
      spotifyRef.current.appendChild(iframe);
    }

    // colorize ribbon / sprite and emphasize pillars/orbs
    // colorize ribbon & emphasize pillar/orb
    try {
      const rgbTr = ((g.color >> 16) & 255) / 255, rgbTg = ((g.color >> 8) & 255) / 255, rgbTb = (g.color & 255) / 255;
      const tr = ((g.color>>16)&255)/255, tg = ((g.color>>8)&255)/255, tb = (g.color&255)/255;
      if (ribbonRef.current && ribbonRef.current.geo && ribbonRef.current.geo.attributes.color){
        const colors = ribbonRef.current.geo.attributes.color.array;
        for (let i=0;i<ribbonRef.current.points;i++){
          const idx = i*3;
          colors[idx] = 0.14 + rgbTr * 0.86;
          colors[idx+1] = 0.14 + rgbTg * 0.86;
          colors[idx+2] = 0.14 + rgbTb * 0.86;
          colors[idx] = 0.14 + tr * 0.86;
          colors[idx+1] = 0.14 + tg * 0.86;
          colors[idx+2] = 0.14 + tb * 0.86;
        }
        ribbonRef.current.geo.attributes.color.needsUpdate = true;
      }
      if (ribbonRef.current && ribbonRef.current.sprite && ribbonRef.current.sprite.material){
        ribbonRef.current.sprite.material.color = new THREE.Color(g.color);
        ribbonRef.current.sprite.material.opacity = 0.62;
      }
      // pillars
      pillarsRef.current.forEach((p, i) => {
      pillarsRef.current.forEach((p, i)=>{
        p.mesh.material.opacity = (GENRES[i].id === genreId) ? 0.34 : 0.16;
      });
      // orbs
      Object.values(orbsRef.current).forEach(o => {
        if (o.id === genreId) {
      Object.values(orbsRef.current).forEach(o=>{
        if (o.id === genreId){
          o.core.material.emissiveIntensity = 1.6;
          o.core.scale.set(1.12, 1.12, 1.12);
        } else {
          o.core.material.emissiveIntensity = 0.6;
          o.core.scale.set(1,1,1);
        }
      });
    } catch(e){}
    // stop any local audio analysis since Spotify embed can't be analyzed
    } catch(e){ /* safe */ }

    // stop local audio analysis (Spotify embeds can't be analyzed)
    try {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.src = "";
        audioElRef.current = null;
      if (audioElementRef.current){
        audioElementRef.current.pause();
        audioElementRef.current.src = "";
        audioElementRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed"){
        audioCtxRef.current.close();
        audioCtxRef.current = null;
        analyserRef.current = null;
      }
    } catch(e){}
  }

  /* ------------------------- Load local audio for analysis ------------------------- */
  async function loadLocalAudioFile(fileOrUrl) {
    // stop previous
  // load local audio file or URL and set up analyser for waveform-driven visuals
  async function loadLocalAudio(fileOrUrl){
    // stop existing
    try {
      if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.src = ""; audioElRef.current = null; }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") { audioCtxRef.current.close(); audioCtxRef.current = null; analyserRef.current = null; }
    } catch(e){}

      if (audioElementRef.current){ audioElementRef.current.pause(); audioElementRef.current.src=""; audioElementRef.current=null; }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed"){ await audioCtxRef.current.close(); audioCtxRef.current=null; analyserRef.current=null; }
    } catch(e){/*safe*/}
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
@@ -691,93 +684,87 @@ export default function App() {
      audioEl.style.width = "100%";
      audioEl.src = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
      audioEl.loop = true;
      // user gesture may be required to begin playback
      await audioEl.play().catch(() => {});
      await audioEl.play().catch(()=>{ /* may require gesture */ });
      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      audioElementRef.current = audioEl;

      audioElRef.current = audioEl;
      // show audio element in spotify panel for feedback
      // place into spotifyRef to show the player
      if (spotifyRef.current){
        spotifyRef.current.innerHTML = "";
        spotifyRef.current.appendChild(audioEl);
      }
    } catch (err) {
      console.warn("Failed to setup local audio analyser", err);
    } catch(err){
      console.warn("audio load failed", err);
    }
  }

  /* ------------------------- UI: file/url handlers ------------------------- */
  // UI callbacks
  function onGenreClick(id){ handleGenreSelect(id); }
  function onFileChange(e){
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    loadLocalAudioFile(f);
    const f = e.target.files && e.target.files[0]; if (!f) return;
    loadLocalAudio(f);
  }
  function onUrlKeyDown(e){
    if (e.key === "Enter"){
      const v = e.target.value && e.target.value.trim();
      if (!v) return;
      loadLocalAudioFile(v);
      loadLocalAudio(v);
      e.target.value = "";
    }
  }

  /* ------------------------- ensure default genre loads after mount ------------------------- */
  // ensure default selection after mount
  useEffect(() => {
    if (mounted) handleGenreSelect(selectedGenre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* ------------------------- Render UI ------------------------- */
  // render UI + canvas mountpoint
  return (
    <>
      {/* Three.js canvas mount */}
      <div ref={mountRef} id="three-bg" style={{ position: "fixed", inset: 0, zIndex: 0 }} />

      {/* decorative CSS ribbon (keeps visual parity with original CSS) */}
      <div id="ribbon" className="idle" style={{ position: "fixed", top: "50%", left: 0, width: "100%", height: 3, transform: "translateY(-50%)", zIndex: 2, pointerEvents: "none" }} />
      {/* CSS ribbon element (keeps the aesthetic, but Three ribbon is synced visually) */}
      <div id="ribbon" className="idle" style={{ position: "fixed", left:0, right:0, top:"50%", transform:"translateY(-50%)", zIndex:2, pointerEvents:"none" }} />

      {/* UI cluster (top-right) */}
      <div id="uiCluster" style={{ position: "fixed", top: 20, right: 30, display: "flex", flexDirection: "column", gap: 10, zIndex: 30 }}>
        {/* Playlist / Now Playing */}
        <div id="playlistPanel" className="panel" style={{ width: 300 }}>
      {/* Fixed UI cluster (top-right) */}
      <div id="uiCluster" style={{ position: "fixed", top: 20, right: 30, display: "flex", flexDirection: "column", gap: 10, zIndex: 30, width: 300 }}>
        <div id="playlistPanel" className="panel" style={{ width: "100%" }}>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Now Playing</h3>
          <div ref={spotifyRef} id="spotifyEmbed" style={{ width: "100%" }}>
            {/* default placeholder embed (will be replaced on genre selection) */}
            {/* default embed injected on first mount by effect; but add a default iframe here for fallback */}
            <iframe
              title="default-spotify"
              src={GENRES[1].spotify}
              src={makeSpotifyEmbedUrl(GENRES.find(g=>g.id===selectedGenre).spotify)}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ width: "100%", height: 120, borderRadius: 10, border: "none" }}
            />
          </div>

          {/* local audio controls */}
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.9 }}>Load local audio</label>
            <input type="file" accept="audio/*" onChange={onFileChange} style={{ marginLeft: "auto" }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <input placeholder="Paste MP3/OGG URL + Enter" onKeyDown={onUrlKeyDown} style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.03)", color: "#fff" }} />
            <input placeholder="Paste MP3/ogg URL + Enter" onKeyDown={onUrlKeyDown} style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.03)", color: "#fff" }} />
          </div>
        </div>

        {/* Genre selection panel */}
        <div id="genreBar" className="panel" style={{ width: 300 }}>
        <div id="genreBar" className="panel" style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Genres</strong>
            <small style={{ opacity: 0.8 }}>{GENRES.length} options</small>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GENRES.map(g => {
              const active = selectedGenre === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => handleGenreSelect(g.id)}
                  onClick={() => onGenreClick(g.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
@@ -788,11 +775,12 @@ export default function App() {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 86
                    minWidth: 92,
                    justifyContent: "flex-start"
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: toCssHex(g.color), display: "inline-block", boxShadow: active ? "0 6px 18px rgba(0,0,0,0.45)" : "none" }} />
                  <span style={{ fontSize: 13 }}>{g.name}</span>
                  <span style={{ fontSize: 13, textAlign:"left" }}>{g.name}</span>
                </button>
              );
            })}

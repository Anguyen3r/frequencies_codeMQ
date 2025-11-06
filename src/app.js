// src/App.js
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/*
  Full integrated src/App.js
  - EXACT seven genres (order & names you requested)
  - Real Spotify embed switching (click a genre -> loads embed playlist)
  - Fixed top-right UI cluster (Now Playing + Genres)
  - Three.js scene: orbs cluster, horizontal ribbon (gentle waving / waveform when local audio loaded),
    pillar ribbons that follow orbs, soft aurora sprites
  - Local audio upload/URL analysis for visuals (Spotify embed won't be analyzable)
  - Clean cleanup on unmount
*/

const GENRES = [
  { id: "hard-techno", name: "Hard Techno", color: 0xff2b6a, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWVY4eLfA3XFQ" },
  { id: "techno", name: "Techno", color: 0x8a5fff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675" },
  { id: "drum-and-bass", name: "Drum & Bass", color: 0x4cff7b, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY" },
  { id: "dubstep", name: "Dubstep", color: 0x5fc9ff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWYWddJiPzbvb" },
  { id: "electronic", name: "Electronic / Dance", color: 0x3f7bff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n" },
  { id: "house", name: "House", color: 0xff9b3f, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX2TRYkJECvfC" },
  { id: "pop", name: "Pop / International", color: 0xff89d9, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }
];

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

export default function App(){
  const mountRef = useRef(null);
  const spotifyRef = useRef(null);
  const audioElementRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const orbsRef = useRef({});
  const pillarsRef = useRef([]);
  const ribbonRef = useRef(null);
  const animIdRef = useRef(null);

  const [selectedGenre, setSelectedGenre] = useState(GENRES[1].id); // default 'techno'
  const [mounted, setMounted] = useState(false);

  // Initialize Three.js scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // <-- fog density adjusted to be lighter so objects remain visible
    scene.fog = new THREE.FogExp2(0x00000c, 0.00002);
    sceneRef.current = scene;

    const CAMERA_Z = 250; // <-- moved camera much closer so the cluster is visible
    const camera = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 10000);
    camera.position.set(0, 18, CAMERA_Z);
    camera.lookAt(0,0,0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000010, 0);
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 1.5); // <-- increased ambient intensity
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 2.5); // <-- increased directional intensity
    dir.position.set(10,20,10); scene.add(dir);

    // helper textures
    function generateGlowTexture(colorHex){
      const size = 256;
      const c = document.createElement('canvas'); c.width=c.height=size;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(size/2,size/2,4,size/2,size/2,size/2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.42, toCssRgba(colorHex, 0.35));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
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

    // star layers
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
    const starsFar = makeStarLayer(1400, 6000, 3600, 6000, 1.1, 0.9);
    const starsNear = makeStarLayer(650, 3500, 2200, 3500, 1.9, 0.6);
    scene.add(starsFar.points, starsNear.points);

    // dust plane
    const loader = new THREE.TextureLoader();
    const dustTex = loader.load("https://assets.codepen.io/982762/clouds.png");
    const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800), new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.05, depthWrite:false }));
    dustPlane.position.set(0,0,-2600); scene.add(dustPlane);

    // ORBs (planets/bubbles)
    const CLUSTER_RADIUS = 420;
    const ORB_GROUP = new THREE.Group(); scene.add(ORB_GROUP);
    orbsRef.current = {};

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

    // create orbs and store them
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
      orbsRef.current[g.id] = { id: g.id, idx, container, core: coreMesh, ringObj, gas: gasMesh, baseAngle };
    });

    // aurora / haze sprites (soft circular shapes)
    function createAuroraSprite(colorStops, size=1600, opacity=0.3){
      const c = document.createElement('canvas'); c.width=c.height=size; const ctx = c.getContext('2d');
      const cx = size * (0.45 + (Math.random()-0.5)*0.08);
      const cy = size * (0.45 + (Math.random()-0.5)*0.08);
      const grad = ctx.createRadialGradient(cx,cy,20,cx,cy,size*0.95);
      colorStops.forEach(s=> grad.addColorStop(s.offset, s.color));
      ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
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
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    ribbonGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ribbonMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending });
    const ribbonLine = new THREE.Line(ribbonGeo, ribbonMat);
    ribbonLine.frustumCulled = false;
    scene.add(ribbonLine);

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
    const vgrad = ctx.createLinearGradient(0,0,c.width,c.height);
    vgrad.addColorStop(0, 'rgba(255,255,255,0.00)');
    vgrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    vgrad.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = vgrad; ctx.fillRect(0,0,c.width,c.height);
    ctx.globalCompositeOperation = 'source-over';
    const glowTex = new THREE.CanvasTexture(c);
    const spriteMat = new THREE.SpriteMaterial({ map: glowTex, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(width * 1.05, Math.max(40, width * 0.035), 1);
    sprite.position.set(0, -8, -140);
    scene.add(sprite);

    ribbonRef.current = { line: ribbonLine, sprite, geo: ribbonGeo, points: POINTS, _prevY: new Float32Array(Array.from({length:POINTS}, (_,i)=>positions[i*3+1])) };

    // Pillar ribbons
    const PILLAR_RIBBONS = [];
    function makePillarTexture(colorHex, h=1024, w=192){
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      const ctx2 = c.getContext('2d');
      const grad2 = ctx2.createLinearGradient(0,0,0,h);
      const rgba = a => toCssRgba(colorHex, a);
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
      ctx2.fillStyle = hg; ctx2.fillRect(0,0,w,h);
      ctx2.globalCompositeOperation = 'source-over';
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      return tex;
    }
    const pillarHeight = 1200; const pillarWidth = 160; const hSegs = 48; const wSegs = 10;
    GENRES.forEach((g, idx) => {
      const geo = new THREE.PlaneGeometry(pillarWidth, pillarHeight, wSegs, hSegs);
      const tex = makePillarTexture(g.color, 1024, 192);
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
    pillarsRef.current = PILLAR_RIBBONS;

    // Raycast for clicks on orbs
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2();
    function onPointerDown(e){
      const rect = renderer.domElement.getBoundingClientRect();
      ndcMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndcMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcMouse, camera);
      const cores = [];
      ORB_GROUP.children.forEach(c => { c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === "SphereGeometry") cores.push(n); }); });
      const hits = raycaster.intersectObjects(cores, true);
      if (hits.length > 0){
        let hit = hits[0].object;
        let parent = null;
        for (const c of ORB_GROUP.children){ if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
        if (parent){
          const found = Object.values(orbsRef.current).find(o => o.container === parent);
          if (found) {
            handleGenreSelect(found.id);
          }
        }
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

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
      animIdRef.current = requestAnimationFrame(animate);
      const t = (performance.now() - start) * 0.001;
      const amps = analyserRef.current ? getAmps() : null;
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

      // camera subtle move
      camera.position.z = CAMERA_Z + Math.sin(t*0.08) * 6 + bass * 80;
      camera.position.x = Math.sin(t*0.04) * 12 * (0.7 + rms * 0.8);
      camera.position.y = Math.cos(t*0.03) * 6 * (0.7 + rms * 0.6);
      camera.lookAt(0,0,0);

      // cluster / orbits diagonal ellipse
      const clusterSpeed = 0.12 + bass * 0.38;
      const tiltAngle = -Math.PI / 4;
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);

      GENRES.forEach((g, idx) => {
        const o = orbsRef.current[g.id];
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

        o.container.position.x = rx + jitterX + (idx - (GENRES.length-1)/2) * Math.sin(t*0.02) * 0.7;
        o.container.position.y = ry + jitterY + Math.cos(idx*0.5 + t*0.2)*4;
        o.container.position.z = Math.sin(t*(0.45 + idx*0.02))*8 - idx*3;

        o.core.rotation.y += 0.002 + idx*0.0003;
        o.core.rotation.x += 0.0011;

        o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass * 0.8);
        o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t*0.6 + idx))*0.18 + rms * 0.22;

        o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t*0.9 + idx) + bass*0.018;

        // sync pillar to orb
        const pillar = pillarsRef.current[idx];
        if (pillar) {
          pillar.mesh.userData.baseX = o.container.position.x;
          pillar.mesh.position.z = o.container.position.z - 50 - idx*2;
        }
      });

      // ribbon update (time-domain if local audio loaded, else idle gentle waving)
      try {
        const posAttr = ribbonRef.current.geo.attributes.position;
        const posArr = posAttr.array;
        const pts = ribbonRef.current.points;
        const prev = ribbonRef.current._prevY;
        const alpha = 0.18;
        let timeData = null;
        if (analyserRef.current) {
          const td = new Uint8Array(analyserRef.current.fftSize || 2048);
          analyserRef.current.getByteTimeDomainData(td);
          timeData = td;
        }
        if (timeData && timeData.length > 0) {
          const tdLen = timeData.length;
          for (let i=0;i<pts;i++){
            const f = (i / (pts-1)) * (tdLen - 1);
            const i0 = Math.floor(f), i1 = Math.min(tdLen-1, i0+1);
            const frac = f - i0;
            const td0 = timeData[i0], td1 = timeData[i1];
            const td = td0 * (1 - frac) + td1 * frac;
            const v = (td / 128.0) - 1.0;
            const amplitude = 120 + (selectedGenre ? 80 : 0);
            const baseOsc = Math.sin(i*0.09 + t*0.7) * 0.14;
            const targetY = v * amplitude * (0.7 + baseOsc);
            const idx3 = i*3;
            prev[i] = prev[i] * (1 - alpha) + targetY * alpha;
            posArr[idx3+1] = prev[i] - 10;
            posArr[idx3+2] = -120 + Math.sin(t*0.28 + i*0.04) * 5;
          }
          posAttr.needsUpdate = true;
          ribbonRef.current.sprite.material.opacity = Math.min(0.95, 0.22 + (analyserRef.current ? (getAmps().rms * 1.4) : 0.36));
        } else {
          for (let i=0;i<pts;i++){
            const idx3 = i*3;
            const targetY = (Math.sin(i*0.08 + t*0.9) * 12 + Math.sin(i*0.06 + t*0.3)*6 - 8);
            prev[i] = prev[i] * (1 - alpha) + targetY * alpha;
            posArr[idx3+1] = prev[i];
            posArr[idx3+2] = -120 + Math.sin(t*0.12 + i*0.03)*4;
          }
          posAttr.needsUpdate = true;
          ribbonRef.current.sprite.material.opacity = 0.45;
        }
      } catch(e){ /* safe */ }

      // pillar weave (gentle waving)
      try {
        pillarsRef.current.forEach((p, pIdx) => {
          const mesh = p.mesh;
          const posAttr = mesh.geometry.attributes.position;
          const arr = posAttr.array;
          const wSegs = mesh.userData.wSegs || 10;
          const hSegs = mesh.userData.hSegs || 48;
          const baseX = mesh.userData.baseX || mesh.position.x;
          const baseZ = mesh.userData.baseZ || mesh.position.z;
          const phase = pIdx * 0.6;
          let vi = 0;
          const globalAmp = 22 + bass * 140;
          const freq = 0.9 + (rms * 6.0);
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
          if (mesh.material) mesh.material.opacity = 0.14 + Math.min(0.4, (analyserRef.current ? getAmps().rms : 0.06) * 0.6) + (pIdx === GENRES.findIndex(g=>g.id===selectedGenre) ? 0.06 : 0);
          mesh.rotation.z = Math.sin(t*0.23 + pIdx*0.5) * 0.015;
        });
      } catch(e){ /* safe */ }

      renderer.render(scene, camera);
    }
    animate();

    // On resize
    function onResize(){
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w,h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      try {
        const newWidth = worldWidthAtZ(0) * 1.05;
        ribbonRef.current.sprite.scale.set(newWidth*1.05, Math.max(40, newWidth*0.035), 1);
        const posArr = ribbonRef.current.geo.attributes.position.array;
        for (let i=0;i<ribbonRef.current.points;i++){
          const x = -newWidth/2 + (i/(ribbonRef.current.points-1)) * newWidth;
          posArr[i*3] = x;
        }
        ribbonRef.current.geo.attributes.position.needsUpdate = true;
      } catch(e){}
    }
    window.addEventListener("resize", onResize);

    // state mounted
    setMounted(true);

    // cleanup
    return () => {
      cancelAnimationFrame(animIdRef.current);
      try { renderer.domElement.removeEventListener('pointerdown', onPointerDown); } catch(e){}
      window.removeEventListener("resize", onResize);
      try { renderer.dispose(); } catch(e){}
      try { mount.removeChild(renderer.domElement); } catch(e){}
      try {
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current.src = "";
          audioElementRef.current = null;
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
      } catch(e){}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // handle genre selection: embed spotify & colorize visuals
  async function handleGenreSelect(genreId){
    setSelectedGenre(genreId);
    const g = GENRES.find(x=>x.id===genreId);
    if (!g) return;

    // insert embed into spotifyRef
    if (spotifyRef.current){
      spotifyRef.current.innerHTML = "";
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

    // colorize ribbon & emphasize pillar/orb
    try {
      const tr = ((g.color>>16)&255)/255, tg = ((g.color>>8)&255)/255, tb = (g.color&255)/255;
      if (ribbonRef.current && ribbonRef.current.geo && ribbonRef.current.geo.attributes.color){
        const colors = ribbonRef.current.geo.attributes.color.array;
        for (let i=0;i<ribbonRef.current.points;i++){
          const idx = i*3;
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
      pillarsRef.current.forEach((p, i)=>{
        p.mesh.material.opacity = (GENRES[i].id === genreId) ? 0.34 : 0.16;
      });
      Object.values(orbsRef.current).forEach(o=>{
        if (o.id === genreId){
          o.core.material.emissiveIntensity = 1.6;
          o.core.scale.set(1.12, 1.12, 1.12);
        } else {
          o.core.material.emissiveIntensity = 0.6;
          o.core.scale.set(1,1,1);
        }
      });
    } catch(e){ /* safe */ }

    // stop local audio analysis (Spotify embeds can't be analyzed)
    try {
      if (audioElementRef.current){
        audioElementRef.current.pause();
        audioElementRef.current.src = "";
        audioElementRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed"){
        audioCtxRef.current.close();
        audioCtxRef.current = null;
        analyserRef.current = null;
      }
    } catch(e){}
  }

  // load local audio file or URL and set up analyser for waveform-driven visuals
  async function loadLocalAudio(fileOrUrl){
    // stop existing
    try {
      if (audioElementRef.current){ audioElementRef.current.pause(); audioElementRef.current.src=""; audioElementRef.current=null; }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed"){ await audioCtxRef.current.close(); audioCtxRef.current=null; analyserRef.current=null; }
    } catch(e){/*safe*/}
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const audioEl = document.createElement("audio");
      audioEl.controls = true;
      audioEl.crossOrigin = "anonymous";
      audioEl.style.width = "100%";
      audioEl.src = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
      audioEl.loop = true;
      await audioEl.play().catch(()=>{ /* may require gesture */ });
      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      audioElementRef.current = audioEl;

      // place into spotifyRef to show the player
      if (spotifyRef.current){
        spotifyRef.current.innerHTML = "";
        spotifyRef.current.appendChild(audioEl);
      }
    } catch(err){
      console.warn("audio load failed", err);
    }
  }

  // UI callbacks
  function onGenreClick(id){ handleGenreSelect(id); }
  function onFileChange(e){
    const f = e.target.files && e.target.files[0]; if (!f) return;
    loadLocalAudio(f);
  }
  function onUrlKeyDown(e){
    if (e.key === "Enter"){
      const v = e.target.value && e.target.value.trim();
      if (!v) return;
      loadLocalAudio(v);
      e.target.value = "";
    }
  }

  // ensure default selection after mount
  useEffect(() => {
    if (mounted) handleGenreSelect(selectedGenre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // render UI + canvas mountpoint
  return (
    <>
      <div ref={mountRef} id="three-bg" style={{ position: "fixed", inset: 0, zIndex: 0 }} />

      {/* CSS ribbon element (keeps the aesthetic, but Three ribbon is synced visually) */}
      <div id="ribbon" className="idle" style={{ position: "fixed", left:0, right:0, top:"50%", transform:"translateY(-50%)", zIndex:2, pointerEvents:"none" }} />

      {/* Fixed UI cluster (top-right) */}
      <div id="uiCluster" style={{ position: "fixed", top: 20, right: 30, display: "flex", flexDirection: "column", gap: 10, zIndex: 30, width: 300 }}>
        <div id="playlistPanel" className="panel" style={{ width: "100%" }}>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Now Playing</h3>
          <div ref={spotifyRef} id="spotifyEmbed" style={{ width: "100%" }}>
            {/* default embed injected on first mount by effect; but add a default iframe here for fallback */}
            <iframe
              title="default-spotify"
              src={makeSpotifyEmbedUrl(GENRES.find(g=>g.id===selectedGenre).spotify)}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ width: "100%", height: 120, borderRadius: 10, border: "none" }}
            />
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.9 }}>Load local audio</label>
            <input type="file" accept="audio/*" onChange={onFileChange} style={{ marginLeft: "auto" }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <input placeholder="Paste MP3/ogg URL + Enter" onKeyDown={onUrlKeyDown} style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.03)", color: "#fff" }} />
          </div>
        </div>

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
                  onClick={() => onGenreClick(g.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                    color: active ? "#000" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 92,
                    justifyContent: "flex-start"
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: toCssHex(g.color), display: "inline-block", boxShadow: active ? "0 6px 18px rgba(0,0,0,0.45)" : "none" }} />
                  <span style={{ fontSize: 13, textAlign:"left" }}>{g.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

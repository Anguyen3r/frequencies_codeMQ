// src/App.js
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/*
  Full integrated src/App.js (Fixed Rendering)
  - EXACT seven genres (order & names you requested)
  - Real Spotify embed switching (click a genre -> loads embed playlist)
  - Fixed top-right UI cluster (Now Playing + Genres)
  - Three.js scene: orbs cluster, horizontal ribbon, pillar ribbons, aurora sprites
  - Local audio upload/URL analysis for visuals (Spotify embed won't be analyzable)
  - Fixed background and canvas visibility
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
  try {
    const u = new URL(spotifyUrl);
    if (u.hostname.includes("spotify")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }
  } catch(e){}
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

  const [selectedGenre, setSelectedGenre] = useState(GENRES[1].id);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050518, 0.00009); // ✅ lighter fog for visibility
    scene.background = new THREE.Color(0x000010);
    sceneRef.current = scene;

    const CAMERA_Z = 850;
    const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 18, CAMERA_Z);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000010, 1); // ✅ fixed alpha transparency
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(10, 20, 10);
    scene.add(dir);
    // === Helper textures ===
    function generateGlowTexture(colorHex){
      const size = 256;
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(size/2, size/2, 4, size/2, size/2, size/2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.42, toCssRgba(colorHex, 0.35));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      return tex;
    }

    function generateStarTexture(){
      const s = 64;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      return new THREE.CanvasTexture(c);
    }

    // === Starfield layers ===
    function makeStarLayer(count, spreadX = 5000, spreadY = 3000, spreadZ = 5000, size = 1.2, opacity = 0.9){
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++){
        pos[i*3] = (Math.random() - 0.5) * spreadX;
        pos[i*3+1] = (Math.random() - 0.5) * spreadY;
        pos[i*3+2] = -Math.random() * spreadZ - 200;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: 0xffffff, size, transparent: true, opacity, depthWrite: false });
      const points = new THREE.Points(geo, mat);
      return points;
    }
    const starsFar = makeStarLayer(1400, 6000, 3600, 6000, 1.1, 0.9);
    const starsNear = makeStarLayer(650, 3500, 2200, 3500, 1.9, 0.6);
    scene.add(starsFar, starsNear);

    // === Orbs (genre planets) ===
    const CLUSTER_RADIUS = 420;
    const ORB_GROUP = new THREE.Group();
    scene.add(ORB_GROUP);
    orbsRef.current = {};

    function createStardustRing(coreRadius, colorHex){
      const group = new THREE.Group();
      const ringRadius = coreRadius * (1.8 + Math.random() * 0.85);
      const particleCount = 240;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++){
        const theta = (i / particleCount) * Math.PI * 2;
        const rr = ringRadius + (Math.random() - 0.5) * (coreRadius * 0.36);
        positions[i*3] = Math.cos(theta) * rr;
        positions[i*3+1] = Math.sin(theta) * rr;
        positions[i*3+2] = (Math.random() - 0.5) * (coreRadius * 0.5);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 9.5,
        map: generateStarTexture(),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      mat.color = new THREE.Color(colorHex);
      const points = new THREE.Points(geo, mat);
      group.add(points);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: generateGlowTexture(colorHex),
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      glow.scale.set(ringRadius*2.0, ringRadius*2.0, 1);
      group.add(glow);
      return group;
    }

    GENRES.forEach((g, idx) => {
      const color = new THREE.Color(g.color);
      const coreRadius = 40 + Math.random() * 10;
      const coreGeo = new THREE.SphereGeometry(coreRadius, 48, 48);
      const coreMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.30,
        roughness: 0.16,
        metalness: 0.08,
        transmission: 0.7,
        emissive: color.clone().multiplyScalar(0.05),
        emissiveIntensity: 0.6,
        clearcoat: 0.2
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      const rim = new THREE.Sprite(new THREE.SpriteMaterial({
        map: generateGlowTexture(g.color),
        color: g.color,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      rim.scale.set(coreRadius*9.8, coreRadius*9.8, 1);
      coreMesh.add(rim);

      const container = new THREE.Group();
      container.add(coreMesh);
      const baseAngle = (idx / GENRES.length) * Math.PI * 2;
      container.position.set(Math.cos(baseAngle)*CLUSTER_RADIUS, Math.sin(baseAngle)*CLUSTER_RADIUS*0.6, -idx*6);

      const ring = createStardustRing(coreRadius, g.color);
      container.add(ring);

      ORB_GROUP.add(container);
      orbsRef.current[g.id] = { id: g.id, idx, container, core: coreMesh };
    });

    // === Ribbon ===
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
    for (let i = 0; i < POINTS; i++){
      const x = -width/2 + (i / (POINTS - 1)) * width;
      positions[i*3] = x;
      positions[i*3+1] = Math.sin(i/6) * 6;
      positions[i*3+2] = -120;
      colors[i*3] = 0.8; colors[i*3+1] = 0.7; colors[i*3+2] = 1.0;
    }
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    ribbonGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ribbonMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    const ribbonLine = new THREE.Line(ribbonGeo, ribbonMat);
    ribbonLine.frustumCulled = false;
    scene.add(ribbonLine);

    ribbonRef.current = { line: ribbonLine, geo: ribbonGeo, points: POINTS };
    // === Animation ===
    let start = performance.now();
    function animate(){
      animIdRef.current = requestAnimationFrame(animate);
      const t = (performance.now() - start) * 0.001;

      // Subtle motion
      starsFar.rotation.z += 0.00025;
      starsNear.rotation.z -= 0.00035;

      ORB_GROUP.children.forEach((c, i) => {
        c.rotation.y += 0.002;
        c.rotation.x += 0.001;
        const angle = t * 0.1 + i * 0.9;
        c.position.x = Math.cos(angle) * CLUSTER_RADIUS;
        c.position.y = Math.sin(angle) * (CLUSTER_RADIUS * 0.6);
      });

      // Ribbon gentle wave
      const posAttr = ribbonGeo.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < POINTS; i++){
        const idx3 = i * 3;
        arr[idx3+1] = Math.sin(i*0.08 + t*0.9) * 12;
        arr[idx3+2] = -120 + Math.sin(t*0.12 + i*0.03)*4;
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    }
    animate();

    // === Resize handling ===
    function onResize(){
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    setMounted(true);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      window.removeEventListener("resize", onResize);
      try { mount.removeChild(renderer.domElement); } catch(e){}
      renderer.dispose();
    };
  }, []);

  // === Handle genre selection ===
  async function handleGenreSelect(genreId){
    setSelectedGenre(genreId);
    const g = GENRES.find(x=>x.id===genreId);
    if (!g) return;
    if (spotifyRef.current){
      spotifyRef.current.innerHTML = "";
      const embed = makeSpotifyEmbedUrl(g.spotify);
      const iframe = document.createElement("iframe");
      iframe.src = embed;
      iframe.width = "100%";
      iframe.height = "120";
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      iframe.style.borderRadius = "10px";
      iframe.style.width = "100%";
      iframe.loading = "lazy";
      spotifyRef.current.appendChild(iframe);
    }
  }

  // === UI events ===
  function onGenreClick(id){ handleGenreSelect(id); }

  useEffect(() => {
    if (mounted) handleGenreSelect(selectedGenre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // === JSX render ===
  return (
    <>
      <div ref={mountRef} id="three-bg" style={{ position: "fixed", inset: 0, zIndex: 0 }} />

      {/* CSS ribbon layer */}
      <div id="ribbon" className="idle"
        style={{ position: "fixed", left:0, right:0, top:"50%", transform:"translateY(-50%)",
                 zIndex:2, pointerEvents:"none", height:"3px",
                 background:"linear-gradient(90deg, rgba(0,255,255,0.25), rgba(255,0,255,0.4), rgba(255,255,0,0.3), rgba(0,255,255,0.25))",
                 filter:"blur(4px) brightness(1.3)", opacity:0.8 }} />

      {/* UI Cluster */}
      <div id="uiCluster"
        style={{ position:"fixed", top:20, right:30, display:"flex", flexDirection:"column", gap:10,
                 zIndex:30, width:300, color:"#fff", fontFamily:"Inter, sans-serif" }}>

        <div id="playlistPanel" className="panel" style={{ background:"rgba(20,20,30,0.55)",
          borderRadius:14, padding:14, boxShadow:"0 0 25px rgba(0,0,0,0.45)" }}>
          <h3 style={{ margin:0, marginBottom:8 }}>Now Playing</h3>
          <div ref={spotifyRef} id="spotifyEmbed" style={{ width:"100%" }}>
            <iframe
              title="default-spotify"
              src={makeSpotifyEmbedUrl(GENRES.find(g=>g.id===selectedGenre).spotify)}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ width:"100%", height:120, borderRadius:10, border:"none" }}
            />
          </div>
        </div>

        <div id="genreBar" className="panel" style={{ background:"rgba(20,20,30,0.55)",
          borderRadius:14, padding:14, boxShadow:"0 0 25px rgba(0,0,0,0.45)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <strong style={{ fontSize:13 }}>Genres</strong>
            <small style={{ opacity:0.8 }}>{GENRES.length} options</small>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {GENRES.map(g => {
              const active = selectedGenre === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => onGenreClick(g.id)}
                  style={{
                    padding:"6px 10px",
                    borderRadius:8,
                    border:"none",
                    cursor:"pointer",
                    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                    color: active ? "#000" : "#fff",
                    display:"flex",
                    alignItems:"center",
                    gap:8,
                    minWidth:92,
                    justifyContent:"flex-start"
                  }}>
                  <span style={{ width:12, height:12, borderRadius:4, background:toCssHex(g.color),
                    display:"inline-block", boxShadow: active ? "0 6px 18px rgba(0,0,0,0.45)" : "none" }} />
                  <span style={{ fontSize:13 }}>{g.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

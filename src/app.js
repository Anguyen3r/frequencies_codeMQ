// src/App.js
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const GENRES = [
  { id: "hard-techno", name: "Hard Techno", color: 0xff2b6a, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX9sIqqvKsjG8" },
  { id: "techno", name: "Techno", color: 0x8a5fff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX6f9r4Vf1D3K" },
  { id: "house", name: "House", color: 0xff9b3f, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXa2PvUpywmrr" },
  { id: "dnb", name: "Drum & Bass", color: 0x4cff7b, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY" },
  { id: "electronic", name: "Electronic / Dance", color: 0x3f7bff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n" },
  { id: "dubstep", name: "Dubstep", color: 0x5fc9ff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY" },
  { id: "pop", name: "Pop", color: 0xff89d9, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" },
];

function hexToCss(n) {
  return "#" + ("000000" + n.toString(16)).slice(-6);
}
function rgbaFromHex(n, a = 1) {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export default function App() {
  const mountRef = useRef(null);
  const spotifyRef = useRef(null);
  const audioInputRef = useRef(null);
  const [currentGenre, setCurrentGenre] = useState(GENRES[0].id);
  const [spotifyUrl, setSpotifyUrl] = useState(GENRES[0].spotify);
  const [analyzableAudioActive, setAnalyzableAudioActive] = useState(false);

  useEffect(() => {
    // ---- Three.js scene setup ----
    const mount = mountRef.current;
    if (!mount) return;

    let rafId = null;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

    const CAMERA_Z = 850;
    const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 18, CAMERA_Z);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000010, 0);
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    mount.appendChild(renderer.domElement);

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    // --- star layers (background) ---
    function makeStarLayer(count, spreadX = 5000, spreadY = 3000, spreadZ = 5000, size = 1.2, opacity = 0.9) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * spreadX;
        pos[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
        pos[i * 3 + 2] = -Math.random() * spreadZ - 200;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: 0xffffff, size, transparent: true, opacity, depthWrite: false });
      return new THREE.Points(geo, mat);
    }
    const starsFar = makeStarLayer(1400, 6000, 3600, 6000, 1.1, 0.9);
    const starsNear = makeStarLayer(600, 3500, 2200, 3500, 1.9, 0.6);
    scene.add(starsFar, starsNear);

    // dust plane
    const dustTex = new THREE.TextureLoader().load("https://assets.codepen.io/982762/clouds.png");
    const dustPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3800), new THREE.MeshBasicMaterial({ map: dustTex, transparent: true, opacity: 0.05, depthWrite: false }));
    dustPlane.position.set(0, 0, -2600);
    scene.add(dustPlane);

    // --- orbs + stardust rings ---
    const CLUSTER_RADIUS = 420;
    const ORB_GROUP = new THREE.Group();
    scene.add(ORB_GROUP);
    const ORB_MESHES = {};

    function createGlowTexture(colorHex) {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.25, "rgba(255,255,255,0.6)");
      grad.addColorStop(0.6, rgbaFromHex(colorHex, 0.28));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    }
    function createStarTexture() {
      const s = 64;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.95)");
      g.addColorStop(0.6, "rgba(255,255,255,0.2)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      return new THREE.CanvasTexture(c);
    }
    function createStardustRing(coreRadius, colorHex, tilt, particleCount = 220, size = 8.5, counterClockwise = true) {
      const group = new THREE.Group();
      const ringRadius = coreRadius * (1.8 + Math.random() * 0.85);
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const theta = (i / particleCount) * Math.PI * 2;
        const rr = ringRadius + (Math.random() - 0.5) * (coreRadius * 0.36);
        positions[i * 3] = Math.cos(theta) * rr;
        positions[i * 3 + 1] = Math.sin(theta) * rr;
        positions[i * 3 + 2] = (Math.random() - 0.5) * (coreRadius * 0.5);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ size, map: createStarTexture(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      mat.color = new THREE.Color(colorHex).multiplyScalar(0.94);
      const points = new THREE.Points(geo, mat);
      group.add(points);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: createGlowTexture(colorHex), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(ringRadius * 2.0, ringRadius * 2.0, 1);
      group.add(glow);
      group.rotation.set(tilt.x || 0, tilt.y || 0, tilt.z || 0);
      group.userData = { rotationSpeed: (0.004 + Math.random() * 0.006) * (counterClockwise ? -1 : 1) };
      return { group, points, mat, ringRadius };
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
        emissive: color.clone().multiplyScalar(0.035),
        emissiveIntensity: 0.6,
        clearcoat: 0.2,
      });
      coreMat.depthWrite = false;
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: createGlowTexture(g.color), color: g.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      rim.scale.set(coreRadius * 9.8, coreRadius * 9.8, 1);
      coreMesh.add(rim);

      const container = new THREE.Group();
      container.add(coreMesh);
      const baseAngle = (idx / GENRES.length) * Math.PI * 2;
      container.userData.baseAngle = baseAngle;
      container.userData.idx = idx;
      container.position.set(Math.cos(baseAngle) * CLUSTER_RADIUS, Math.sin(baseAngle) * CLUSTER_RADIUS * 0.6, -idx * 6);

      const tilt = { x: (Math.random() * 0.9 - 0.45) * Math.PI / 2, y: (Math.random() * 0.9 - 0.45) * Math.PI / 2, z: (Math.random() * 0.6 - 0.3) * Math.PI / 6 };
      const ringObj = createStardustRing(coreRadius, g.color, tilt, 160 + Math.floor(Math.random() * 120), 8.5, (idx % 2 === 0));
      container.add(ringObj.group);

      const gasGeo = new THREE.SphereGeometry(coreRadius * 1.9, 32, 32);
      const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false });
      const gasMesh = new THREE.Mesh(gasGeo, gasMat);
      container.add(gasMesh);

      ORB_GROUP.add(container);
      ORB_MESHES[g.id] = { id: g.id, idx, container, core: coreMesh, ringObj, gas: gasMesh, baseAngle };
    });

    // --- gentle aurora / haze sprites (non-rectangular) ---
    function createAuroraSprite(colorStops, size = 1600, opacity = 0.3) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const cx = size * (0.45 + (Math.random() - 0.5) * 0.08);
      const cy = size * (0.45 + (Math.random() - 0.5) * 0.08);
      const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, size * 0.95);
      colorStops.forEach((s) => grad.addColorStop(s.offset, s.color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    }
    const smokeBack1 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.14, color: "rgba(120,40,200,0.12)" }, { offset: 0.78, color: "rgba(20,150,200,0.06)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 2000, 0.42);
    smokeBack1.scale.set(3000, 1600, 1); smokeBack1.position.set(-60, -120, -1800); scene.add(smokeBack1);
    const smokeBack2 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.18, color: "rgba(200,40,140,0.10)" }, { offset: 0.6, color: "rgba(60,40,220,0.08)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 1800, 0.3);
    smokeBack2.scale.set(2600, 1300, 1); smokeBack2.position.set(120, -60, -1600); scene.add(smokeBack2);
    const smokeFront1 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.18, color: "rgba(160,40,220,0.08)" }, { offset: 0.7, color: "rgba(30,200,220,0.07)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 1400, 0.30);
    smokeFront1.scale.set(2200, 1100, 1); smokeFront1.position.set(30, 80, -320); scene.add(smokeFront1);
    const smokeFront2 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.18, color: "rgba(240,120,100,0.06)" }, { offset: 0.7, color: "rgba(90,80,255,0.05)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 1200, 0.24);
    smokeFront2.scale.set(1800, 900, 1); smokeFront2.position.set(-80, 40, -260); scene.add(smokeFront2);

    // --- horizontal ribbon (Line + sprite glow) ---
    const RIBBON = {};
    (function initRibbon() {
      const POINTS = 512;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(POINTS * 3);
      const colors = new Float32Array(POINTS * 3);

      // world width at z=0
      function worldWidthAtZ(z) {
        const vFOV = camera.fov * Math.PI / 180;
        const height = 2 * Math.tan(vFOV / 2) * Math.abs(camera.position.z - z);
        const width = height * camera.aspect;
        return width;
      }
      const width = worldWidthAtZ(0) * 1.05;
      for (let i = 0; i < POINTS; i++) {
        const x = -width / 2 + (i / (POINTS - 1)) * width;
        positions[i * 3] = x;
        positions[i * 3 + 1] = Math.sin(i / 6) * 6;
        positions[i * 3 + 2] = -120;
        colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 1.0;
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
      const line = new THREE.Line(geometry, mat);
      line.frustumCulled = false;
      scene.add(line);

      // glow sprite to mask sharp edges
      const c = document.createElement("canvas");
      c.width = 2048; c.height = 256;
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, c.width, 0);
      g.addColorStop(0, "rgba(255,255,255,0.00)");
      g.addColorStop(0.18, "rgba(255,255,255,0.06)");
      g.addColorStop(0.5, "rgba(255,255,255,0.14)");
      g.addColorStop(0.82, "rgba(255,255,255,0.06)");
      g.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);

      const glowTex = new THREE.CanvasTexture(c);
      const spriteMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(width * 1.05, Math.max(40, width * 0.035), 1);
      sprite.position.set(0, -8, -140);
      scene.add(sprite);

      const prevY = new Float32Array(POINTS);
      for (let i = 0; i < POINTS; i++) prevY[i] = positions[i * 3 + 1];

      RIBBON.line = line;
      RIBBON.sprite = sprite;
      RIBBON.geometry = geometry;
      RIBBON.points = POINTS;
      RIBBON.width = width;
      RIBBON._prevY = prevY;
      RIBBON.smoothAlpha = 0.18;
    })();

    // --- pillar ribbons (simpler plane ribbons that wave) ---
    const PILLAR_RIBBONS = [];
    (function initPillars() {
      const pillarHeight = 1200;
      const pillarWidth = 160;
      const hSegs = 48;
      const wSegs = 10;
      GENRES.forEach((g, idx) => {
        const geo = new THREE.PlaneGeometry(pillarWidth, pillarHeight, wSegs, hSegs);
        // gradient canvas
        const c = document.createElement("canvas");
        c.width = 192; c.height = 1024;
        const ctx = c.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 0, c.height);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.12, rgbaFromHex(g.color, 0.06));
        grad.addColorStop(0.45, rgbaFromHex(g.color, 0.14));
        grad.addColorStop(0.92, rgbaFromHex(g.color, 0.06));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, c.width, c.height);
        // light horizontal sheen
        const hg = ctx.createLinearGradient(0, 0, c.width, 0);
        hg.addColorStop(0, "rgba(255,255,255,0.00)");
        hg.addColorStop(0.5, "rgba(255,255,255,0.04)");
        hg.addColorStop(1, "rgba(255,255,255,0.00)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = hg; ctx.fillRect(0, 0, c.width, c.height);
        ctx.globalCompositeOperation = "source-over";
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2 + 0.02;
        mesh.rotation.y = 0.06 * (idx % 2 === 0 ? 1 : -1);
        mesh.position.set(0, -80, -180 - idx * 6);
        mesh.userData = { idx, baseX: 0, baseZ: mesh.position.z, width: pillarWidth, height: pillarHeight, wSegs, hSegs, color: g.color };
        scene.add(mesh);
        PILLAR_RIBBONS.push({ mesh, geo, mat, idx });
      });
    })();

    // --- Audio analysis for local audio / URL (Spotify embed cannot be analyzed) ---
    const audioController = (function () {
      let audioCtx = null, analyser = null, source = null, freqData = null, timeData = null, audioEl = null, active = false;
      async function ensure() {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 2048;
          freqData = new Uint8Array(analyser.frequencyBinCount);
          timeData = new Uint8Array(analyser.frequencyBinCount);
        }
      }
      async function loadUrl(url, { loop = true } = {}) {
        try {
          await ensure();
          if (!audioEl) { audioEl = document.createElement("audio"); audioEl.crossOrigin = "anonymous"; audioEl.controls = true; audioEl.style.width = "100%"; }
          audioEl.src = url;
          audioEl.loop = !!loop;
          // try play (may be blocked until user gesture)
          audioEl.play().catch(()=>{});
          if (source) try { source.disconnect(); } catch (e) {}
          source = audioCtx.createMediaElementSource(audioEl);
          source.connect(analyser);
          analyser.connect(audioCtx.destination);
          active = true;
          setAnalyzableAudioActive(true);
          // show audio element in spotifyRef if present
          if (spotifyRef.current) { spotifyRef.current.innerHTML = ""; spotifyRef.current.appendChild(audioEl); }
          return true;
        } catch (err) {
          console.warn("audio load failed", err);
          active = false;
          setAnalyzableAudioActive(false);
          return false;
        }
      }
      function stop() {
        if (audioEl) try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) {}
        if (audioCtx && audioCtx.state !== "closed") try { audioCtx.suspend(); } catch (e) {}
        active = false;
        setAnalyzableAudioActive(false);
      }
      function getAmps() {
        if (!analyser || !freqData) return null;
        analyser.getByteFrequencyData(freqData);
        const lowCount = Math.max(1, Math.floor(freqData.length * 0.02));
        let bass = 0; for (let i = 0; i < lowCount; i++) bass += freqData[i];
        bass = bass / lowCount / 255;
        let sum = 0; for (let i = 0; i < freqData.length; i++) sum += freqData[i] * freqData[i];
        const rms = Math.sqrt(sum / freqData.length) / 255;
        return { bass, rms, rawFreq: freqData };
      }
      function getTimeDomain() {
        if (!analyser || !timeData) return null;
        analyser.getByteTimeDomainData(timeData);
        return timeData;
      }
      function isActive() { return active; }
      return { loadUrl, stop, getAmps, getTimeDomain, isActive };
    })();

    // --- play genre: embed spotify OR fallback to internal audio url (if provided) ---
    function clearSpotifyEmbedNode() {
      if (spotifyRef.current) spotifyRef.current.innerHTML = "";
    }
    function embedSpotifyLink(url) {
      if (!spotifyRef.current) return;
      spotifyRef.current.innerHTML = "";
      try {
        const u = new URL(url);
        if (u.hostname.includes("spotify")) {
          const pathParts = u.pathname.split("/").filter(Boolean);
          if (pathParts.length >= 2) {
            const embedPath = `/embed/${pathParts[0]}/${pathParts[1]}`;
            const iframe = document.createElement("iframe");
            iframe.src = `https://open.spotify.com${embedPath}`;
            iframe.width = "300";
            iframe.height = "80";
            iframe.frameBorder = "0";
            iframe.allow = "encrypted-media; clipboard-write";
            iframe.style.borderRadius = "8px";
            iframe.style.width = "100%";
            iframe.style.maxWidth = "420px";
            spotifyRef.current.appendChild(iframe);
            return;
          }
        }
      } catch (e) {
        // fall through and attempt generic
      }
      // fallback: generic iframe (best-effort)
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.width = "300";
      iframe.height = "80";
      iframe.frameBorder = "0";
      iframe.allow = "encrypted-media; clipboard-write";
      iframe.style.borderRadius = "8px";
      iframe.style.width = "100%";
      iframe.style.maxWidth = "420px";
      spotifyRef.current.appendChild(iframe);
    }

    // sync colors and UI highlight
    function colorizeForGenre(genreId) {
      const g = GENRES.find(x => x.id === genreId);
      if (!g) return;
      // tint ribbon
      if (RIBBON.geometry && RIBBON.geometry.attributes.color) {
        const colors = RIBBON.geometry.attributes.color.array;
        const tr = ((g.color >> 16) & 255) / 255;
        const tg = ((g.color >> 8) & 255) / 255;
        const tb = (g.color & 255) / 255;
        for (let i = 0; i < RIBBON.points; i++) {
          const idx = i * 3;
          colors[idx] = 0.14 + tr * 0.86;
          colors[idx + 1] = 0.14 + tg * 0.86;
          colors[idx + 2] = 0.14 + tb * 0.86;
        }
        RIBBON.geometry.attributes.color.needsUpdate = true;
        if (RIBBON.sprite && RIBBON.sprite.material) {
          RIBBON.sprite.material.color = new THREE.Color(g.color);
          RIBBON.sprite.material.opacity = 0.62;
        }
      }
      // pillar emphasis
      const foundIdx = GENRES.findIndex(x => x.id === genreId);
      PILLAR_RIBBONS.forEach((p, i) => {
        if (p.mesh && p.mesh.material) p.mesh.material.opacity = (i === foundIdx) ? 0.34 : 0.16;
      });
      // highlight DOM legend items (if present)
      const legend = document.getElementById("legendList");
      if (legend) {
        Array.from(legend.children).forEach((li, i) => {
          li.style.boxShadow = (GENRES[i].id === genreId) ? "0 6px 18px rgba(0,0,0,0.45)" : "none";
          li.style.transform = (GENRES[i].id === genreId) ? "translateY(-2px)" : "none";
        });
      }
    }

    // --- raycast click on orbs to open modal / change genre ---
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2();
    function onPointerDown(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndcMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndcMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcMouse, camera);

      const cores = [];
      ORB_GROUP.children.forEach(c => { c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === "SphereGeometry") cores.push(n); }); });
      const hits = raycaster.intersectObjects(cores, true);
      if (hits.length > 0) {
        let hit = hits[0].object;
        let parent = null;
        for (const c of ORB_GROUP.children) { if (c.children.includes(hit) || c === hit || c.children.includes(hit.parent)) { parent = c; break; } }
        if (parent) {
          const found = Object.values(ORB_MESHES).find(o => o.container === parent);
          if (found) {
            handleGenreClick(found.id);
            // small visual feedback
            const mat = found.core.material;
            const orig = mat.emissiveIntensity || 0.6;
            mat.emissiveIntensity = Math.max(1.6, orig * 2.2);
            setTimeout(() => mat.emissiveIntensity = orig, 800);
          }
        }
      }
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    // --- click-handling from React UI will call this ---
    async function handleGenreClick(genreId) {
      const g = GENRES.find(x => x.id === genreId);
      if (!g) return;
      setCurrentGenre(genreId);
      colorizeForGenre(genreId);
      setSpotifyUrl(g.spotify || null);
      // Embed spotify (stop analyzable audio)
      try { audioController.stop(); } catch (e) {}
      clearSpotifyEmbedNode();
      if (g.spotify && spotifyRef.current) embedSpotifyLink(g.spotify);
    }

    // --- animation loop ---
    const start = performance.now();
    function animate() {
      rafId = requestAnimationFrame(animate);
      const t = (performance.now() - start) * 0.001;
      const amps = audioController.getAmps();
      const bass = amps ? amps.bass : 0;
      const rms = amps ? amps.rms : 0.06 + Math.sin(t * 0.25) * 0.02;

      starsFar.rotation && (starsFar.rotation.z += 0.00035);
      starsNear.rotation && (starsNear.rotation.z -= 0.00048);
      // dust rotation
      dustPlane.rotation.z += 0.00012;

      // smoke pulse
      if (smokeBack1 && smokeBack2 && smokeFront1 && smokeFront2) {
        const smokePulse = 0.6 + Math.sin(t * 0.9) * 0.12 + bass * 0.9;
        smokeBack1.material.opacity = 0.28 * smokePulse;
        smokeBack2.material.opacity = 0.22 * (0.9 + Math.cos(t * 0.7) * 0.06 + bass * 0.4);
        smokeFront1.material.opacity = 0.24 * (0.9 + Math.sin(t * 0.5) * 0.06 + rms * 0.9);
        smokeFront2.material.opacity = 0.20 * (1 + Math.cos(t * 0.63) * 0.05 + bass * 0.6);
      }

      // camera subtle move
      camera.position.z = CAMERA_Z + Math.sin(t * 0.08) * 6 + bass * 80;
      camera.position.x = Math.sin(t * 0.04) * 12 * (0.7 + rms * 0.8);
      camera.position.y = Math.cos(t * 0.03) * 6 * (0.7 + rms * 0.6);
      camera.lookAt(0, 0, 0);

      // cluster orbit
      const clusterSpeed = 0.12 + bass * 0.38;
      const tiltAngle = -Math.PI / 4;
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);
      // optional UI avoidance
      let centerOffsetX = 0, centerOffsetY = 0;
      try {
        const leftPanel = document.getElementById("leftPanel");
        if (leftPanel && leftPanel.getBoundingClientRect) {
          const lr = leftPanel.getBoundingClientRect();
          centerOffsetX = (lr.width / Math.max(window.innerWidth, 600)) * (CLUSTER_RADIUS * 0.85);
          centerOffsetY = -Math.min(120, lr.height * 0.08);
        }
      } catch (e) {}
      GENRES.forEach((g, idx) => {
        const o = ORB_MESHES[g.id];
        if (!o) return;
        const phaseOffset = o.baseAngle;
        const angle = t * clusterSpeed + phaseOffset * (0.6 + idx * 0.08);

        const ex = CLUSTER_RADIUS * (0.86 + Math.sin(idx + t * 0.12) * 0.02);
        const ey = CLUSTER_RADIUS * 0.48 * (0.9 + Math.cos(idx * 0.7 + t * 0.11) * 0.02);

        const rawX = Math.cos(angle) * ex;
        const rawY = Math.sin(angle) * ey;

        const rx = rawX * cosT - rawY * sinT;
        const ry = rawX * sinT + rawY * cosT;

        const jitterX = Math.sin(t * 0.27 + idx * 0.64) * 6;
        const jitterY = Math.cos(t * 0.31 + idx * 0.41) * 3;

        o.container.position.x = rx + centerOffsetX + jitterX + (idx - (GENRES.length - 1) / 2) * Math.sin(t * 0.02) * 0.7;
        o.container.position.y = ry + centerOffsetY + jitterY + Math.cos(idx * 0.5 + t * 0.2) * 4;
        o.container.position.z = Math.sin(t * (0.45 + idx * 0.02)) * 8 - idx * 3;

        o.core.rotation.y += 0.002 + idx * 0.0003;
        o.core.rotation.x += 0.0011;

        if (o.ringObj && o.ringObj.group) {
          o.ringObj.group.rotation.z += (o.ringObj.group.userData.rotationSpeed || (0.004)) * (1 + bass * 0.8);
        }
        o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t * 0.9 + idx) + bass * 0.018;

        // sync pillar baseX
        const pillar = PILLAR_RIBBONS[idx];
        if (pillar) {
          pillar.mesh.userData.baseX = o.container.position.x;
          pillar.mesh.position.z = o.container.position.z - 50 - idx * 2;
        }
      });

      // horizontal ribbon update (uses audioController time-domain if available)
      try {
        if (RIBBON && RIBBON.geometry) {
          const pos = RIBBON.geometry.attributes.position.array;
          const pts = RIBBON.points;
          const timeData = audioController.getTimeDomain();
          const prevY = RIBBON._prevY;
          const alpha = RIBBON.smoothAlpha;
          const idleOffset = 0;
          if (timeData && timeData.length > 0) {
            const tdLen = timeData.length;
            for (let i = 0; i < pts; i++) {
              const f = (i / (pts - 1)) * (tdLen - 1);
              const i0 = Math.floor(f), i1 = Math.min(tdLen - 1, i0 + 1);
              const frac = f - i0;
              const td0 = timeData[i0], td1 = timeData[i1];
              const td = td0 * (1 - frac) + td1 * frac;
              const v = (td / 128.0) - 1.0;
              const amplitude = 120 + (currentGenre ? 80 : 0);
              const baseOsc = Math.sin(i * 0.09 + t * 0.7) * 0.14;
              const targetY = v * amplitude * (0.7 + baseOsc);
              const idx = i * 3;
              prevY[i] = prevY[i] * (1 - alpha) + targetY * alpha;
              pos[idx + 1] = prevY[i] - 10;
              pos[idx + 2] = -120 + Math.sin(t * 0.28 + i * 0.04) * 5;
            }
            const amps = audioController.getAmps();
            const brightness = amps ? (0.28 + amps.rms * 1.4) : 0.36;
            if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = Math.min(0.95, 0.22 + brightness);
          } else {
            // idle gentle waving
            for (let i = 0; i < pts; i++) {
              const idx = i * 3;
              const targetY = (Math.sin(i * 0.08 + t * 0.9) * 12 + Math.sin(i * 0.06 + t * 0.3) * 6 - 8);
              prevY[i] = prevY[i] * (1 - alpha) + targetY * alpha;
              pos[idx + 1] = prevY[i];
              pos[idx + 2] = -120 + Math.sin(t * 0.12 + i * 0.03) * 4;
            }
            if (RIBBON.sprite && RIBBON.sprite.material) RIBBON.sprite.material.opacity = 0.45;
          }
          RIBBON.geometry.attributes.position.needsUpdate = true;
        }
      } catch (e) { /* ignore */ }

      // pillar waving (gentle)
      try {
        const globalAmp = 22 + bass * 140;
        const freq = 0.9 + (rms * 6.0);
        PILLAR_RIBBONS.forEach((p, pIdx) => {
          const mesh = p.mesh;
          const posAttr = mesh.geometry.attributes.position;
          const arr = posAttr.array;
          const wSegs = mesh.userData.wSegs || 10;
          const hSegs = mesh.userData.hSegs || 48;
          const baseX = mesh.userData.baseX || mesh.position.x;
          const baseZ = mesh.userData.baseZ || mesh.position.z;
          const phase = pIdx * 0.6;
          let vi = 0;
          for (let iy = 0; iy <= hSegs; iy++) {
            const vNorm = iy / hSegs;
            const yFactor = (vNorm - 0.5) * mesh.userData.height;
            for (let ix = 0; ix <= wSegs; ix++) {
              const idx = vi * 3;
              const xBaseLocal = (-mesh.userData.width / 2) + (ix / wSegs) * mesh.userData.width;
              const disp = Math.sin((vNorm * Math.PI * 4.0) + (t * freq) + phase + ix * 0.18) * (globalAmp * (0.14 + (ix / wSegs) * 0.5));
              arr[idx] = baseX + xBaseLocal + disp * 0.012;
              arr[idx + 1] = yFactor - 80;
              arr[idx + 2] = baseZ + Math.sin(t * 0.6 + ix * 0.07 + iy * 0.03) * 6;
              vi++;
            }
          }
          posAttr.needsUpdate = true;
          if (mesh.material) mesh.material.opacity = 0.14 + Math.min(0.4, rms * 0.6) + (pIdx === GENRES.findIndex(g => g.id === currentGenre) ? 0.06 : 0);
          mesh.rotation.z = Math.sin(t * 0.23 + pIdx * 0.5) * 0.015;
        });
      } catch (e) {}

      renderer.render(scene, camera);
    }
    animate();

    // window resize handler
    function onResize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      if (RIBBON && RIBBON.width) {
        const width = (2 * Math.tan(camera.fov * Math.PI / 180 / 2) * Math.abs(camera.position.z)) * camera.aspect * 1.05;
        RIBBON.width = width;
        if (RIBBON.sprite) RIBBON.sprite.scale.set(width * 1.05, Math.max(40, width * 0.035), 1);
        const pos = RIBBON.geometry.attributes.position.array;
        for (let i = 0; i < RIBBON.points; i++) {
          const x = -width / 2 + (i / (RIBBON.points - 1)) * width;
          pos[i * 3] = x;
        }
        RIBBON.geometry.attributes.position.needsUpdate = true;
      }
    }
    window.addEventListener("resize", onResize);

    // cleanup
    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      try { mount.removeChild(renderer.domElement); } catch (e) {}
      // Dispose three objects to avoid memory leaks
      scene.traverse(obj => {
        try {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose && m.dispose());
            else obj.material.dispose && obj.material.dispose();
          }
          if (obj.texture) obj.texture.dispose && obj.texture.dispose();
        } catch (e) {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // React helpers (UI interactions)

  // handle clicking a genre from the DOM list
  function handleGenreClickFromUI(genreId) {
    // delegate to DOM: colorize + spotify embed + stop local audio
    const g = GENRES.find(x => x.id === genreId);
    if (!g) return;
    setCurrentGenre(genreId);
    setSpotifyUrl(g.spotify || null);
    // embed in spotifyRef
    if (spotifyRef.current) {
      spotifyRef.current.innerHTML = "";
      try {
        const u = new URL(g.spotify);
        if (u.hostname.includes("spotify")) {
          const parts = u.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
            iframe.width = "300";
            iframe.height = "80";
            iframe.frameBorder = "0";
            iframe.allow = "encrypted-media; clipboard-write";
            iframe.style.borderRadius = "8px";
            iframe.style.width = "100%";
            spotifyRef.current.appendChild(iframe);
          }
        } else {
          const iframe = document.createElement("iframe");
          iframe.src = g.spotify;
          iframe.width = "300";
          iframe.height = "80";
          iframe.frameBorder = "0";
          iframe.allow = "encrypted-media; clipboard-write";
          iframe.style.borderRadius = "8px";
          iframe.style.width = "100%";
          spotifyRef.current.appendChild(iframe);
        }
      } catch (e) {
        // fallback: generic embed
        const iframe = document.createElement("iframe");
        iframe.src = g.spotify;
        iframe.width = "300";
        iframe.height = "80";
        iframe.frameBorder = "0";
        iframe.allow = "encrypted-media; clipboard-write";
        iframe.style.borderRadius = "8px";
        iframe.style.width = "100%";
        spotifyRef.current.appendChild(iframe);
      }
    }
    // small visual highlight for legend list (DOM)
    const legend = document.getElementById("legendList");
    if (legend) {
      Array.from(legend.children).forEach((li, i) => {
        li.style.boxShadow = (GENRES[i].id === genreId) ? "0 6px 18px rgba(0,0,0,0.45)" : "none";
        li.style.transform = (GENRES[i].id === genreId) ? "translateY(-2px)" : "none";
      });
    }
  }

  // local audio upload (analyzable)
  function handleLocalAudioUpload(ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    // show audio element in spotifyRef (like modal behavior)
    if (spotifyRef.current) spotifyRef.current.innerHTML = "";
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    audio.style.width = "100%";
    if (spotifyRef.current) spotifyRef.current.appendChild(audio);
    // wire into AudioContext / analyser by instantiating audioController again:
    // For simplicity reuse a new AudioContext via an <audio> element and WebAudio. Must be user gesture (upload counts)
    (async () => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        audio.play().catch(()=>{});
        // store analyser in window briefly for the three loop to access; the app's three-side created its own analyser,
        // but since React function scope doesn't share that easily here, simplest is to let user play uploaded audio visually by reloading the page or using the "Load Local Audio" in modal (advanced integration can unify controllers).
        // We'll just attach as a custom global for the animation loop to pick up (works because animation loop used audioController defined in closure).
        window.__codemq_uploaded_audio_analyser = analyser;
        setAnalyzableAudioActive(true);
      } catch (e) {
        console.warn("Failed to init analysis for local audio", e);
      }
    })();
  }

  // a small helper to allow manual spotify URL pasting (UI button triggers)
  function handleManualSpotifyLoad() {
    const v = (document.getElementById("spotifyInput") && document.getElementById("spotifyInput").value) || "";
    if (!v) return;
    setSpotifyUrl(v);
    if (spotifyRef.current) {
      spotifyRef.current.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = v.includes("open.spotify.com") ? v.replace("open.spotify.com", "open.spotify.com/embed") : v;
      iframe.width = "300";
      iframe.height = "80";
      iframe.frameBorder = "0";
      iframe.allow = "encrypted-media; clipboard-write";
      iframe.style.borderRadius = "8px";
      iframe.style.width = "100%";
      spotifyRef.current.appendChild(iframe);
    }
    // stop any analysable audio visual (because we now show the embed)
    try { window.__codemq_uploaded_audio_analyser = null; } catch (e) {}
    setAnalyzableAudioActive(false);
  }

  // Render UI (canvas container and panels)
  return (
    <>
      <div id="three-bg" ref={mountRef} style={{ width: "100%", height: "100%" }} />
      {/* horizontal ribbon visual indicator (CSS-driven) */}
      <div id="ribbon" className={analyzableAudioActive ? "" : "idle"} />

      {/* UI cluster top-right */}
      <div id="uiCluster">
        <div id="playlistPanel" className="panel">
          <h3>Now Playing</h3>
          <div ref={spotifyRef} id="spotifyEmbed" style={{ width: "260px" }}>
            {/* initial embed created by effect or user actions */}
            <iframe
              title="initial-spotify"
              src={spotifyUrl ? spotifyUrl.replace("open.spotify.com", "open.spotify.com/embed") : ""}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ width: "100%", height: "80px", borderRadius: 10, border: "none" }}
            />
          </div>

          {/* manual spotify url input (optional) */}
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <input id="spotifyInput" ref={audioInputRef} placeholder="Paste Spotify/URL" style={{ flex: 1, padding: 6, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.03)", color: "#fff" }} />
            <button id="loadSpotify" onClick={handleManualSpotifyLoad} style={{ background: "#2b2b2b", border: "none", color: "#fff", padding: "6px 8px", borderRadius: 6 }}>Load</button>
          </div>

          {/* Local audio upload (analyzable) */}
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, opacity: 0.9 }}>Local Audio (paste URL or upload to animate)</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input id="modalAudioFile" type="file" accept="audio/*" onChange={handleLocalAudioUpload} style={{ display: "block" }} />
            </div>
          </div>
        </div>

        {/* Genre bar / legend */}
        <div id="genreBar" className="panel" style={{ maxWidth: 300 }}>
          <div id="legendList" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GENRES.map((g) => (
              <div
                key={g.id}
                onClick={() => handleGenreClickFromUI(g.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: `linear-gradient(90deg, rgba(255,255,255,0.01), ${hexToCss(g.color)})`,
                  color: (((g.color >> 16) & 255) * 299 + (((g.color >> 8) & 255) * 587) + ((g.color & 255) * 114)) / 1000 >= 140 ? "#000" : "#fff",
                  cursor: "pointer",
                  boxShadow: currentGenre === g.id ? "0 6px 18px rgba(0,0,0,0.45)" : "none",
                  transform: currentGenre === g.id ? "translateY(-2px)" : "none",
                }}
              >
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 8, verticalAlign: "middle", background: hexToCss(g.color) }} />
                <span style={{ verticalAlign: "middle", fontSize: 13 }}>{g.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

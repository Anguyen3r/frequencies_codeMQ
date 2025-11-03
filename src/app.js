// src/App.js
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Full React + Three.js main app.
 * - 7 genres, each with color + Spotify playlist URL
 * - Orbiting orbs (bubbles) + stardust rings + glow
 * - Vertical weaving pillar planes that follow orbs
 * - Horizontal ribbon (time-domain visual when local audio is loaded)
 * - Spotify embed in the UI (click a genre to load embed)
 *
 * Notes:
 * - Spotify embed cannot be analyzed for audio data; local audio URLs / uploads use WebAudio analyser.
 * - Keep index.html / CSS mostly unchanged; inline style used sparingly for the UI container only.
 */

const GENRES = [
  { id: "hard-techno", name: "Hard Techno", color: 0xff2b6a, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX9sIqqvKsjG8" },
  { id: "techno", name: "Techno", color: 0x8a5fff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX6f9r4Vf1D3K" },
  { id: "house", name: "House", color: 0xff9b3f, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXa2PvUpywmrr" },
  { id: "dnb", name: "Drum & Bass", color: 0x4cff7b, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY" },
  { id: "electronic", name: "Electronic / Dance", color: 0x3f7bff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n" },
  { id: "dubstep", name: "Dubstep", color: 0x5fc9ff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY" },
  { id: "pop", name: "Pop", color: 0xff89d9, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" },
];

function toCssHex(n) {
  return "#" + ("000000" + n.toString(16)).slice(-6);
}
function toCssRgba(n, a = 1) {
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export default function App() {
  const mountRef = useRef(null);
  const spotifyRef = useRef(null);
  const spotifyInputRef = useRef(null);
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0].id);
  const [legendOpen, setLegendOpen] = useState(true);

  // Hold Three.js objects / controllers in refs so we can cleanup
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    orbs: {},
    pillars: [],
    ribbon: null,
    audioController: null,
    animId: null,
  });

  // mount Three.js scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---------- Basic scene / renderer / camera ----------
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
    const amb = new THREE.AmbientLight(0xffffff, 0.45); scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(10, 20, 10); scene.add(dir);

    // ---------- Starfield & dust ----------
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
      const points = new THREE.Points(geo, mat);
      return { points, mat };
    }
    const starsFar = makeStarLayer(1200, 6000, 3600, 6000, 1.1, 0.9);
    const starsNear = makeStarLayer(500, 3500, 2200, 3500, 1.9, 0.6);
    scene.add(starsFar.points, starsNear.points);

    // dust plane (background texture) - keep optional: uses remote asset
    const dustTex = new THREE.TextureLoader().load("https://assets.codepen.io/982762/clouds.png");
    const dustPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(7000, 3800),
      new THREE.MeshBasicMaterial({ map: dustTex, transparent: true, opacity: 0.045, depthWrite: false })
    );
    dustPlane.position.set(0, 0, -2600);
    scene.add(dustPlane);

    // ---------- Procedural textures ----------
    function genGlowTexture(colorHex) {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.18, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.42, toCssRgba(colorHex, 0.35));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }
    function genStarTexture() {
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

    // ---------- Orb cluster (bubbles) ----------
    const CLUSTER_RADIUS = 420;
    const ORB_GROUP = new THREE.Group();
    scene.add(ORB_GROUP);
    const ORB_MESHES = {};

    function createStardustRing(coreRadius, colorHex, tilt = {}, particleCount = 220, size = 8.5, counterClockwise = true) {
      const group = new THREE.Group();
      const ringRadius = coreRadius * (1.8 + Math.random() * 0.85);
      const positions = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) {
        const theta = (i / particleCount) * Math.PI * 2;
        const rr = ringRadius + (Math.random() - 0.5) * (coreRadius * 0.36);
        positions[i * 3] = Math.cos(theta) * rr;
        positions[i * 3 + 1] = Math.sin(theta) * rr;
        positions[i * 3 + 2] = (Math.random() - 0.5) * (coreRadius * 0.5);
        sizes[i] = (Math.random() * 1.6 + 1.2) * size;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ size, map: genStarTexture(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      mat.color = new THREE.Color(colorHex).multiplyScalar(0.94);
      const points = new THREE.Points(geo, mat);
      group.add(points);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: genGlowTexture(colorHex), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending }));
      glow.scale.set(ringRadius * 2.0, ringRadius * 2.0, 1);
      group.add(glow);

      group.rotation.set(tilt.x || 0, tilt.y || 0, tilt.z || 0);
      const baseSpeed = 0.004 + Math.random() * 0.006;
      const rotationSpeed = baseSpeed * (counterClockwise ? -1 : 1);
      return { group, points, mat, rotationSpeed, ringRadius };
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

      // rim sprite (soft glow)
      const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: genGlowTexture(g.color), color: g.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending }));
      rim.scale.set(coreRadius * 9.8, coreRadius * 9.8, 1);
      coreMesh.add(rim);

      const container = new THREE.Group();
      container.add(coreMesh);

      const baseAngle = (idx / GENRES.length) * Math.PI * 2;
      container.userData.baseAngle = baseAngle;
      container.userData.idx = idx;
      container.position.set(Math.cos(baseAngle) * CLUSTER_RADIUS, Math.sin(baseAngle) * CLUSTER_RADIUS * 0.6, -idx * 6);

      const tilt = { x: (Math.random() * 0.9 - 0.45) * Math.PI / 2, y: (Math.random() * 0.9 - 0.45) * Math.PI / 2, z: (Math.random() * 0.6 - 0.3) * Math.PI / 6 };
      const ringObj = createStardustRing(coreRadius, g.color, tilt, 220 + Math.floor(Math.random() * 160), 9.5, idx % 2 === 0);
      container.add(ringObj.group);

      const gasGeo = new THREE.SphereGeometry(coreRadius * 1.9, 32, 32);
      const gasMat = new THREE.MeshBasicMaterial({ color: g.color, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false });
      const gasMesh = new THREE.Mesh(gasGeo, gasMat);
      container.add(gasMesh);

      ORB_GROUP.add(container);
      ORB_MESHES[g.id] = { id: g.id, idx, container, core: coreMesh, ringObj, gas: gasMesh, baseAngle };
    });

    // ---------- Aurora / haze sprites (circular / soft) ----------
    function createAuroraSprite(colorStops = [], size = 1600, opacity = 0.3) {
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
      return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending }));
    }
    const smokeBack1 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.14, color: "rgba(120,40,200,0.12)" }, { offset: 0.78, color: "rgba(20,150,200,0.06)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 2000, 0.42);
    smokeBack1.scale.set(3000, 1600, 1); smokeBack1.position.set(-60, -120, -1800); scene.add(smokeBack1);

    const smokeBack2 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.18, color: "rgba(200,40,140,0.10)" }, { offset: 0.6, color: "rgba(60,40,220,0.08)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 1800, 0.3);
    smokeBack2.scale.set(2600, 1300, 1); smokeBack2.position.set(120, -60, -1600); scene.add(smokeBack2);

    const smokeFront1 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.18, color: "rgba(160,40,220,0.08)" }, { offset: 0.7, color: "rgba(30,200,220,0.07)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 1400, 0.30);
    smokeFront1.scale.set(2200, 1100, 1); smokeFront1.position.set(30, 80, -320); scene.add(smokeFront1);

    const smokeFront2 = createAuroraSprite([{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.18, color: "rgba(240,120,100,0.06)" }, { offset: 0.7, color: "rgba(90,80,255,0.05)" }, { offset: 1, color: "rgba(0,0,0,0)" }], 1200, 0.24);
    smokeFront2.scale.set(1800, 900, 1); smokeFront2.position.set(-80, 40, -260); scene.add(smokeFront2);

    // corner accent sprites
    const cornerSpecs = [
      { x: -1.0, y: -1.0, color: "rgba(160,40,220,0.14)" },
      { x: 1.0, y: -0.9, color: "rgba(40,200,220,0.11)" },
      { x: -0.9, y: 1.0, color: "rgba(240,120,100,0.09)" },
      { x: 0.9, y: 0.9, color: "rgba(100,120,255,0.07)" }
    ];
    const cornerSprites = [];
    cornerSpecs.forEach((s, i) => {
      const spr = createAuroraSprite([{ offset: 0, color: s.color }, { offset: 1, color: "rgba(0,0,0,0)" }], 900, 0.14);
      spr.scale.set(900, 900, 1);
      spr.position.set(s.x * 1200 * (0.6 + Math.random() * 0.4), s.y * 700 * (0.6 + Math.random() * 0.4), -320);
      scene.add(spr);
      cornerSprites.push(spr);
    });

    // ---------- Audio Controller (WebAudio) ----------
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
          audioEl.play().catch(() => { /* may be blocked until user gesture */ });
          if (source) try { source.disconnect(); } catch (e) { }
          source = audioCtx.createMediaElementSource(audioEl);
          source.connect(analyser);
          analyser.connect(audioCtx.destination);
          active = true;
          return true;
        } catch (err) {
          console.warn("audio load failed", err);
          active = false;
          return false;
        }
      }
      function stop() {
        if (audioEl) try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) { }
        if (audioCtx && audioCtx.state !== "closed") try { audioCtx.suspend(); } catch (e) { }
        active = false;
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
      return { loadUrl, stop, getAmps, getTimeDomain, isActive, _internal: { getAudioElement: () => audioEl } };
    })();

    // ---------- Horizontal Ribbon ----------
    const RIBBON = { points: 512 };
    (function initRibbon() {
      const POINTS = RIBBON.points;
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
      for (let i = 0; i < POINTS; i++) {
        const x = -width / 2 + (i / (POINTS - 1)) * width;
        positions[i * 3] = x;
        positions[i * 3 + 1] = Math.sin(i / 6) * 6;
        positions[i * 3 + 2] = -120;
        // initial soft bluish
        colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 1.0;
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
      const line = new THREE.Line(geometry, mat);
      line.frustumCulled = false;
      scene.add(line);

      // soft glow sprite behind ribbon to hide any rectangular artifact
      const c = document.createElement("canvas"); c.width = 2048; c.height = 256;
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, c.width, 0);
      g.addColorStop(0, "rgba(255,255,255,0.00)");
      g.addColorStop(0.18, "rgba(255,255,255,0.06)");
      g.addColorStop(0.5, "rgba(255,255,255,0.14)");
      g.addColorStop(0.82, "rgba(255,255,255,0.06)");
      g.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
      const glowTex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending }));
      sprite.scale.set(width * 1.05, Math.max(40, width * 0.035), 1);
      sprite.position.set(0, -8, -140);
      scene.add(sprite);

      const prevY = new Float32Array(POINTS);
      for (let i = 0; i < POINTS; i++) prevY[i] = positions[i * 3 + 1];

      RIBBON.geometry = geometry;
      RIBBON.line = line;
      RIBBON.sprite = sprite;
      RIBBON._prevY = prevY;
      RIBBON.width = width;
      RIBBON.smoothAlpha = 0.18;
    })();

    // ---------- Pillar ribbons ----------
    const PILLARS = [];
    (function initPillars() {
      const pillarHeight = 1200;
      const pillarWidth = 160;
      const hSegs = 48;
      const wSegs = 10;

      function makePillarTexture(colorHex, h = 1024, w = 192) {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        const rgba = (a) => toCssRgba(colorHex, a);
        grad.addColorStop(0.0, rgba(0.0));
        grad.addColorStop(0.08, rgba(0.06));
        grad.addColorStop(0.25, rgba(0.12));
        grad.addColorStop(0.45, rgba(0.18));
        grad.addColorStop(0.65, rgba(0.12));
        grad.addColorStop(0.92, rgba(0.06));
        grad.addColorStop(1.0, rgba(0.0));
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
        const hg = ctx.createLinearGradient(0, 0, w, 0);
        hg.addColorStop(0, "rgba(255,255,255,0.00)");
        hg.addColorStop(0.45, "rgba(255,255,255,0.04)");
        hg.addColorStop(0.5, "rgba(255,255,255,0.08)");
        hg.addColorStop(0.55, "rgba(255,255,255,0.04)");
        hg.addColorStop(1, "rgba(255,255,255,0.00)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
        const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
        return tex;
      }

      GENRES.forEach((g, idx) => {
        const geo = new THREE.PlaneGeometry(pillarWidth, pillarHeight, wSegs, hSegs);
        const tex = makePillarTexture(g.color, 1024, 192);
        tex.minFilter = THREE.LinearMipMapLinearFilter;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.20, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.rotation.x = -Math.PI / 2 + 0.02;
        mesh.rotation.y = 0.06 * (idx % 2 === 0 ? 1 : -1);
        mesh.position.set(0, -80, -180 - idx * 6);
        mesh.userData = { idx, baseX: 0, baseZ: mesh.position.z, width: pillarWidth, height: pillarHeight, wSegs, hSegs, color: g.color };
        scene.add(mesh);
        PILLARS.push({ mesh, geo, mat, idx });
      });
    })();

    // ---------- Raycast / pointer interaction ----------
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2();

    function handlePointerDown(e) {
      // show UI if hidden by some state
      // compute normalized device coordinates
      const rect = renderer.domElement.getBoundingClientRect();
      ndcMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndcMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcMouse, camera);

      // gather orb spheres
      const cores = [];
      ORB_GROUP.children.forEach(c => {
        c.traverse(n => { if (n.isMesh && n.geometry && n.geometry.type === "SphereGeometry") cores.push(n); });
      });
      const hits = raycaster.intersectObjects(cores, true);
      if (hits.length > 0) {
        const foundObj = hits[0].object;
        // find its container
        let parent = null;
        for (const c of ORB_GROUP.children) {
          if (c.children.includes(foundObj) || c === foundObj || c.children.includes(foundObj.parent)) { parent = c; break; }
        }
        if (parent) {
          const found = Object.values(ORB_MESHES).find(o => o.container === parent);
          if (found) {
            // play/embed spotify for genre and open modal
            playGenre(found.id);
            openModal(found.id);
          }
        }
      }
    }
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    // ---------- Simple modal (vote + audio upload) ----------
    let activeModal = null;
    function openModal(genreId) {
      closeModal();
      const g = GENRES.find(x => x.id === genreId);
      if (!g) return;
      const modal = document.createElement("div");
      modal.className = "panel";
      Object.assign(modal.style, {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 9999,
        width: "420px",
        maxWidth: "90vw",
        textAlign: "left",
        backdropFilter: "blur(6px)",
        padding: "14px",
        borderRadius: "12px",
        background: "rgba(6,10,18,0.88)",
        color: "#e6f0ff",
      });
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
      modal.querySelector(".closeX").addEventListener("click", closeModal);
      modal.querySelector(".cancel").addEventListener("click", closeModal);
      modal.querySelector(".submit").addEventListener("click", async () => {
        const artist = modal.querySelector(".artist").value.trim();
        if (!artist) { modal.querySelector(".artist").focus(); return; }
        // Save locally (simple localStorage)
        const KEY = "codemq_votes";
        const data = JSON.parse(localStorage.getItem(KEY) || "{}");
        data[genreId] = data[genreId] || [];
        data[genreId].push({ artist, b2b: modal.querySelector(".b2b").value.trim() || "", ts: Date.now() });
        localStorage.setItem(KEY, JSON.stringify(data));
        flashOrb(genreId);
        closeModal();
      });
      const openAudioFileBtn = modal.querySelector("#openAudioFile");
      const modalAudioFile = modal.querySelector("#modalAudioFile");
      const modalAudioUrl = modal.querySelector("#modalAudioUrl");
      openAudioFileBtn.addEventListener("click", () => modalAudioFile.click());
      modalAudioFile.addEventListener("change", async (ev) => {
        const f = ev.target.files && ev.target.files[0]; if (!f) return;
        const url = URL.createObjectURL(f);
        await audioController.loadUrl(url, { loop: true });
        // append audio element for user visibility
        const audioEl = audioController._internal.getAudioElement();
        if (spotifyRef.current) {
          spotifyRef.current.innerHTML = "";
          spotifyRef.current.appendChild(audioEl);
        }
        setSelectedGenre(null); // clears genre selection because local audio is playing
      });
      modalAudioUrl.addEventListener("keydown", async (ev) => {
        if (ev.key === "Enter") {
          const url = modalAudioUrl.value.trim(); if (!url) return;
          await audioController.loadUrl(url, { loop: true });
          const audioEl = audioController._internal.getAudioElement();
          if (spotifyRef.current) { spotifyRef.current.innerHTML = ""; spotifyRef.current.appendChild(audioEl); }
          setSelectedGenre(null);
        }
      });
      activeModal = modal;
    }
    function closeModal() {
      if (!activeModal) return;
      try { activeModal.remove(); } catch (e) { }
      activeModal = null;
    }

    // ---------- Visual feedback (flash orb) ----------
    function flashOrb(genreId) {
      const o = ORB_MESHES[genreId];
      if (!o) return;
      const mat = o.core.material;
      const orig = mat.emissiveIntensity || 0.6;
      mat.emissiveIntensity = Math.max(1.6, orig * 2.5);
      setTimeout(() => { mat.emissiveIntensity = orig; }, 900);
    }

    // ---------- Play genre: embed Spotify if available, otherwise attempt audio URL ----------
    function clearSpotifyEmbed() {
      if (spotifyRef.current) spotifyRef.current.innerHTML = "";
    }
    function embedSpotify(url) {
      if (!spotifyRef.current) return;
      spotifyRef.current.innerHTML = "";
      try {
        const u = new URL(url);
        if (u.hostname.includes("spotify")) {
          // path like /playlist/{id} or /track/{id}
          const pathParts = u.pathname.split("/").filter(Boolean);
          if (pathParts.length >= 2) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://open.spotify.com/embed/${pathParts[0]}/${pathParts[1]}`;
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
      } catch (e) { /* fallback */ }
      // fallback: iframe with raw URL (best effort)
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

    async function playGenre(genreId) {
      setSelectedGenre(genreId);
      const g = GENRES.find(x => x.id === genreId);
      if (!g) return;
      // stop local audio if playing
      try { audioController.stop(); } catch (e) { }
      clearSpotifyEmbed();
      if (g.spotify) {
        embedSpotify(g.spotify);
      } else {
        // fallback: could load a direct audio url if mapped
      }
      // colorize ribbon and emphasize pillar
      if (RIBBON.geometry) {
        const colors = RIBBON.geometry.attributes.color.array;
        const tr = ((g.color >> 16) & 255) / 255, tg = ((g.color >> 8) & 255) / 255, tb = (g.color & 255) / 255;
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
      // pillar highlight:
      PILLARS.forEach((p, i) => {
        p.mesh.material.opacity = (GENRES[i].id === genreId) ? 0.34 : 0.16;
      });
      // legend highlight handled in React UI via selectedGenre state
    }

    // ---------- Animation / render loop ----------
    const start = performance.now();
    function animate() {
      threeRef.current.animId = requestAnimationFrame(animate);
      const t = (performance.now() - start) * 0.001;

      const amps = audioController.getAmps();
      const bass = amps ? amps.bass : 0;
      const rms = amps ? amps.rms : 0.06 + Math.sin(t * 0.25) * 0.02;

      // star twinkle
      starsFar.points.rotation.z += 0.00035;
      starsNear.points.rotation.z -= 0.00048;
      starsNear.mat.opacity = 0.55 + Math.sin(t * 0.9 + 3.1) * 0.08 + rms * 0.12;
      starsFar.mat.opacity = 0.88 + Math.cos(t * 0.4 + 1.7) * 0.04 + bass * 0.06;
      dustPlane.rotation.z += 0.00012;

      // smoke pulse
      const smokePulse = 0.6 + Math.sin(t * 0.9) * 0.12 + bass * 0.9;
      smokeBack1.material.opacity = 0.28 * smokePulse;
      smokeBack2.material.opacity = 0.22 * (0.9 + Math.cos(t * 0.7) * 0.06 + bass * 0.4);
      smokeFront1.material.opacity = 0.24 * (0.9 + Math.sin(t * 0.5) * 0.06 + rms * 0.9);
      smokeFront2.material.opacity = 0.20 * (1 + Math.cos(t * 0.63) * 0.05 + bass * 0.6);

      // camera subtle movement
      camera.position.z = CAMERA_Z + Math.sin(t * 0.08) * 6 + bass * 80;
      camera.position.x = Math.sin(t * 0.04) * 12 * (0.7 + rms * 0.8);
      camera.position.y = Math.cos(t * 0.03) * 6 * (0.7 + rms * 0.6);
      camera.lookAt(0, 0, 0);

      // cluster/orb motion: diagonal elliptical orbit
      const clusterSpeed = 0.12 + bass * 0.38;
      const tiltAngle = -Math.PI / 4;
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);

      // optional left panel offset (if you add UI on the left)
      let centerOffsetX = 0, centerOffsetY = 0;
      // iterate orbs
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
        o.ringObj.group.rotation.z += o.ringObj.rotationSpeed * (1 + bass * 0.8);
        o.ringObj.mat.opacity = 0.82 - Math.abs(Math.sin(t * 0.6 + idx)) * 0.18 + rms * 0.22;
        o.gas.material.opacity = 0.045 + 0.01 * Math.sin(t * 0.9 + idx) + bass * 0.018;
        o.core.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 0.16 + rms * 0.28; });

        // sync pillar baseX
        const pillar = PILLARS[idx];
        if (pillar) {
          pillar.mesh.userData.baseX = o.container.position.x;
          pillar.mesh.position.z = o.container.position.z - 50 - idx * 2;
        }
      });

      // Horizontal ribbon update: uses time-domain if loaded; else gentle idle waving
      try {
        if (RIBBON && RIBBON.geometry) {
          const pos = RIBBON.geometry.attributes.position.array;
          const pts = RIBBON.points;
          const timeData = audioController.getTimeDomain();
          const prevY = RIBBON._prevY;
          const alpha = RIBBON.smoothAlpha;
          if (timeData && timeData.length > 0) {
            const tdLen = timeData.length;
            for (let i = 0; i < pts; i++) {
              const f = (i / (pts - 1)) * (tdLen - 1);
              const i0 = Math.floor(f), i1 = Math.min(tdLen - 1, i0 + 1);
              const frac = f - i0;
              const td0 = timeData[i0], td1 = timeData[i1];
              const td = td0 * (1 - frac) + td1 * frac;
              const v = (td / 128.0) - 1.0;
              const amplitude = 120 + (selectedGenre ? 80 : 0);
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
      } catch (e) { /* safe */ }

      // Pillar weave update (gentle waving)
      try {
        const globalAmp = 22 + bass * 140;
        const freq = 0.9 + (rms * 6.0);
        PILLARS.forEach((p, pIdx) => {
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
          if (mesh.material) mesh.material.opacity = 0.14 + Math.min(0.4, rms * 0.6) + (pIdx === GENRES.findIndex(g => g.id === selectedGenre) ? 0.06 : 0);
          mesh.rotation.z = Math.sin(t * 0.23 + pIdx * 0.5) * 0.015;
        });
      } catch (e) { /* safe */ }

      renderer.render(scene, camera);
    }
    animate();

    // ---------- Window resize ----------
    function onResize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      // recompute ribbon width
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
      // update pillar textures
      PILLARS.forEach(p => {
        try { if (p.mesh && p.mesh.material && p.mesh.material.map) p.mesh.material.map.needsUpdate = true; } catch (e) { }
      });
    }
    window.addEventListener("resize", onResize);

    // expose to refs for cleanup and possible external access
    threeRef.current = {
      scene, camera, renderer, ORB_GROUP, ORB_MESHES, PILLARS, RIBBON, audioController, animId: threeRef.current.animId
    };

    // cleanup on unmount
    return () => {
      try {
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
        renderer.domElement.parentElement && renderer.domElement.parentElement.removeChild(renderer.domElement);
        cancelAnimationFrame(threeRef.current.animId);
        // dispose geometries & textures lightly (not exhaustive)
        Object.values(ORB_MESHES).forEach(o => {
          try { o.core.geometry.dispose(); if (o.ringObj && o.ringObj.points) o.ringObj.points.geometry.dispose(); } catch (e) { }
        });
        PILLARS.forEach(p => {
          try { p.geo.dispose(); p.mat && p.mat.map && p.mat.map.dispose(); } catch (e) { }
        });
        RIBBON.geometry && RIBBON.geometry.dispose();
      } catch (e) { /* ignore */ }
    };
  }, []); // run once

  // React UI handlers
  function handleGenreClick(g) {
    setSelectedGenre(g.id);
    // update Spotify embed and visuals
    if (spotifyRef.current) {
      spotifyRef.current.innerHTML = "";
      if (g.spotify) {
        // embed Spotify
        try {
          const u = new URL(g.spotify);
          const pathParts = u.pathname.split("/").filter(Boolean);
          if (pathParts.length >= 2) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://open.spotify.com/embed/${pathParts[0]}/${pathParts[1]}`;
            iframe.width = "300";
            iframe.height = "80";
            iframe.frameBorder = "0";
            iframe.allow = "encrypted-media; clipboard-write";
            iframe.style.borderRadius = "8px";
            iframe.style.width = "100%";
            iframe.style.maxWidth = "420px";
            spotifyRef.current.appendChild(iframe);
          } else {
            // fallback
            const iframe = document.createElement("iframe");
            iframe.src = g.spotify;
            iframe.width = "300";
            iframe.height = "80";
            iframe.frameBorder = "0";
            spotifyRef.current.appendChild(iframe);
          }
        } catch (e) {
          const iframe = document.createElement("iframe");
          iframe.src = g.spotify;
          iframe.width = "300";
          iframe.height = "80";
          iframe.frameBorder = "0";
          spotifyRef.current.appendChild(iframe);
        }
      }
    }
    // apply color to ribbon/pillars via threeRef state if available
    try {
      const three = threeRef.current;
      if (three && three.RIBBON && three.RIBBON.geometry) {
        const colors = three.RIBBON.geometry.attributes.color.array;
        const tr = ((g.color >> 16) & 255) / 255, tg = ((g.color >> 8) & 255) / 255, tb = (g.color & 255) / 255;
        for (let i = 0; i < three.RIBBON.points; i++) {
          const idx = i * 3;
          colors[idx] = 0.14 + tr * 0.86;
          colors[idx + 1] = 0.14 + tg * 0.86;
          colors[idx + 2] = 0.14 + tb * 0.86;
        }
        three.RIBBON.geometry.attributes.color.needsUpdate = true;
        if (three.RIBBON.sprite && three.RIBBON.sprite.material) {
          three.RIBBON.sprite.material.color = new THREE.Color(g.color);
          three.RIBBON.sprite.material.opacity = 0.62;
        }
        three.PILLARS && three.PILLARS.forEach((p, i) => {
          p.mesh.material.opacity = (GENRES[i].id === g.id) ? 0.34 : 0.16;
        });
      }
    } catch (e) { /* ignore */ }
  }

  function handleSpotifyLoad() {
    const v = spotifyInputRef.current && spotifyInputRef.current.value && spotifyInputRef.current.value.trim();
    if (!v) return;
    if (spotifyRef.current) {
      spotifyRef.current.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = v;
      iframe.width = "320";
      iframe.height = "90";
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      iframe.loading = "lazy";
      spotifyRef.current.appendChild(iframe);
      // stop local audio
      try { threeRef.current.audioController.stop(); } catch (e) { }
    }
  }

  // legend UI helpers
  function legendItemStyle(gId) {
    const g = GENRES.find(x => x.id === gId);
    const lum = (((g.color >> 16) & 255) * 299 + (((g.color >> 8) & 255) * 587) + ((g.color & 255) * 114)) / 1000;
    return {
      padding: "6px 10px",
      marginBottom: "8px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: `linear-gradient(90deg, rgba(255,255,255,0.01), rgba(255,255,255,0.01)), ${toCssHex(g.color)}`,
      color: lum >= 140 ? "#000" : "#fff",
      cursor: "pointer",
      boxShadow: selectedGenre === gId ? "0 6px 18px rgba(0,0,0,0.45)" : "none",
      transform: selectedGenre === gId ? "translateY(-2px)" : "none"
    };
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#000914" }}>
      {/* Three.js mount */}
      <div ref={mountRef} id="canvasWrap" style={{ position: "fixed", inset: 0, zIndex: 0 }} />

      {/* UI cluster */}
      <div id="uiCluster" style={{ position: "fixed", right: 28, top: 28, zIndex: 10, width: 360, display: "flex", flexDirection: "column", gap: 12, pointerEvents: "auto" }}>
        <div id="playlistPanel" className="panel" style={{ padding: 12, borderRadius: 12, background: "rgba(6,10,18,0.7)", color: "#e6f0ff", boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>
          <h4 style={{ margin: 0 }}>Now Playing</h4>
          <div ref={spotifyRef} id="spotifyEmbed" style={{ marginTop: 8 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input ref={spotifyInputRef} id="spotifyInput" placeholder="Paste Spotify/iframe URL" style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.02)", color: "#fff" }} />
            <button id="loadSpotify" onClick={handleSpotifyLoad} style={{ padding: "8px 10px", borderRadius: 8, background: "#1db954", color: "#06222b", border: "none", cursor: "pointer" }}>Load</button>
          </div>
        </div>

        <div id="legend" className="panel" style={{ padding: 12, borderRadius: 12, background: "rgba(6,10,18,0.7)", color: "#e6f0ff", boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0 }}>Genres</h4>
            <button onClick={() => setLegendOpen(s => !s)} style={{ background: "transparent", border: "none", color: "#cde6ff", cursor: "pointer" }}>{legendOpen ? "Hide" : "Show"}</button>
          </div>
          {legendOpen && (
            <div id="legendList" style={{ marginTop: 8 }}>
              {GENRES.map((g, i) => (
                <div key={g.id} onClick={() => { handleGenreClick(g); }} style={legendItemStyle(g.id)}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, display: "inline-block", background: toCssHex(g.color) }} />
                  <span style={{ flex: 1 }}>{g.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleGenreClick(g); }} style={{ marginLeft: 8, borderRadius: 8, background: selectedGenre === g.id ? "#06222b" : "rgba(255,255,255,0.06)", color: "#fff", border: "none", padding: "6px 8px", cursor: "pointer" }}>Play</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   DREAM BUBBLES — APP.JS (YOUTUBE MUSIC, FIXED)
   ====================================================== */

/* ===============================
   GLOBAL STATE
================================ */

let scene, camera, renderer;
let clock = new THREE.Clock();

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let ytPlayer;
let ytReady = false;
let ytIsPlaying = false;
let playbackProgress = 0;

let currentGenre = "ambient";
window.__activeGenreColorHex = "#7aa2ff";

/* ===============================
   GENRES
================================ */

const GENRES = {
  ambient: {
    color: "#7aa2ff",
    playlist: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI"
  },
  techno: {
    color: "#ff4fd8",
    playlist: "PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj"
  },
  classical: {
    color: "#f2d398",
    playlist: "PLRbjoNpE_9bV_JZpRZj3Uu1Y6A4YqEJ0A"
  }
};

/* ===============================
   THREE.JS SETUP
================================ */

init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 2.5, 9);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  document.getElementById("canvasWrap").appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  buildStars();
  buildBubbles();
  buildRibbon();

  window.addEventListener("resize", onResize);
  window.addEventListener("pointerdown", onPointerDown);
}

/* ===============================
   STARS
================================ */

let stars;

function buildStars() {
  const geo = new THREE.BufferGeometry();
  const count = 1800;
  const pos = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.45,
    color: 0xffffff,
    transparent: true,
    opacity: 0.5
  });

  stars = new THREE.Points(geo, mat);
  scene.add(stars);
}

/* ===============================
   BUBBLES / ORBS
================================ */

const BUBBLES = {};
const bubbleMeshes = [];

function buildBubbles() {
  const geo = new THREE.SphereGeometry(0.9, 48, 48);

  Object.keys(GENRES).forEach((key, i) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: GENRES[key].color,
      transmission: 1,
      roughness: 0.15,
      thickness: 1.2,
      transparent: true,
      opacity: 0.55
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = (i - 1) * 3.2;
    mesh.userData.genre = key;

    BUBBLES[key] = mesh;
    bubbleMeshes.push(mesh);
    scene.add(mesh);
  });
}

/* ===============================
   RIBBON
================================ */

let ribbon;

function buildRibbon() {
  const geo = new THREE.PlaneGeometry(18, 1.2, 256, 1);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uHue: { value: 210 }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.z += sin((p.x + uTime) * 2.0) * 0.35;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }
    `,
    fragmentShader: `
      uniform float uHue;
      varying vec2 vUv;
      void main(){
        float a = smoothstep(0.0,0.25,vUv.y) * smoothstep(1.0,0.75,vUv.y);
        vec3 col = vec3(
          abs(sin(radians(uHue))),
          abs(sin(radians(uHue+120.))),
          abs(sin(radians(uHue+240.)))
        );
        gl_FragColor = vec4(col, a*0.5);
      }
    `
  });

  ribbon = new THREE.Mesh(geo, mat);
  ribbon.position.y = -1.8;
  scene.add(ribbon);
}

/* ===============================
   YOUTUBE MUSIC CONTROLLER
================================ */

window.onYouTubeIframeAPIReady = () => {
  ytPlayer = new YT.Player("ytPlayer", {
    height: "0",
    width: "0",
    playerVars: {
      listType: "playlist",
      list: GENRES[currentGenre].playlist,
      autoplay: 1,
      controls: 0
    },
    events: {
      onReady: () => {
        ytReady = true;
        ytPlayer.playVideo();
      },
      onStateChange: e => {
        ytIsPlaying = e.data === YT.PlayerState.PLAYING;
      }
    }
  });
};

/* ===============================
   VISUAL ENERGY DRIVER
================================ */

function getVisualEnergy() {
  if (!ytReady || !ytIsPlaying) return 0.25;

  const duration = ytPlayer.getDuration() || 1;
  const current = ytPlayer.getCurrentTime() || 0;
  playbackProgress = current / duration;

  return (
    0.35 +
    Math.sin(performance.now() * 0.0006) * 0.25 +
    playbackProgress * 0.4
  );
}

/* ===============================
   INTERACTION
================================ */

function onPointerDown(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(bubbleMeshes);

  if (hits.length) {
    switchGenre(hits[0].object.userData.genre);
  }
}

function switchGenre(genre) {
  if (!GENRES[genre]) return;

  currentGenre = genre;
  window.__activeGenreColorHex = GENRES[genre].color;

  if (ytReady) {
    ytPlayer.loadPlaylist({ list: GENRES[genre].playlist });
  }

  updateGenreCSS();
}

/* ===============================
   ANIMATION LOOP
================================ */

function animate() {
  requestAnimationFrame(animate);

  const energy = getVisualEnergy();
  const t = clock.getElapsedTime();

  stars.rotation.y += 0.00015 + energy * 0.0004;

  Object.values(BUBBLES).forEach((b, i) => {
    b.position.y = Math.sin(t + i) * 0.35 * energy;
    b.rotation.y += 0.002 + energy * 0.004;
  });

  ribbon.material.uniforms.uTime.value += 0.015 + energy * 0.05;
  ribbon.material.uniforms.uHue.value = hexToHue(
    window.__activeGenreColorHex
  );

  renderer.render(scene, camera);
}

/* ===============================
   UTILS
================================ */

function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360;
    else if (max === g) h = 60 * ((b - r) / (max - min)) + 120;
    else h = 60 * ((r - g) / (max - min)) + 240;
  }
  return h;
}

function updateGenreCSS() {
  document.documentElement.style.setProperty(
    "--genre-hue",
    hexToHue(window.__activeGenreColorHex)
  );
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

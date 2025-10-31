// app.js — Finalized version

// === Scene Setup ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 220);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("canvasWrap").appendChild(renderer.domElement);

// === Lighting ===
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
const point = new THREE.PointLight(0xffffff, 1.4);
point.position.set(50, 50, 80);
scene.add(ambient, point);

// === Global Parameters ===
let bubbles = [];
let stardusts = [];
let currentGenre = "pop";
let genreColors = {
  pop: 0xff66cc,
  techno: 0x00ffff,
  house: 0xff9900,
  trance: 0x9966ff,
  classical: 0xffffff,
  hiphop: 0xff4444,
  ambient: 0x66ffcc
};

// === Ribbon Setup ===
const ribbonGeometry = new THREE.PlaneGeometry(400, 3, 40, 1);
const ribbonMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(genreColors[currentGenre]) }
  },
  vertexShader: `
    uniform float time;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.y += sin(pos.x * 0.05 + time * 2.0) * 1.2;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying vec2 vUv;
    void main() {
      float alpha = 0.8 - abs(vUv.y - 0.5) * 1.6;
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true
});
const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
ribbon.rotation.x = -Math.PI / 2;
ribbon.position.z = -40;
scene.add(ribbon);

// === Bubble Creation ===
function createBubbles(count = 15) {
  const geo = new THREE.SphereGeometry(4, 32, 32);
  for (let i = 0; i < count; i++) {
    const col = new THREE.Color(genreColors[currentGenre]);
    const mat = new THREE.MeshPhysicalMaterial({
      color: col,
      emissive: col.clone().multiplyScalar(0.2),
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.8,
      transmission: 0.6,
      thickness: 0.8
    });
    const bubble = new THREE.Mesh(geo, mat);
    bubble.userData = {
      angle: Math.random() * Math.PI * 2,
      radius: 60 + Math.random() * 70,
      speed: 0.001 + Math.random() * 0.0015,
      offset: Math.random() * 50
    };
    scene.add(bubble);
    bubbles.push(bubble);

    // Stardust ring around bubble
    const ringGeo = new THREE.RingGeometry(5.5, 5.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: col,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    bubble.add(ring);
    stardusts.push(ring);
  }
}
createBubbles();

// === SoundCloud Playlist Embed ===
document.getElementById("loadSpotify").addEventListener("click", () => {
  const url = document.getElementById("spotifyInput").value.trim();
  if (!url) return;

  const embedHTML = `
    <iframe width="100%" height="120" scrolling="no" frameborder="no" allow="autoplay"
      src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23${new THREE.Color(genreColors[currentGenre]).getHexString()}&inverse=false&auto_play=false&show_user=true">
    </iframe>
  `;
  document.getElementById("spotifyEmbed").innerHTML = embedHTML;
});

// === Animation Loop ===
function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;
  ribbonMaterial.uniforms.time.value = t;

  // Move bubbles in forward orbit
  bubbles.forEach((b, i) => {
    const data = b.userData;
    data.angle += data.speed;
    const zForward = -Math.sin(t * 0.1 + data.offset) * 40;
    b.position.set(
      Math.cos(data.angle) * data.radius,
      Math.sin(data.angle * 1.3) * 20,
      zForward + Math.sin(t * 0.3 + i) * 10
    );
  });

  renderer.render(scene, camera);
}
animate();

// === Genre Tint Change ===
function setGenre(genre) {
  if (!genreColors[genre]) return;
  currentGenre = genre;
  const color = new THREE.Color(genreColors[genre]);
  ribbonMaterial.uniforms.color.value.copy(color);

  bubbles.forEach((b, i) => {
    const c = color.clone().offsetHSL(0, 0, Math.sin(i) * 0.05);
    b.material.color.copy(c);
    b.material.emissive.copy(c.clone().multiplyScalar(0.2));
    if (stardusts[i]) stardusts[i].material.color.copy(c);
  });

  document.querySelectorAll("#legend span").forEach((span) => {
    if (span.dataset.genre === genre)
      span.style.background = color.getStyle();
    else span.style.background = "rgba(255,255,255,0.08)";
  });
}

// === Window Resize ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Initialize UI Legends ===
const legendList = document.getElementById("legendList");
Object.keys(genreColors).forEach((g) => {
  const span = document.createElement("span");
  span.dataset.genre = g;
  span.textContent = g.charAt(0).toUpperCase() + g.slice(1);
  span.style.background = new THREE.Color(genreColors[g]).getStyle();
  span.addEventListener("click", () => setGenre(g));
  legendList.appendChild(span);
});

// Fade overlay (static)
window.addEventListener("load", () => {
  const overlay = document.getElementById("fadeOverlay");
  if (overlay) overlay.style.opacity = "0.95"; // permanent black tint
});

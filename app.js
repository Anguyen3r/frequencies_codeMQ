// app.js — Dream Bubbles / Music Atlas
// ------------------------------------

// === SETUP THREE.JS SCENE ===
const canvas = document.getElementById("canvas");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000010, 1);
document.body.appendChild(renderer.domElement);

// === LIGHTING ===
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(0, 0, 10);
scene.add(pointLight);

// === GENRES ===
const genres = [
  { name: "Hard Techno", color: 0xff0000, spotify: "https://open.spotify.com/embed/playlist/0FDNSowO1e6HHMGQqsQR8e" },
  { name: "Techno", color: 0xcc0000, spotify: "https://open.spotify.com/embed/playlist/3he7OajxdzoUoNzD44SVg3" },
  { name: "House", color: 0xffa500, spotify: "https://open.spotify.com/embed/playlist/3he7OajxdzoUoNzD44SVg3" },
  { name: "Drum & Bass", color: 0x00ff00, spotify: "https://open.spotify.com/embed/playlist/5oACj64SrftgiSuM2czyXz" },
  { name: "Dubstep", color: 0x8000ff, spotify: "https://open.spotify.com/embed/playlist/3Wf0rHKFtkJz0HhUKxKcK9" },
  { name: "Electronic / Dance", color: 0x0000ff, spotify: "https://open.spotify.com/embed/playlist/3iSpfyRtyMgfeNysn2B9Se" },
  { name: "Pop / International", color: 0xff66aa, spotify: "https://open.spotify.com/embed/playlist/5wfU7vYATfRPwLOl9h98K1" },
];

// === CREATE ORBS ===
const orbs = [];
const radius = 6;

genres.forEach((genre, i) => {
  const geometry = new THREE.SphereGeometry(0.5, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: genre.color,
    transparent: true,
    opacity: 0.3,
    emissive: genre.color,
    emissiveIntensity: 0.8,
  });
  const orb = new THREE.Mesh(geometry, material);
  orb.position.set(
    Math.cos((i / genres.length) * Math.PI * 2) * radius,
    Math.sin((i / genres.length) * Math.PI * 2) * radius,
    0
  );
  scene.add(orb);
  orbs.push({ mesh: orb, speed: i % 2 === 0 ? 0.002 : -0.002 });
});

// === STARFIELD BACKGROUND ===
const starGeometry = new THREE.BufferGeometry();
const starCount = 1000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 400;
}
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// === CAMERA CONTROLS ===
camera.position.z = 15;
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;

// === SPOTIFY PLAYER HANDLER ===
const spotifyFrame = document.getElementById("spotifyPlayer");
function setPlaylist(url) {
  spotifyFrame.src = url;
}

// === GENRE TOGGLE HANDLER ===
document.querySelectorAll(".genre").forEach((el, index) => {
  el.addEventListener("click", () => {
    const selected = genres[index];
    setPlaylist(selected.spotify);
  });
});

// === ANIMATION LOOP ===
function animate() {
  requestAnimationFrame(animate);

  stars.rotation.y += 0.0003;
  stars.rotation.x += 0.0001;

  orbs.forEach((orbObj, i) => {
    const angle = Date.now() * orbObj.speed + i;
    orbObj.mesh.position.x = Math.cos(angle) * radius;
    orbObj.mesh.position.y = Math.sin(angle) * radius;
    orbObj.mesh.rotation.y += 0.01;
  });

  controls.update();
  renderer.render(scene, camera);
}
animate();

// === RESPONSIVENESS ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

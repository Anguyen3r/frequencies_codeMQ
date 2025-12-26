console.log('app.js loaded');

//
// DOM guards (prevents null crashes)
//
const get = id => document.getElementById(id);

const canvasWrap   = get('canvasWrap');
const legendList   = get('legendList');
const genreSelect  = get('genreSelect');
const topList      = get('topList');
const leftPanel    = get('leftPanel');
const fadeOverlay  = get('fade-overlay');

//
// THREE.JS CORE
//
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
canvasWrap.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

//
// SIMPLE VISUAL (proof of life)
//
const geometry = new THREE.TorusKnotGeometry(1, 0.35, 128, 32);
const material = new THREE.MeshStandardMaterial({
  color: 0xff77aa,
  metalness: 0.4,
  roughness: 0.2
});
const knot = new THREE.Mesh(geometry, material);
scene.add(knot);

const light1 = new THREE.PointLight(0xffffff, 1);
light1.position.set(5, 5, 5);
scene.add(light1);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));

//
// RESIZE
//
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

//
// ANIMATE
//
function animate() {
  requestAnimationFrame(animate);
  knot.rotation.x += 0.003;
  knot.rotation.y += 0.004;
  controls.update();
  renderer.render(scene, camera);
}

animate();

//
// AUDIO (SAFE STUB — no SoundCloud crash)
//
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;

console.log('Three.js scene initialized');

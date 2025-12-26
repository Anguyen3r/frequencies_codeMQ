console.log('app.js loaded');

//
// DOM SAFETY
//
const get = id => document.getElementById(id);
const canvasWrap = get('canvasWrap');

if (!canvasWrap) {
  throw new Error('canvasWrap not found — check index.html');
}

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
controls.enablePan = false;

//
// LIGHTING
//
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const keyLight = new THREE.PointLight(0xffffff, 1);
keyLight.position.set(5, 5, 5);
scene.add(keyLight);

//
// RIBBON GEOMETRY
//
const RIBBON_POINTS = 120;
const RIBBON_RADIUS = 0.015;

const ribbonPoints = [];
for (let i = 0; i < RIBBON_POINTS; i++) {
  const t = i / RIBBON_POINTS;
  ribbonPoints.push(
    new THREE.Vector3(
      Math.sin(t * Math.PI * 4) * 1.2,
      Math.cos(t * Math.PI * 2) * 0.6,
      (t - 0.5) * 4
    )
  );
}

const ribbonCurve = new THREE.CatmullRomCurve3(ribbonPoints);

let ribbonGeometry = new THREE.TubeGeometry(
  ribbonCurve,
  300,
  RIBBON_RADIUS,
  3,
  false
);

const ribbonMaterial = new THREE.MeshStandardMaterial({
  color: 0xff88cc,
  emissive: 0x220011,
  roughness: 0.3,
  metalness: 0.6,
  side: THREE.DoubleSide
});

const ribbonMesh = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
scene.add(ribbonMesh);

//
// ANIMATION LOOP
//
let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  // Deform ribbon
  for (let i = 0; i < ribbonPoints.length; i++) {
    const t = i / ribbonPoints.length;
    ribbonPoints[i].x = Math.sin(t * Math.PI * 4 + time) * 1.2;
    ribbonPoints[i].y = Math.cos(t * Math.PI * 2 + time * 1.5) * 0.6;
  }

  ribbonCurve.points = ribbonPoints;

  // Rebuild geometry
  ribbonMesh.geometry.dispose();
  ribbonMesh.geometry = new THREE.TubeGeometry(
    ribbonCurve,
    300,
    RIBBON_RADIUS,
    3,
    false
  );

  ribbonMesh.rotation.z += 0.001;

  controls.update();
  renderer.render(scene, camera);
}

animate();

//
// RESIZE HANDLER
//
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('Ribbon initialized successfully');

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/controls/OrbitControls.js';

console.log('MODULE LOADED');

const canvasWrap = document.getElementById('canvasWrap');
if (!canvasWrap) throw new Error('canvasWrap missing');

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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const light = new THREE.PointLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

// ---------- RIBBON GEOMETRY ----------

const POINTS = 120;
const RADIUS = 0.015;
const ribbonPoints = [];

for (let i = 0; i < POINTS; i++) {
  const t = i / POINTS;
  ribbonPoints.push(
    new THREE.Vector3(
      Math.sin(t * Math.PI * 4) * 1.2,
      Math.cos(t * Math.PI * 2) * 0.6,
      (t - 0.5) * 4
    )
  );
}

const curve = new THREE.CatmullRomCurve3(ribbonPoints);

let mesh = new THREE.Mesh(
  new THREE.TubeGeometry(curve, 300, RADIUS, 3, false),
  new THREE.MeshStandardMaterial({
    color: 0xff88cc,
    emissive: 0x220011,
    metalness: 0.6,
    roughness: 0.3,
    side: THREE.DoubleSide
  })
);

scene.add(mesh);

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  for (let i = 0; i < ribbonPoints.length; i++) {
    const t = i / ribbonPoints.length;
    ribbonPoints[i].x = Math.sin(t * Math.PI * 4 + time) * 1.2;
    ribbonPoints[i].y = Math.cos(t * Math.PI * 2 + time * 1.5) * 0.6;
  }

  mesh.geometry.dispose();
  mesh.geometry = new THREE.TubeGeometry(curve, 300, RADIUS, 3, false);

  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('RIBBON RUNNING');

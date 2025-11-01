// app.js — Dream Bubbles: Seven-Genre System
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let planets = [];
let ribbons = [];
const numPlanets = 7;
const orbitRadius = 5;
const clock = new THREE.Clock();

// genre + color data
const genres = [
  { name: "Hard Techno", color: "#ff0033" },
  { name: "Techno", color: "#b066ff" },
  { name: "House", color: "#ffaa33" },
  { name: "Drum & Bass", color: "#00ff66" },
  { name: "Electronic/Dance", color: "#0066ff" },
  { name: "Dubstep", color: "#00ffff" },
  { name: "Pop", color: "#ff66cc" },
];

// init
function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000010, 0.04);

  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2, 10);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("canvas"), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000010, 1);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  const point = new THREE.PointLight(0xffffff, 1);
  point.position.set(0, 10, 10);
  scene.add(ambient, point);

  // horizontal ribbon
  const ribbonGeo = new THREE.PlaneGeometry(20, 0.15, 64, 1);
  const ribbonMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.position.set(0, 0, 0);
  ribbon.rotation.x = Math.PI / 2;
  scene.add(ribbon);

  // 7 vertical ribbons
  for (let i = 0; i < numPlanets; i++) {
    const { color } = genres[i];
    const gradMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const height = 8 + Math.random() * 2;
    const ribbonPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.25, height, 1, 64), gradMat);
    ribbonPlane.position.set((i - (numPlanets - 1) / 2) * 1.8, 0, -2);
    ribbons.push(ribbonPlane);
    scene.add(ribbonPlane);
  }

  // 7 planets
  for (let i = 0; i < numPlanets; i++) {
    const { color } = genres[i];
    const geo = new THREE.SphereGeometry(0.25 + Math.random() * 0.15, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.5,
      roughness: 0.4,
      emissive: new THREE.Color(color).multiplyScalar(0.3),
      transparent: true,
      opacity: 0.95,
    });
    const planet = new THREE.Mesh(geo, mat);
    planet.userData = {
      angle: Math.random() * Math.PI * 2,
      radius: orbitRadius + Math.random() * 0.8 - 0.4,
      speed: 0.2 + Math.random() * 0.15,
      offsetY: (Math.random() - 0.5) * 1.2,
    };
    scene.add(planet);
    planets.push(planet);
  }

  // starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2000;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPositions[i] = (Math.random() - 0.5) * 100;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0x8888ff,
    size: 0.05,
    transparent: true,
    opacity: 0.7,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  window.addEventListener("resize", onWindowResize);
  animate();
}

// handle resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// animation loop
function animate() {
  const elapsed = clock.getElapsedTime();

  // orbit motion: random but centered
  planets.forEach((planet, i) => {
    const data = planet.userData;
    data.angle += data.speed * 0.1;
    const randomDrift = Math.sin(elapsed * (0.2 + i * 0.05)) * 0.5;
    planet.position.x = Math.cos(data.angle + randomDrift) * data.radius;
    planet.position.y = Math.sin(elapsed * 0.8 + i) * 0.3 + data.offsetY;
    planet.position.z = Math.sin(data.angle + randomDrift) * data.radius * 0.6;
  });

  // weave motion for ribbons
  ribbons.forEach((r, i) => {
    r.rotation.z = Math.sin(elapsed * 0.4 + i) * 0.3;
    r.material.opacity = 0.25 + Math.sin(elapsed * 0.8 + i) * 0.1;
  });

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

init();

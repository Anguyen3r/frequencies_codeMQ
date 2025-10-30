// app.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js";

let scene, camera, renderer, bubbles = [], particles = [], smokeParticles = [];
let clock = new THREE.Clock();

init();
animate();

function init() {
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("canvasWrap").appendChild(renderer.domElement);

  // CAMERA — pulled further back but now moves dynamically
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 0, 500);

  // LIGHT
  const light = new THREE.PointLight(0xffffff, 2);
  light.position.set(0, 0, 400);
  scene.add(light);

  // BACKGROUND STARS
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 5000;
  const starPositions = [];
  for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 3000;
    const y = (Math.random() - 0.5) * 3000;
    const z = (Math.random() - 0.5) * 3000;
    starPositions.push(x, y, z);
  }
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.2,
    transparent: true,
    opacity: 0.8
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // GENRE BUBBLES
  const colors = [0xff005d, 0x00ffff, 0xfff700, 0x9d00ff, 0x00ff66, 0xff7b00];
  for (let i = 0; i < colors.length; i++) {
    const geometry = new THREE.SphereGeometry(35, 64, 64);
    const material = new THREE.MeshPhongMaterial({
      color: colors[i],
      transparent: true,
      opacity: 0.5,
      shininess: 100,
      emissive: colors[i],
      emissiveIntensity: 0.3
    });
    const bubble = new THREE.Mesh(geometry, material);
    const angle = (i / colors.length) * Math.PI * 2;
    bubble.position.set(Math.cos(angle) * 200, Math.sin(angle) * 120, (Math.random() - 0.5) * 100);
    scene.add(bubble);
    bubbles.push(bubble);

    // STAR DUST RING
    const ringGeometry = new THREE.BufferGeometry();
    const ringParticles = 300;
    const ringPositions = [];
    for (let j = 0; j < ringParticles; j++) {
      const theta = (j / ringParticles) * Math.PI * 2;
      const radius = 90 + Math.random() * 25;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius * 0.6;
      const z = (Math.random() - 0.5) * 40;
      ringPositions.push(x, y, z);
    }
    ringGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ringPositions, 3));
    const ringMaterial = new THREE.PointsMaterial({
      color: colors[i],
      size: 2.5,
      transparent: true,
      opacity: 0.9
    });
    const ring = new THREE.Points(ringGeometry, ringMaterial);
    bubble.add(ring);
    particles.push({ bubble, ring, direction: i % 2 === 0 ? 1 : -1 });
  }

  // SMOKE / NEBULA LAYER
  const smokeTexture = new THREE.TextureLoader().load("https://threejs.org/examples/textures/lava/cloud.png");
  const smokeMaterial = new THREE.SpriteMaterial({
    map: smokeTexture,
    color: 0x77aaff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending
  });
  for (let i = 0; i < 12; i++) {
    const smoke = new THREE.Sprite(smokeMaterial);
    smoke.scale.set(1000, 1000, 1);
    smoke.position.set(
      (Math.random() - 0.5) * 1500,
      (Math.random() - 0.5) * 1000,
      -600 + Math.random() * 400
    );
    scene.add(smoke);
    smokeParticles.push(smoke);
  }

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Move camera dynamically to simulate floating
  camera.position.x = Math.sin(t * 0.1) * 100;
  camera.position.y = Math.cos(t * 0.1) * 50;
  camera.lookAt(0, 0, 0);

  // Rotate entire scene cluster (the gyroscope effect)
  scene.rotation.y += 0.0015;
  scene.rotation.x += 0.0008;

  // Individual bubble movement
  bubbles.forEach((bubble, i) => {
    bubble.rotation.y += 0.004;
    bubble.rotation.x += 0.002;
    const orbitSpeed = 0.001 + i * 0.0003;
    const phase = t * orbitSpeed * 100;
    bubble.position.x = Math.cos(phase) * 200;
    bubble.position.y = Math.sin(phase) * 120;
    const { ring, direction } = particles[i];
    ring.rotation.z += 0.005 * direction;
  });

  // Smoke wave motion
  smokeParticles.forEach((smoke, i) => {
    smoke.rotation.z += 0.0008 * (i % 2 === 0 ? 1 : -1);
  });

  renderer.render(scene, camera);
}

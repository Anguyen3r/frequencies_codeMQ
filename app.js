// app.js — Dream Bubbles (merged version)

import * as THREE from 'three';

let scene, camera, renderer;
let bubbles = [];
let stardustRings = [];
let stars = [];
let clock = new THREE.Clock();

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000010, 0.0008);

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Camera setup — closer to gray original but with 3D depth
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
  camera.position.z = 650;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0x000010, 1);
  document.getElementById('canvasWrap').appendChild(renderer.domElement);

  // Lighting — soft ambient and directional
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(300, 400, 200);
  scene.add(dirLight);

  // Genre bubble colors (soft translucent glow)
  const colors = [0xff6b6b, 0x5f9eff, 0xffe66d, 0x9b5de5, 0x00bbf9, 0x00f5d4];

  const bubbleGeo = new THREE.SphereGeometry(60, 64, 64);
  const bubbleMat = colors.map(
    (c) =>
      new THREE.MeshPhongMaterial({
        color: c,
        transparent: true,
        opacity: 0.35,
        emissive: c,
        emissiveIntensity: 0.3,
        shininess: 100,
      })
  );

  for (let i = 0; i < colors.length; i++) {
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat[i]);
    bubble.position.x = Math.sin(i * 1.05) * 200;
    bubble.position.y = Math.cos(i * 1.2) * 180;
    bubble.position.z = Math.sin(i * 0.8) * 150;
    scene.add(bubble);
    bubbles.push(bubble);

    // Stardust ring around each bubble
    const ringGeo = new THREE.BufferGeometry();
    const ringCount = 250;
    const ringPositions = [];
    for (let j = 0; j < ringCount; j++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 90 + Math.random() * 15;
      const y = (Math.random() - 0.5) * 10;
      ringPositions.push(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      );
    }
    ringGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(ringPositions, 3)
    );
    const ringMat = new THREE.PointsMaterial({
      color: c,
      size: 3.5,
      opacity: 0.8,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Points(ringGeo, ringMat);
    bubble.add(ring);
    stardustRings.push(ring);
  }

  // Background stars
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const starPos = [];
  for (let i = 0; i < starCount; i++) {
    starPos.push(
      (Math.random() - 0.5) * 4000,
      (Math.random() - 0.5) * 4000,
      (Math.random() - 0.5) * 4000
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.5,
    transparent: true,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);
  stars.push(starField);

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Prompt on click — seamless modal (placeholder logic)
  document.addEventListener('click', () => {
    if (!document.getElementById('genrePrompt')) {
      const modal = document.createElement('div');
      modal.id = 'genrePrompt';
      modal.style.position = 'fixed';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.background = 'rgba(0,0,0,0.85)';
      modal.style.color = 'white';
      modal.style.padding = '20px 30px';
      modal.style.borderRadius = '12px';
      modal.style.textAlign = 'center';
      modal.style.zIndex = '999';
      modal.innerHTML =
        `<p>Who’s your favorite artist in this genre?<br><br>` +
        `<input id="artistInput" placeholder="Artist Name" style="padding:6px;border:none;border-radius:8px;width:80%;"><br><br>` +
        `<button id="closePrompt" style="background:#333;color:white;padding:6px 16px;border-radius:8px;">Submit</button>`;
      document.body.appendChild(modal);
      document.getElementById('closePrompt').onclick = () =>
        modal.remove();
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Bubble orbital motion
  bubbles.forEach((bubble, i) => {
    const speed = 0.2 + i * 0.05;
    bubble.position.x = Math.sin(t * speed + i) * 250;
    bubble.position.y = Math.cos(t * speed * 0.9 + i) * 200;
    bubble.position.z = Math.sin(t * speed * 1.2 + i) * 150;

    // Rotate bubble slightly
    bubble.rotation.x += 0.002;
    bubble.rotation.y -= 0.003;

    // Rotate ring opposite direction
    const ring = stardustRings[i];
    ring.rotation.y -= 0.004;
  });

  // Subtle pulsing fade for stars
  const pulse = Math.sin(t * 0.8) * 0.25 + 0.75;
  stars.forEach((sf) => (sf.material.opacity = pulse));

  renderer.render(scene, camera);
}

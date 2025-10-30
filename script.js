// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("canvasWrap").appendChild(renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// Bubbles data
const genres = [
  { color: 0x8ff7ff, name: "Techno" },
  { color: 0xff8fa3, name: "House" },
  { color: 0xb38bff, name: "Drum & Bass" },
  { color: 0xffe38f, name: "Dubstep" },
  { color: 0x8fffbc, name: "Electronic" },
  { color: 0xffaf8f, name: "Mainstream" }
];

const bubbles = [];
const stardusts = [];

genres.forEach((genre, i) => {
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshPhysicalMaterial({
    color: genre.color,
    metalness: 0.2,
    roughness: 0.3,
    transmission: 0.9,
    opacity: 0.7,
    transparent: true
  });
  const sphere = new THREE.Mesh(geometry, material);

  sphere.position.set(Math.cos(i) * 6, Math.sin(i) * 6, 0);
  sphere.userData = { name: genre.name };
  scene.add(sphere);
  bubbles.push(sphere);

  // Stardust
  const starGeo = new THREE.BufferGeometry();
  const starCount = 500;
  const starPositions = new Float32Array(starCount * 3);
  for (let j = 0; j < starCount; j++) {
    const r = 2.5 + Math.random() * 2;
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI;
    starPositions[j * 3] = Math.sin(b) * Math.cos(a) * r;
    starPositions[j * 3 + 1] = Math.sin(b) * Math.sin(a) * r;
    starPositions[j * 3 + 2] = Math.cos(b) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: genre.color,
    size: 0.08,
    transparent: true,
    opacity: 0.7
  });
  const starField = new THREE.Points(starGeo, starMat);
  sphere.add(starField);
  stardusts.push(starField);
});

camera.position.z = 15;

// Rotation variables
let angle = 0;

// Animate
function animate() {
  requestAnimationFrame(animate);
  angle += 0.002;

  bubbles.forEach((bubble, i) => {
    bubble.position.x = Math.cos(angle + i) * 6;
    bubble.position.y = Math.sin(angle + i) * 3;
    bubble.rotation.y += 0.01;
    stardusts[i].rotation.y -= 0.01; // opposite rotation
  });

  renderer.render(scene, camera);
}
animate();

// Click prompt
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(bubbles);
  if (intersects.length > 0) {
    document.getElementById("promptOverlay").classList.remove("hidden");
  }
}
window.addEventListener("click", onClick);

// Close button
document.getElementById("closePrompt").addEventListener("click", () => {
  document.getElementById("promptOverlay").classList.add("hidden");
});

// Responsive
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

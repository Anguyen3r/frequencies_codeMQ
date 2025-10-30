// --- Scene setup ---
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 50);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById("canvasWrap").appendChild(renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const pointLight = new THREE.PointLight(0xffffff, 1.2);
pointLight.position.set(0, 20, 20);
scene.add(pointLight);

// Optional orbit controls (for debugging)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false; // turn on only if you need debugging

// --- Create Bubbles ---
const bubbleCount = 40;
const bubbles = [];
const bubbleGroup = new THREE.Group();
scene.add(bubbleGroup);

for (let i = 0; i < bubbleCount; i++) {
  const radius = Math.random() * 1.5 + 0.8;

  // glowing material
  const color = new THREE.Color(
    `hsl(${Math.random() * 360}, 80%, 60%)`
  );
  const material = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color.clone().multiplyScalar(0.5),
    roughness: 0.3,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85,
  });

  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const mesh = new THREE.Mesh(geometry, material);

  // Random orbit setup
  const orbitRadius = Math.random() * 20 + 5;
  const speed = (Math.random() * 0.5 + 0.2) * (Math.random() < 0.5 ? 1 : -1);
  const verticalPhase = Math.random() * Math.PI * 2;
  const rotationAxis = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1
  ).normalize();

  bubbles.push({
    mesh,
    orbitRadius,
    angle: Math.random() * Math.PI * 2,
    speed,
    verticalPhase,
    rotationAxis,
  });

  bubbleGroup.add(mesh);
}

// --- Animate Background Gyroscopic Motion ---
let gyroscopeAngle = 0;

// --- Animation loop ---
function animate() {
  requestAnimationFrame(animate);

  gyroscopeAngle += 0.002;
  bubbleGroup.rotation.x = Math.sin(gyroscopeAngle * 0.5) * 0.3;
  bubbleGroup.rotation.y = Math.cos(gyroscopeAngle * 0.5) * 0.3;

  const time = performance.now() * 0.001;
  bubbles.forEach((b, i) => {
    b.angle += b.speed * 0.01;

    // circular orbit
    const x = Math.cos(b.angle) * b.orbitRadius;
    const z = Math.sin(b.angle) * b.orbitRadius;

    // vertical gyroscopic float
    const y = Math.sin(time * 0.8 + b.verticalPhase) * 5;

    b.mesh.position.set(x, y, z);
  });

  controls.update();
  renderer.render(scene, camera);
}

animate();

// --- Responsive Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Spotify / SoundCloud Embed Handler ---
const loadButton = document.getElementById("loadTrack");
const embedWrap = document.getElementById("embedWrap");
loadButton.addEventListener("click", () => {
  const input = document.getElementById("spotifyInput").value.trim();
  embedWrap.innerHTML = "";

  if (input.includes("spotify")) {
    // Spotify link
    const uri = input.includes("embed")
      ? input
      : `https://open.spotify.com/embed/playlist/${input.split("/").pop()}`;
    const iframe = document.createElement("iframe");
    iframe.src = uri;
    iframe.width = "100%";
    iframe.height = "380";
    iframe.frameBorder = "0";
    iframe.allow = "encrypted-media";
    embedWrap.appendChild(iframe);
  } else if (input.includes("soundcloud")) {
    // SoundCloud link
    const iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = "380";
    iframe.scrolling = "no";
    iframe.frameBorder = "no";
    iframe.allow = "autoplay";
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
      input
    )}&color=%23ff5500&auto_play=false`;
    embedWrap.appendChild(iframe);
  } else {
    embedWrap.textContent = "Please enter a valid Spotify or SoundCloud link.";
  }
});

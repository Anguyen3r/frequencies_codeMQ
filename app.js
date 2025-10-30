// === Setup scene ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById("canvasWrap").appendChild(renderer.domElement);

// === Lighting ===
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);
const pointLight = new THREE.PointLight(0xffffff, 2);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// === Genre Colors ===
const genreColors = [
  0xff007f, // Hard/Techno
  0xff8c00, // House
  0x00ffff, // Drum & Bass
  0x9400d3, // Dubstep
  0x7fff00, // Electronic
  0xffffff  // Mainstream
];

// === Create Orbs ===
const orbs = [];
const radius = 8; // orbital distance
genreColors.forEach((color, i) => {
  const geometry = new THREE.SphereGeometry(1.2, 64, 64);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2,
    transmission: 0.8,
    opacity: 0.7,
    transparent: true,
    roughness: 0.1,
    metalness: 0.2,
    clearcoat: 1.0
  });

  const orb = new THREE.Mesh(geometry, material);
  orb.userData = {
    angle: Math.random() * Math.PI * 2,
    speed: 0.002 + Math.random() * 0.001,
    direction: Math.random() > 0.5 ? 1 : -1
  };
  orb.position.set(
    Math.cos(orb.userData.angle) * radius,
    (Math.random() - 0.5) * 3,
    Math.sin(orb.userData.angle) * radius
  );
  scene.add(orb);
  orbs.push(orb);
});

// === Background Stars ===
const starCount = 800;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 200;
}
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

camera.position.z = 15;

// === Animate Scene ===
function animate() {
  requestAnimationFrame(animate);

  // Move background (nebula illusion)
  stars.rotation.y += 0.0003;
  stars.rotation.x += 0.0002;

  // Orbit motion for orbs
  orbs.forEach((orb) => {
    orb.userData.angle += orb.userData.speed * orb.userData.direction;
    orb.position.x = Math.cos(orb.userData.angle) * radius;
    orb.position.z = Math.sin(orb.userData.angle) * radius;
    orb.rotation.y += 0.005;
  });

  renderer.render(scene, camera);
}
animate();

// === Resize Handler ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Spotify/SoundCloud Embed ===
document.getElementById("loadSpotify").addEventListener("click", () => {
  const input = document.getElementById("spotifyInput").value.trim();
  const embedDiv = document.getElementById("spotifyEmbed");
  embedDiv.innerHTML = "";

  if (input.includes("spotify.com")) {
    const embedURL = input.replace("open.spotify.com", "open.spotify.com/embed");
    embedDiv.innerHTML = `<iframe src="${embedURL}" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
  } else if (input.includes("soundcloud.com")) {
    embedDiv.innerHTML = `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
    src="https://w.soundcloud.com/player/?url=${encodeURIComponent(input)}"></iframe>`;
  } else {
    embedDiv.textContent = "Invalid link. Paste a Spotify or SoundCloud link.";
  }
});

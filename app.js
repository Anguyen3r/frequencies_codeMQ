// === SCENE SETUP ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvasWrap').appendChild(renderer.domElement);

// === LIGHTING ===
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);
const point = new THREE.PointLight(0xffffff, 1);
point.position.set(20, 20, 20);
scene.add(point);

// === CAMERA ===
camera.position.z = 25;

// === GENRE COLORS ===
const genres = {
  Pop: 0xff66cc,
  Electronic: 0x66ccff,
  Techno: 0x9966ff,
  House: 0xffcc66,
  HipHop: 0xff6666,
  Ambient: 0x66ffcc,
};

const legendList = document.getElementById('legendList');
for (let [name, color] of Object.entries(genres)) {
  const li = document.createElement('li');
  const colorDot = document.createElement('span');
  colorDot.className = 'color';
  colorDot.style.backgroundColor = `#${color.toString(16)}`;
  li.appendChild(colorDot);
  li.append(name);
  legendList.appendChild(li);
}

// === BUBBLES ===
const bubbles = [];
for (let i = 0; i < 30; i++) {
  const genreKeys = Object.keys(genres);
  const randomGenre = genreKeys[Math.floor(Math.random() * genreKeys.length)];
  const color = genres[randomGenre];

  const geometry = new THREE.SphereGeometry(0.8 + Math.random() * 0.8, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.2,
    emissive: color,
    emissiveIntensity: 0.1,
  });
  const bubble = new THREE.Mesh(geometry, material);
  bubble.position.set(
    (Math.random() - 0.5) * 50,
    (Math.random() - 0.5) * 30,
    (Math.random() - 0.5) * 30
  );
  bubble.userData = { genre: randomGenre };
  scene.add(bubble);
  bubbles.push(bubble);
}

// === ANIMATION ===
function animate() {
  requestAnimationFrame(animate);
  bubbles.forEach(b => {
    b.position.y += Math.sin(Date.now() * 0.001 + b.position.x) * 0.002;
    b.rotation.y += 0.002;
  });
  renderer.render(scene, camera);
}
animate();

// === RESPONSIVE ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === SOUNDCLOUD EMBED ===
const loadSoundcloudBtn = document.getElementById('loadSoundcloud');
loadSoundcloudBtn.addEventListener('click', () => {
  const url = document.getElementById('soundcloudInput').value.trim();
  if (!url) return;
  const embed = document.getElementById('soundcloudEmbed');
  embed.innerHTML = `
    <iframe width="100%" height="300" scrolling="no" frameborder="no"
    allow="autoplay" 
    src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false">
    </iframe>
  `;
});

// app.js

import * as THREE from 'three';

let scene, camera, renderer;
let genreBubbles = [];
let artistBubbles = [];
let fadeOverlay, uiVisible = false;
let introPlayed = false;

// SoundCloud URLs
const introTrack = "https://soundcloud.com/user-200235414/wave-1";

// Generic playlists by genre (SoundCloud placeholders)
const genrePlaylists = {
  "Hard/Techno": "https://soundcloud.com/your-hard-techno-playlist",
  "House": "https://soundcloud.com/your-house-playlist",
  "Drum & Bass": "https://soundcloud.com/your-dnb-playlist",
  "Dubstep": "https://soundcloud.com/your-dubstep-playlist",
  "Electronic/Dance": "https://soundcloud.com/your-electronic-playlist",
  "Mainstream/International": "https://soundcloud.com/your-mainstream-playlist"
};

// Audio elements
const audio = new Audio();
audio.volume = 0.7;
audio.loop = false;

// Fade overlay for intro
const fadeDiv = document.createElement('div');
fadeDiv.style.position = 'fixed';
fadeDiv.style.top = '0';
fadeDiv.style.left = '0';
fadeDiv.style.width = '100vw';
fadeDiv.style.height = '100vh';
fadeDiv.style.background = 'rgba(0, 0, 0, 0.8)';
fadeDiv.style.transition = 'opacity 1.5s ease';
fadeDiv.style.zIndex = '9999';
document.body.appendChild(fadeDiv);

// Start fade and intro music
function playIntro() {
  if (!introPlayed) {
    introPlayed = true;
    audio.src = introTrack;
    audio.play().catch(e => console.log("Autoplay blocked:", e));
    setTimeout(() => fadeDiv.style.opacity = '0', 100);
    setTimeout(() => fadeDiv.remove(), 1500);
    setTimeout(() => showUI(), 1800);
  }
}

// Initialize scene
function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 15;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  createGenreBubbles();
  animate();
}

// Create genre bubbles in a tilted diagonal orbit
function createGenreBubbles() {
  const genres = Object.keys(genrePlaylists);
  const geometry = new THREE.SphereGeometry(0.8, 32, 32);

  genres.forEach((genre, i) => {
    const color = new THREE.Color(`hsl(${(i * 60) % 360}, 70%, 60%)`);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      roughness: 0.3,
      metalness: 0.5
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(
      Math.cos(i) * 6,
      Math.sin(i) * 2,
      Math.sin(i * 2) * 3
    );
    sphere.userData = { genre, direction: i % 2 === 0 ? 1 : -1 };
    scene.add(sphere);
    genreBubbles.push(sphere);
  });

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 1.2);
  pointLight.position.set(5, 10, 10);
  scene.add(pointLight);

  window.addEventListener('click', onGenreClick);
}

// Handle genre click
function onGenreClick(event) {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(genreBubbles);

  if (intersects.length > 0) {
    const clicked = intersects[0].object;
    const genre = clicked.userData.genre;
    loadGenrePlaylist(genre);
  }
}

// Switch to genre playlist
function loadGenrePlaylist(genre) {
  const url = genrePlaylists[genre];
  audio.src = url;
  audio.loop = true;
  audio.play().catch(e => console.log("Autoplay blocked:", e));

  // Glow effect and focus
  genreBubbles.forEach(b => {
    b.material.emissive = new THREE.Color(0x000000);
  });
  const clicked = genreBubbles.find(b => b.userData.genre === genre);
  clicked.material.emissive = new THREE.Color(0xffffff);
}

// Show UI elements
function showUI() {
  if (uiVisible) return;
  uiVisible = true;

  const playlistDiv = document.createElement('div');
  playlistDiv.id = 'playlist';
  playlistDiv.style.position = 'absolute';
  playlistDiv.style.top = '20px';
  playlistDiv.style.right = '30px';
  playlistDiv.style.padding = '12px 20px';
  playlistDiv.style.background = 'rgba(0, 0, 0, 0.4)';
  playlistDiv.style.borderRadius = '12px';
  playlistDiv.style.backdropFilter = 'blur(6px)';
  playlistDiv.style.color = '#fff';
  playlistDiv.style.fontFamily = 'monospace';
  playlistDiv.style.border = '1px solid rgba(255,255,255,0.15)';
  playlistDiv.innerHTML = `<h3>Playlist</h3><p>Click a bubble to switch genre.</p>`;
  playlistDiv.style.transition = 'opacity 1.5s ease';
  playlistDiv.style.opacity = '0';
  document.body.appendChild(playlistDiv);
  setTimeout(() => playlistDiv.style.opacity = '1', 500);

  // Add genre legend under playlist
  const legendDiv = document.createElement('div');
  legendDiv.id = 'legend';
  legendDiv.style.marginTop = '10px';
  legendDiv.style.display = 'flex';
  legendDiv.style.flexWrap = 'wrap';
  legendDiv.style.gap = '6px';
  legendDiv.style.opacity = '0.9';
  Object.keys(genrePlaylists).forEach((genre, i) => {
    const item = document.createElement('span');
    item.textContent = genre;
    item.style.padding = '4px 8px';
    item.style.borderRadius = '8px';
    item.style.background = `linear-gradient(90deg, hsl(${(i * 60) % 360}, 60%, 45%), hsl(${(i * 60 + 30) % 360}, 70%, 55%))`;
    item.style.color = '#fff';
    item.style.fontSize = '0.85em';
    item.style.fontWeight = '500';
    legendDiv.appendChild(item);
  });
  playlistDiv.appendChild(legendDiv);
}

// Animate bubbles
function animate() {
  requestAnimationFrame(animate);
  const time = Date.now() * 0.0004;

  genreBubbles.forEach((bubble, i) => {
    const radiusX = 6;
    const radiusY = 3;
    const speed = 0.2 * bubble.userData.direction;
    bubble.position.x = radiusX * Math.cos(time + i);
    bubble.position.y = radiusY * Math.sin(time * speed + i);
    bubble.rotation.y += 0.005;
    bubble.rotation.x += 0.003;
  });

  renderer.render(scene, camera);
}

// Start app
window.addEventListener('load', () => {
  init();
  playIntro();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

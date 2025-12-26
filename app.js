console.log('app.js loaded');

let scene, camera, renderer, controls;
let sphere;

init();
animate();

function init() {
  const container = document.getElementById('canvasWrap');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050508);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Test geometry (proof of life)
  const geo = new THREE.SphereGeometry(1, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x88aaff,
    metalness: 0.2,
    roughness: 0.4
  });
  sphere = new THREE.Mesh(geo, mat);
  scene.add(sphere);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 5, 5);
  scene.add(dir);

  // Resize
  window.addEventListener('resize', onResize);
}

function animate() {
  requestAnimationFrame(animate);

  sphere.rotation.y += 0.003;
  sphere.rotation.x += 0.0015;

  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

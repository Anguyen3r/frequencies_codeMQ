const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvasWrap').appendChild(renderer.domElement);

const bubbles = [];
const bubbleCount = 6;
const colors = [0xffc0cb, 0x87cefa, 0xffb6c1, 0xc0ffee, 0xf0e68c, 0xd8bfd8];

for (let i = 0; i < bubbleCount; i++) {
  const geometry = new THREE.SphereGeometry(0.8, 32, 32);
  const material = new THREE.MeshPhongMaterial({
    color: colors[i % colors.length],
    transparent: true,
    opacity: 0.8,
    shininess: 100,
  });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
  scene.add(sphere);
  bubbles.push(sphere);
}

const light = new THREE.PointLight(0xffffff, 2);
light.position.set(10, 10, 10);
scene.add(light);

camera.position.z = 6;

function animate() {
  requestAnimationFrame(animate);
  bubbles.forEach((bubble, i) => {
    const time = Date.now() * 0.001 + i;
    bubble.position.x = Math.sin(time) * 2.5;
    bubble.position.y = Math.cos(time * 0.9) * 2.5;
    bubble.position.z = Math.sin(time * 1.1) * 1.5;
  });
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==== App.js ====

document.addEventListener("DOMContentLoaded", () => {
  // Create the main scene container
  const scene = document.createElement("div");
  scene.classList.add("scene");
  document.body.appendChild(scene);

  // Create the central ribbon pillar
  const ribbon = document.createElement("div");
  ribbon.classList.add("ribbon");
  scene.appendChild(ribbon);

  // Generate ambient floating light particles
  const particleCount = 40;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.classList.add("particle");

    // Random placement and motion
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = `${Math.random() * 100}vh`;
    particle.style.animationDelay = `${Math.random() * 8}s`;
    particle.style.opacity = `${0.2 + Math.random() * 0.6}`;
    particle.style.transform = `scale(${0.8 + Math.random() * 1.2})`;

    scene.appendChild(particle);
  }
});

const canvas = document.getElementById("space");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Define 6 orbs (genres)
const genres = [
  { color: "rgba(255, 80, 80, 0.6)", name: "Hard/Techno" },
  { color: "rgba(80, 255, 120, 0.6)", name: "House" },
  { color: "rgba(80, 160, 255, 0.6)", name: "Drum & Bass" },
  { color: "rgba(255, 200, 80, 0.6)", name: "Dubstep" },
  { color: "rgba(180, 80, 255, 0.6)", name: "Electronic" },
  { color: "rgba(255, 255, 255, 0.6)", name: "Mainstream" }
];

let orbs = genres.map((g, i) => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  radius: 70,
  dx: (Math.random() - 0.5) * 2,
  dy: (Math.random() - 0.5) * 2,
  color: g.color,
  name: g.name
}));

function drawOrb(orb) {
  const gradient = ctx.createRadialGradient(orb.x, orb.y, orb.radius * 0.3, orb.x, orb.y, orb.radius);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.3, orb.color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
  ctx.fill();
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // subtle star background
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = "rgba(255,255,255," + Math.random() * 0.2 + ")";
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
  }

  orbs.forEach((orb) => {
    orb.x += orb.dx;
    orb.y += orb.dy;
    if (orb.x + orb.radius > canvas.width || orb.x - orb.radius < 0) orb.dx *= -1;
    if (orb.y + orb.radius > canvas.height || orb.y - orb.radius < 0) orb.dy *= -1;
    drawOrb(orb);
  });

  requestAnimationFrame(animate);
}

animate();

// Interaction
const popup = document.getElementById("popup");
const artistInput = document.getElementById("artistInput");
const genreTitle = document.getElementById("genreTitle");
const submitArtist = document.getElementById("submitArtist");

canvas.addEventListener("click", (e) => {
  const clickedOrb = orbs.find(
    (o) => Math.hypot(o.x - e.clientX, o.y - e.clientY) < o.radius
  );
  if (clickedOrb) {
    genreTitle.textContent = `Favorite Artist (${clickedOrb.name})`;
    popup.classList.remove("hidden");
  }
});

submitArtist.addEventListener("click", () => {
  popup.classList.add("hidden");
  artistInput.value = "";
});

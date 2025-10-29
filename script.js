// Nebula stars
const canvas = document.getElementById("space");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const stars = Array.from({ length: 250 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.5,
  color: `rgba(${100 + Math.random()*155}, ${100 + Math.random()*155}, 255, ${Math.random()})`
}));

function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 100, canvas.width/2, canvas.height/2, 600);
  grad.addColorStop(0, "#1a002a");
  grad.addColorStop(1, "#000010");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  stars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
  });

  requestAnimationFrame(drawStars);
}
drawStars();

// Orbs modal behavior
const orbs = document.querySelectorAll(".orb");
const modal = document.getElementById("promptModal");
const closeBtn = document.getElementById("closeBtn");
const submitBtn = document.getElementById("submitBtn");

orbs.forEach(orb => {
  orb.addEventListener("click", () => {
    modal.style.display = "flex";
  });
});

closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

submitBtn.addEventListener("click", () => {
  const artist = document.getElementById("artistInput").value;
  const b2b = document.getElementById("b2bInput").value;
  alert(`Submitted: ${artist} wants B2B with ${b2b}`);
  modal.style.display = "none";
});


const space = document.querySelector('.space');
const numOrbs = 15;

function randomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 100%, 70%)`;
}

for (let i = 0; i < numOrbs; i++) {
  const orb = document.createElement('div');
  orb.classList.add('orb');
  
  const size = Math.random() * 100 + 60;
  orb.style.width = `${size}px`;
  orb.style.height = `${size}px`;

  orb.style.background = `
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), transparent 70%),
    radial-gradient(circle at center, ${randomColor()}80, ${randomColor()}20)
  `;

  orb.style.left = `${Math.random() * 100}%`;
  orb.style.top = `${Math.random() * 100}%`;

  orb.style.animationDuration = `${8 + Math.random() * 8}s`;
  orb.style.animationDelay = `${Math.random() * 4}s`;

  space.appendChild(orb);
}

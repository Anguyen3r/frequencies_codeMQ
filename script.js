const container = document.querySelector('.orb-container');
const numOrbs = 15; // number of floating orbs

for (let i = 0; i < numOrbs; i++) {
  const orb = document.createElement('div');
  orb.classList.add('orb');

  // random position
  orb.style.top = `${Math.random() * 100}%`;
  orb.style.left = `${Math.random() * 100}%`;

  // random size
  const size = 30 + Math.random() * 60;
  orb.style.width = `${size}px`;
  orb.style.height = `${size}px`;

  // random blue/purple/cyan hue
  const hue = 180 + Math.random() * 120;
  orb.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), hsla(${hue}, 100%, 60%, 0.3) 60%, rgba(0,0,0,0.1) 100%)`;
  orb.style.boxShadow = `
    0 0 25px hsla(${hue}, 100%, 60%, 0.6),
    inset 0 0 15px rgba(255,255,255,0.3)
  `;

  // random animation speed and delay
  orb.style.animationDuration = `${8 + Math.random() * 5}s, ${3 + Math.random() * 3}s`;
  orb.style.animationDelay = `${Math.random() * 5}s`;

  container.appendChild(orb);
}

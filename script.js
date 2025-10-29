const orbs = document.querySelectorAll('.orb');
const promptBox = document.getElementById('prompt');
const closePrompt = document.getElementById('closePrompt');

orbs.forEach(orb => {
  orb.style.left = `${Math.random() * 80 + 10}%`;
  orb.style.top = `${Math.random() * 80 + 10}%`;
  animateOrb(orb);

  orb.addEventListener('click', () => {
    promptBox.classList.remove('hidden');
  });
});

closePrompt.addEventListener('click', () => {
  promptBox.classList.add('hidden');
});

function animateOrb(orb) {
  const randomX = (Math.random() - 0.5) * 40;
  const randomY = (Math.random() - 0.5) * 40;
  const duration = 5000 + Math.random() * 3000;

  orb.animate([
    { transform: 'translate(0,0)' },
    { transform: `translate(${randomX}px, ${randomY}px)` },
    { transform: 'translate(0,0)' }
  ], {
    duration: duration,
    iterations: Infinity,
    easing: 'ease-in-out'
  });
}

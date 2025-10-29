document.querySelectorAll(".bubble").forEach((bubble, i) => {
  const radius = 200 + i * 40;
  let angle = Math.random() * Math.PI * 2;

  function orbit() {
    angle += 0.003 + Math.random() * 0.002;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    bubble.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(orbit);
  }
  orbit();

  bubble.addEventListener("click", () => {
    const genre = bubble.dataset.genre;
    const artist = prompt(`You selected ${genre}. Who is your favorite artist?`);
    if (artist) alert(`Thank you for choosing ${artist} in ${genre}!`);
  });
});

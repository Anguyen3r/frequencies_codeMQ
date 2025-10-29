const colors = ['#ff5f5f', '#ffbf5f', '#5fff85', '#5fc9ff', '#9f5fff', '#fff75f'];
const numBubbles = 6;

for (let i = 0; i < numBubbles; i++) {
  const bubble = document.createElement('div');
  const size = 120 + Math.random() * 80;
  bubble.className = 'bubble';
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.background = colors[i];
  bubble.style.left = Math.random() * (window.innerWidth - size) + 'px';
  bubble.style.top = Math.random() * (window.innerHeight - size) + 'px';
  bubble.onclick = () => alert(`You clicked bubble ${i + 1}`);
  document.body.appendChild(bubble);
}

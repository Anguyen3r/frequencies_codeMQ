document.querySelectorAll('.orb').forEach((orb, index) => {
  orb.style.left = `${15 + index * 12}%`;
  orb.style.top = `${40 + Math.sin(index) * 15}%`;
  orb.addEventListener('mouseover', () => {
    orb.style.transform = 'scale(1.3)';
    orb.style.boxShadow = '0 0 60px rgba(0,200,255,0.8)';
  });
  orb.addEventListener('mouseout', () => {
    orb.style.transform = '';
    orb.style.boxShadow = '';
  });
});

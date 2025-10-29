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
const colors = [
  'rgba(255, 80, 80, 0.6)',   // red
  'rgba(255, 180, 70, 0.6)',  // orange
  'rgba(255, 255, 100, 0.6)', // yellow
  'rgba(100, 255, 150, 0.6)', // green
  'rgba(120, 180, 255, 0.6)', // blue
  'rgba(200, 120, 255, 0.6)'  // violet
];

document.querySelectorAll('.orb').forEach((orb, index) => {
  orb.style.left = `${15 + index * 12}%`;
  orb.style.top = `${40 + Math.sin(index) * 15}%`;
  orb.style.setProperty('--orb-color', colors[index % colors.length]);
  orb.addEventListener('mouseover', () => {
    orb.style.transform = 'scale(1.3)';
    orb.style.boxShadow = `0 0 60px ${colors[index % colors.length]}`;
  });
  orb.addEventListener('mouseout', () => {
    orb.style.transform = '';
    orb.style.boxShadow = '';
  });
});

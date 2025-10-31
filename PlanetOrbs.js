import React, { useEffect, useRef } from "react";

const genres = [
  { name: "Hard Techno", color: "#ff0000", ring: "#00ffff" }, // red & cyan
  { name: "Techno", color: "#8000ff", ring: "#ffff00" }, // purple & yellow
  { name: "House", color: "#ff8000", ring: "#00bfff" }, // orange & blue
  { name: "Drum & Bass", color: "#00ff00", ring: "#ff00ff" }, // green & magenta
  { name: "Dubstep", color: "#00ffff", ring: "#ff6600" }, // cyan & orange
  { name: "Electronic / Dance", color: "#0f52ba", ring: "#ffcc00" }, // sapphire & gold
  { name: "Pop / International", color: "#ff66aa", ring: "#66ffff" }, // pink & aqua
];

const PlanetOrbs = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let time = 0;
    const orbs = genres.map((g, i) => ({
      ...g,
      radius: 40 + Math.random() * 10,
      orbitRadius: 120 + i * 50,
      angle: Math.random() * Math.PI * 2,
      speed: 0.002 + i * 0.0003,
    }));

    const drawStars = (x, y, radius, color, count = 60) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const distance = radius + Math.sin(time * 0.02 + i) * 4;
        const starX = x + Math.cos(angle) * distance;
        const starY = y + Math.sin(angle) * distance;
        ctx.beginPath();
        ctx.arc(starX, starY, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 0.05 + i);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      orbs.forEach((orb, i) => {
        orb.angle += orb.speed;
        const x = centerX + Math.cos(orb.angle) * orb.orbitRadius;
        const y = centerY + Math.sin(orb.angle) * orb.orbitRadius * 0.6;

        // Stardust ring
        drawStars(x, y, orb.orbitRadius * 0.6, orb.ring, 120);

        // Orb glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, orb.radius * 2);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, orb.radius * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core planet
        ctx.beginPath();
        ctx.arc(x, y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = orb.color;
        ctx.shadowColor = orb.color;
        ctx.shadowBlur = 30;
        ctx.fill();

        // Genre label
        ctx.font = "600 13px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 0;
        ctx.fillText(orb.name, x, y + orb.radius + 18);
      });

      time += 1;
      requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1, // Above NebulaWave
        pointerEvents: "none",
      }}
    />
  );
};

export default PlanetOrbs;
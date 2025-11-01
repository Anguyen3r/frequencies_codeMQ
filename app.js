import React, { useEffect, useRef } from "react";
import "./App.css";

function App() {
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

    // --- Stars ---
    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2,
      opacity: Math.random(),
    }));

    // --- Planets ---
    const planets = Array.from({ length: 7 }).map((_, i) => ({
      radius: 140 + i * 25,
      size: 10 + Math.random() * 6,
      angle: Math.random() * Math.PI * 2,
      speed: 0.001 + i * 0.0004,
      color: `rgba(${100 + i * 20}, ${180 - i * 15}, ${255 - i * 25}, 0.35)`,
    }));

    const drawStars = () => {
      stars.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
        ctx.fill();
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawStars();

      // Draw colorful ribbon
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "rgba(255, 0, 150, 0.4)");
      gradient.addColorStop(0.5, "rgba(0, 200, 255, 0.3)");
      gradient.addColorStop(1, "rgba(0, 255, 120, 0.4)");

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.beginPath();
      for (let i = -300; i < 300; i += 10) {
        const y = Math.sin(i / 60) * 80;
        ctx.lineTo(i, y);
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 40;
      ctx.globalCompositeOperation = "lighter";
      ctx.stroke();
      ctx.restore();

      // Orbiting planets around the ribbon area
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      planets.forEach((p) => {
        const x = Math.cos(p.angle) * p.radius;
        const y = Math.sin(p.angle) * (p.radius * 0.4); // flatten orbit to follow ribbon curve

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        p.angle += p.speed;
      });
      ctx.restore();

      requestAnimationFrame(animate);
    };

    animate();
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="App">
      <canvas ref={canvasRef} className="background"></canvas>

      <nav className="navbar">
        <ul>
          <li>Home</li>
          <li>About</li>
          <li>Projects</li>
          <li>Contact</li>
        </ul>
      </nav>
    </div>
  );
}

export default App;
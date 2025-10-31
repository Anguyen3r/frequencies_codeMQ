import React, { useEffect, useRef } from "react";

const NebulaWave = () => {
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

    let t = 0;
    const gradientColors = [
      "#ff0040",
      "#ff8c00",
      "#ffff00",
      "#00ff7f",
      "#00ffff",
      "#0f52ba",
      "#ff69b4",
    ];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const midX = canvas.width / 2;
      const midY = canvas.height / 2;
      const waveHeight = canvas.height * 0.6;

      for (let y = 0; y < canvas.height; y += 3) {
        const offset = Math.sin(t / 100 + y / 120) * 80;
        const grad = ctx.createLinearGradient(
          midX - offset,
          y,
          midX + offset,
          y
        );
        gradientColors.forEach((c, i) =>
          grad.addColorStop(i / gradientColors.length, c)
        );
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.06;
        ctx.fillRect(midX - offset, y, offset * 2, 4);
      }

      t += 2;
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
        zIndex: 0,
        background: "radial-gradient(#000010, #000000)",
      }}
    />
  );
};

export default NebulaWave;
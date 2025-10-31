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

    const colors = [
      "rgba(102, 51, 255, 0.25)", // Sapphire glow (electronic)
      "rgba(255, 51, 102, 0.2)",  // Pink (pop)
      "rgba(255, 128, 0, 0.15)",  // Orange (house)
      "rgba(0, 255, 0, 0.15)",    // Green (D&B)
      "rgba(255, 0, 0, 0.2)",     // Red (hard techno)
      "rgba(128, 0, 255, 0.2)",   // Purple (techno)
      "rgba(0, 255, 255, 0.15)",  // Cyan (dubstep)
    ];

    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(0, 0, 30, 0.5)");
      gradient.addColorStop(1, "rgba(10, 0, 50, 0.7)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      colors.forEach((color, i) => {
        const amplitude = 60 + i * 10;
        const offset = (time * 0.001 + i * 0.5) % (2 * Math.PI);

        ctx.beginPath();
        for (let y = 0; y <= canvas.height; y += 5) {
          const x =
            canvas.width / 2 +
            Math.sin(y * 0.01 + offset) * amplitude * Math.sin(time * 0.0008 + i);
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 40;
        ctx.shadowColor = color;
        ctx.shadowBlur = 50;
        ctx.stroke();
      });

      time += 1.5;
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
        background: "black",
      }}
    />
  );
};

export default NebulaWave;
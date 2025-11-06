import React, { useEffect } from "react";
import * as THREE from "three";
import "./style.css";

export default function App() {
  useEffect(() => {
    // === SETUP SCENE ===
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x00000c, 0.00009);

    const camera = new THREE.PerspectiveCamera(
      46,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    camera.position.set(0, 18, 850);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000010, 0);
    const wrap = document.getElementById("canvasWrap");
    wrap.appendChild(renderer.domElement);

    // === LIGHTS ===
    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 20, 10);
    scene.add(amb, dir);

    // === SIMPLE STARFIELD EXAMPLE ===
    const stars = new THREE.BufferGeometry();
    const starCount = 1500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 4000;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 4000;
      starPositions[i * 3 + 2] = -Math.random() * 4000;
    }
    stars.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
    });
    const starField = new THREE.Points(stars, starMat);
    scene.add(starField);

    // === ANIMATE ===
    function animate() {
      requestAnimationFrame(animate);
      starField.rotation.y += 0.0005;
      renderer.render(scene, camera);
    }
    animate();

    // === RESIZE HANDLER ===
    function handleResize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", handleResize);

    // === CLEANUP ===
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      wrap.removeChild(renderer.domElement);
    };
  }, []);

  return <div id="canvasWrap" style={{ width: "100vw", height: "100vh" }}></div>;
}

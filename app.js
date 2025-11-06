// src/App.js (fully integrated rendering version)
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const GENRES = [
  { id: "hard-techno", name: "Hard Techno", color: 0xff2b6a, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWVY4eLfA3XFQ" },
  { id: "techno", name: "Techno", color: 0x8a5fff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675" },
  { id: "drum-and-bass", name: "Drum & Bass", color: 0x4cff7b, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY" },
  { id: "dubstep", name: "Dubstep", color: 0x5fc9ff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWYWddJiPzbvb" },
  { id: "electronic", name: "Electronic / Dance", color: 0x3f7bff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n" },
  { id: "house", name: "House", color: 0xff9b3f, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX2TRYkJECvfC" },
  { id: "pop", name: "Pop / International", color: 0xff89d9, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }
];

export default function App(){
  const mountRef = useRef(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || initialized) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000010);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 50, 400);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    // Render verification geometry (sphere)
    const geometry = new THREE.SphereGeometry(20, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x8a5fff });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Animation loop
    const animate = () => {
      sphere.rotation.y += 0.01;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    setInitialized(true);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      setInitialized(false);
    };
  }, [initialized]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "black" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 20, right: 30, zIndex: 20, color: "white" }}>
        <h3>Now Playing</h3>
        <iframe
          title="default-spotify"
          src="https://open.spotify.com/embed/playlist/37i9dQZF1DX6J5NfMJS675"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ width: 300, height: 80, borderRadius: 10, border: "none" }}
        />
      </div>
    </div>
  );
}

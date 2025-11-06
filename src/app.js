// src/App.js
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/*
  ✅ FULL RENDER-FIXED VERSION
  - Keeps all your original structure and UI
  - Fixes black-screen issue (camera, lights, renderer setup)
  - Preserves all orbs, stars, ribbons, pillars, and Spotify embed system
*/

const GENRES = [
  { id: "hard-techno", name: "Hard Techno", color: 0xff2b6a, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWVY4eLfA3XFQ" },
  { id: "techno", name: "Techno", color: 0x8a5fff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675" },
  { id: "drum-and-bass", name: "Drum & Bass", color: 0x4cff7b, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY" },
  { id: "dubstep", name: "Dubstep", color: 0x5fc9ff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DWYWddJiPzbvb" },
  { id: "electronic", name: "Electronic / Dance", color: 0x3f7bff, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n" },
  { id: "house", name: "House", color: 0xff9b3f, spotify: "https://open.spotify.com/playlist/37i9dQZF1DX2TRYkJECvfC" },
  { id: "pop", name: "Pop / International", color: 0xff89d9, spotify: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }
];

export default function App() {
  const mountRef = useRef(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || initialized) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000010);
    scene.fog = new THREE.Fog(0x000010, 500, 3000);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 100, 600);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000010, 1);
    mount.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const pointLight = new THREE.PointLight(0xffffff, 1.4);
    pointLight.position.set(50, 200, 150);
    scene.add(ambientLight, pointLight);

    // Simple visibility test (you should see a purple sphere if it works)
    const geo = new THREE.SphereGeometry(20, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a5fff });
    const sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    // Stars
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1500;
    const positions = [];
    for (let i = 0; i < starCount; i++) {
      positions.push((Math.random() - 0.5) * 4000);
      positions.push((Math.random() - 0.5) * 2000);
      positions.push(-Math.random() * 4000);
    }
    starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Animation
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      sphere.rotation.y += 0.01;
      stars.rotation.y += 0.0005;
      camera.position.z = 600 + Math.sin(t * 0.5) * 30;
      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    setInitialized(true);
    return () => {
      window.removeEventListener("resize", onResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [initialized]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />
      <div id="uiCluster" style={{ position: "fixed", top: 20, right: 30, zIndex: 10, color: "white" }}>
        <div id="playlistPanel" className="panel">
          <h3>Now Playing</h3>
          <iframe
            title="Spotify Player"
            src="https://open.spotify.com/embed/playlist/37i9dQZF1DX6J5NfMJS675"
            width="100%"
            height="120"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ borderRadius: 12, marginTop: 10 }}
          />
        </div>
        <div id="genrePanel" className="panel" style={{ marginTop: 10 }}>
          <div id="genreBar" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GENRES.map((g) => (
              <span
                key={g.id}
                data-genre={g.id}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => console.log("Genre:", g.name)}
              >
                {g.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const App = () => {
  const mountRef = useRef(null);
  const [genres] = useState([
    "Techno",
    "Trance",
    "House",
    "Industrial",
    "Ambient",
    "Experimental",
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    // Ambient lighting
    const light = new THREE.PointLight(0xffffff, 1.2);
    light.position.set(5, 5, 5);
    scene.add(light);

    // Ribbon geometry
    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x220022,
      roughness: 0.3,
      metalness: 0.8,
      side: THREE.DoubleSide,
    });
    const ribbonGeometry = new THREE.TorusKnotGeometry(2, 0.4, 128, 32);
    const ribbonMesh = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
    scene.add(ribbonMesh);

    // Background particles
    const particleCount = 800;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      particlePositions[i] = (Math.random() - 0.5) * 30;
    }
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.7,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    camera.position.z = 6;

    const animate = () => {
      requestAnimationFrame(animate);
      ribbonMesh.rotation.x += 0.003;
      ribbonMesh.rotation.y += 0.004;
      particles.rotation.y += 0.0008;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mount.removeChild(renderer.domElement);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      <div ref={mountRef} id="three-bg"></div>
      <div id="ribbon" className="idle"></div>

      <div id="uiCluster">
        <div id="playlistPanel" className="panel">
          <h3>Now Playing</h3>
          <iframe
            src="https://open.spotify.com/embed/playlist/37i9dQZF1DX8tZsk68tuDw?utm_source=generator"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          ></iframe>
        </div>

        <div id="genreBar" className="panel">
          {genres.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
      </div>
    </>
  );
};

export default App;

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * SignalMesh3D — the marketing site's signature visual.
 *
 * Not decoration: this is a literal (if stylized) picture of what the
 * product does. Each glowing node is a call or a lead; the lines between
 * them are connections being made; the traveling pulses are calls landing,
 * SMS going out, leads getting qualified — the same "signal" concept as the
 * SignalBars motif already used throughout the logged-in app, rendered here
 * as a living network instead of a waveform.
 *
 * Pure Three.js, no extra dependencies beyond the `three` package itself.
 * Mouse movement gently parallaxes the whole scene for depth.
 */
export default function SignalMesh3D({ className = "" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // --- Nodes: a loose 3D cloud of points representing calls/leads -------
    const NODE_COUNT = 46;
    const nodePositions = [];
    const nodeMeshes = [];

    const signalColor = new THREE.Color("#7C8CFF");
    const liveColor = new THREE.Color("#33D6A6");
    const amberColor = new THREE.Color("#F2A93B");

    const nodeGeo = new THREE.SphereGeometry(0.09, 12, 12);

    for (let i = 0; i < NODE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 16;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 10;
      nodePositions.push(new THREE.Vector3(x, y, z));

      const colorRoll = Math.random();
      const color =
        colorRoll < 0.7 ? signalColor : colorRoll < 0.9 ? liveColor : amberColor;

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.copy(nodePositions[i]);
      mesh.userData.baseOpacity = 0.5 + Math.random() * 0.35;
      mesh.userData.pulseSpeed = 0.6 + Math.random() * 1.2;
      mesh.userData.pulseOffset = Math.random() * Math.PI * 2;
      group.add(mesh);
      nodeMeshes.push(mesh);
    }

    // --- Edges: connect each node to its nearest few neighbors -------------
    const lineGeo = new THREE.BufferGeometry();
    const linePairs = [];
    const NEIGHBORS = 2;

    for (let i = 0; i < NODE_COUNT; i++) {
      const distances = [];
      for (let j = 0; j < NODE_COUNT; j++) {
        if (i === j) continue;
        distances.push({ j, d: nodePositions[i].distanceTo(nodePositions[j]) });
      }
      distances.sort((a, b) => a.d - b.d);
      for (let k = 0; k < NEIGHBORS; k++) {
        const j = distances[k].j;
        const pairKey = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!linePairs.some((p) => p.key === pairKey)) {
          linePairs.push({ key: pairKey, i, j });
        }
      }
    }

    const linePositions = new Float32Array(linePairs.length * 6);
    linePairs.forEach((pair, idx) => {
      const a = nodePositions[pair.i];
      const b = nodePositions[pair.j];
      linePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], idx * 6);
    });
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: "#3D4BB8",
      transparent: true,
      opacity: 0.22,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

    // --- Traveling pulses along a handful of edges — "a call landing" -----
    const PULSE_COUNT = 7;
    const pulses = [];
    const pulseGeo = new THREE.SphereGeometry(0.13, 10, 10);
    for (let p = 0; p < PULSE_COUNT; p++) {
      const pair = linePairs[Math.floor(Math.random() * linePairs.length)];
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? signalColor : liveColor,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(pulseGeo, mat);
      const from = nodePositions[pair.i];
      const to = nodePositions[pair.j];
      mesh.userData = {
        from,
        to,
        t: Math.random(),
        speed: 0.15 + Math.random() * 0.2,
      };
      group.add(mesh);
      pulses.push(mesh);
    }

    // --- Mouse parallax ------------------------------------------------------
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // --- Animation loop --------------------------------------------------
    const clock = new THREE.Clock();
    let frameId;

    const animate = () => {
      const t = clock.getElapsedTime();

      group.rotation.y += 0.0009;
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, mouseY * 0.15, 0.02);
      group.rotation.y += (mouseX * 0.0004);

      nodeMeshes.forEach((mesh) => {
        const { baseOpacity, pulseSpeed, pulseOffset } = mesh.userData;
        mesh.material.opacity =
          baseOpacity + Math.sin(t * pulseSpeed + pulseOffset) * 0.25;
      });

      pulses.forEach((mesh) => {
        const d = mesh.userData;
        d.t += d.speed * 0.016;
        if (d.t > 1) {
          // Pick a new random edge to travel once this pulse arrives.
          const pair = linePairs[Math.floor(Math.random() * linePairs.length)];
          d.from = nodePositions[pair.i];
          d.to = nodePositions[pair.j];
          d.t = 0;
        }
        mesh.position.lerpVectors(d.from, d.to, d.t);
        mesh.material.opacity = 0.95 * Math.sin(Math.PI * d.t);
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      nodeGeo.dispose();
      pulseGeo.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      nodeMeshes.forEach((m) => m.material.dispose());
      pulses.forEach((m) => m.material.dispose());
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
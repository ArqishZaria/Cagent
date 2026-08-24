import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * SignalMesh3D v2 — glowing network with real depth, built with plain
 * Three.js (no extra postprocessing dependencies, keeps this installable
 * without fragile extra packages).
 *
 * Techniques used (deliberately, not decoration):
 * - Soft radial-gradient sprite texture (generated on a canvas at runtime)
 *   used as the point sprite, with additive blending -> real glow, no
 *   flat-looking spheres.
 * - Two depth layers: a slow, distant "starfield" of tiny points behind a
 *   denser, brighter foreground network -> actual parallax depth.
 * - Pulses render as a short fading comet-style trail, not a single dot.
 * - Camera dollies in on mount (a staged opening moment) then settles into
 *   a slow idle drift + mouse parallax.
 */
function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function SignalMesh3D({ className = "" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 200);
    camera.position.set(0, 0, 42); // starts further back — dollies in on load

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const glowTexture = makeGlowTexture();
    const group = new THREE.Group();
    const starGroup = new THREE.Group();
    scene.add(starGroup, group);

    const signalColor = new THREE.Color("#7C8CFF");
    const liveColor = new THREE.Color("#33D6A6");
    const amberColor = new THREE.Color("#F2A93B");

    // --- Distant starfield: pure depth cue, moves slower than foreground ---
    const STAR_COUNT = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 60;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 20;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.35,
      map: glowTexture,
      transparent: true,
      opacity: 0.35,
      color: "#3D4BB8",
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    starGroup.add(new THREE.Points(starGeo, starMat));

    // --- Foreground node network -------------------------------------------
    const NODE_COUNT = 42;
    const nodePositions = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodePositions.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 17,
          (Math.random() - 0.5) * 10.5,
          (Math.random() - 0.5) * 9
        )
      );
    }

    const nodeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(NODE_COUNT * 3);
    const colorAttr = new Float32Array(NODE_COUNT * 3);
    nodePositions.forEach((p, i) => {
      positions.set([p.x, p.y, p.z], i * 3);
      const roll = Math.random();
      const c = roll < 0.68 ? signalColor : roll < 0.9 ? liveColor : amberColor;
      colorAttr.set([c.r, c.g, c.b], i * 3);
    });
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    nodeGeo.setAttribute("color", new THREE.BufferAttribute(colorAttr, 3));

    const nodeMat = new THREE.PointsMaterial({
      size: 0.8,
      map: glowTexture,
      transparent: true,
      vertexColors: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const nodePoints = new THREE.Points(nodeGeo, nodeMat);
    group.add(nodePoints);

    // --- Edges between nearest neighbors, faint ---------------------------
    const linePairs = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const distances = [];
      for (let j = 0; j < NODE_COUNT; j++) {
        if (i === j) continue;
        distances.push({ j, d: nodePositions[i].distanceTo(nodePositions[j]) });
      }
      distances.sort((a, b) => a.d - b.d);
      for (let k = 0; k < 2; k++) {
        const j = distances[k].j;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!linePairs.some((p) => p.key === key)) linePairs.push({ key, i, j });
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(linePairs.length * 6);
    linePairs.forEach((pair, idx) => {
      const a = nodePositions[pair.i];
      const b = nodePositions[pair.j];
      linePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], idx * 6);
    });
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: "#3D4BB8", transparent: true, opacity: 0.16 });
    group.add(new THREE.LineSegments(lineGeo, lineMat));

    // --- Traveling pulses with a short comet-style trail -------------------
    const PULSE_COUNT = 6;
    const TRAIL_LENGTH = 5;
    const pulses = [];
    for (let p = 0; p < PULSE_COUNT; p++) {
      const pair = linePairs[Math.floor(Math.random() * linePairs.length)];
      const color = Math.random() < 0.5 ? signalColor : liveColor;
      const sprites = [];
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        const mat = new THREE.SpriteMaterial({
          map: glowTexture,
          color,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(mat);
        const scale = 0.85 - t * 0.12;
        sprite.scale.set(scale, scale, 1);
        group.add(sprite);
        sprites.push(sprite);
      }
      pulses.push({
        from: nodePositions[pair.i],
        to: nodePositions[pair.j],
        t: Math.random(),
        speed: 0.12 + Math.random() * 0.16,
        history: [],
        sprites,
      });
    }

    // --- Mouse tracking (drives parallax; spotlight overlay is CSS) --------
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // --- Animation ---------------------------------------------------------
    let frameId;
    const introStart = performance.now();
    const INTRO_MS = 1800;

    const animate = () => {
      const introProgress = Math.min((performance.now() - introStart) / INTRO_MS, 1);
      const eased = 1 - Math.pow(1 - introProgress, 3);
      camera.position.z = 42 - eased * 20; // 42 -> 22

      group.rotation.y += 0.0007;
      starGroup.rotation.y += 0.00018;
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, mouseY * 0.14, 0.02);
      group.rotation.y += mouseX * 0.00035;

      pulses.forEach((pulse) => {
        pulse.t += pulse.speed * 0.016;
        if (pulse.t > 1) {
          const pair = linePairs[Math.floor(Math.random() * linePairs.length)];
          pulse.from = nodePositions[pair.i];
          pulse.to = nodePositions[pair.j];
          pulse.t = 0;
          pulse.history = [];
        }
        const pos = new THREE.Vector3().lerpVectors(pulse.from, pulse.to, pulse.t);
        pulse.history.unshift(pos);
        if (pulse.history.length > pulse.sprites.length) pulse.history.pop();

        const fade = Math.sin(Math.PI * pulse.t);
        pulse.sprites.forEach((sprite, idx) => {
          const histPos = pulse.history[idx];
          if (!histPos) {
            sprite.material.opacity = 0;
            return;
          }
          sprite.position.copy(histPos);
          sprite.material.opacity = fade * (1 - idx / pulse.sprites.length) * 0.9;
        });
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
      starGeo.dispose();
      starMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      glowTexture.dispose();
      pulses.forEach((p) => p.sprites.forEach((s) => s.material.dispose()));
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
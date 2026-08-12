/**
 * WAT? AGENCY CINEMATIC HOMEPAGE
 * WebGL 3D Fluid Object + Scroll-Driven Animation System
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js';

class FluidObject {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.material = null;
    this.geometry = null;
    this.time = 0;
    this.targetRotation = { x: 0, y: 0 };
    this.currentRotation = { x: 0, y: 0 };
    this.targetScale = 1;
    this.currentScale = 1;

    this.createGeometry();
    this.createMaterial();
    this.createMesh();
  }

  createGeometry() {
    // Create organic geometry - icosahedron with subdivision for smooth shape
    const geometry = new THREE.IcosahedronGeometry(1.2, 6);

    // Store original positions for deformation
    this.positionAttribute = geometry.getAttribute('position');
    this.originalPositions = this.positionAttribute.array.slice();

    geometry.computeVertexNormals();
    this.geometry = geometry;
  }

  createMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Create metallic gradient texture
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#FFD400');
    gradient.addColorStop(0.5, '#FFC400');
    gradient.addColorStop(1, '#FFB000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Add noise for metallic effect
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 30;
      data[i] += noise;
      data[i+1] += noise * 0.8;
      data[i+2] += noise * 0.6;
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xFFD400,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x332200,
      emissiveIntensity: 0.2,
      map: texture,
      envMapIntensity: 1.2,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
  }

  createMesh() {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, 0);
    this.scene.add(this.mesh);
  }

  deformGeometry(time, intensity = 0.3) {
    const position = this.positionAttribute;
    const originalPosition = this.originalPositions;

    for (let i = 0; i < position.count; i++) {
      const i3 = i * 3;
      const x = originalPosition[i3];
      const y = originalPosition[i3 + 1];
      const z = originalPosition[i3 + 2];

      const deform = Math.sin(time * 0.5 + x * 2) *
                     Math.cos(time * 0.3 + y * 2) *
                     intensity;

      position.setXYZ(
        i,
        x + deform * 0.1,
        y + deform * 0.1,
        z + deform * 0.1
      );
    }

    position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  update(deltaTime, scrollProgress = 0) {
    this.time += deltaTime;

    // Continuous ambient rotation and deformation
    this.mesh.rotation.x += 0.0003;
    this.mesh.rotation.y += 0.0005;

    // Deformation based on time
    this.deformGeometry(this.time, 0.15 + scrollProgress * 0.2);

    // Subtle scale breathing
    const breathing = Math.sin(this.time * 0.3) * 0.05;
    this.mesh.scale.set(
      1 + breathing,
      1 + breathing * 0.8,
      1 + breathing * 1.2
    );

    // Apply target rotations for scroll control
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.05;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.05;

    this.mesh.rotation.x += this.currentRotation.x * 0.02;
    this.mesh.rotation.y += this.currentRotation.y * 0.02;
  }

  setScrollRotation(scrollProgress) {
    this.targetRotation.x = scrollProgress * Math.PI * 0.5;
    this.targetRotation.y = scrollProgress * Math.PI;
  }

  setScrollScale(scrollProgress) {
    this.targetScale = 0.8 + scrollProgress * 0.5;
  }
}

class CinematicScene {
  constructor(canvasId = 'webgl-canvas') {
    this.canvas = document.getElementById(canvasId) || this.createCanvas();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    this.setupRenderer();
    this.setupLighting();
    this.setupScene();

    this.fluidObject = new FluidObject(this.scene);
    this.clock = new THREE.Clock();

    this.setupEventListeners();
    this.animate();
  }

  createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'webgl-canvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      pointer-events: none;
    `;
    document.body.insertBefore(canvas, document.body.firstChild);
    return canvas;
  }

  setupRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x050505, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
  }

  setupLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Main directional light (sun)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.far = 50;
    this.scene.add(mainLight);

    // Warm accent light
    const warmLight = new THREE.DirectionalLight(0xFFD400, 0.4);
    warmLight.position.set(-15, 8, -10);
    this.scene.add(warmLight);

    // Cool fill light
    const fillLight = new THREE.DirectionalLight(0x0066ff, 0.15);
    fillLight.position.set(-10, 5, 15);
    this.scene.add(fillLight);
  }

  setupScene() {
    this.scene.background = new THREE.Color(0x050505);
    this.camera.position.z = 3;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  onMouseMove(event) {
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Subtle mouse-controlled rotation
    if (this.fluidObject) {
      this.fluidObject.targetRotation.x = y * 0.3;
      this.fluidObject.targetRotation.y = x * 0.3;
    }
  }

  setScrollProgress(progress) {
    if (this.fluidObject) {
      this.fluidObject.setScrollRotation(progress);
      this.fluidObject.setScrollScale(progress);
    }
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();

    if (this.fluidObject) {
      this.fluidObject.update(deltaTime);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.geometry?.dispose();
    this.material?.dispose();
  }
}

// Export for use in main script
window.CinematicScene = CinematicScene;
window.FluidObject = FluidObject;

// Bridge to make Three.js work as a global
import * as THREE from '/lib/three.min.js';
window.THREE = THREE;
window.THREE.WebGLRenderer = THREE.WebGLRenderer;
window.THREE.Scene = THREE.Scene;
window.THREE.PerspectiveCamera = THREE.PerspectiveCamera;
window.THREE.IcosahedronGeometry = THREE.IcosahedronGeometry;
window.THREE.MeshPhysicalMaterial = THREE.MeshPhysicalMaterial;
window.THREE.Mesh = THREE.Mesh;
window.THREE.AmbientLight = THREE.AmbientLight;
window.THREE.DirectionalLight = THREE.DirectionalLight;

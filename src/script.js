import * as THREE from "three";
import * as dat from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Octree
import { Octree } from "three/addons/math/Octree.js";
import { OctreeHelper } from "three/addons/helpers/OctreeHelper.js";



/**
 ******************************
 ****** Three.js Initial ******
 ******************************
 */

/**
 * Init
 */
// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(20, 20, 100);
scene.add(camera);

/**
 * Addition
 */
// Controls
const orbitControls = new OrbitControls(camera, canvas);
orbitControls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0x161e33, 0.8);
scene.add(ambientLight);

// MODELVIEWER
let pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(
  new RoomEnvironment(),
  0.04
).texture;

// Axes
const axes = new THREE.AxesHelper(10);
scene.add(axes);

// Clock
const clock = new THREE.Clock();

// Debug
const gui = new dat.GUI();

// Physics - Octree
const worldOctree = new Octree();

/**
 ******************************
 ************ Main ************
 ******************************
 */

/**
 * Definitions
 */
// Main Model
let building;
const deltaPosition = new THREE.Vector3(0, 0, 0);

// Draco
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

// GLTF Loader
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Models
 */
// Load Building Model
gltfLoader.load("/models/main.glb", (gltf) => {
  building = gltf.scene;
  building.scale.set(0.5, 0.5, 0.5);

  // Octree physics to building
  worldOctree.fromGraphNode(building);

  // Octree helper
  const octreeHelper = new OctreeHelper(worldOctree);
  octreeHelper.visible = false;
  scene.add(octreeHelper);

  gui.add({ debug: false }, "debug").onChange(function (value) {
    octreeHelper.visible = value;
  });

  scene.add(building);
});

// Character
const gSphere = new THREE.SphereGeometry(1);
const mSphere = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const sphere = new THREE.Mesh(gSphere, mSphere); // Sphere Mesh
sphere.position.z = 15;
scene.add(sphere);

const sphereCollider = new THREE.Sphere(sphere.position.clone(), 1); // Sphere physics body

/**
 * Functioins
 */
function updatePlayer() {
  sphereCollider.translate(deltaPosition); // Move as deltaPosition
  sphere.position.copy(sphereCollider.center); // Move sphere Mesh to physics body position

  const result = worldOctree.sphereIntersect(sphereCollider); // bumped?
  if (result) {
    sphereCollider.translate(result.normal.multiplyScalar(result.depth)); // if bumped, back to before position.
  }
}

// Handle keydown events
function onKeyDown(event) {
  switch (event.code) {
    case "KeyW":
      deltaPosition.z = -0.1;
      break;
    case "KeyS":
      deltaPosition.z = 0.1;
      break;
    case "KeyA":
      deltaPosition.x = -0.1;
      break;
    case "KeyD":
      deltaPosition.x = 0.1;
      break;
    case "KeyQ":
      deltaPosition.y = -0.1;
      break;
    case "KeyE":
      deltaPosition.y = 0.1;
      break;
  }
}

// Handle keyup events
function onKeyUp(event) {
  switch (event.code) {
    case "KeyW":
      deltaPosition.z = 0;
      break;
    case "KeyS":
      deltaPosition.z = 0;
      break;
    case "KeyA":
      deltaPosition.x = 0;
      break;
    case "KeyD":
      deltaPosition.x = 0;
      break;
    case "KeyQ":
      deltaPosition.y = 0;
      break;
    case "KeyE":
      deltaPosition.y = 0;
      break;
  }
}

/**
 * Events
 */
// Key event
document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);

// Auto Resize
window.addEventListener("resize", () => {
  // Update camera
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Animate
 */
const animate = () => {
  // Update controls
  orbitControls.update();

  // Update Sphere state
  updatePlayer();

  // Render Scene
  renderer.render(scene, camera);

  // Call animate again on the next frame
  window.requestAnimationFrame(animate);
};

animate();

import * as THREE from "three";
import * as dat from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Octree
import { Octree } from "three/addons/math/Octree.js";

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
camera.position.set(0, 5, 5);
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
const direction = new THREE.Vector3();
const playerVelocity = new THREE.Vector3();
let delta;
let playerOnFloor = false;
let GRAVITY = 30;
const keyStates = {};
const playerDirection = new THREE.Vector3();

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
gltfLoader.load("/models/book.glb", (gltf) => {
  building = gltf.scene;
  building.scale.set(1.5, 1.5, 1.5);

  // Octree physics to building
  worldOctree.fromGraphNode(building);

  scene.add(building);
});

// Character
const gSphere = new THREE.SphereGeometry(1);
const mSphere = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const sphere = new THREE.Mesh(gSphere, mSphere); // Sphere Mesh
sphere.position.y = 15;
scene.add(sphere);

const sphereCollider = new THREE.Sphere(sphere.position.clone(), 1); // Sphere physics body

/**
 * Functioins
 */
function playerCollisions() {
  playerOnFloor = false;
  const result = worldOctree.sphereIntersect(sphereCollider);
  if (result) {
    playerOnFloor = result.normal.y > -10;
    if (!playerOnFloor) {
      // console.log("case!");
      playerVelocity.addScaledVector(
        result.normal,
        -result.normal.dot(playerVelocity)
      );
    }
    sphereCollider.translate(result.normal.multiplyScalar(result.depth));
  }
}

function updatePlayer(deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1;

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;

    // small air resistance
    damping *= 0.1;
  }

  playerVelocity.addScaledVector(playerVelocity, damping);

  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
  sphereCollider.translate(deltaPosition);
  sphere.position.copy(sphereCollider.center);

  playerCollisions();
}

function getForwardVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();

  return playerDirection;
}

function getSideVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  playerDirection.cross(camera.up);

  return playerDirection;
}

function controls(deltaTime) {
  // gives a bit of air control
  const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

  if (keyStates["KeyW"]) {
    playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
  }

  if (keyStates["KeyS"]) {
    playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
  }

  if (keyStates["KeyA"]) {
    playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
  }

  if (keyStates["KeyD"]) {
    playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
  }

  if (playerOnFloor) {
    if (keyStates["Space"]) {
      playerVelocity.y = 15;
    }
  }
}

function updateCamera() {
  camera.position.sub(orbitControls.target);
  orbitControls.target.copy(sphere.position);
  camera.position.add(sphere.position);
  camera.getWorldDirection(direction);
  // console.log(direction);
}

function teleportPlayerIfOob() {
  if (camera.position.y <= -100) {
    sphereCollider.center.set(0, 0, 0);
  }
}

/**
 * Events
 */
// Key event
document.addEventListener("keydown", (event) => {
  keyStates[event.code] = true;
});

document.addEventListener("keyup", (event) => {
  keyStates[event.code] = false;
});
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
  delta = clock.getDelta();
  // Update controls
  orbitControls.update();

  // Update Sphere state
  controls(delta);
  updatePlayer(delta);
  updateCamera();
  teleportPlayerIfOob();

  // Render Scene
  renderer.render(scene, camera);

  // Call animate again on the next frame
  window.requestAnimationFrame(animate);
};

animate();

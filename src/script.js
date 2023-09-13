import * as THREE from "three";
import * as dat from "lil-gui";
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

/**
 ******************************
 ****** Three.js Initial ******
 ******************************
 */

/**
 * Basic
 */
// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 5);
scene.add(camera);

/**
 * Addition
 */
// Stats
const stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
document.body.appendChild(stats.domElement);

// Clock
const clock = new THREE.Clock();

// Controls
const orbitControls = new OrbitControls(camera, canvas);
orbitControls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);
const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight);
scene.add(directionalLightHelper);

// Axes
const axes = new THREE.AxesHelper(10);
scene.add(axes);

// Physics
const worldOctree = new Octree();

// Loader
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
gltfLoader.setDRACOLoader(dracoLoader);

/**
 ******************************
 ************ Main ************
 ******************************
 */

/**
 * Definitions
 */3
let terrain;
let moveForward = false, moveBackward = false, moveRight = false, moveLeft = false;
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
let playerOnFloor = false;
let deltaTime;
let playerSpeed = 20;
const GRAVITY = 30;
const STEPS_PER_FRAME = 5;

/**
 * Models
 */
// Terrian
gltfLoader.load("/models/book.glb", (gltf) => {
    terrain = gltf.scene;
    scene.add(terrain);

    worldOctree.fromGraphNode(terrain);
});

// Character
const gCapsule = new THREE.CapsuleGeometry(0.35, 0.3, 4, 3);
const mCapsule = new THREE.MeshPhongMaterial({ color: 0xff33bb });
const player = new THREE.Mesh(gCapsule, mCapsule);
scene.add(player);

const playerCollider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.35);

/**
 * Action
 */
window.addEventListener("keypress", (event) => {
    if (event.code == "KeyW") moveForward = true;
    if (event.code == "KeyS") moveBackward = true;
    if (event.code == "KeyA") moveLeft = true;
    if (event.code == "KeyD") moveRight = true;
    if (playerOnFloor) {
        if (event.code == "Space") {
            playerVelocity.y = 15;
        }
    }
});
window.addEventListener("keyup", (event) => {
    if (event.code == "KeyW") moveForward = false;
    if (event.code == "KeyS") moveBackward = false;
    if (event.code == "KeyA") moveLeft = false;
    if (event.code == "KeyD") moveRight = false;
});

/**
 * Functioins
 */
function updateCamera() {
    camera.position.sub(orbitControls.target);
    orbitControls.target.copy(player.position);
    camera.position.add(player.position);
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();
    // player.lookAt(playerDirection);
}

function forwardDirection() {
    const direction = cameraDirection.clone();
    return direction;
}

function sideDirection() {
    const direction = cameraDirection.cross(new THREE.Vector3(0, 1, 0));
    return direction;
}

function updateVelocity(delta) {
    if (moveForward) playerVelocity.add(forwardDirection().multiplyScalar(playerSpeed * delta));
    if (moveBackward) playerVelocity.add(forwardDirection().multiplyScalar(-playerSpeed * delta));
    if (moveRight) playerVelocity.add(sideDirection().multiplyScalar(playerSpeed * delta));
    if (moveLeft) playerVelocity.add(sideDirection().multiplyScalar(-playerSpeed * delta));
}

function playerCollisions() {
    playerOnFloor = false;
    const result = worldOctree.capsuleIntersect(playerCollider);
    if (result) {
        playerOnFloor = result.normal.y > -50;
        if (result.normal.y < 0.8) { playerOnFloor = false }
        if (!playerOnFloor) {
            playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
        }
        playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
}

function updatePlayer(delta) {
    updateVelocity(deltaTime);
    let damping = Math.exp(-4 * delta) - 1;
    if (!playerOnFloor) {
        playerVelocity.y -= GRAVITY * delta;
        damping *= 0.3;
    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    const deltaPosition = playerVelocity.clone().multiplyScalar(delta);
    playerCollider.translate(deltaPosition);
    player.position.x = playerCollider.start.x;
    player.position.y = playerCollider.start.y + 0.15;
    player.position.z = playerCollider.start.z;

    playerCollisions();
    updateDirection();
}

function updateDirection() {
    if (!moveForward && !moveBackward && !moveRight && !moveLeft) {
        playerDirection.copy(player.position.clone().add(cameraDirection));
    } else {
        playerDirection.copy(player.position.clone().add(new THREE.Vector3(playerVelocity.x, 0, playerVelocity.z)));
    }
    player.lookAt(playerDirection);
}

function teleportPlayerIfOob() {
    if (player.position.y <= -100) {
        playerVelocity.set(0, 0, 0);
        playerCollider.translate(player.position.multiplyScalar(-1));
    }
}

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
    deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        updateCamera();

        updatePlayer(deltaTime);
        teleportPlayerIfOob();
    }

    // Update controls
    orbitControls.update();

    // Render Scene
    renderer.render(scene, camera);

    // Stats Update
    stats.update();

    // Call animate again on the next frame
    window.requestAnimationFrame(animate);
};

animate();

import * as THREE from "three";
import * as dat from "lil-gui";
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';

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

// CANNON
const world = new CANNON.World();
world.gravity.set(0, -9.8, 0);
// const cannonDebugger = new CannonDebugger(scene, world);

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
let playerRadius = 0.5;

/**
 * Models
 */
// Terrian
gltfLoader.load("/models/temp.glb", (gltf) => {
    terrain = gltf.scene;
    scene.add(terrain);

    terrain.traverse(function (node) {
        if (node.isMesh) {
            const geometry = node.geometry;
            const positionAttribute = geometry.attributes.position;

            const scale = node.scale; // Get the scale of the mesh node
            console.log(node);

            // Apply the scale to the position attribute during trimesh creation
            const scaledPositionArray = [];
            const positionArray = positionAttribute.array;
            for (let i = 0; i < positionArray.length; i += 3) {
                const x = positionArray[i] * scale.x;
                const y = positionArray[i + 1] * scale.y;
                const z = positionArray[i + 2] * scale.z;
                scaledPositionArray.push(x, y, z);
            }

            // Create the trimesh with the scaled position array
            const trimesh = new CANNON.Trimesh(
                scaledPositionArray,
                geometry.index ? geometry.index.array : undefined
            );

            const body = new CANNON.Body({ mass: 0 }); // Adjust the mass as needed
            body.addShape(trimesh);
            // Set the initial position, rotation, or other properties of the body
            body.position.copy(node.position);
            body.quaternion.copy(node.quaternion);

            // Add the body to your Cannon.js world
            world.addBody(body);
        }
    });
});

// Character
const gPlayer = new THREE.SphereGeometry(playerRadius, 12, 12);
const mPlayer = new THREE.MeshPhongMaterial({ color: 0xff33bb });
const player = new THREE.Mesh(gPlayer, mPlayer);
player.position.set(0, 5, 0);
scene.add(player);

const playerShape = new CANNON.Sphere(playerRadius);
const playerBody = new CANNON.Body({ mass: 10 });
playerBody.addShape(playerShape);
playerBody.position.copy(player.position);
world.addBody(playerBody);

/**
 * Action
 */
window.addEventListener("keypress", (event) => {
    if (event.code == "KeyW") moveForward = true;
    if (event.code == "KeyS") moveBackward = true;
    if (event.code == "KeyA") moveLeft = true;
    if (event.code == "KeyD") moveRight = true;
    if (playerBody.velocity.y.toFixed(2) == 0) {
        if (event.code == "Space") playerBody.velocity.y = 5;
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

function updatePlayer(delta) {
    updateVelocity(delta);
    playerBody.velocity.x = playerVelocity.x;
    playerBody.velocity.z = playerVelocity.z;

    playerVelocity.addScaledVector(playerVelocity, -0.1);
}


function teleportPlayerIfOob() {
    if (player.position.y <= -100) {
        playerBody.velocity.set(0, 0, 0);
        playerBody.position.set(0, 5, 0);
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
    deltaTime = Math.min(clock.getDelta(), 0.1);

    updateCamera();
    updatePlayer(deltaTime);
    teleportPlayerIfOob();

    player.position.copy(playerBody.position);

    world.step(deltaTime);

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

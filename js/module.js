import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GUI } from 'three/addons/gui';

const initialCameraPosition = {
    x: 13.400938401234148,
    y: 6.889562835235831,
    z: 11.038891875781443
};
const initialCameraTarget = { x: 0, y: 0.8, z: 0 };

const scene = new THREE.Scene();
const defaultBgColor = new THREE.Color(0x222222);
scene.background = defaultBgColor;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(initialCameraTarget.x, initialCameraTarget.y, initialCameraTarget.z);
controls.enableDamping = true;
controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
};
controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
};

let gridSize = 100;
let gridDivisions = 100;
let gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x007acc, 0x444444);
gridHelper.position.set(0, 0, 0);
scene.add(gridHelper);

const floorGeometry = new THREE.PlaneGeometry(500, 500);
const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.set(0, 0, 0);
floorMesh.receiveShadow = true;
scene.add(floorMesh);

scene.add(new THREE.AmbientLight(0xffffff, 1.0));

const mainSunLight = new THREE.DirectionalLight(0xffffff, 1.8);
mainSunLight.position.set(5, 12, 7.5);
mainSunLight.castShadow = true;
mainSunLight.shadow.mapSize.width = 1024;
mainSunLight.shadow.mapSize.height = 1024;
scene.add(mainSunLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(-5, 6, -5);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
backLight.position.set(0, -5, -5);
scene.add(backLight);

const boneMarkers = new Map();
function createBoneMarker(bone) {
    if (boneMarkers.has(bone.id)) return boneMarkers.get(bone.id);
    const geom = new THREE.SphereGeometry(0.04, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.3 });
    const marker = new THREE.Mesh(geom, mat);
    marker.userData = { isBoneMarker: true, targetBone: bone };
    marker.visible = false;
    scene.add(marker);
    boneMarkers.set(bone.id, marker);
    return marker;
}

function updateBoneMarkersPositions() {
    if (boneMarkers.size === 0) return;
    bones.forEach(b => {
        let marker = boneMarkers.get(b.id);
        if (marker && marker.visible) {
            const worldPos = new THREE.Vector3();
            b.getWorldPosition(worldPos);
            marker.position.copy(worldPos);
        }
    });
}

const keysPressed = {};
window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    keysPressed[e.key] = true;
});
window.addEventListener('keyup', (e) => { keysPressed[e.key] = false; });

function handleKeyboardControls() {
    const moveSpeed = 0.05;
    const rotateSpeed = 0.02;
    const zoomSpeed = 0.1;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).negate().normalize();

    let hasMoved = false;

    if (keysPressed['a'] || keysPressed['A']) {
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotateSpeed);
        camera.position.copy(controls.target).add(offset);
        hasMoved = true;
    }
    if (keysPressed['d'] || keysPressed['D']) {
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotateSpeed);
        camera.position.copy(controls.target).add(offset);
        hasMoved = true;
    }
    if (keysPressed['w'] || keysPressed['W']) {
        const offset = camera.position.clone().sub(controls.target);
        const axis = new THREE.Vector3().crossVectors(offset, camera.up).normalize();
        offset.applyAxisAngle(axis, -rotateSpeed);
        camera.position.copy(controls.target).add(offset);
        hasMoved = true;
    }
    if (keysPressed['s'] || keysPressed['S']) {
        const offset = camera.position.clone().sub(controls.target);
        const axis = new THREE.Vector3().crossVectors(offset, camera.up).normalize();
        offset.applyAxisAngle(axis, rotateSpeed);
        camera.position.copy(controls.target).add(offset);
        hasMoved = true;
    }
    if (keysPressed['q'] || keysPressed['Q']) {
        const dir = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
        camera.position.addScaledVector(dir, zoomSpeed);
        hasMoved = true;
    }
    if (keysPressed['e'] || keysPressed['E']) {
        const dir = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
        camera.position.addScaledVector(dir, -zoomSpeed);
        hasMoved = true;
    }
    if (keysPressed['ArrowLeft']) {
        camera.position.addScaledVector(right, -moveSpeed);
        controls.target.addScaledVector(right, -moveSpeed);
        hasMoved = true;
    }
    if (keysPressed['ArrowRight']) {
        camera.position.addScaledVector(right, moveSpeed);
        controls.target.addScaledVector(right, moveSpeed);
        hasMoved = true;
    }
    if (keysPressed['ArrowUp']) {
        camera.position.y += moveSpeed;
        controls.target.y += moveSpeed;
        hasMoved = true;
    }
    if (keysPressed['ArrowDown']) {
        camera.position.y -= moveSpeed;
        controls.target.y -= moveSpeed;
        hasMoved = true;
    }

    if (hasMoved) controls.update();
}

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.size = 0.75;
scene.add(transformControls);

transformControls.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value;
});

transformControls.addEventListener('change', () => {
    if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
});

let currentModel = null;
let initialModelSource = null;
let modelSubmeshes = [];
let extraObjectsData = [];
let primitivesData = [];
let selectedPrimitiveIndex = 0;
let selectedExtraObjectIndex = 0;

let cameraFolder = null;
let modelOptionsFolder = null;
let extraObjectsFolder = null;
let primitivesFolder = null;
let inspectionFolder = null;
let gridFolder = null;
let coordsFolder = null;
let viewsFolder = null;
let lightsFolder = null;

let mixer = null;
let activeAction = null;
let bones = [];
let initialBoneTransforms = [];
let capturedPoses = [];
let gui = null;
let boneDropdownController = null;
const clock = new THREE.Clock();

const normalMaterial = new THREE.MeshNormalMaterial();
const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
let originalMaterialsMap = new Map();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
const textureLoader = new THREE.TextureLoader();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function fitCameraToModel(object) {
    if (initialCameraPosition) {
        camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
        controls.target.set(initialCameraTarget.x, initialCameraTarget.y, initialCameraTarget.z);
        controls.update();
        return;
    }

    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    const fov = camera.fov * (Math.PI / 180);
    const aspect = camera.aspect;

    let distance = sphere.radius / Math.sin(fov / 2);
    if (aspect < 1) {
        const horizontalFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
        distance = sphere.radius / Math.sin(horizontalFov / 2);
    }

    distance *= 1.35;

    controls.target.copy(center);
    camera.position.set(center.x, center.y + (sphere.radius * 0.3), center.z + distance);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.update();
}

function updateCameraGUI() {
    if (!gui) return;
    if (cameraFolder) cameraFolder.destroy();

    cameraFolder = gui.addFolder('Posición de la cámara').close();

    const camPos = {
        imprimirCoords: () => {
            console.log(`Posición de la cámara: X: ${camera.position.x}, Y: ${camera.position.y}, Z: ${camera.position.z}`);
            alert(`Posición de la cámara:\nX: ${camera.position.x}\nY: ${camera.position.y}\nZ: ${camera.position.z}`);
        }
    };

    cameraFolder.add(camera.position, 'x', -50, 50, 0.01).name('X:').listen();
    cameraFolder.add(camera.position, 'y', -50, 50, 0.01).name('Y:').listen();
    cameraFolder.add(camera.position, 'z', -50, 50, 0.01).name('Z:').listen();
    cameraFolder.add(camPos, 'imprimirCoords').name('Obtener posición de la cámara');
}

function updateModelOptionsGUI() {
    if (!gui) return;
    if (modelOptionsFolder) modelOptionsFolder.destroy();

    modelOptionsFolder = gui.addFolder('Opciones del modelo').close();

    const modelActions = {
        resetear: () => {
            if (initialModelSource) loadModelSource(initialModelSource);
        },
        guardarGLB: () => exportStaticGLB()
    };

    modelOptionsFolder.add(modelActions, 'resetear').name('Restablecer modelo');
    modelOptionsFolder.add(modelActions, 'guardarGLB').name('Guardar como GLB');
}

function setPredefinedView(viewType) {
    let targetObj = currentModel;
    if (!targetObj && primitivesData.length > 0) {
        targetObj = primitivesData[selectedPrimitiveIndex];
    }
    if (!targetObj) return;

    const box = new THREE.Box3().setFromObject(targetObj);
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius * 2.5 || 5;

    controls.target.copy(center);

    switch (viewType) {
        case 'Frontal': camera.position.set(center.x, center.y, center.z + dist); break;
        case 'Trasera': camera.position.set(center.x, center.y, center.z - dist); break;
        case 'Izquierda': camera.position.set(center.x - dist, center.y, center.z); break;
        case 'Derecha': camera.position.set(center.x + dist, center.y, center.z); break;
        case 'Superior': camera.position.set(center.x, center.y + dist, center.z + 0.001); break;
        case 'Inferior': camera.position.set(center.x, center.y - dist, center.z + 0.001); break;
    }
    controls.update();
}

function updateViewsGUI() {
    if (!gui) return;
    if (viewsFolder) viewsFolder.destroy();

    viewsFolder = gui.addFolder('Perspectiva de la cámara').close();
    viewsFolder.add({ f: () => setPredefinedView('Frontal') }, 'f').name('Vista frontal');
    viewsFolder.add({ f: () => setPredefinedView('Trasera') }, 'f').name('Vista trasera');
    viewsFolder.add({ f: () => setPredefinedView('Izquierda') }, 'f').name('Vista izquierda');
    viewsFolder.add({ f: () => setPredefinedView('Derecha') }, 'f').name('Vista derecha');
    viewsFolder.add({ f: () => setPredefinedView('Superior') }, 'f').name('Vista superior');
    viewsFolder.add({ f: () => setPredefinedView('Inferior') }, 'f').name('Vista inferior');
}

function updateLightsGUI() {
    if (!gui) return;
    if (lightsFolder) lightsFolder.destroy();

    lightsFolder = gui.addFolder('Control de iluminación').close();

    const lightSettings = {
        solX: mainSunLight.position.x,
        solY: mainSunLight.position.y,
        solZ: mainSunLight.position.z,
        intensidadSol: mainSunLight.intensity,
        luzRelleno: fillLight.visible,
        luzTrasera: backLight.visible
    };

    const solFolder = lightsFolder.addFolder('Posición del sol').close();
    solFolder.add(lightSettings, 'solX', -50, 50, 0.5).name('X:').onChange(v => mainSunLight.position.x = v);
    solFolder.add(lightSettings, 'solY', 0, 50, 0.5).name('Y:').onChange(v => mainSunLight.position.y = v);
    solFolder.add(lightSettings, 'solZ', -50, 50, 0.5).name('Z:').onChange(v => mainSunLight.position.z = v);

    lightsFolder.add(lightSettings, 'intensidadSol', 0, 5, 0.1).name('Intensidad de iluminación:').onChange(v => mainSunLight.intensity = v);
    lightsFolder.add(lightSettings, 'luzRelleno').name('Relleno lateral:').onChange(v => fillLight.visible = v);
    lightsFolder.add(lightSettings, 'luzTrasera').name('Contraluz:').onChange(v => backLight.visible = v);
}

function updateCoordinatesGUI() {
    if (!gui) return;

    if (coordsFolder) {
        coordsFolder.destroy();
        coordsFolder = null;
    }

    const activeObj = transformControls.object;
    if (!activeObj) return;

    coordsFolder = gui.addFolder('Coordenadas (Transformación Objeto)');

    const posFolder = coordsFolder.addFolder('Posición (X, Y, Z)').close();
    posFolder.add(activeObj.position, 'x', -50, 50, 0.01).name('X').listen();
    posFolder.add(activeObj.position, 'y', -50, 50, 0.01).name('Y').listen();
    posFolder.add(activeObj.position, 'z', -50, 50, 0.01).name('Z').listen();

    const rotFolder = coordsFolder.addFolder('Rotación (Grados)').close();
    const rotDeg = {
        x: THREE.MathUtils.radToDeg(activeObj.rotation.x),
        y: THREE.MathUtils.radToDeg(activeObj.rotation.y),
        z: THREE.MathUtils.radToDeg(activeObj.rotation.z)
    };

    rotFolder.add(rotDeg, 'x', -180, 180, 0.1).name('Rot X°').onChange(v => activeObj.rotation.x = THREE.MathUtils.degToRad(v));
    rotFolder.add(rotDeg, 'y', -180, 180, 0.1).name('Rot Y°').onChange(v => activeObj.rotation.y = THREE.MathUtils.degToRad(v));
    rotFolder.add(rotDeg, 'z', -180, 180, 0.1).name('Rot Z°').onChange(v => activeObj.rotation.z = THREE.MathUtils.degToRad(v));

    const scaleFolder = coordsFolder.addFolder('Escala (X, Y, Z)').close();
    scaleFolder.add(activeObj.scale, 'x', 0.001, 20, 0.01).name('Escala X').listen();
    scaleFolder.add(activeObj.scale, 'y', 0.001, 20, 0.01).name('Escala Y').listen();
    scaleFolder.add(activeObj.scale, 'z', 0.001, 20, 0.01).name('Escala Z').listen();
}

function updateGridGUI() {
    if (!gui) return;
    if (gridFolder) gridFolder.destroy();

    gridFolder = gui.addFolder('Opciones de malla').close();

    const gridSettings = {
        visible: gridHelper.visible,
        sombras: floorMesh.visible
    };

    gridFolder.add(gridSettings, 'visible').name('Ver malla del suelo:').onChange(v => gridHelper.visible = v);
    gridFolder.add(gridSettings, 'sombras').name('Destacar sombras:').onChange(v => floorMesh.visible = v);
}

function createPrimitive(type) {
    let geometry;
    switch (type) {
        case 'Cubo': geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8); break;
        case 'Esfera': geometry = new THREE.SphereGeometry(0.5, 32, 32); break;
        case 'Cilindro': geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32); break;
        case 'Cono': geometry = new THREE.ConeGeometry(0.5, 0.8, 32); break;
        case 'Plano': geometry = new THREE.PlaneGeometry(0.8, 0.8); break;
        case 'Toro': geometry = new THREE.TorusGeometry(0.4, 0.15, 16, 100); break;
        default: geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    }

    const material = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        roughness: 0.4,
        metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${type}_${primitivesData.length + 1}`;
    mesh.position.set(0, 0.4, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    primitivesData.push(mesh);
    selectedPrimitiveIndex = primitivesData.length - 1;
    transformControls.attach(mesh);
    updatePrimitivesGUI();
    updateCoordinatesGUI();
}

function updatePrimitivesGUI() {
    if (!gui) return;
    if (primitivesFolder) primitivesFolder.destroy();

    primitivesFolder = gui.addFolder('Objetos geométricos:').close();

    const createObj = {
        tipo: 'Cubo',
        crear: () => createPrimitive(createObj.tipo)
    };

    primitivesFolder.add(createObj, 'tipo', ['Cubo', 'Esfera', 'Cilindro', 'Cono', 'Plano', 'Toro']).name('Tipo:');
    primitivesFolder.add(createObj, 'crear').name('Añadir bloque al área de trabajo');

    if (primitivesData.length === 0) return;

    const primitiveOptions = {};
    primitivesData.forEach((mesh, idx) => primitiveOptions[mesh.name] = idx);

    const currentMesh = primitivesData[selectedPrimitiveIndex < primitivesData.length ? selectedPrimitiveIndex : 0];

    const primControls = {
        Seleccionado: selectedPrimitiveIndex < primitivesData.length ? selectedPrimitiveIndex : 0,
        Nombre: currentMesh ? currentMesh.name : '',
        Color: currentMesh ? '#' + currentMesh.material.color.getHexString() : '#ffffff',
        Roughness: currentMesh ? currentMesh.material.roughness : 0.5,
        Metalness: currentMesh ? currentMesh.material.metalness : 0.5,
        Wireframe: currentMesh ? currentMesh.material.wireframe : false,
        Opacity: currentMesh ? currentMesh.material.opacity : 1.0,
        Modo: transformControls.mode || 'translate',
        eliminar: () => {
            if (currentMesh) {
                if (transformControls.object === currentMesh) transformControls.detach();
                scene.remove(currentMesh);
                currentMesh.geometry.dispose();
                if (Array.isArray(currentMesh.material)) {
                    currentMesh.material.forEach(m => m.dispose());
                } else {
                    currentMesh.material.dispose();
                }
                primitivesData.splice(selectedPrimitiveIndex, 1);
                selectedPrimitiveIndex = Math.max(0, selectedPrimitiveIndex - 1);
                updatePrimitivesGUI();
            }
        }
    };

    const editFolder = primitivesFolder.addFolder('Editar forma geométrica:').close();

    editFolder.add(primControls, 'Seleccionado', primitiveOptions).name('Objeto seleccionado:').onChange((idx) => {
        selectedPrimitiveIndex = parseInt(idx);
        transformControls.attach(primitivesData[selectedPrimitiveIndex]);
        updatePrimitivesGUI();
        updateCoordinatesGUI();
    });

    editFolder.add(primControls, 'Nombre').name('Nombre del item:').onChange((val) => {
        if (currentMesh && val.trim()) {
            currentMesh.name = val.trim();
            updatePrimitivesGUI();
        }
    });

    editFolder.addColor(primControls, 'Color').name('Color:').onChange((colorHex) => {
        if (currentMesh) currentMesh.material.color.set(colorHex);
    });

    editFolder.add(primControls, 'Roughness', 0, 1, 0.01).name('Rugosidad:').onChange((v) => {
        if (currentMesh) currentMesh.material.roughness = v;
    });

    editFolder.add(primControls, 'Metalness', 0, 1, 0.01).name('Metalicidad:').onChange((v) => {
        if (currentMesh) currentMesh.material.metalness = v;
    });

    editFolder.add(primControls, 'Wireframe').name('Ver wireframe del objeto:').onChange((v) => {
        if (currentMesh) currentMesh.material.wireframe = v;
    });

    editFolder.add(primControls, 'Modo', ['translate', 'rotate', 'scale']).name('Modo de transformación:').onChange((mode) => {
        transformControls.setMode(mode);
    });

    editFolder.add(primControls, 'eliminar').name('Eliminar del área de trabajo');

    if (currentMesh) transformControls.attach(currentMesh);
}

function updateGLBInspectionGUI() {
    if (!gui || !currentModel) return;
    if (inspectionFolder) inspectionFolder.destroy();

    inspectionFolder = gui.addFolder('Inspector del modelo 3D').close();

    const inspectParams = {
        modoShading: 'Estándar',
        verTriangulos: false,
        submallaActiva: 'Ninguna'
    };

    inspectionFolder.add(inspectParams, 'modoShading', ['Estándar', 'RGB', 'Triángulos', 'Unlit / Sin luces'])
        .name('Escala:')
        .onChange((modo) => {
            currentModel.traverse((child) => {
                if (child.isMesh) {
                    if (modo === 'RGB') {
                        child.material = normalMaterial;
                    } else if (modo === 'Triángulos') {
                        child.material = wireframeMaterial;
                    } else if (modo === 'Unlit / Sin luces') {
                        if (!originalMaterialsMap.has(child.id)) originalMaterialsMap.set(child.id, child.material);
                        const orig = originalMaterialsMap.get(child.id);
                        child.material = new THREE.MeshBasicMaterial({
                            map: orig.map || null,
                            color: orig.color || 0xffffff
                        });
                    } else {
                        if (originalMaterialsMap.has(child.id)) child.material = originalMaterialsMap.get(child.id);
                    }
                }
            });
        });

    inspectionFolder.add(inspectParams, 'verTriangulos').name('Superponer triángulos:').onChange((v) => {
        currentModel.traverse((child) => {
            if (child.isMesh) {
                const mat = child.material;
                if (Array.isArray(mat)) mat.forEach(m => m.wireframe = v);
                else if (mat) mat.wireframe = v;
            }
        });
    });

    if (modelSubmeshes.length > 0) {
        const submeshMap = { 'Modelo completo': -1 };
        modelSubmeshes.forEach((m, idx) => submeshMap[m.name || `Pieza_${idx + 1}`] = idx);

        const submeshFolder = inspectionFolder.addFolder('Separar objetos').close();

        submeshFolder.add(inspectParams, 'submallaActiva', Object.keys(submeshMap))
            .name('Objeto a separar:')
            .onChange((name) => {
                const idx = submeshMap[name];
                if (idx === -1) {
                    transformControls.attach(currentModel);
                } else if (modelSubmeshes[idx]) {
                    transformControls.attach(modelSubmeshes[idx]);
                }
                updateCoordinatesGUI();
            });

        submeshFolder.add({
            desacoplar: () => {
                const active = transformControls.object;
                if (active && active !== currentModel && active.isMesh) {
                    scene.attach(active);
                    alert(`La pieza "${active.name}" se ha separado del modelo principal.`);
                }
            }
        }, 'desacoplar').name('Separar pieza');
    }
}

function updateExtraObjectsGUI() {
    if (!gui) return;
    if (extraObjectsFolder) extraObjectsFolder.destroy();

    if (extraObjectsData.length === 0) return;

    extraObjectsFolder = gui.addFolder('Objetos Extras 3D').close();

    const extraOptions = {};
    extraObjectsData.forEach((item, idx) => extraOptions[item.name || `Objeto ${idx + 1}`] = idx);

    const currentData = extraObjectsData[selectedExtraObjectIndex < extraObjectsData.length ? selectedExtraObjectIndex : 0];

    const extraControls = {
        ObjetoSeleccionado: selectedExtraObjectIndex < extraObjectsData.length ? selectedExtraObjectIndex : 0,
        Nombre: currentData ? currentData.name : '',
        Modo: transformControls.mode || 'translate',
        eliminar: () => {
            const idx = extraControls.ObjetoSeleccionado;
            if (extraObjectsData[idx]) {
                const itemToRemove = extraObjectsData[idx];

                if (transformControls.object === itemToRemove.object) transformControls.detach();
                scene.remove(itemToRemove.object);

                extraObjectsData.splice(idx, 1);
                selectedExtraObjectIndex = Math.max(0, idx - 1);
                updateExtraObjectsGUI();
            }
        }
    };

    extraObjectsFolder.add(extraControls, 'ObjetoSeleccionado', extraOptions)
        .name('Seleccionar Objeto')
        .onChange((idx) => {
            selectedExtraObjectIndex = parseInt(idx);
            updateExtraObjectsGUI();
            updateCoordinatesGUI();
        });

    extraObjectsFolder.add(extraControls, 'eliminar').name('🗑️ Eliminar Objeto');

    if (currentData) transformControls.attach(currentData.object);
}

function initGUI(gltf = null) {
    if (gui) gui.destroy();

    const guiContainer = document.getElementById('gui-container');
    gui = new GUI({ title: 'Controles del Modelo', container: guiContainer });

    if (gltf && gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(currentModel);

        const animFolder = gui.addFolder('Animaciones del Archivo').close();
        const animNames = gltf.animations.map((a, i) => a.name || 'Animación ' + (i + 1));
        const animControls = { Animación: animNames[0] };

        activeAction = mixer.clipAction(gltf.animations[0]);
        activeAction.play();

        animFolder.add(animControls, 'Animación', animNames).onChange((name) => {
            const clipIndex = animNames.indexOf(name);
            const newAction = mixer.clipAction(gltf.animations[clipIndex]);

            if (activeAction) activeAction.fadeOut(0.3);
            newAction.reset().fadeIn(0.3).play();
            activeAction = newAction;
        });
    }

    if (bones.length > 0) {
        const boneFolder = gui.addFolder('Puntos de movilidad').close();

        const boneMap = {};
        bones.forEach((b, i) => {
            boneMap[b.name || `Hueso_${i}`] = i;
            createBoneMarker(b);
        });

        const boneControls = { 
            HuesoActivo: Object.keys(boneMap)[0],
            modo: transformControls.mode || 'translate'
        };

        transformControls.detach();

        boneFolder.add(boneControls, 'HuesoActivo', Object.keys(boneMap))
            .name('Seleccionar Hueso')
            .onChange((name) => {
                const boneIndex = boneMap[name];
                if (bones[boneIndex]) {
                    transformControls.attach(bones[boneIndex]);
                    updateCoordinatesGUI();
                }
            });

        boneFolder.add(boneControls, 'modo', ['translate', 'rotate', 'scale'])
            .name('Modo de control')
            .onChange((mode) => {
                transformControls.setMode(mode);
            });
    }

    if (currentModel) {
        const animCreatorFolder = gui.addFolder('Creador de animación').close();
        const animParams = {
            capturasCount: '0 poses guardadas',
            capturarPose: () => {
                if (activeAction) activeAction.stop();
                const currentSnapshot = bones.map(b => ({ position: b.position.clone(), quaternion: b.quaternion.clone() }));
                capturedPoses.push(currentSnapshot);
                animParams.capturasCount = `${capturedPoses.length} pose(s) guardada(s)`;
                gui.controllersRecursive().forEach(c => c.updateDisplay());
            },
            limpiarPoses: () => {
                capturedPoses = [];
                animParams.capturasCount = '0 poses guardadas';
                gui.controllersRecursive().forEach(c => c.updateDisplay());
            },
            exportarAnimado: exportAnimatedGLB
        };

        animCreatorFolder.add(animParams, 'capturasCount').name('Estado').listen().disable();
        animCreatorFolder.add(animParams, 'capturarPose').name('Capturar pose');
        animCreatorFolder.add(animParams, 'limpiarPoses').name('Eliminar todas las poses');
        animCreatorFolder.add(animParams, 'exportarAnimado').name('Exportar modelo animado');
    }

    updateCameraGUI();
    if (currentModel) updateModelOptionsGUI();
    updateCoordinatesGUI();
    updateViewsGUI();
    updateLightsGUI();
    updateGridGUI();
    if (currentModel) updateGLBInspectionGUI();
    updatePrimitivesGUI();
    updateExtraObjectsGUI();
    gui.close();
}

function loadModelSource(source) {
    document.getElementById('sketchfab-iframe').style.display = 'none';
    initialModelSource = source;

    if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
        bones = [];
        modelSubmeshes = [];
        originalMaterialsMap.clear();
        initialBoneTransforms = [];
        capturedPoses = [];
        boneMarkers.forEach(m => scene.remove(m));
        boneMarkers.clear();
    }

    primitivesData.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }
    });
    primitivesData = [];
    selectedPrimitiveIndex = 0;
    transformControls.detach();
    updateCoordinatesGUI();

    if (typeof source === 'string' && source.includes('sketchfab.com/3d-models')) {
        const match = source.match(/([a-f0-9]{32})/);
        if (match) {
            const modelId = match[1];
            const iframe = document.getElementById('sketchfab-iframe');
            iframe.src = `https://sketchfab.com/models/${modelId}/embed?autostart=1`;
            iframe.style.display = 'block';
            if (gui) gui.destroy();
            return;
        }
    }

    let finalUrl = source;
    if (typeof source === 'string' && source.includes('github.com') && source.includes('/blob/')) {
        finalUrl = source.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    loader.load(
        finalUrl,
        (gltf) => {
            currentModel = gltf.scene;
            currentModel.name = 'MainModel';

            currentModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    modelSubmeshes.push(child);
                    originalMaterialsMap.set(child.id, child.material);
                }
                if (child.isBone) {
                    bones.push(child);
                    initialBoneTransforms.push({
                        position: child.position.clone(),
                        rotation: child.rotation.clone(),
                        scale: child.scale.clone()
                    });
                }
            });

            scene.add(currentModel);
            fitCameraToModel(currentModel);
            initGUI(gltf);
        },
        undefined,
        (error) => {
            console.error('Error al cargar:', error);
            alert('No se pudo cargar el modelo 3D.');
        }
    );
}

function addExtraObject(source) {
    const defaultName = `Objeto Extra ${extraObjectsData.length + 1}`;
    const objectName = prompt('Introduce un nombre para el objeto secundario:', defaultName) || defaultName;

    let finalUrl = source;
    if (typeof source === 'string' && source.includes('github.com') && source.includes('/blob/')) {
        finalUrl = source.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    loader.load(
        finalUrl,
        (gltf) => {
            const extraObj = gltf.scene;
            extraObj.name = objectName.trim();

            if (currentModel) {
                const box = new THREE.Box3().setFromObject(currentModel);
                const size = box.getSize(new THREE.Vector3());
                extraObj.position.set(size.x * 0.8 + 0.5, 0, 0);
            }

            const extraBones = [];
            extraObj.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
                if (child.isBone) extraBones.push(child);
            });

            scene.add(extraObj);
            extraObjectsData.push({ object: extraObj, bones: extraBones, name: extraObj.name });

            selectedExtraObjectIndex = extraObjectsData.length - 1;
            updateExtraObjectsGUI();
        },
        undefined,
        (error) => {
            console.error('Error al cargar objeto extra:', error);
            alert('No se pudo añadir el objeto 3D.');
        }
    );
}

function setSceneBackground(source, is3D = false) {
    const applyTexture = (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        if (is3D) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        } else {
            scene.environment = null;
            scene.background = texture;
        }
    };

    if (typeof source === 'string') {
        textureLoader.load(source, applyTexture, undefined, () => alert('No se pudo cargar el fondo.'));
    } else if (source instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => textureLoader.load(e.target.result, applyTexture);
        reader.readAsDataURL(source);
    }
}

window.addEventListener('dblclick', (event) => {
    if (event.target.tagName !== 'CANVAS') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    transformControls.detach();
    updateCoordinatesGUI();

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const hit = intersects.find(i => i.object.visible && !i.object.name.includes('TransformControls') && i.object !== gridHelper && i.object !== floorMesh);

        if (hit) {
            let obj = hit.object;

            if (obj.isSkinnedMesh && obj.skeleton) {
                let closestBone = null;
                let minDistance = Infinity;

                obj.skeleton.bones.forEach((b) => {
                    const worldPos = new THREE.Vector3();
                    b.getWorldPosition(worldPos);
                    const dist = worldPos.distanceTo(hit.point);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestBone = b;
                    }
                });

                if (closestBone) {
                    transformControls.attach(closestBone);
                    if (boneDropdownController) boneDropdownController.setValue(closestBone.name);
                    updateCoordinatesGUI();
                    return;
                }
            }

            transformControls.attach(obj);
            updateCoordinatesGUI();
        }
    }
});

function exportStaticGLB() {
    let targetObj = currentModel;
    if (!targetObj && primitivesData.length > 0) {
        targetObj = primitivesData[selectedPrimitiveIndex];
    }
    if (!targetObj) return;

    transformControls.detach();

    const exporter = new GLTFExporter();
    exporter.parse(
        targetObj,
        (glb) => {
            const blob = new Blob([glb], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'modelo_exportado.glb';
            link.click();
        },
        (err) => console.error('Error al exportar GLB:', err),
        { binary: true }
    );
}

function exportAnimatedGLB() {
    if (capturedPoses.length < 2) {
        alert('Debes capturar al menos 2 poses diferentes para crear una animación.');
        return;
    }

    transformControls.detach();

    const tracks = [];
    const durationPerFrame = 0.8;
    const times = capturedPoses.map((_, index) => index * durationPerFrame);

    bones.forEach((bone, boneIndex) => {
        const positionValues = [];
        const quaternionValues = [];

        capturedPoses.forEach((pose) => {
            const transform = pose[boneIndex];
            positionValues.push(transform.position.x, transform.position.y, transform.position.z);
            quaternionValues.push(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
        });

        const posTrack = new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, positionValues);
        const rotTrack = new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, quaternionValues);

        tracks.push(posTrack, rotTrack);
    });

    const clip = new THREE.AnimationClip('MiAnimacionPersonalizada', -1, tracks);

    const exporter = new GLTFExporter();
    exporter.parse(
        currentModel,
        (glb) => {
            const blob = new Blob([glb], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'modelo_animado.glb';
            link.click();
        },
        (err) => console.error('Error al exportar animación:', err),
        { binary: true, animations: [clip] }
    );
}

document.getElementById('load-url-btn').addEventListener('click', () => {
    const url = document.getElementById('url-input').value.trim();
    if (url) loadModelSource(url);
});

document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadModelSource(URL.createObjectURL(file));
});

document.getElementById('add-object-url-btn').addEventListener('click', () => {
    const url = document.getElementById('object-url-input').value.trim();
    if (url) addExtraObject(url);
});

document.getElementById('object-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) addExtraObject(URL.createObjectURL(file));
});

document.getElementById('bg-url-btn').addEventListener('click', () => {
    const url = document.getElementById('bg-url-input').value.trim();
    if (url) setSceneBackground(url, false);
});

document.getElementById('bg-3d-btn').addEventListener('click', () => {
    const url = document.getElementById('bg-url-input').value.trim();
    if (url) setSceneBackground(url, true);
});

document.getElementById('bg-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) setSceneBackground(file, false);
});

document.getElementById('bg-reset-btn').addEventListener('click', () => {
    scene.background = defaultBgColor;
    scene.environment = null;
});

const cards = Array.from(document.querySelectorAll('.panel-card'));
const prevBtn = document.getElementById('prev-menu-btn');
const nextBtn = document.getElementById('next-menu-btn');
const indicator = document.getElementById('menu-indicator');
const navBar = document.getElementById('nav-menu-bar');
const toggleBtn = document.getElementById('toggle-ui-btn');
const toggleText = document.getElementById('toggle-text');

let activeCardIndex = 0;
let uiVisible = true;

function updateMobileMenuDisplay() {
    if (window.innerWidth > 768) return;

    cards.forEach((card, index) => {
        if (uiVisible && index === activeCardIndex) {
            card.classList.add('active-card');
        } else {
            card.classList.remove('active-card');
        }
    });

    indicator.textContent = `${activeCardIndex + 1} / ${cards.length}`;
}

prevBtn.addEventListener('click', () => {
    activeCardIndex = (activeCardIndex - 1 + cards.length) % cards.length;
    updateMobileMenuDisplay();
});

nextBtn.addEventListener('click', () => {
    activeCardIndex = (activeCardIndex + 1) % cards.length;
    updateMobileMenuDisplay();
});

toggleBtn.addEventListener('click', () => {
    uiVisible = !uiVisible;

    if (window.innerWidth <= 768) {
        navBar.style.display = uiVisible ? 'flex' : 'none';
        updateMobileMenuDisplay();
    } else {
        const uiTop = document.getElementById('ui-top');
        const uiBottom = document.getElementById('ui-bottom');
        uiTop.style.display = uiVisible ? 'flex' : 'none';
        uiBottom.style.display = uiVisible ? 'flex' : 'none';
    }

    toggleText.textContent = uiVisible ? 'Ocultar IU' : 'Mostrar IU';
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    let targetObj = currentModel;
    if (!targetObj && primitivesData.length > 0) targetObj = primitivesData[selectedPrimitiveIndex];
    if (targetObj && currentModel) fitCameraToModel(targetObj);

    if (window.innerWidth <= 768) {
        updateMobileMenuDisplay();
    } else {
        cards.forEach(card => card.classList.remove('active-card'));
        const uiTop = document.getElementById('ui-top');
        const uiBottom = document.getElementById('ui-bottom');
        uiTop.style.display = uiVisible ? 'flex' : 'none';
        uiBottom.style.display = uiVisible ? 'flex' : 'none';
    }
});

initGUI();
createPrimitive('Cubo');

function animate() {
    requestAnimationFrame(animate);

    handleKeyboardControls();
    updateBoneMarkersPositions();

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    controls.update();
    renderer.render(scene, camera);
}

animate();

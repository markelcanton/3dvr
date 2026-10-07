import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GUI } from 'three/addons/gui';

const scene = new THREE.Scene();
const defaultBgColor = new THREE.Color(0x222222);
scene.background = defaultBgColor;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 2.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
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

const keysPressed = {};
window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    keysPressed[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});

function handleKeyboardControls() {
    const moveSpeed = 0.05;
    const rotateSpeed = 0.02;
    const zoomSpeed = 0.1;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

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

    if (hasMoved) {
        controls.update();
    }
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

scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

let currentModel = null;
let extraObjectsData = [];
let selectedExtraObjectIndex = 0;
let extraObjectsFolder = null;
let extraObjectDropdownController = null;
let mixer = null;
let activeAction = null;
let bones = [];
let initialBoneTransforms = [];
let capturedPoses = [];
let gui = null;
let boneDropdownController = null;
const clock = new THREE.Clock();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
const textureLoader = new THREE.TextureLoader();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function updateExtraObjectsGUI() {
    if (!gui) return;

    if (extraObjectsFolder) {
        extraObjectsFolder.destroy();
        extraObjectsFolder = null;
    }

    if (extraObjectsData.length === 0) return;

    extraObjectsFolder = gui.addFolder('Objetos Extras 3D');

    const extraOptions = {};
    extraObjectsData.forEach((item, idx) => {
        extraOptions[item.name || `Objeto ${idx + 1}`] = idx;
    });

    const currentData = extraObjectsData[selectedExtraObjectIndex < extraObjectsData.length ? selectedExtraObjectIndex : 0];

    const extraControls = {
        ObjetoSeleccionado: selectedExtraObjectIndex < extraObjectsData.length ? selectedExtraObjectIndex : 0,
        Nombre: currentData ? currentData.name : '',
        Modo: transformControls.mode || 'translate',
        HuesoActivo: '',
        eliminar: () => {
            const idx = extraControls.ObjetoSeleccionado;
            if (extraObjectsData[idx]) {
                const itemToRemove = extraObjectsData[idx];

                if (transformControls.object === itemToRemove.object || itemToRemove.bones.includes(transformControls.object)) {
                    transformControls.detach();
                }

                scene.remove(itemToRemove.object);

                itemToRemove.object.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });

                extraObjectsData.splice(idx, 1);
                selectedExtraObjectIndex = Math.max(0, idx - 1);
                updateExtraObjectsGUI();
            }
        }
    };

    extraObjectDropdownController = extraObjectsFolder.add(extraControls, 'ObjetoSeleccionado', extraOptions)
        .name('Seleccionar Objeto')
        .onChange((idx) => {
            selectedExtraObjectIndex = parseInt(idx);
            updateExtraObjectsGUI();
        });

    extraObjectsFolder.add(extraControls, 'Nombre').name('Nombre del Objeto').onChange((newName) => {
        if (currentData && newName.trim() !== '') {
            currentData.name = newName.trim();
            currentData.object.name = newName.trim();
            updateExtraObjectsGUI();
        }
    });

    extraObjectsFolder.add(extraControls, 'Modo', ['translate', 'rotate', 'scale'])
        .name('Modo Transformación')
        .onChange((mode) => {
            transformControls.setMode(mode);
        });

    if (currentData && currentData.bones.length > 0) {
        const extraBoneMap = {};
        currentData.bones.forEach((b, i) => {
            const name = b.name || `Hueso_${i}`;
            extraBoneMap[name] = i;
        });

        extraControls.HuesoActivo = Object.keys(extraBoneMap)[0];

        const extraBoneFolder = extraObjectsFolder.addFolder('Puntos de Movilidad');
        extraBoneFolder.add(extraControls, 'HuesoActivo', Object.keys(extraBoneMap))
            .name('Seleccionar hueso')
            .onChange((name) => {
                const boneIndex = extraBoneMap[name];
                if (currentData.bones[boneIndex]) {
                    transformControls.attach(currentData.bones[boneIndex]);
                }
            });

        const extraBonesListFolder = extraObjectsFolder.addFolder('Lista de Huesos (Ejes X,Y,Z)');
        extraBonesListFolder.close();

        currentData.bones.forEach((bone) => {
            const folder = extraBonesListFolder.addFolder(bone.name || 'Hueso');
            folder.add(bone.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X').listen();
            folder.add(bone.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y').listen();
            folder.add(bone.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z').listen();
            folder.close();
        });
    }

    extraObjectsFolder.add(extraControls, 'eliminar').name('🗑️ Eliminar Objeto');

    if (currentData) {
        transformControls.attach(currentData.object);
    }
}

function initGUI(gltf) {
    if (gui) gui.destroy();

    const guiContainer = document.getElementById('gui-container');
    gui = new GUI({ title: 'Controles del modelo', container: guiContainer });

    if (gltf && gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(currentModel);

        const animFolder = gui.addFolder('Animaciones del Archivo');
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
        const boneFolder = gui.addFolder('Puntos de movilidad');

        const boneMap = {};
        bones.forEach((b, i) => {
            const name = b.name || `Hueso_${i}`;
            boneMap[name] = i;
        });

        const boneControls = {
            HuesoActivo: Object.keys(boneMap)[0],
            Modo: 'rotate'
        };

        transformControls.detach();

        boneDropdownController = boneFolder.add(boneControls, 'HuesoActivo', Object.keys(boneMap))
            .name('Seleccionar Hueso')
            .onChange((name) => {
                const boneIndex = boneMap[name];
                if (bones[boneIndex]) transformControls.attach(bones[boneIndex]);
            });

        boneFolder.add(boneControls, 'Modo', ['rotate', 'translate']).name('Modo de control').onChange((mode) => {
            transformControls.setMode(mode);
        });

        const bonesFolder = gui.addFolder('Lista de huesos (Ejes X, Y, Z)');
        bonesFolder.close();

        bones.forEach((bone) => {
            const folder = bonesFolder.addFolder(bone.name || 'Hueso');
            folder.add(bone.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X').listen();
            folder.add(bone.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y').listen();
            folder.add(bone.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z').listen();
            folder.close();
        });
    }

    const animCreatorFolder = gui.addFolder('Creador de animación');

    const animParams = {
        capturasCount: '0 poses guardadas',
        capturarPose: () => {
            if (activeAction) activeAction.stop();

            const currentSnapshot = bones.map(b => ({
                position: b.position.clone(),
                quaternion: b.quaternion.clone()
            }));

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
    animCreatorFolder.add(animParams, 'exportarAnimado').name('Exportar modelo 3D animado');

    const optionsFolder = gui.addFolder('Opciones del modelo');
    optionsFolder.add({
        restablecerModelo: () => {
            if (activeAction) {
                activeAction.stop();
                activeAction.play();
            }
            bones.forEach((bone, index) => {
                const initial = initialBoneTransforms[index];
                if (initial) {
                    bone.position.copy(initial.position);
                    bone.rotation.copy(initial.rotation);
                    bone.scale.copy(initial.scale);
                }
            });
            gui.controllersRecursive().forEach(c => c.updateDisplay());
        }
    }, 'restablecerModelo').name('Restablecer modelo');

    optionsFolder.add({ guardarGLB: exportStaticGLB }, 'guardarGLB').name('Guardar como GLB');

    updateExtraObjectsGUI();
    gui.close();
}

function loadModelSource(source) {
    document.getElementById('sketchfab-iframe').style.display = 'none';

    if (currentModel) {
        scene.remove(currentModel);
        transformControls.detach();
        currentModel = null;
        bones = [];
        initialBoneTransforms = [];
        capturedPoses = [];
    }

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
            scene.add(currentModel);

            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const headHeight = center.y + (size.y * 0.25);

            controls.target.set(center.x, headHeight, center.z);
            camera.position.set(center.x, headHeight + (size.y * 0.1), center.z + (size.y * 0.8));
            controls.update();

            currentModel.traverse((child) => {
                if (child.isBone) {
                    bones.push(child);
                    initialBoneTransforms.push({
                        position: child.position.clone(),
                        rotation: child.rotation.clone(),
                        scale: child.scale.clone()
                    });
                }
            });

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
                if (child.isBone) {
                    extraBones.push(child);
                }
            });

            scene.add(extraObj);
            extraObjectsData.push({
                object: extraObj,
                bones: extraBones,
                name: extraObj.name
            });

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

function setSceneBackground(source) {
    if (typeof source === 'string') {
        textureLoader.load(
            source,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                scene.background = texture;
            },
            undefined,
            () => alert('No se pudo cargar la imagen de fondo.')
        );
    } else if (source instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
            textureLoader.load(e.target.result, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                scene.background = texture;
            });
        };
        reader.readAsDataURL(source);
    }
}

window.addEventListener('dblclick', (event) => {
    if (event.target.tagName !== 'CANVAS') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    transformControls.detach();

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const hit = intersects.find(i => i.object.visible && !i.object.name.includes('TransformControls'));

        if (hit) {
            let selectedBone = null;
            let obj = hit.object;
            let isMainModel = false;

            while (obj) {
                if (obj === currentModel) {
                    isMainModel = true;
                    break;
                }
                obj = obj.parent;
            }

            if (isMainModel) {
                if (hit.object.isSkinnedMesh && hit.object.skeleton) {
                    let minDistance = Infinity;
                    hit.object.skeleton.bones.forEach((b) => {
                        const boneWorldPos = new THREE.Vector3();
                        b.getWorldPosition(boneWorldPos);
                        const dist = boneWorldPos.distanceTo(hit.point);
                        if (dist < minDistance) {
                            minDistance = dist;
                            selectedBone = b;
                        }
                    });
                } else {
                    let boneCandidate = hit.object;
                    while (boneCandidate && !boneCandidate.isBone && boneCandidate.parent) {
                        boneCandidate = boneCandidate.parent;
                    }
                    if (boneCandidate && boneCandidate.isBone) selectedBone = boneCandidate;
                }

                if (selectedBone) {
                    transformControls.attach(selectedBone);
                    if (boneDropdownController) {
                        boneDropdownController.setValue(selectedBone.name);
                    }
                    return;
                }
            } else {
                let extraObjRoot = hit.object;
                while (extraObjRoot.parent && extraObjRoot.parent !== scene) {
                    extraObjRoot = extraObjRoot.parent;
                }

                const extraIdx = extraObjectsData.findIndex(item => item.object === extraObjRoot);
                if (extraIdx !== -1) {
                    selectedExtraObjectIndex = extraIdx;
                    transformControls.attach(extraObjRoot);
                    updateExtraObjectsGUI();
                    return;
                }
            }
        }
    }
});

function exportStaticGLB() {
    if (!currentModel) return;
    transformControls.detach();

    const exporter = new GLTFExporter();
    exporter.parse(
        currentModel,
        (glb) => {
            const blob = new Blob([glb], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'modelo_estatico.glb';
            link.click();
        },
        (err) => console.error(err),
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
    if (url) setSceneBackground(url);
});

document.getElementById('bg-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) setSceneBackground(file);
});

document.getElementById('bg-reset-btn').addEventListener('click', () => {
    scene.background = defaultBgColor;
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

const initialUrl = 'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular/727.glb';
document.getElementById('url-input').value = initialUrl;
loadModelSource(initialUrl);

function animate() {
    requestAnimationFrame(animate);

    handleKeyboardControls();

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

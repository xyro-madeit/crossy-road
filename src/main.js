import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './style.css';

const TILE = 2.2;
const HALF_WORLD = 7;
const COLS = HALF_WORLD * 2 + 1;
const START_ROW = 0;
const AHEAD_ROWS = 30;
const BEHIND_ROWS = 18;
const MAX_LIVES = 3;

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const canvas = document.querySelector('#game');
const scoreEl = document.querySelector('#score');
const livesEl = document.querySelector('#lives');
const startPanel = document.querySelector('#start-panel');
const startBtn = document.querySelector('#start-btn');
const gameOverPanel = document.querySelector('#game-over');
const restartBtn = document.querySelector('#restart-btn');
const finalScoreEl = document.querySelector('#final-score');
const statusEl = document.querySelector('#status');
const statusTitle = document.querySelector('#status-title');
const statusSubtitle = document.querySelector('#status-subtitle');
const flashEl = document.querySelector('#flash');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1822);
scene.fog = new THREE.FogExp2(0x0a1822, 0.018);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 260);
camera.position.set(18, 22, 22);
camera.lookAt(0, 0, -8);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.48, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hemi = new THREE.HemisphereLight(0xbfefff, 0x193018, 1.45);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d3, 2.2);
sun.position.set(12, 28, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x7cc8ff, 0.6);
fill.position.set(-14, 10, -16);
scene.add(fill);

const world = new THREE.Group();
scene.add(world);
const effects = new THREE.Group();
scene.add(effects);

const mats = {
  grass: new THREE.MeshStandardMaterial({ color: 0x4c9f54, roughness: 0.95 }),
  grassDark: new THREE.MeshStandardMaterial({ color: 0x357844, roughness: 1 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x594935, roughness: 1 }),
  cliff: new THREE.MeshStandardMaterial({ color: 0x2e261e, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x1f252b, roughness: 0.86 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x8c9499, metalness: 0.85, roughness: 0.32 }),
  sleeper: new THREE.MeshStandardMaterial({ color: 0x47392e, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x2196b7, emissive: 0x092a39, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.9 }),
  lava: new THREE.MeshStandardMaterial({ color: 0xff5a17, emissive: 0xff2800, emissiveIntensity: 2.2, roughness: 0.38 }),
  basalt: new THREE.MeshStandardMaterial({ color: 0x292929, roughness: 0.95 }),
  log: new THREE.MeshStandardMaterial({ color: 0x6f452d, roughness: 0.94 }),
  train: new THREE.MeshStandardMaterial({ color: 0xd22f3f, roughness: 0.48, metalness: 0.4 }),
  trainDark: new THREE.MeshStandardMaterial({ color: 0x151b21, roughness: 0.55, metalness: 0.62 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffd747, roughness: 0.55 }),
  red: new THREE.MeshStandardMaterial({ color: 0xf3475d, roughness: 0.6 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xf9a52b, roughness: 0.62 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xf0a126, roughness: 0.68 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.45 }),
  halo: new THREE.MeshStandardMaterial({ color: 0xfff49b, emissive: 0xffdc53, emissiveIntensity: 2.4, metalness: 0.08, roughness: 0.32 }),
  wing: new THREE.MeshStandardMaterial({ color: 0xf6fbff, emissive: 0xa9e7ff, emissiveIntensity: 0.55, roughness: 0.5 }),
};

const state = {
  started: false,
  gameOver: false,
  lives: MAX_LIVES,
  score: 0,
  maxRow: 0,
  row: START_ROW,
  col: 0,
  moving: false,
  angel: false,
  angelInvulnUntil: 0,
  deadUntil: 0,
  history: [{ row: 0, col: 0 }],
  lanes: new Map(),
  movingObjects: [],
  lastTime: performance.now(),
  elapsed: 0,
  shake: 0,
  cameraY: 0,
};

function box(w, h, d, mat, x = 0, y = 0, z = 0, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function cylinder(r, h, mat, x = 0, y = 0, z = 0, rotZ = Math.PI / 2) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotZ;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundedBush(x, z, scale = 1) {
  const g = new THREE.Group();
  const leaf = new THREE.MeshStandardMaterial({ color: pick([0x2b743c, 0x3c8b45, 0x28683d]), roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.45, 0.7) * scale, 1), leaf);
    s.position.set((i - 1) * 0.42 * scale, rand(0.42, 0.66) * scale, rand(-0.18, 0.18) * scale);
    s.castShadow = true;
    g.add(s);
  }
  g.position.set(x, 0.3, z);
  return g;
}

function createChicken() {
  const g = new THREE.Group();
  const body = box(1.02, 1.06, 1.16, mats.white, 0, 0.86, 0);
  body.geometry.translate(0, 0.03, 0);
  g.add(body);

  const head = box(0.78, 0.82, 0.78, mats.white, 0, 1.7, -0.14);
  g.add(head);
  g.add(box(0.34, 0.24, 0.38, mats.beak, 0, 1.6, -0.62));
  g.add(box(0.09, 0.11, 0.06, mats.eye, -0.2, 1.82, -0.54));
  g.add(box(0.09, 0.11, 0.06, mats.eye, 0.2, 1.82, -0.54));

  const comb = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mats.red);
    c.position.set((i - 1) * 0.17, 2.17 + (i === 1 ? 0.05 : 0), -0.06);
    comb.add(c);
  }
  g.add(comb);

  const legMat = new THREE.MeshStandardMaterial({ color: 0xd68e25, roughness: 0.8 });
  const leftLeg = box(0.12, 0.44, 0.12, legMat, -0.27, 0.15, 0.04);
  const rightLeg = box(0.12, 0.44, 0.12, legMat, 0.27, 0.15, 0.04);
  g.add(leftLeg, rightLeg);

  const leftWing = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 8), mats.wing);
  leftWing.scale.set(0.4, 0.68, 1.15);
  leftWing.position.set(-0.62, 1.02, 0.04);
  leftWing.visible = false;
  g.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.position.x = 0.62;
  rightWing.visible = false;
  g.add(rightWing);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 10, 30), mats.halo);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 2.62;
  halo.visible = false;
  g.add(halo);

  const glow = new THREE.PointLight(0xbfefff, 0, 8, 2);
  glow.position.y = 1.4;
  g.add(glow);

  g.userData = { body, head, leftLeg, rightLeg, leftWing, rightWing, halo, glow };
  return g;
}

const chicken = createChicken();
scene.add(chicken);
chicken.position.set(0, 0.5, 0);

function setAngelMode(on) {
  state.angel = on;
  const u = chicken.userData;
  u.leftWing.visible = on;
  u.rightWing.visible = on;
  u.halo.visible = on;
  u.glow.intensity = on ? 2.2 : 0;
  if (on) spawnSparkRing(chicken.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xb8edff, 34, 5.2);
}

function safeRowToZ(row) { return -row * TILE; }
function colToX(col) { return col * TILE; }

function createLane(row, type) {
  const group = new THREE.Group();
  group.position.z = safeRowToZ(row);
  const lane = { row, type, group, pits: new Set(), platforms: [], carriers: [], hazards: [], speed: 0, dir: 1, phase: rand(0, 20) };
  const width = COLS * TILE;

  if (type === 'grass' || type === 'start') {
    group.add(box(width, 0.52, TILE, row % 2 ? mats.grassDark : mats.grass, 0, -0.3, 0));
    if (type !== 'start') {
      const bushCount = Math.floor(rand(1, 5));
      const blocked = new Set();
      for (let i = 0; i < bushCount; i++) {
        const c = Math.floor(rand(-HALF_WORLD, HALF_WORLD + 1));
        if (Math.abs(c) < 2 && Math.random() < 0.65) continue;
        if (blocked.has(c)) continue;
        blocked.add(c);
        const b = roundedBush(colToX(c), 0, rand(0.65, 1));
        b.userData.blockCol = c;
        group.add(b);
      }
      lane.blocked = blocked;
    }
  }

  if (type === 'cliff') {
    group.add(box(width, 0.7, TILE, mats.dirt, 0, -0.42, 0));
    const pitCount = Math.floor(rand(2, 5));
    const pits = new Set();
    while (pits.size < pitCount) {
      const c = Math.floor(rand(-HALF_WORLD + 1, HALF_WORLD));
      if (Math.abs(c) <= 1 && row < 6) continue;
      pits.add(c);
    }
    lane.pits = pits;
    for (let c = -HALF_WORLD; c <= HALF_WORLD; c++) {
      if (pits.has(c)) {
        const rim = box(TILE * 0.96, 0.12, TILE * 0.94, mats.cliff, colToX(c), -0.08, 0);
        group.add(rim);
        const hole = box(TILE * 0.72, 0.05, TILE * 0.72, new THREE.MeshBasicMaterial({ color: 0x020508 }), colToX(c), 0.01, 0, false, false);
        group.add(hole);
      } else {
        group.add(box(TILE * 0.88, 0.09, TILE * 0.88, row % 2 ? mats.grassDark : mats.grass, colToX(c), 0.01, 0));
      }
    }
  }

  if (type === 'river') {
    const water = box(width, 0.25, TILE, mats.water, 0, -0.26, 0, false, true);
    group.add(water);
    lane.speed = rand(1.5, 2.8);
    lane.dir = Math.random() > 0.5 ? 1 : -1;
    const logCount = Math.floor(rand(4, 7));
    for (let i = 0; i < logCount; i++) {
      const log = cylinder(0.34, rand(2.4, 4.2), mats.log, rand(-width / 2, width / 2), 0.18, 0);
      log.userData = { kind: 'log', lane, length: log.geometry.parameters.height };
      group.add(log);
      lane.carriers.push(log);
      state.movingObjects.push(log);
    }
    for (let i = -HALF_WORLD; i <= HALF_WORLD; i += 2) {
      const ripple = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 6, 20), new THREE.MeshBasicMaterial({ color: 0x8ae8ff, transparent: true, opacity: 0.25 }));
      ripple.rotation.x = Math.PI / 2;
      ripple.position.set(colToX(i) + rand(-0.7, 0.7), 0.04, rand(-0.5, 0.5));
      ripple.userData.ripple = true;
      group.add(ripple);
    }
  }

  if (type === 'lava') {
    group.add(box(width, 0.28, TILE, mats.lava, 0, -0.23, 0));
    const safeCount = Math.floor(rand(5, 8));
    const safeCols = new Set();
    while (safeCols.size < safeCount) safeCols.add(Math.floor(rand(-HALF_WORLD, HALF_WORLD + 1)));
    lane.safeCols = safeCols;
    for (const c of safeCols) {
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.88, 0.24, 7), mats.basalt);
      rock.position.set(colToX(c), 0.06, 0);
      rock.rotation.y = rand(0, Math.PI);
      rock.castShadow = true;
      group.add(rock);
    }
    for (let i = 0; i < 8; i++) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(rand(0.08, 0.17), 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb01f }));
      bubble.position.set(rand(-width / 2, width / 2), rand(0.02, 0.16), rand(-0.75, 0.75));
      bubble.userData.lavaBubble = { phase: rand(0, Math.PI * 2), baseY: bubble.position.y };
      group.add(bubble);
    }
  }

  if (type === 'train') {
    group.add(box(width, 0.35, TILE, mats.dirt, 0, -0.26, 0));
    for (let x = -width / 2; x < width / 2; x += 1.25) group.add(box(0.22, 0.14, 1.82, mats.sleeper, x, 0.01, 0));
    group.add(box(width, 0.11, 0.13, mats.rail, 0, 0.12, -0.56));
    group.add(box(width, 0.11, 0.13, mats.rail, 0, 0.12, 0.56));
    lane.speed = rand(7.2, 11.5);
    lane.dir = Math.random() > 0.5 ? 1 : -1;
    const train = createTrain(lane.dir);
    train.position.x = lane.dir > 0 ? -width * 0.75 : width * 0.75;
    group.add(train);
    lane.hazards.push(train);
    state.movingObjects.push(train);
    lane.train = train;

    const signalPole = box(0.16, 1.75, 0.16, mats.trainDark, -HALF_WORLD * TILE + 0.9, 0.72, 0.78);
    const signalLamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4a0d11, emissive: 0xff2138, emissiveIntensity: 0.35 }));
    signalLamp.position.set(-HALF_WORLD * TILE + 0.9, 1.55, 0.78);
    group.add(signalPole, signalLamp);
    lane.signalLamp = signalLamp;
  }

  world.add(group);
  state.lanes.set(row, lane);
  return lane;
}

function createTrain(dir) {
  const g = new THREE.Group();
  const engine = box(6.4, 1.5, 1.72, mats.train, 0, 0.88, 0);
  g.add(engine);
  const nose = box(1.05, 1.15, 1.55, mats.trainDark, dir * 3.22, 0.88, 0);
  g.add(nose);
  for (let i = -2; i <= 2; i++) {
    const win = box(0.64, 0.42, 0.04, mats.trainDark, i * 1.04, 1.15, -0.88, false, false);
    g.add(win);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3a7 });
  const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), headMat);
  headlight.position.set(dir * 3.78, 0.95, -0.5);
  g.add(headlight);
  const headlight2 = headlight.clone();
  headlight2.position.z = 0.5;
  g.add(headlight2);

  for (const x of [-2.1, 2.1]) {
    const wheel = cylinder(0.34, 0.16, mats.trainDark, x, 0.18, -0.86, Math.PI / 2);
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
    const wheel2 = wheel.clone();
    wheel2.position.z = 0.86;
    g.add(wheel2);
  }

  g.userData = { kind: 'train', halfWidth: 3.75, dir };
  return g;
}

function chooseLaneType(row) {
  if (row <= 2) return 'grass';
  const prev = state.lanes.get(row - 1)?.type;
  const roll = Math.random();
  let type;
  if (roll < 0.34) type = 'grass';
  else if (roll < 0.52) type = 'cliff';
  else if (roll < 0.70) type = 'river';
  else if (roll < 0.84) type = 'lava';
  else type = 'train';
  if ((type === 'lava' || type === 'river') && prev === type && Math.random() < 0.5) type = 'grass';
  return type;
}

function ensureWorld() {
  for (let r = state.row - BEHIND_ROWS; r <= state.row + AHEAD_ROWS; r++) {
    if (!state.lanes.has(r)) createLane(r, r === 0 ? 'start' : chooseLaneType(r));
  }
  for (const [r, lane] of [...state.lanes]) {
    if (r < state.row - BEHIND_ROWS - 4 || r > state.row + AHEAD_ROWS + 4) {
      world.remove(lane.group);
      for (const obj of [...lane.carriers, ...lane.hazards]) {
        const idx = state.movingObjects.indexOf(obj);
        if (idx >= 0) state.movingObjects.splice(idx, 1);
      }
      state.lanes.delete(r);
    }
  }
}

function buildInitialWorld() {
  for (const lane of state.lanes.values()) world.remove(lane.group);
  state.lanes.clear();
  state.movingObjects.length = 0;
  for (let r = -8; r <= AHEAD_ROWS; r++) createLane(r, r === 0 ? 'start' : chooseLaneType(r));
}

function flash(color = 'white', amount = 0.82) {
  flashEl.style.background = color;
  flashEl.style.opacity = String(amount);
  setTimeout(() => { flashEl.style.transition = 'opacity .48s ease'; flashEl.style.opacity = '0'; }, 20);
  setTimeout(() => { flashEl.style.transition = ''; }, 560);
}

function showStatus(title, subtitle, duration = 1300) {
  statusTitle.textContent = title;
  statusSubtitle.textContent = subtitle;
  statusEl.classList.remove('hidden');
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => statusEl.classList.add('hidden'), duration);
}

function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = Array.from({ length: MAX_LIVES }, (_, i) => i < state.lives ? '❤' : '♡').join(' ');
  livesEl.setAttribute('aria-label', `${state.lives} lives remaining`);
}

function canEnter(row, col) {
  if (Math.abs(col) > HALF_WORLD) return false;
  const lane = state.lanes.get(row);
  if (!lane) return true;
  if (lane.blocked?.has(col)) return false;
  return true;
}

function move(dir) {
  if (!state.started || state.gameOver || state.moving || performance.now() < state.deadUntil) return;
  const delta = { forward: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1] }[dir];
  if (!delta) return;

  const nextRow = state.row + delta[0];
  const nextCol = state.col + delta[1];
  if (!canEnter(nextRow, nextCol)) {
    bumpVfx(dir);
    sfx('bump');
    return;
  }

  state.moving = true;
  const from = chicken.position.clone();
  const to = new THREE.Vector3(colToX(nextCol), 0.5, safeRowToZ(nextRow));
  const duration = 165;
  const start = performance.now();
  const u = chicken.userData;
  const targetRot = dir === 'forward' ? 0 : dir === 'back' ? Math.PI : dir === 'left' ? -Math.PI / 2 : Math.PI / 2;

  spawnHopDust(from.clone().add(new THREE.Vector3(0, 0.1, 0)));
  sfx('hop');

  function hop(now) {
    const t = clamp((now - start) / duration, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    chicken.position.x = lerp(from.x, to.x, e);
    chicken.position.z = lerp(from.z, to.z, e);
    chicken.position.y = 0.5 + Math.sin(t * Math.PI) * 0.95;
    chicken.rotation.y = lerpAngle(chicken.rotation.y, targetRot, 0.24);
    const squash = 1 + Math.sin(t * Math.PI) * 0.13;
    chicken.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    u.leftLeg.rotation.x = Math.sin(t * Math.PI * 2) * 0.4;
    u.rightLeg.rotation.x = -u.leftLeg.rotation.x;
    if (t < 1) requestAnimationFrame(hop);
    else {
      chicken.position.copy(to);
      chicken.scale.set(1, 1, 1);
      state.row = nextRow;
      state.col = nextCol;
      state.moving = false;
      onStep();
    }
  }
  requestAnimationFrame(hop);
}

function lerpAngle(a, b, t) {
  let d = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

function onStep() {
  state.history.push({ row: state.row, col: state.col });
  if (state.history.length > 80) state.history.shift();
  if (state.row > state.maxRow) {
    state.maxRow = state.row;
    state.score = state.maxRow;
    updateHUD();
  }
  ensureWorld();
  checkCurrentLane(true);
}

function checkCurrentLane(fromStep = false) {
  if (!state.started || state.gameOver || performance.now() < state.deadUntil) return;
  const lane = state.lanes.get(state.row);
  if (!lane) return;
  const x = chicken.position.x;

  if (lane.type === 'cliff' && lane.pits.has(state.col)) {
    die('cliff');
    return;
  }

  if (lane.type === 'lava' && !lane.safeCols.has(state.col)) {
    die('lava');
    return;
  }

  if (lane.type === 'river') {
    let onLog = false;
    for (const log of lane.carriers) {
      const wx = log.position.x;
      const halfLen = (log.geometry.parameters.height || 3) * 0.5;
      if (Math.abs(x - wx) < halfLen + 0.35) {
        onLog = true;
        break;
      }
    }
    if (!onLog && !fromStep) die('water');
  }

  if (lane.type === 'train' && lane.train) {
    const tx = lane.train.position.x;
    if (Math.abs(x - tx) < lane.train.userData.halfWidth + 0.5) die('train');
  }

  if (Math.abs(chicken.position.x) > (HALF_WORLD + 0.65) * TILE) die(lane.type === 'river' ? 'water' : 'cliff');
}

function die(kind) {
  const now = performance.now();
  if (now < state.angelInvulnUntil || now < state.deadUntil || state.gameOver) return;
  state.deadUntil = now + 1050;
  state.lives -= 1;
  updateHUD();
  state.shake = kind === 'train' ? 1.4 : 0.9;

  const pos = chicken.position.clone().add(new THREE.Vector3(0, 1, 0));
  if (kind === 'lava') {
    spawnBurst(pos, 0xff4a00, 48, 7.4, 1.2);
    flash('#ff6a2a', 0.7);
  } else if (kind === 'water') {
    spawnBurst(pos, 0x63dfff, 38, 5.2, 0.9);
    spawnSplash(chicken.position.clone());
    flash('#9eeaff', 0.45);
  } else if (kind === 'train') {
    spawnBurst(pos, 0xffffff, 50, 8.5, 1.4);
    spawnBurst(pos, 0xff3957, 24, 6.5, 1.1);
    flash('#ffffff', 0.92);
  } else {
    spawnBurst(pos, 0xc6d0d7, 34, 5.4, 0.9);
    flash('#d9e8ef', 0.5);
  }
  sfx(kind);

  const labels = {
    cliff: ['OFF THE EDGE', 'rewinding 10 steps'],
    lava: ['TOO CRISPY', 'rewinding 10 steps'],
    water: ['SPLASHED', 'rewinding 10 steps'],
    train: ['TRAIN WINS', 'rewinding 10 steps'],
  };
  showStatus(labels[kind][0], labels[kind][1], 1150);

  chicken.visible = false;

  if (state.lives <= 0) {
    setTimeout(endGame, 980);
    return;
  }

  setTimeout(() => respawnTenBack(), 780);
}

function respawnTenBack() {
  const idx = Math.max(0, state.history.length - 11);
  let target = state.history[idx] || { row: 0, col: 0 };
  for (let i = idx; i >= 0; i--) {
    const candidate = state.history[i];
    const lane = state.lanes.get(candidate.row);
    if (!lane) continue;
    const unsafeCliff = lane.type === 'cliff' && lane.pits.has(candidate.col);
    const unsafeLava = lane.type === 'lava' && !lane.safeCols.has(candidate.col);
    const unsafeRiver = lane.type === 'river';
    if (!unsafeCliff && !unsafeLava && !unsafeRiver && lane.type !== 'train') {
      target = candidate;
      break;
    }
  }

  state.row = target.row;
  state.col = target.col;
  chicken.position.set(colToX(target.col), 0.5, safeRowToZ(target.row));
  chicken.visible = true;
  state.angelInvulnUntil = performance.now() + 2200;
  setAngelMode(true);
  spawnSparkRing(chicken.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xfff2a1, 50, 6.4);
  showStatus('ANGEL CHICKEN', '2 seconds of grace', 1400);
  sfx('angel');
  state.deadUntil = performance.now() + 360;
  ensureWorld();
}

function endGame() {
  state.gameOver = true;
  chicken.visible = true;
  chicken.rotation.z = -Math.PI / 2;
  finalScoreEl.textContent = `Distance: ${state.score} steps`;
  gameOverPanel.classList.remove('hidden');
  showStatus('3 LIVES USED', 'the road remembers', 900);
}

function resetGame() {
  state.started = true;
  state.gameOver = false;
  state.lives = MAX_LIVES;
  state.score = 0;
  state.maxRow = 0;
  state.row = 0;
  state.col = 0;
  state.moving = false;
  state.angel = false;
  state.angelInvulnUntil = 0;
  state.deadUntil = 0;
  state.history = [{ row: 0, col: 0 }];
  chicken.visible = true;
  chicken.position.set(0, 0.5, 0);
  chicken.rotation.set(0, 0, 0);
  chicken.scale.set(1, 1, 1);
  setAngelMode(false);
  buildInitialWorld();
  updateHUD();
  gameOverPanel.classList.add('hidden');
  startPanel.classList.add('hidden');
  flash('#d7fbff', 0.45);
  sfx('start');
}

function bumpVfx(dir) {
  const p = chicken.position.clone().add(new THREE.Vector3(0, 0.7, -0.2));
  spawnBurst(p, 0xffffff, 8, 2.3, 0.38);
  state.shake = Math.max(state.shake, 0.22);
}

function spawnHopDust(pos) {
  spawnBurst(pos, 0xd7efdc, 8, 1.4, 0.22, true);
}

function spawnBurst(position, color, count = 28, speed = 5, life = 0.8, tiny = false) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    const v = new THREE.Vector3(rand(-1, 1), rand(0.15, 1.5), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.35, speed));
    velocities.push(v);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: tiny ? 0.08 : 0.16, transparent: true, opacity: 1, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.userData.fx = { type: 'particles', velocities, age: 0, life, gravity: tiny ? 2.2 : 5.6 };
  effects.add(points);
}

function spawnSparkRing(position, color = 0xffffff, count = 36, speed = 4.5) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    velocities.push(new THREE.Vector3(Math.cos(a) * speed, rand(-0.2, 1.1), Math.sin(a) * speed));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.13, transparent: true, opacity: 1, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.userData.fx = { type: 'particles', velocities, age: 0, life: 0.95, gravity: 1.4 };
  effects.add(points);
}

function spawnSplash(position) {
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.25 + i * 0.08, 0.028, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0x8beaff, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = 0.03;
    ring.userData.fx = { type: 'ring', age: -i * 0.08, life: 0.85 };
    effects.add(ring);
  }
}

function updateEffects(dt) {
  for (const obj of [...effects.children]) {
    const fx = obj.userData.fx;
    if (!fx) continue;
    fx.age += dt;
    if (fx.age > fx.life) {
      effects.remove(obj);
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
      continue;
    }
    if (fx.type === 'particles') {
      const pos = obj.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = fx.velocities[i];
        v.y -= fx.gravity * dt;
        pos.array[i * 3] += v.x * dt;
        pos.array[i * 3 + 1] += v.y * dt;
        pos.array[i * 3 + 2] += v.z * dt;
      }
      pos.needsUpdate = true;
      obj.material.opacity = 1 - fx.age / fx.life;
    }
    if (fx.type === 'ring') {
      if (fx.age < 0) continue;
      const t = fx.age / fx.life;
      obj.scale.setScalar(1 + t * 5.5);
      obj.material.opacity = (1 - t) * 0.65;
    }
  }
}

function updateLanes(dt) {
  const width = COLS * TILE;
  for (const lane of state.lanes.values()) {
    lane.phase += dt;
    if (lane.type === 'river') {
      for (const log of lane.carriers) {
        log.position.x += lane.speed * lane.dir * dt;
        const half = (log.geometry.parameters.height || 3) * 0.5;
        if (lane.dir > 0 && log.position.x > width / 2 + half) log.position.x = -width / 2 - half;
        if (lane.dir < 0 && log.position.x < -width / 2 - half) log.position.x = width / 2 + half;
        log.rotation.x += dt * lane.dir * 0.35;
      }
      if (lane.row === state.row && !state.moving && performance.now() >= state.deadUntil) {
        const currentX = chicken.position.x;
        const carrier = lane.carriers.find((log) => Math.abs(currentX - log.position.x) < (log.geometry.parameters.height || 3) * 0.5 + 0.35);
        if (carrier) {
          chicken.position.x += lane.speed * lane.dir * dt;
          state.col = clamp(Math.round(chicken.position.x / TILE), -HALF_WORLD, HALF_WORLD);
        }
      }
      for (const child of lane.group.children) {
        if (child.userData.ripple) {
          const s = 1 + Math.sin(state.elapsed * 2.6 + child.position.x) * 0.12;
          child.scale.setScalar(s);
          child.material.opacity = 0.18 + Math.sin(state.elapsed * 2 + child.position.x) * 0.07;
        }
      }
    }
    if (lane.type === 'lava') {
      for (const child of lane.group.children) {
        if (child.userData.lavaBubble) {
          const d = child.userData.lavaBubble;
          child.position.y = d.baseY + Math.max(0, Math.sin(state.elapsed * 2.8 + d.phase)) * 0.23;
          const s = 0.75 + Math.max(0, Math.sin(state.elapsed * 2.8 + d.phase)) * 0.8;
          child.scale.setScalar(s);
        }
      }
    }
    if (lane.type === 'train' && lane.train) {
      const train = lane.train;
      train.position.x += lane.speed * lane.dir * dt;
      const wrap = width / 2 + 10;
      if (lane.dir > 0 && train.position.x > wrap) train.position.x = -wrap - rand(6, 18);
      if (lane.dir < 0 && train.position.x < -wrap) train.position.x = wrap + rand(6, 18);
      const nearPlayer = lane.row === state.row && Math.abs(train.position.x - chicken.position.x) < 8;
      if (nearPlayer) state.shake = Math.max(state.shake, 0.12);
      if (lane.signalLamp) {
        const warning = Math.abs(train.position.x) < width * 0.65;
        lane.signalLamp.material.emissiveIntensity = warning ? 2.8 + Math.sin(state.elapsed * 18) * 1.4 : 0.35;
        lane.signalLamp.scale.setScalar(warning ? 1 + Math.max(0, Math.sin(state.elapsed * 18)) * 0.18 : 1);
      }
    }
  }
}

function updateChicken(dt) {
  const u = chicken.userData;
  const t = state.elapsed;
  if (!state.moving && chicken.visible && !state.gameOver) {
    chicken.position.y = 0.5 + Math.sin(t * 3.4) * 0.035;
    u.head.rotation.z = Math.sin(t * 2.5) * 0.035;
  }
  if (state.angel) {
    u.halo.position.y = 2.62 + Math.sin(t * 3.2) * 0.08;
    u.halo.rotation.z += dt * 0.85;
    u.leftWing.rotation.z = 0.35 + Math.sin(t * 9.5) * 0.42;
    u.rightWing.rotation.z = -0.35 - Math.sin(t * 9.5) * 0.42;
    u.glow.intensity = 2.05 + Math.sin(t * 5.2) * 0.45;
  }
}

function updateCamera(dt) {
  const desiredTarget = new THREE.Vector3(chicken.position.x * 0.22, 0.4, chicken.position.z - 4.5);
  const basePos = new THREE.Vector3(
    18 + chicken.position.x * 0.18,
    21.5,
    chicken.position.z + 22
  );
  camera.position.lerp(basePos, 1 - Math.pow(0.0008, dt));
  if (state.shake > 0.001) {
    camera.position.x += rand(-state.shake, state.shake) * 0.3;
    camera.position.y += rand(-state.shake, state.shake) * 0.22;
    camera.position.z += rand(-state.shake, state.shake) * 0.18;
    state.shake *= Math.pow(0.045, dt);
  } else state.shake = 0;
  camera.lookAt(desiredTarget);
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - state.lastTime) / 1000, 0.05);
  state.lastTime = now;
  state.elapsed += dt;
  updateLanes(dt);
  updateEffects(dt);
  updateChicken(dt);
  updateCamera(dt);
  if (state.started && !state.gameOver && !state.moving) checkCurrentLane(false);
  composer.render();
}
requestAnimationFrame(tick);

let audioCtx;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, duration, type = 'sine', volume = 0.05, glide = 0) {
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), audioCtx.currentTime + duration);
  g.gain.setValueAtTime(volume, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}

function sfx(name) {
  try {
    if (name === 'hop') tone(420, 0.07, 'square', 0.018, 130);
    if (name === 'bump') tone(95, 0.08, 'square', 0.03, -20);
    if (name === 'start') { tone(330, 0.12, 'triangle', 0.04, 210); setTimeout(() => tone(550, 0.15, 'triangle', 0.035, 200), 80); }
    if (name === 'cliff') tone(190, 0.5, 'sawtooth', 0.04, -120);
    if (name === 'lava') { tone(120, 0.45, 'sawtooth', 0.055, -55); tone(65, 0.65, 'square', 0.025, -20); }
    if (name === 'water') { tone(240, 0.24, 'sine', 0.045, -160); tone(130, 0.36, 'sine', 0.025, -70); }
    if (name === 'train') { tone(72, 0.52, 'sawtooth', 0.075, -25); tone(520, 0.13, 'square', 0.03, -180); }
    if (name === 'angel') { tone(660, 0.35, 'sine', 0.03, 240); setTimeout(() => tone(990, 0.42, 'sine', 0.022, 330), 120); }
  } catch (_) {}
}

const keyMap = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
window.addEventListener('keydown', (e) => {
  const dir = keyMap[e.code];
  if (dir) {
    e.preventDefault();
    move(dir);
  }
});

document.querySelectorAll('[data-move]').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    move(btn.dataset.move);
  });
});

let touchStart = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  touchStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!touchStart || e.pointerType === 'mouse') return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.hypot(dx, dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'back' : 'forward');
});

startBtn.addEventListener('click', resetGame);
restartBtn.addEventListener('click', resetGame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

buildInitialWorld();
updateHUD();

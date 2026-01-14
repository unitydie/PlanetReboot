// Minimal WebGL scene (Three.js): cosmos + planet + HUD.

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.146.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.146.0/examples/jsm/loaders/GLTFLoader.js";
import { mergeBufferGeometries } from "https://unpkg.com/three@0.146.0/examples/jsm/utils/BufferGeometryUtils.js";
import "./ui.js";

// --- Asset paths --------------------------------------------------------------
const BASE = "/PlanetReboot/";

const assetUrl = (path) => new URL(path.replace(/^\//, ""), window.location.origin + BASE).href;

// или проще без URL():
const assetPath = (path) => BASE + path.replace(/^\//, "");

const MODEL_PLANET  = assetPath("assets/models/planet.glb");
const MODEL_TRASH   = assetPath("assets/models/trash.glb");
const MODEL_BOTTLE  = assetPath("assets/models/bottle.glb");
const MODEL_GARBAGE = assetPath("assets/models/garbage.glb");
const MODEL_SPUTNIK = assetPath("assets/models/sputnik.glb");

// --- Simulation tuning --------------------------------------------------------
const STORAGE_KEY = "circularSim.min.v1";
const DEFAULT_HEALTH = 80;
const DEFAULT_YEARS = 75;
const YEARS_MAX = 120;
const MAX_TRASH_INSTANCES = 600;

// --- DOM ---------------------------------------------------------------------
const dom = {
  webgl: document.getElementById("webgl"),
  healthFill: document.getElementById("healthFill"),
  healthValue: document.getElementById("healthValue"),
  yearsValue: document.getElementById("yearsValue"),
  trashCount: document.getElementById("trashCount"),
  btnPause: document.getElementById("btnPause"),
  btnReset: document.getElementById("btnReset"),
  recycleFx: document.getElementById("recycleFx"),
  consequence: document.getElementById("consequence"),
  consequenceCard: document.getElementById("consequenceCard"),
  consequenceTag: document.getElementById("consequenceTag"),
  consequenceText: document.getElementById("consequenceText"),
  tabSpace: document.getElementById("tabSpace"),
  panelSpace: document.getElementById("panelSpace"),
  tabPickup: document.getElementById("tabPickup"),
  panelPickup: document.getElementById("panelPickup"),
  satDebris: document.getElementById("satDebris"),
  satHarm: document.getElementById("satHarm"),
  satImpact: document.getElementById("satImpact"),

  pickupForm: document.getElementById("pickupForm"),
  pickupCopy: document.getElementById("pickupCopy"),
  pickupDownload: document.getElementById("pickupDownload"),
  pickupStatus: document.getElementById("pickupStatus"),

  overlayLoading: document.getElementById("overlayLoading"),
  loadingBar: document.getElementById("loadingBar"),
  loadingText: document.getElementById("loadingText"),

  overlayError: document.getElementById("overlayError"),
  errorText: document.getElementById("errorText"),
  btnErrorClose: document.getElementById("btnErrorClose"),
};

// --- Helpers -----------------------------------------------------------------
const clamp = THREE.MathUtils.clamp;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function setOverlayVisible(el, visible) {
  if (!el) return;
  el.classList.toggle("overlay--visible", Boolean(visible));
}

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadStoredState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const data = safeParseJSON(raw);
  if (!data || typeof data !== "object") return null;
  return data;
}

function persistState() {
  const trashPacked = packTrashForStorage();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      health: state.health,
      yearsLeft: state.yearsLeft,
      trashCount: trashPacked.count,
      trash: trashPacked.items,
      autoRotateEnabled: state.autoRotateEnabled,
    })
  );
}

function roundForStorage(num) {
  return Math.round(num * 10000) / 10000;
}

function packTrashForStorage() {
  // If trash system isn't ready yet (e.g. during loading), keep previously stored placements.
  const prev = Array.isArray(stored?.trash) ? stored.trash : [];
  if (!trashSlots.length || !litterMeshes.length) {
    const items = prev.slice(0, MAX_TRASH_INSTANCES);
    const count = items.length ? items.length : clamp(state.trashCount ?? 0, 0, MAX_TRASH_INSTANCES);
    return { count, items };
  }

  const typeMax = Math.max(0, litterMeshes.length - 1);
  const items = [];
  for (let k = 0; k < trashActive.length; k += 1) {
    const idx = trashActive[k];
    const slot = trashSlots[idx];
    if (!slot?.active) continue;
    // If user already started recycling, treat it as removed for persistence (so it doesn't come back on reload).
    if (slot.removing || slot.target <= 0) continue;

    const t = clamp(Math.round(slot.type) || 0, 0, typeMax);
    const p = slot.anchorPos;
    const q = slot.targetQuat;
    const s = slot.baseScale;

    items.push([
      t,
      roundForStorage(p.x),
      roundForStorage(p.y),
      roundForStorage(p.z),
      roundForStorage(q.x),
      roundForStorage(q.y),
      roundForStorage(q.z),
      roundForStorage(q.w),
      roundForStorage(s),
    ]);
  }

  return { count: items.length, items };
}

// --- Motion ------------------------------------------------------------------
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

// --- Recycle FX --------------------------------------------------------------
const RECYCLE_LOTTIE_SRC =
  "https://lottie.host/58d69f06-6ec2-4bfe-804d-e4cbad27729b/VTgW1xaZ7z.lottie";
const RECYCLE_FX_MS = 1300;
const recycleFx = [];

function spawnRecycleFxAtLocalPos(localPos) {
  if (reduceMotion) return;
  if (!dom.recycleFx) return;
  if (!window.customElements?.get?.("dotlottie-wc")) return;

  const el = document.createElement("dotlottie-wc");
  el.setAttribute("src", RECYCLE_LOTTIE_SRC);
  el.setAttribute("autoplay", "");
  el.classList.add("recycle-fx-item");
  dom.recycleFx.appendChild(el);

  recycleFx.push({
    el,
    localPos: localPos.clone(),
    endAt: performance.now() + RECYCLE_FX_MS,
    cleanupAt: 0,
    ending: false,
  });

  requestAnimationFrame(() => el.classList.add("is-visible"));
}

function spawnRecycleFxForTrash(instanceId) {
  if (!trashSlots?.length) return;
  const slot = trashSlots[instanceId];
  if (!slot?.active) return;
  spawnRecycleFxAtLocalPos(slot.pos);
}

function updateRecycleFx(nowMs) {
  if (!recycleFx.length) return;
  const rect = renderer.domElement.getBoundingClientRect();

  for (let i = recycleFx.length - 1; i >= 0; i -= 1) {
    const fx = recycleFx[i];

    if (!fx.ending && nowMs >= fx.endAt) {
      fx.ending = true;
      fx.cleanupAt = nowMs + 240;
      fx.el.classList.remove("is-visible");
    }

    if (fx.ending && nowMs >= fx.cleanupAt) {
      fx.el.remove();
      recycleFx.splice(i, 1);
      continue;
    }

    tmpV3a.copy(fx.localPos).applyMatrix4(planetGroup.matrixWorld);
    tmpV3b.copy(tmpV3a).project(camera);

    const x = rect.left + (tmpV3b.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-tmpV3b.y * 0.5 + 0.5) * rect.height;
    fx.el.style.left = `${x}px`;
    fx.el.style.top = `${y}px`;

    const behind = tmpV3b.z > 1;
    fx.el.style.display = behind ? "none" : "block";
  }
}

// --- Consequences (10 + 10) ----------------------------------------------------
const CONSEQUENCE_MS = 2600;
const consequencesAdd = [
  "Mikroplast havner i vann og mat.",
  "Dyr forveksler søppel med mat og dør.",
  "Deponier slipper ut metan og øker oppvarmingen.",
  "Giftstoffer fra avfall kan sive ned i jorden.",
  "Brenning av avfall forverrer luftkvaliteten.",
  "Tette avløp → flere oversvømmelser i byer.",
  "Søppel ender i havet og blir liggende i tiår.",
  "Å lage nye ting bruker mer vann og ressurser.",
  "Forurensning reduserer biologisk mangfold.",
  "Avfall tiltrekker skadedyr og øker smitterisiko.",
];

const consequencesRemove = [
  "Mindre avfall på deponi — mindre metan og giftstoffer.",
  "Materialgjenvinning sparer ressurser: vann, metall og olje.",
  "Renere luft og mindre røyk fra brenning.",
  "Mindre mikroplast i vann og mat.",
  "Økosystemer kan bygge seg opp raskere.",
  "Gjenbruk reduserer behovet for råvareutvinning.",
  "Kildesortering gir bedre kvalitet i gjenvinning.",
  "Lavere klimafotavtrykk fra produksjon.",
  "Færre giftstoffer — lavere risiko for mennesker og dyr.",
  "Hvert steg mot sirkularitet øker sjansen for en robust framtid.",
];

function refillDeck(deck, source) {
  deck.length = 0;
  deck.push(...source);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }
}

const consequenceDeckAdd = [];
const consequenceDeckRemove = [];
refillDeck(consequenceDeckAdd, consequencesAdd);
refillDeck(consequenceDeckRemove, consequencesRemove);

const consequenceState = { visible: false, endAt: 0 };

function pickConsequence({ good }) {
  const deck = good ? consequenceDeckRemove : consequenceDeckAdd;
  const source = good ? consequencesRemove : consequencesAdd;
  if (!deck.length) refillDeck(deck, source);
  return deck.pop() ?? "";
}

function hideConsequence() {
  if (!dom.consequenceCard) return;
  consequenceState.visible = false;
  dom.consequenceCard.classList.remove("is-visible");
}

function showConsequence({ good }) {
  if (!dom.consequenceCard || !dom.consequenceText) return;
  const text = pickConsequence({ good });

  if (dom.consequenceTag) dom.consequenceTag.textContent = good ? "Resirkulering" : "Konsekvens";
  dom.consequenceText.textContent = text;

  dom.consequenceCard.classList.toggle("is-good", Boolean(good));
  dom.consequenceCard.classList.toggle("is-bad", !good);

  dom.consequenceCard.classList.remove("is-visible");
  requestAnimationFrame(() => dom.consequenceCard.classList.add("is-visible"));

  consequenceState.visible = true;
  consequenceState.endAt = performance.now() + CONSEQUENCE_MS;
}

function updateConsequence(nowMs) {
  if (!consequenceState.visible || !dom.consequenceCard) return;
  if (nowMs >= consequenceState.endAt) {
    hideConsequence();
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();

  // Anchor above the planet in screen space.
  planetGroup.getWorldPosition(tmpV3a); // planet center (world)
  tmpV3b.copy(tmpV3a).addScaledVector(camera.up, planetRadius); // point above planet (world)

  tmpV3c.copy(tmpV3a).project(camera);
  tmpV3d.copy(tmpV3b).project(camera);

  const cx = rect.left + (tmpV3c.x * 0.5 + 0.5) * rect.width;
  const cy = rect.top + (-tmpV3c.y * 0.5 + 0.5) * rect.height;
  const ty = rect.top + (-tmpV3d.y * 0.5 + 0.5) * rect.height;
  const rPx = Math.abs(ty - cy);
  const margin = 18;

  const w = dom.consequenceCard.offsetWidth || 320;
  const h = dom.consequenceCard.offsetHeight || 70;

  const x = clamp(cx, rect.left + w / 2 + 12, rect.right - w / 2 - 12);
  const y = clamp(cy - rPx - margin, rect.top + h / 2 + 12, rect.bottom - h / 2 - 12);

  dom.consequenceCard.style.left = `${x}px`;
  dom.consequenceCard.style.top = `${y}px`;

  const behind = tmpV3c.z > 1;
  dom.consequenceCard.style.display = behind ? "none" : "block";
}

// --- State -------------------------------------------------------------------
const stored = loadStoredState();
const state = {
  health: clamp(Number(stored?.health ?? DEFAULT_HEALTH) || DEFAULT_HEALTH, 0, 100),
  yearsLeft: clamp(Number(stored?.yearsLeft ?? DEFAULT_YEARS) || DEFAULT_YEARS, 0, YEARS_MAX),
  trashCount: clamp(Number(stored?.trashCount ?? 0) || 0, 0, MAX_TRASH_INSTANCES),
  autoRotateEnabled: reduceMotion ? false : Boolean(stored?.autoRotateEnabled ?? true),
};

let isTimeUp = state.yearsLeft <= 0;

function updateHUD() {
  if (dom.healthValue) dom.healthValue.textContent = String(Math.round(state.health));
  if (dom.healthFill) dom.healthFill.style.width = `${state.health}%`;
  if (dom.trashCount) dom.trashCount.textContent = String(state.trashCount);

  if (dom.yearsValue) {
    dom.yearsValue.textContent = state.yearsLeft.toFixed(1);
    const y = state.yearsLeft;
    dom.yearsValue.style.color =
      y <= 0
        ? "rgba(239, 68, 68, 0.95)"
        : y <= 12
          ? "rgba(239, 68, 68, 0.95)"
          : y <= 30
            ? "rgba(245, 158, 11, 0.95)"
            : "rgba(34, 197, 94, 0.92)";
  }

  const bar = dom.healthFill?.closest?.('[role="progressbar"]');
  if (bar) bar.setAttribute("aria-valuenow", String(Math.round(state.health)));
}

updateHUD();

function applySimulationDelta({ healthDelta, yearsDelta }) {
  if (isTimeUp) return;
  state.health = clamp(state.health + healthDelta, 0, 100);
  state.yearsLeft = clamp(state.yearsLeft + yearsDelta, 0, YEARS_MAX);

  if (state.yearsLeft <= 0) {
    state.yearsLeft = 0;
    isTimeUp = true;
  }

  updateHUD();
  persistState();
}

// --- Three.js ----------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(0x000000, 1);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
dom.webgl.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 0.4, 3.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 6.0;
controls.autoRotate = state.autoRotateEnabled && !reduceMotion;
controls.autoRotateSpeed = 0.25;
controls.update();

if (reduceMotion && dom.btnPause) {
  dom.btnPause.disabled = true;
  dom.btnPause.textContent = "Rotation disabled";
  dom.btnPause.title = "prefers-reduced-motion: reduce";
}

const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(6, 2.5, 5);
const fillLight = new THREE.DirectionalLight(0xa9c7ff, 0.9);
fillLight.position.set(-6, -1.2, 4);
const rimLight = new THREE.DirectionalLight(0x66ccff, 0.8);
rimLight.position.set(-4.5, 3.2, -6);
const ambient = new THREE.AmbientLight(0xffffff, 0.18);
scene.add(keyLight, fillLight, rimLight, ambient);

const world = new THREE.Group();
scene.add(world);

const bgGroup = new THREE.Group();
world.add(bgGroup);

const planetGroup = new THREE.Group();
world.add(planetGroup);

const spaceGroup = new THREE.Group();
spaceGroup.visible = false;
world.add(spaceGroup);

let sceneMode = "planet"; // "planet" | "space"

// --- Background ---------------------------------------------------------------
function createStarSpriteTexture({ size = 64 } = {}) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const r = size * 0.5;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,1)");
  g.addColorStop(0.42, "rgba(255,255,255,0.55)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createStarFlareTexture({ size = 128 } = {}) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const r = size * 0.5;

  // Soft glow
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0.0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.12, "rgba(255,255,255,0.55)");
  g.addColorStop(0.38, "rgba(255,255,255,0.22)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  // Spikes (small lens flare)
  ctx.save();
  ctx.translate(r, r);
  const spikeLen = r * 0.95;
  const spikeW = Math.max(1, Math.floor(size * 0.035));

  function drawSpike(angle, alpha) {
    ctx.save();
    ctx.rotate(angle);
    const lg = ctx.createLinearGradient(-spikeLen, 0, spikeLen, 0);
    lg.addColorStop(0.0, `rgba(255,255,255,0)`);
    lg.addColorStop(0.45, `rgba(255,255,255,${alpha})`);
    lg.addColorStop(0.5, `rgba(255,255,255,${alpha * 1.15})`);
    lg.addColorStop(0.55, `rgba(255,255,255,${alpha})`);
    lg.addColorStop(1.0, `rgba(255,255,255,0)`);
    ctx.fillStyle = lg;
    ctx.fillRect(-spikeLen, -spikeW * 0.5, spikeLen * 2, spikeW);
    ctx.restore();
  }

  drawSpike(0, 0.22);
  drawSpike(Math.PI * 0.5, 0.18);
  drawSpike(Math.PI * 0.25, 0.16);
  drawSpike(-Math.PI * 0.25, 0.16);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function buildStarLayer({ count, rMin, rMax, size, opacity }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const u = rand(-1, 1);
    const theta = rand(0, Math.PI * 2);
    const phi = Math.acos(u);
    const rr = rand(rMin, rMax);

    const x = rr * Math.sin(phi) * Math.cos(theta);
    const y = rr * Math.cos(phi);
    const z = rr * Math.sin(phi) * Math.sin(theta);

    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const b = rand(0.55, 1.0);
    const cool = rand(0, 1);
    colors[i * 3 + 0] = (0.92 + 0.08 * (1 - cool)) * b;
    colors[i * 3 + 1] = (0.92 + 0.08 * (1 - cool)) * b;
    colors[i * 3 + 2] = (1.0 - 0.12 * cool) * b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  const mat = new THREE.PointsMaterial({
    size,
    map: starSprite,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity,
    vertexColors: true,
  });
  mat.toneMapped = false;
  mat.fog = false;

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function buildTwinkleLayer({ count, rMin, rMax, size, opacity }) {
  const positions = new Float32Array(count * 3);
  const baseColors = new Float32Array(count * 3);
  const colorsCore = new Float32Array(count * 3);
  const colorsHalo = new Float32Array(count * 3);
  const base = new Float32Array(count);
  const amp = new Float32Array(count);
  const speed = new Float32Array(count);
  const speed2 = new Float32Array(count);
  const phase = new Float32Array(count);
  const phase2 = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const u = rand(-1, 1);
    const theta = rand(0, Math.PI * 2);
    const phi = Math.acos(u);
    const rr = rand(rMin, rMax);

    positions[i * 3 + 0] = rr * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = rr * Math.cos(phi);
    positions[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);

    const type = Math.random();
    let r = 1.0;
    let g = 1.0;
    let b = 1.0;
    if (type < 0.7) {
      const c = rand(0.88, 1.0);
      r = c;
      g = c;
      b = rand(0.92, 1.0);
    } else if (type < 0.88) {
      r = rand(0.62, 0.86);
      g = rand(0.76, 0.96);
      b = 1.0;
    } else {
      r = 1.0;
      g = rand(0.82, 0.96);
      b = rand(0.62, 0.86);
    }

    const tint = rand(0.85, 1.05);
    baseColors[i * 3 + 0] = r * tint;
    baseColors[i * 3 + 1] = g * tint;
    baseColors[i * 3 + 2] = b * tint;

    base[i] = rand(0.55, 0.92);
    amp[i] = rand(0.2, 0.75);
    speed[i] = rand(0.6, 2.4);
    phase[i] = rand(0, Math.PI * 2);
    speed2[i] = rand(0.35, 1.35);
    phase2[i] = rand(0, Math.PI * 2);

    const s1 = 0.5 + 0.5 * Math.sin(phase[i]);
    const s2 = 0.5 + 0.5 * Math.sin(phase2[i] + s1 * 2.0);
    const burst = Math.pow(0.5 + 0.5 * Math.sin(phase[i] * 1.9 + phase2[i] * 0.6), 6);
    const sparkle = s1 * s1 * (0.72 + 0.28 * s2) + burst * 0.22;

    const fCore = base[i] + amp[i] * sparkle;
    const fHalo = clamp(0.2 + amp[i] * 1.15 * Math.pow(sparkle, 1.15), 0, 1.9);

    colorsCore[i * 3 + 0] = baseColors[i * 3 + 0] * fCore;
    colorsCore[i * 3 + 1] = baseColors[i * 3 + 1] * fCore;
    colorsCore[i * 3 + 2] = baseColors[i * 3 + 2] * fCore;

    colorsHalo[i * 3 + 0] = baseColors[i * 3 + 0] * fHalo;
    colorsHalo[i * 3 + 1] = baseColors[i * 3 + 1] * fHalo;
    colorsHalo[i * 3 + 2] = baseColors[i * 3 + 2] * fHalo;
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);

  const geoCore = new THREE.BufferGeometry();
  const coreColorAttr = new THREE.BufferAttribute(colorsCore, 3);
  geoCore.setAttribute("position", posAttr);
  geoCore.setAttribute("color", coreColorAttr);
  geoCore.computeBoundingSphere();

  const coreMat = new THREE.PointsMaterial({
    size,
    map: starSprite,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity,
    vertexColors: true,
  });
  coreMat.toneMapped = false;
  coreMat.fog = false;

  const geoHalo = new THREE.BufferGeometry();
  const haloColorAttr = new THREE.BufferAttribute(colorsHalo, 3);
  geoHalo.setAttribute("position", posAttr);
  geoHalo.setAttribute("color", haloColorAttr);
  geoHalo.computeBoundingSphere();

  const haloMat = new THREE.PointsMaterial({
    size: size * 2.45,
    map: starFlareSprite,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: opacity * 0.85,
    vertexColors: true,
  });
  haloMat.toneMapped = false;
  haloMat.fog = false;

  const halo = new THREE.Points(geoHalo, haloMat);
  halo.frustumCulled = false;
  const core = new THREE.Points(geoCore, coreMat);
  core.frustumCulled = false;

  return {
    core,
    halo,
    coreColorAttr,
    haloColorAttr,
    baseColors,
    base,
    amp,
    speed,
    speed2,
    phase,
    phase2,
    count,
  };
}

const starSprite = createStarSpriteTexture();
const starFlareSprite = createStarFlareTexture();
const starfield = new THREE.Group();
starfield.renderOrder = -10;
bgGroup.add(starfield);

starfield.add(
  buildStarLayer({ count: 2600, rMin: 80, rMax: 140, size: 0.12, opacity: 0.85 }),
  buildStarLayer({ count: 1200, rMin: 55, rMax: 120, size: 0.18, opacity: 0.9 }),
  buildStarLayer({ count: 420, rMin: 35, rMax: 90, size: 0.28, opacity: 0.95 })
);

const starTwinkle = buildTwinkleLayer({ count: 260, rMin: 45, rMax: 135, size: 0.34, opacity: 0.95 });
starfield.add(starTwinkle.halo, starTwinkle.core);

function updateStarTwinkle(timeSec) {
  if (reduceMotion) return;
  const colorsCore = starTwinkle.coreColorAttr.array;
  const colorsHalo = starTwinkle.haloColorAttr.array;
  for (let i = 0; i < starTwinkle.count; i += 1) {
    const t1 = starTwinkle.phase[i] + timeSec * starTwinkle.speed[i];
    const t2 = starTwinkle.phase2[i] + timeSec * starTwinkle.speed2[i];
    const s1 = 0.5 + 0.5 * Math.sin(t1);
    const s2 = 0.5 + 0.5 * Math.sin(t2 + Math.sin(t1) * 1.6);
    const burst = Math.pow(0.5 + 0.5 * Math.sin(t1 * 1.7 + t2 * 0.6), 6);
    const sparkle = s1 * s1 * (0.72 + 0.28 * s2) + burst * 0.25;

    const fCore = starTwinkle.base[i] + starTwinkle.amp[i] * sparkle;
    const fHalo = clamp(0.16 + starTwinkle.amp[i] * 1.25 * Math.pow(sparkle, 1.18), 0, 1.95);

    colorsCore[i * 3 + 0] = starTwinkle.baseColors[i * 3 + 0] * fCore;
    colorsCore[i * 3 + 1] = starTwinkle.baseColors[i * 3 + 1] * fCore;
    colorsCore[i * 3 + 2] = starTwinkle.baseColors[i * 3 + 2] * fCore;

    colorsHalo[i * 3 + 0] = starTwinkle.baseColors[i * 3 + 0] * fHalo;
    colorsHalo[i * 3 + 1] = starTwinkle.baseColors[i * 3 + 1] * fHalo;
    colorsHalo[i * 3 + 2] = starTwinkle.baseColors[i * 3 + 2] * fHalo;
  }
  starTwinkle.coreColorAttr.needsUpdate = true;
  starTwinkle.haloColorAttr.needsUpdate = true;
}

// --- Loading -----------------------------------------------------------------
const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

manager.onProgress = (_url, loaded, total) => {
  const p = total > 0 ? loaded / total : 0;
  if (dom.loadingBar) dom.loadingBar.style.width = `${Math.round(p * 100)}%`;
};

manager.onError = (url) => {
  void url;
  if (dom.loadingText) dom.loadingText.textContent = "Noe gikk galt under innlasting.";
};

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf), undefined, (err) => reject(err ?? new Error(`Failed to load ${url}`)));
  });
}

function fixMaterialColorMaps(material) {
  if (!material) return;
  const maps = ["map", "emissiveMap"];
  for (const k of maps) {
    const tex = material[k];
    if (!tex) continue;
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
  }
  material.needsUpdate = true;
}

function centerAndScaleToRadius(root, radius = 1) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const scale = sphere.radius > 0 ? radius / sphere.radius : 1;
  root.scale.multiplyScalar(scale);
  root.position.addScaledVector(center, -scale);
  root.updateWorldMatrix(true, true);
  return { radius, scale };
}

function hideLoading() {
  setOverlayVisible(dom.overlayLoading, false);
}

function showLoadError(message) {
  if (dom.errorText) dom.errorText.textContent = message;
  setOverlayVisible(dom.overlayError, true);
}

// --- Planet + trash -----------------------------------------------------------
let planetRoot = null;
let planetPickMeshes = [];
let planetRadius = 1;

// --- Space mode (satellites) --------------------------------------------------
let sputnikTemplate = null;
const satellites = [];
const SATELLITE_COUNT = 10;

const litterMeshes = []; // InstancedMesh per type (trash/bottle/garbage)
const litterBaseScales = [];
let spawnTypeCursor = 0;
let trashMinDistanceSq = 0.035;
let trashSurfaceOffset = 0.015;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpV3a = new THREE.Vector3();
const tmpV3b = new THREE.Vector3();
const tmpV3c = new THREE.Vector3();
const tmpV3d = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpQuatB = new THREE.Quaternion();
const tmpQuatC = new THREE.Quaternion();
const tmpQuatD = new THREE.Quaternion();
const tmpMat4a = new THREE.Matrix4();
const tmpMat4b = new THREE.Matrix4();
const tmpScale = new THREE.Vector3();

function buildFallbackPlanet() {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2ea043, roughness: 0.85, metalness: 0.0 });
  return new THREE.Mesh(geo, mat);
}

function buildFallbackTrashGeometry() {
  const geo = new THREE.DodecahedronGeometry(0.075, 0);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb7b7b7, roughness: 0.95, metalness: 0.0 });
  return { geometry: geo, material: mat };
}

function buildTrashGeometryFromGLTF(gltf) {
  const meshes = [];
  gltf.scene.updateWorldMatrix(true, true);
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj);
  });
  if (meshes.length === 0) return null;

  const geometries = [];
  for (const mesh of meshes) {
    const geom = mesh.geometry?.clone?.();
    if (!geom) continue;
    geom.applyMatrix4(mesh.matrixWorld);
    geometries.push(geom);
  }
  if (!geometries.length) return null;

  const merged = mergeBufferGeometries(geometries, false) ?? geometries[0];
  merged.computeBoundingBox();
  if (merged.boundingBox) {
    const center = merged.boundingBox.getCenter(new THREE.Vector3());
    merged.translate(-center.x, -center.y, -center.z);
  }
  merged.computeBoundingSphere();

  const firstMat = Array.isArray(meshes[0].material) ? meshes[0].material[0] : meshes[0].material;
  const map = firstMat?.map ?? null;
  const material =
    firstMat?.clone?.() ??
    new THREE.MeshStandardMaterial({
      color: 0xb8b8b8,
      roughness: 0.95,
      metalness: 0.0,
      map,
    });
  fixMaterialColorMaps(material);
  return { geometry: merged, material };
}

function buildFallbackSputnik() {
  const g = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.32, 18, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xaabbd0, roughness: 0.65, metalness: 0.25 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.z = Math.PI / 2;

  const panelGeo = new THREE.BoxGeometry(0.28, 0.11, 0.012);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1f77b4,
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x061a2a,
    emissiveIntensity: 0.18,
  });
  const p1 = new THREE.Mesh(panelGeo, panelMat);
  p1.position.set(0.28, 0, 0);
  const p2 = p1.clone();
  p2.position.set(-0.28, 0, 0);

  g.add(body, p1, p2);
  return g;
}

function randomUnitVector(out) {
  const u = rand(-1, 1);
  const theta = rand(0, Math.PI * 2);
  const phi = Math.acos(u);
  out.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
  return out;
}

const satelliteImpactPhrases = [
  "Øker risikoen for mikroplast i havet og i næringskjedene.",
  "Øker giftbelastningen på vann og jord.",
  "Øker risikoen for skader på dyr fra fragmenter og tråder.",
  "Legger til klimafotavtrykk gjennom ekstra opprydding og logistikk.",
  "Svekket biologisk mangfold i kyst- og byøkosystemer.",
  "Øker risikoen for at elver forurenses via overvann og avrenning.",
  "Øker belastningen på kommunale tjenester og budsjetter.",
  "Fremskynder økosystemdegradering og gjør framtiden mindre robust.",
  "Reduserer leveområdenes kvalitet for fugler og insekter.",
  "Holder liv i engangskultur og økt råvareuttak.",
];

let selectedSatelliteIndex = -1;

function rollSatelliteStats(sat) {
  if (!sat) return;
  sat.debrisKg = randInt(40, 980);
  sat.harm = rand(0.08, 0.98);
  sat.impactText = satelliteImpactPhrases[randInt(0, satelliteImpactPhrases.length - 1)];
}

function updateSpacePanel(sat) {
  if (!dom.satDebris || !dom.satHarm || !dom.satImpact) return;
  if (!sat) {
    dom.satDebris.textContent = "—";
    dom.satHarm.textContent = "—";
    dom.satImpact.textContent = "—";
    return;
  }

  rollSatelliteStats(sat);
  dom.satDebris.textContent = `${sat.debrisKg} kg`;

  const pct = Math.round(sat.harm * 100);
  const label = pct < 34 ? "lav" : pct < 67 ? "middels" : "høy";
  dom.satHarm.textContent = `${pct}% (${label})`;
  dom.satImpact.textContent = sat.impactText;
}

function selectSatellite(index) {
  if (!satellites.length) return;
  const next = clamp(index, 0, satellites.length - 1);
  if (selectedSatelliteIndex === next) {
    const sat = satellites[selectedSatelliteIndex];
    updateSpacePanel(sat);
    return;
  }

  const prevSat = satellites[selectedSatelliteIndex];
  if (prevSat?.root && typeof prevSat.baseScale === "number") prevSat.root.scale.setScalar(prevSat.baseScale);

  selectedSatelliteIndex = next;
  const sat = satellites[selectedSatelliteIndex];
  if (!sat) return;

  if (sat.root && typeof sat.baseScale === "number") sat.root.scale.setScalar(sat.baseScale * 1.08);
  updateSpacePanel(sat);
}

function buildSatellites() {
  satellites.length = 0;
  selectedSatelliteIndex = -1;
  updateSpacePanel(null);

  spaceGroup.clear();

  const inner =
    sputnikTemplate?.clone?.(true) ??
    (() => {
      const fb = buildFallbackSputnik();
      return fb;
    })();

  const rMin = planetRadius * 3.4;
  const rMax = planetRadius * 9.4;
  const minDist = planetRadius * 1.55;
  const minDistSq = minDist * minDist;
  const used = [];

  for (let i = 0; i < SATELLITE_COUNT; i += 1) {
    let ok = false;
    let attempts = 0;
    let radius = rand(rMin, rMax);
    const baseDir = new THREE.Vector3();
    const basePos = new THREE.Vector3();
    while (!ok && attempts < 240) {
      attempts += 1;
      randomUnitVector(baseDir);
      radius = rand(rMin, rMax);
      basePos.copy(baseDir).multiplyScalar(radius);
      ok = used.every((p) => p.distanceToSquared(basePos) > minDistSq);
    }
    used.push(basePos.clone());

    const root = new THREE.Group();
    root.userData.satIndex = i;
    root.position.copy(basePos);

    const model = inner.clone(true);
    root.add(model);

    const scale0 = rand(1.25, 1.65);
    root.scale.setScalar(scale0);
    root.rotation.set(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2));

    // Bigger invisible collider so satellites are easier to click.
    const hitGeo = new THREE.SphereGeometry(planetRadius * 0.42, 14, 10);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.name = "__sat_hit";
    root.add(hit);

    spaceGroup.add(root);

    const orbitAxis = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (orbitAxis.lengthSq() < 1e-6) orbitAxis.set(0, 1, 0);
    orbitAxis.normalize();

    const wobbleAxis1 = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (wobbleAxis1.lengthSq() < 1e-6) wobbleAxis1.set(1, 0, 0);
    wobbleAxis1.normalize();

    const wobbleAxis2 = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (wobbleAxis2.lengthSq() < 1e-6) wobbleAxis2.set(0, 0, 1);
    wobbleAxis2.normalize();

    const rotAxis = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (rotAxis.lengthSq() < 1e-6) rotAxis.set(0, 1, 0);
    rotAxis.normalize();

    satellites.push({
      root,
      baseScale: scale0,
      baseDir,
      radius,
      orbitAxis,
      orbitSpeed: rand(0.03, 0.11) * (Math.random() < 0.5 ? -1 : 1),
      orbitPhase: rand(0, Math.PI * 2),
      radiusAmp: radius * rand(0.012, 0.03),
      radiusSpeed: rand(0.18, 0.42),
      radiusPhase: rand(0, Math.PI * 2),
      wobbleAxis1,
      wobbleAmp1: planetRadius * rand(0.08, 0.42),
      wobbleSpeed1: rand(0.16, 0.48),
      wobblePhase1: rand(0, Math.PI * 2),
      wobbleAxis2,
      wobbleAmp2: planetRadius * rand(0.06, 0.32),
      wobbleSpeed2: rand(0.18, 0.55),
      wobblePhase2: rand(0, Math.PI * 2),
      rotAxis,
      rotSpeed: rand(0.12, 0.45) * (Math.random() < 0.5 ? -1 : 1),
      debrisKg: null,
      harm: null,
      impactText: "",
    });
  }
}

function updateSatellites(dt, timeSec) {
  if (!satellites.length) return;
  for (let i = 0; i < satellites.length; i += 1) {
    const sat = satellites[i];
    const root = sat.root;
    if (!root) continue;

    const r = sat.radius + Math.sin(timeSec * sat.radiusSpeed + sat.radiusPhase) * sat.radiusAmp;

    tmpQuat.setFromAxisAngle(sat.orbitAxis, sat.orbitPhase + timeSec * sat.orbitSpeed);
    tmpV3a.copy(sat.baseDir).applyQuaternion(tmpQuat).multiplyScalar(r);

    tmpV3b
      .copy(sat.wobbleAxis1)
      .multiplyScalar(Math.sin(timeSec * sat.wobbleSpeed1 + sat.wobblePhase1) * sat.wobbleAmp1);
    tmpV3c
      .copy(sat.wobbleAxis2)
      .multiplyScalar(Math.cos(timeSec * sat.wobbleSpeed2 + sat.wobblePhase2) * sat.wobbleAmp2);

    root.position.copy(tmpV3a).add(tmpV3b).add(tmpV3c);

    tmpQuatD.setFromAxisAngle(sat.rotAxis, sat.rotSpeed * dt);
    root.quaternion.multiply(tmpQuatD);
  }
}

const trashSlots = [];
const trashActive = [];
const trashFree = [];

function getLitterMesh(typeIndex) {
  return litterMeshes[typeIndex] ?? litterMeshes[0] ?? null;
}

function initTrashSlots() {
  trashSlots.length = 0;
  trashActive.length = 0;
  trashFree.length = 0;

  for (let i = 0; i < MAX_TRASH_INSTANCES; i += 1) {
    trashSlots.push({
      active: false,
      removing: false,
      flying: false,
      flightT: 0,
      flightMax: 0,
      scaleT: 0,
      target: 0,
      type: 0,
      pos: new THREE.Vector3(9999, 9999, 9999),
      anchorPos: new THREE.Vector3(9999, 9999, 9999),
      quat: new THREE.Quaternion(),
      targetQuat: new THREE.Quaternion(),
      worldPos: new THREE.Vector3(9999, 9999, 9999),
      worldVel: new THREE.Vector3(),
      worldQuat: new THREE.Quaternion(),
      spinAxis: new THREE.Vector3(0, 1, 0),
      spinSpeed: 0,
      baseScale: 1,
      listIndex: -1,
    });
    trashFree.push(i);
  }

  const hidden = new THREE.Matrix4().compose(
    new THREE.Vector3(9999, 9999, 9999),
    new THREE.Quaternion(),
    new THREE.Vector3(0, 0, 0)
  );
  for (const mesh of litterMeshes) {
    if (!mesh) continue;
    for (let i = 0; i < MAX_TRASH_INSTANCES; i += 1) mesh.setMatrixAt(i, hidden);
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function setTrashInstanceMatrix(i, scaleFactor) {
  const slot = trashSlots[i];
  const s = slot.baseScale * scaleFactor;
  tmpScale.set(s, s, s);
  tmpMat4a.compose(slot.pos, slot.quat, tmpScale);
  const mesh = getLitterMesh(slot.type);
  if (!mesh) return;
  mesh.setMatrixAt(i, tmpMat4a);
}

function finalizeTrashRemoval(i) {
  const slot = trashSlots[i];
  if (!slot.active) return;
  const typeIndex = slot.type;

  const idx = slot.listIndex;
  const last = trashActive.pop();
  if (last !== i && typeof last === "number") {
    trashActive[idx] = last;
    trashSlots[last].listIndex = idx;
  }

  slot.active = false;
  slot.removing = false;
  slot.flying = false;
  slot.flightT = 0;
  slot.flightMax = 0;
  slot.scaleT = 0;
  slot.target = 0;
  slot.type = 0;
  slot.listIndex = -1;
  slot.pos.set(9999, 9999, 9999);
  slot.anchorPos.set(9999, 9999, 9999);
  slot.worldPos.set(9999, 9999, 9999);
  slot.worldVel.set(0, 0, 0);
  slot.spinAxis.set(0, 1, 0);
  slot.spinSpeed = 0;

  trashFree.push(i);

  tmpMat4a.compose(slot.pos, slot.quat, new THREE.Vector3(0, 0, 0));
  const mesh = getLitterMesh(typeIndex);
  if (!mesh) {
    for (const m of litterMeshes) m?.setMatrixAt(i, tmpMat4a);
    return;
  }
  mesh.setMatrixAt(i, tmpMat4a);
}

function startRemoveTrash(i) {
  const slot = trashSlots[i];
  if (!slot.active || slot.removing) return false;
  slot.removing = true;
  slot.target = 0;
  if (reduceMotion) {
    finalizeTrashRemoval(i);
    for (const m of litterMeshes) if (m) m.instanceMatrix.needsUpdate = true;
    return true;
  }
  return true;
}

function canPlaceTrashAt(localPos) {
  for (let k = 0; k < trashActive.length; k += 1) {
    const idx = trashActive[k];
    const slot = trashSlots[idx];
    if (!slot.active) continue;
    if (slot.anchorPos.distanceToSquared(localPos) < trashMinDistanceSq) return false;
  }
  return true;
}

function spawnTrashAtWorldHit(pointWorld, normalWorld, { animate = true, fly = true, typeIndex = 0 } = {}) {
  if (isTimeUp) return false;
  if (trashFree.length === 0) return false;
  if (!litterMeshes.length) return false;

  const normal = tmpV3a.copy(normalWorld).normalize();
  const targetWorldPos = tmpV3b.copy(pointWorld).addScaledVector(normal, trashSurfaceOffset);

  tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  tmpQuatB.setFromAxisAngle(normal, rand(0, Math.PI * 2));
  tmpQuat.multiply(tmpQuatB);

  const typeCount = Math.max(1, litterMeshes.length);
  const safeType = ((typeIndex % typeCount) + typeCount) % typeCount;
  const baseScale = (litterBaseScales[safeType] ?? litterBaseScales[0] ?? 0.085) * rand(0.85, 1.15);
  tmpScale.set(baseScale, baseScale, baseScale);

  tmpMat4b.copy(planetGroup.matrixWorld).invert(); // world -> local
  tmpMat4a.compose(targetWorldPos, tmpQuat, tmpScale);
  tmpMat4a.premultiply(tmpMat4b);
  tmpMat4a.decompose(tmpV3c, tmpQuatC, tmpScale);

  if (!canPlaceTrashAt(tmpV3c)) return false;

  const i = trashFree.pop();
  const slot = trashSlots[i];
  slot.active = true;
  slot.removing = false;
  slot.target = 1;
  slot.scaleT = animate && !reduceMotion ? 0 : 1;
  slot.baseScale = tmpScale.x;
  slot.type = safeType;
  slot.anchorPos.copy(tmpV3c);
  slot.targetQuat.copy(tmpQuatC);

  slot.listIndex = trashActive.length;
  trashActive.push(i);

  const wantsFlight = fly && !reduceMotion;
  if (!wantsFlight) {
    slot.flying = false;
    slot.flightT = 0;
    slot.flightMax = 0;
    slot.spinAxis.set(0, 1, 0);
    slot.spinSpeed = 0;
    slot.pos.copy(slot.anchorPos);
    slot.quat.copy(slot.targetQuat);
    setTrashInstanceMatrix(i, slot.scaleT);
    const mesh = getLitterMesh(slot.type);
    if (mesh) mesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  slot.flying = true;
  slot.flightT = 0;

  tmpV3d.copy(targetWorldPos);
  tmpV3c.subVectors(tmpV3d, camera.position).normalize();

  const distCam = camera.position.distanceTo(tmpV3d);
  slot.flightMax = clamp(distCam / (planetRadius * 4.0), 0.55, 1.25);

  const startOffset = clamp(planetRadius * 0.35, 0.12, planetRadius * 0.95);
  slot.worldPos.copy(camera.position).addScaledVector(tmpV3c, startOffset);

  const dist = slot.worldPos.distanceTo(tmpV3d);
  const flightTime = clamp(dist / (planetRadius * 3.6), 0.45, 1.05);
  const speed = dist / flightTime;

  slot.worldVel.copy(tmpV3c).multiplyScalar(speed);

  tmpV3a.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
  tmpV3a.cross(tmpV3c);
  if (tmpV3a.lengthSq() > 1e-6) {
    tmpV3a.normalize();
    slot.worldVel.addScaledVector(tmpV3a, speed * rand(-0.08, 0.08));
  }

  tmpV3a.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
  if (tmpV3a.lengthSq() < 1e-6) tmpV3a.set(0, 1, 0);
  tmpV3a.normalize();
  slot.worldQuat.setFromAxisAngle(tmpV3a, rand(0, Math.PI * 2));
  slot.spinAxis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
  if (slot.spinAxis.lengthSq() < 1e-6) slot.spinAxis.set(0, 1, 0);
  slot.spinAxis.normalize();
  slot.spinSpeed = rand(2.5, 9.0) * (Math.random() < 0.5 ? -1 : 1);
  slot.worldVel.multiplyScalar(rand(0.92, 1.08));

  slot.pos.copy(slot.worldPos).applyMatrix4(tmpMat4b);
  planetGroup.getWorldQuaternion(tmpQuatB);
  tmpQuatB.invert();
  slot.quat.copy(tmpQuatB).multiply(slot.worldQuat);

  setTrashInstanceMatrix(i, slot.scaleT);
  {
    const mesh = getLitterMesh(slot.type);
    if (mesh) mesh.instanceMatrix.needsUpdate = true;
  }
  return true;
}

function stepTrashFlight(slot, dt, planetWorldQuat, planetInvQuat, planetInvMat) {
  const targetWorld = tmpV3c.copy(slot.anchorPos).applyMatrix4(planetGroup.matrixWorld);

  slot.flightT += dt;
  const t01 = slot.flightMax > 0 ? clamp(slot.flightT / slot.flightMax, 0, 1) : 1;
  const align01 = t01 * t01 * (3 - 2 * t01);
  const attachDist = Math.max(trashSurfaceOffset * 2.2, planetRadius * 0.025);

  tmpV3d.copy(targetWorld).sub(slot.worldPos);
  const dist = tmpV3d.length();
  if (dist <= attachDist || slot.flightT >= slot.flightMax) {
    slot.flying = false;
    slot.flightT = 0;
    slot.flightMax = 0;
    slot.worldPos.copy(targetWorld);
    slot.worldVel.set(0, 0, 0);
    slot.worldQuat.copy(planetWorldQuat).multiply(slot.targetQuat);
    slot.spinSpeed = 0;
    slot.pos.copy(slot.anchorPos);
    slot.quat.copy(slot.targetQuat);
    return true;
  }

  const springK = 10.5;
  const damping = 6.0;
  const gravity = 2.2;
  const drag = 1.25;

  // a = k*(target - pos) - c*v
  tmpV3a.copy(tmpV3d).multiplyScalar(springK);
  tmpV3a.addScaledVector(slot.worldVel, -damping);

  tmpV3b.copy(slot.worldPos);
  const r2 = tmpV3b.lengthSq();
  if (r2 > 1e-6) {
    tmpV3b.multiplyScalar(1 / Math.sqrt(r2)); // normalize
    tmpV3a.addScaledVector(tmpV3b, -gravity);
  }

  slot.worldVel.addScaledVector(tmpV3a, dt);
  slot.worldVel.multiplyScalar(Math.exp(-drag * dt));
  slot.worldPos.addScaledVector(slot.worldVel, dt);

  // Tumbling spin in the air (damped as we approach landing).
  if (slot.spinSpeed !== 0) {
    tmpQuatD.setFromAxisAngle(slot.spinAxis, slot.spinSpeed * dt);
    slot.worldQuat.multiply(tmpQuatD);
    const spinDamp = 0.55 + align01 * 3.25;
    slot.spinSpeed *= Math.exp(-spinDamp * dt);
    if (Math.abs(slot.spinSpeed) < 0.05) slot.spinSpeed = 0;
  }

  tmpQuat.copy(planetWorldQuat).multiply(slot.targetQuat);
  const alignLambda = 2.0 + align01 * 18.0;
  slot.worldQuat.slerp(tmpQuat, 1 - Math.exp(-alignLambda * dt));

  // Render transform (world -> local)
  slot.pos.copy(slot.worldPos).applyMatrix4(planetInvMat);
  slot.quat.copy(planetInvQuat).multiply(slot.worldQuat);
  return true;
}

function restoreTrashFromPacked(items) {
  if (!Array.isArray(items) || !items.length) return 0;
  if (!trashSlots.length || !litterMeshes.length) return 0;
  if (!trashFree.length) return 0;

  const typeCount = Math.max(1, litterMeshes.length);
  const meshDirty = new Array(typeCount).fill(false);

  const max = Math.min(items.length, MAX_TRASH_INSTANCES);
  for (let n = 0; n < max; n += 1) {
    const it = items[n];
    if (!Array.isArray(it) || it.length < 9) continue;
    if (!trashFree.length) break;

    const type = clamp(Math.round(Number(it[0]) || 0), 0, typeCount - 1);
    const x = Number(it[1]);
    const y = Number(it[2]);
    const z = Number(it[3]);
    const qx = Number(it[4]);
    const qy = Number(it[5]);
    const qz = Number(it[6]);
    const qw = Number(it[7]);
    const baseScaleRaw = Number(it[8]);

    if (![x, y, z, qx, qy, qz, qw].every((v) => Number.isFinite(v))) continue;

    const baseScaleFallback = litterBaseScales[type] ?? litterBaseScales[0] ?? 0.085;
    const baseScale = Number.isFinite(baseScaleRaw) && baseScaleRaw > 0 ? baseScaleRaw : baseScaleFallback;

    const i = trashFree.pop();
    const slot = trashSlots[i];
    slot.active = true;
    slot.removing = false;
    slot.flying = false;
    slot.flightT = 0;
    slot.flightMax = 0;
    slot.target = 1;
    slot.scaleT = 1;
    slot.type = type;
    slot.baseScale = baseScale;
    slot.anchorPos.set(x, y, z);
    slot.targetQuat.set(qx, qy, qz, qw);
    if (slot.targetQuat.lengthSq() > 1e-8) slot.targetQuat.normalize();
    else slot.targetQuat.identity();

    slot.pos.copy(slot.anchorPos);
    slot.quat.copy(slot.targetQuat);
    slot.worldPos.set(9999, 9999, 9999);
    slot.worldVel.set(0, 0, 0);
    slot.worldQuat.identity();
    slot.spinAxis.set(0, 1, 0);
    slot.spinSpeed = 0;

    slot.listIndex = trashActive.length;
    trashActive.push(i);

    setTrashInstanceMatrix(i, 1);
    meshDirty[type] = true;
  }

  for (let m = 0; m < meshDirty.length; m += 1) {
    if (!meshDirty[m]) continue;
    litterMeshes[m].instanceMatrix.needsUpdate = true;
  }

  spawnTypeCursor = trashActive.length % typeCount;
  state.trashCount = trashActive.length;
  updateHUD();
  persistState();
  return trashActive.length;
}

function restoreTrashFromCount(count) {
  const desired = clamp(count, 0, MAX_TRASH_INSTANCES);
  const typeCount = Math.max(1, litterMeshes.length);
  if (!desired) return;

  planetGroup.updateWorldMatrix(true, true);

  const rc = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const toward = new THREE.Vector3();
  const pointWorld = new THREE.Vector3();
  const normalWorld = new THREE.Vector3();

  const maxAttempts = 28;
  for (let i = 0; i < desired; i += 1) {
    const typeIndex = i % typeCount;
    let placed = false;

    for (let attempt = 0; attempt < maxAttempts && !placed; attempt += 1) {
      const u = rand(-1, 1);
      const theta = rand(0, Math.PI * 2);
      const phi = Math.acos(u);
      dir.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).normalize();

      origin.copy(dir).multiplyScalar(Math.max(planetRadius * 4.5, 3.5));
      toward.copy(dir).multiplyScalar(-1).normalize();
      rc.set(origin, toward);

      const hits = planetPickMeshes?.length ? rc.intersectObjects(planetPickMeshes, true) : [];
      if (hits.length) {
        const hit = hits[0];
        pointWorld.copy(hit.point);
        if (hit.face?.normal) normalWorld.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        else normalWorld.copy(pointWorld).normalize();
      } else {
        // Fallback: sphere placement (only if raycast fails).
        pointWorld.copy(dir).multiplyScalar(planetRadius);
        normalWorld.copy(dir);
      }

      placed = spawnTrashAtWorldHit(pointWorld, normalWorld, { animate: false, fly: false, typeIndex });
    }
  }

  spawnTypeCursor = trashActive.length % typeCount;
  state.trashCount = trashActive.length;
  updateHUD();
  persistState();
}

function clearAllTrash() {
  for (let k = trashActive.length - 1; k >= 0; k -= 1) finalizeTrashRemoval(trashActive[k]);
  for (const m of litterMeshes) if (m) m.instanceMatrix.needsUpdate = true;
  state.trashCount = 0;
}

function settleTrashForModeSwitch() {
  if (!trashActive.length) return;
  if (!litterMeshes.length) return;

  planetGroup.updateWorldMatrix(true, false);
  planetGroup.getWorldQuaternion(tmpQuatB);

  const meshDirty = new Array(litterMeshes.length).fill(false);
  let countDirty = false;

  // Finish any removal animations immediately (so nothing gets "stuck" between modes).
  for (let k = trashActive.length - 1; k >= 0; k -= 1) {
    const i = trashActive[k];
    const slot = trashSlots[i];
    if (!slot?.active) continue;
    if (!slot.removing) continue;
    const t = slot.type;
    finalizeTrashRemoval(i);
    meshDirty[t] = true;
    countDirty = true;
  }

  // Snap any in-flight trash to the planet (so it doesn't appear floating when returning).
  for (let k = 0; k < trashActive.length; k += 1) {
    const i = trashActive[k];
    const slot = trashSlots[i];
    if (!slot?.active) continue;
    if (!slot.flying) continue;

    slot.flying = false;
    slot.flightT = 0;
    slot.flightMax = 0;
    slot.spinSpeed = 0;
    slot.worldVel.set(0, 0, 0);

    slot.worldPos.copy(slot.anchorPos).applyMatrix4(planetGroup.matrixWorld);
    slot.worldQuat.copy(tmpQuatB).multiply(slot.targetQuat);

    slot.pos.copy(slot.anchorPos);
    slot.quat.copy(slot.targetQuat);

    slot.scaleT = slot.target;
    setTrashInstanceMatrix(i, slot.scaleT);
    meshDirty[slot.type] = true;
  }

  for (let m = 0; m < meshDirty.length; m += 1) {
    if (!meshDirty[m]) continue;
    litterMeshes[m].instanceMatrix.needsUpdate = true;
  }

  if (countDirty) {
    state.trashCount = trashActive.length;
    updateHUD();
    persistState();
  }
}

// --- Visual link to health ----------------------------------------------------
function updatePlanetLook() {
  const health01 = clamp(state.health / 100, 0, 1);

  keyLight.intensity = 1.7 + health01 * 0.8;
  rimLight.intensity = 0.55 + health01 * 0.55;
  fillLight.intensity = 0.55 + health01 * 0.5;
}

// --- Interaction --------------------------------------------------------------
const pointerState = { down: false, x: 0, y: 0, t: 0, button: 0 };

function clientToNDC(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  ndc.set(x * 2 - 1, -(y * 2 - 1));
  return ndc;
}

function raycastPlanet(clientX, clientY) {
  clientToNDC(clientX, clientY);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(planetPickMeshes, true);
}

function raycastTrash(clientX, clientY) {
  if (!litterMeshes.length) return [];
  clientToNDC(clientX, clientY);
  raycaster.setFromCamera(ndc, camera);
  let best = null;
  for (const mesh of litterMeshes) {
    if (!mesh) continue;
    const hits = raycaster.intersectObject(mesh, false);
    if (!hits.length) continue;
    const hit = hits[0];
    if (!best || hit.distance < best.distance) best = hit;
  }
  return best ? [best] : [];
}

function raycastSatellites(clientX, clientY) {
  if (!satellites.length) return [];
  clientToNDC(clientX, clientY);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(spaceGroup, true);
}

function onSpaceClick(clientX, clientY) {
  const hits = raycastSatellites(clientX, clientY);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && typeof obj.userData?.satIndex !== "number") obj = obj.parent;
  const idx = obj?.userData?.satIndex;
  if (typeof idx === "number") selectSatellite(idx);
}

function onAddTrashClick(clientX, clientY) {
  if (isTimeUp) return;

  const trashHits = raycastTrash(clientX, clientY);
  if (trashHits.length) {
    const id = trashHits[0].instanceId;
    if (typeof id === "number" && startRemoveTrash(id)) {
      spawnRecycleFxForTrash(id);
      if (reduceMotion) {
        state.trashCount = trashActive.length;
        updateHUD();
        persistState();
      }
      applySimulationDelta({ healthDelta: randInt(1, 3), yearsDelta: rand(0.3, 1.2) });
      showConsequence({ good: true });
    }
    return;
  }

  const hits = raycastPlanet(clientX, clientY);
  if (!hits.length) return;

  const hit = hits[0];
  const pointWorld = hit.point;
  const normalWorld = hit.face?.normal
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    : pointWorld.clone().normalize();

  const typeCount = Math.max(1, litterMeshes.length);
  const typeIndex = spawnTypeCursor % typeCount;
  const ok = spawnTrashAtWorldHit(pointWorld, normalWorld, { animate: true, fly: true, typeIndex });
  if (!ok) return;
  spawnTypeCursor += 1;

  state.trashCount = trashActive.length;
  updateHUD();
  persistState();

  applySimulationDelta({ healthDelta: -randInt(1, 3), yearsDelta: -rand(0.3, 1.2) });
  showConsequence({ good: false });
}

function onRemoveTrashClick(clientX, clientY) {
  if (isTimeUp) return;
  const hits = raycastTrash(clientX, clientY);
  if (!hits.length) return;

  const id = hits[0].instanceId;
  if (typeof id !== "number") return;
  if (!startRemoveTrash(id)) return;

  spawnRecycleFxForTrash(id);

  if (reduceMotion) {
    state.trashCount = trashActive.length;
    updateHUD();
    persistState();
  }

  applySimulationDelta({ healthDelta: randInt(1, 3), yearsDelta: rand(0.3, 1.2) });
  showConsequence({ good: true });
}

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  pointerState.down = true;
  pointerState.x = e.clientX;
  pointerState.y = e.clientY;
  pointerState.t = performance.now();
  pointerState.button = e.button;
});

renderer.domElement.addEventListener("pointerup", (e) => {
  if (!pointerState.down || pointerState.button !== 0) return;
  pointerState.down = false;

  const dx = e.clientX - pointerState.x;
  const dy = e.clientY - pointerState.y;
  const dist2 = dx * dx + dy * dy;
  const dt = performance.now() - pointerState.t;
  const clickLike = dist2 < 36 && dt < 450;
  if (!clickLike) return;
  if (sceneMode === "space") onSpaceClick(e.clientX, e.clientY);
  else onAddTrashClick(e.clientX, e.clientY);
});

renderer.domElement.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (sceneMode !== "space") onRemoveTrashClick(e.clientX, e.clientY);
});

// --- UI ----------------------------------------------------------------------
dom.btnPause?.addEventListener("click", () => {
  state.autoRotateEnabled = !state.autoRotateEnabled;
  controls.autoRotate = state.autoRotateEnabled && !reduceMotion;
  dom.btnPause.textContent = state.autoRotateEnabled ? "Pause rotasjon" : "Fortsett rotasjon";
  persistState();
});

function setSceneMode(nextMode) {
  if (nextMode !== "planet" && nextMode !== "space") return;
  if (sceneMode === nextMode) return;
  const prevMode = sceneMode;
  if (prevMode === "planet" && nextMode === "space") settleTrashForModeSwitch();
  sceneMode = nextMode;

  const isSpace = sceneMode === "space";
  planetGroup.visible = !isSpace;
  spaceGroup.visible = isSpace;

  hideConsequence();

  if (!isSpace) {
    selectedSatelliteIndex = -1;
    updateSpacePanel(null);
  }

  controls.target.set(0, 0, 0);
  if (isSpace) {
    controls.minDistance = planetRadius * 2.4;
    controls.maxDistance = planetRadius * 16.0;
    camera.position.set(0, planetRadius * 0.9, planetRadius * 8.2);
  } else {
    controls.minDistance = planetRadius * 2.05;
    controls.maxDistance = planetRadius * 5.6;
    camera.position.set(0, planetRadius * 0.35, planetRadius * 3.2);
  }
  controls.update();
}

let activeSidePanel = null; // "space" | "pickup" | null

function setSidePanel(next) {
  const normalized = next === "space" || next === "pickup" ? next : null;
  activeSidePanel = activeSidePanel === normalized ? null : normalized;

  const showSpace = activeSidePanel === "space";
  const showPickup = activeSidePanel === "pickup";

  if (dom.panelSpace) dom.panelSpace.hidden = !showSpace;
  if (dom.panelPickup) dom.panelPickup.hidden = !showPickup;

  if (dom.tabSpace) {
    dom.tabSpace.classList.toggle("is-active", showSpace);
    dom.tabSpace.setAttribute("aria-pressed", showSpace ? "true" : "false");
  }
  if (dom.tabPickup) {
    dom.tabPickup.classList.toggle("is-active", showPickup);
    dom.tabPickup.setAttribute("aria-pressed", showPickup ? "true" : "false");
  }

  if (showSpace) setSceneMode("space");
  else if (sceneMode === "space") setSceneMode("planet");

  if (showPickup) setSceneMode("planet");

  hideConsequence();
}

dom.tabSpace?.addEventListener("click", () => setSidePanel("space"));
dom.tabPickup?.addEventListener("click", () => setSidePanel("pickup"));

// --- Eco scanner (educational, no real brands) --------------------------------
const ECO_PRODUCTS = [
  { id: "bottle", title: "Flaske", sub: "plast / PET", base: { resources: 58, co2: 52, time: 35 } },
  { id: "bag", title: "Pose", sub: "plast / LDPE", base: { resources: 50, co2: 44, time: 30 } },
  { id: "tshirt", title: "T-skjorte", sub: "tekstiler / bomull", base: { resources: 72, co2: 66, time: 70 } },
  { id: "phone", title: "Telefon", sub: "elektronikk", base: { resources: 95, co2: 88, time: 85 } },
  { id: "shoes", title: "Joggesko", sub: "komposittmaterialer", base: { resources: 82, co2: 74, time: 78 } },
  { id: "cup", title: "Kopp", sub: "papir + plast", base: { resources: 46, co2: 42, time: 28 } },
];

const ECO_ACTIONS = [
  {
    id: "repair",
    label: "Reparasjon",
    factors: { resources: 0.28, co2: 0.32, time: 1.25 },
    note: "Forlenger levetiden: mindre ny produksjon og råvareuttak.",
  },
  {
    id: "rent",
    label: "Leie",
    factors: { resources: 0.35, co2: 0.42, time: 1.15 },
    note: "Én gjenstand kan brukes av flere — lavere behov for nytt.",
  },
  {
    id: "used",
    label: "Brukt",
    factors: { resources: 0.32, co2: 0.38, time: 1.1 },
    note: "Et nytt liv reduserer presset på ressurser og energi.",
  },
  {
    id: "recycle",
    label: "Resirkulering",
    factors: { resources: 0.55, co2: 0.6, time: 0.95 },
    note: "Materialer går tilbake i kretsløpet, men gjenvinning krever også energi.",
  },
  {
    id: "single",
    label: "Engangs",
    factors: { resources: 1, co2: 1, time: 0.55 },
    note: "Kort bruk → høyere fotavtrykk. Unngå der det er mulig.",
  },
];

let scannerProductId = ECO_PRODUCTS[0]?.id ?? "bottle";
let scannerActionId = "recycle";

function computeEcoImpact(product, action) {
  const base = product?.base ?? { resources: 60, co2: 55, time: 50 };
  const f = action?.factors ?? { resources: 1, co2: 1, time: 1 };
  return {
    resources: clamp(Math.round(base.resources * f.resources), 0, 100),
    co2: clamp(Math.round(base.co2 * f.co2), 0, 100),
    time: clamp(Math.round(base.time * f.time), 0, 100),
  };
}

function setScannerSelection({ productId, actionId } = {}) {
  if (productId && ECO_PRODUCTS.some((p) => p.id === productId)) scannerProductId = productId;
  if (actionId && ECO_ACTIONS.some((a) => a.id === actionId)) scannerActionId = actionId;
  renderEcoScanner();
}

function renderEcoScanner() {
  if (!dom.scannerProducts || !dom.scannerActions) return;
  const product = ECO_PRODUCTS.find((p) => p.id === scannerProductId) ?? ECO_PRODUCTS[0];
  const action = ECO_ACTIONS.find((a) => a.id === scannerActionId) ?? ECO_ACTIONS[0];
  if (!product || !action) return;

  const impact = computeEcoImpact(product, action);

  const updateMetric = (fillEl, valEl, value) => {
    if (valEl) valEl.textContent = `${value}/100`;
    if (fillEl) fillEl.style.width = `${value}%`;
  };

  updateMetric(dom.metricResourcesFill, dom.metricResourcesVal, impact.resources);
  updateMetric(dom.metricCo2Fill, dom.metricCo2Val, impact.co2);
  updateMetric(dom.metricTimeFill, dom.metricTimeVal, impact.time);

  if (dom.scannerNote) {
    dom.scannerNote.textContent = `${product.title} • ${action.label}. Ressurser/CO₂: lavere er bedre. Tid: høyere er bedre. ${action.note}`;
  }

  for (const btn of dom.scannerProducts.querySelectorAll("button[data-product]")) {
    btn.classList.toggle("is-active", btn.dataset.product === scannerProductId);
    btn.setAttribute("aria-pressed", btn.dataset.product === scannerProductId ? "true" : "false");
  }
  for (const btn of dom.scannerActions.querySelectorAll("button[data-action]")) {
    btn.classList.toggle("is-active", btn.dataset.action === scannerActionId);
    btn.setAttribute("aria-pressed", btn.dataset.action === scannerActionId ? "true" : "false");
  }
}

function initEcoScanner() {
  if (!dom.scannerProducts || !dom.scannerActions) return;

  if (!dom.scannerProducts.childElementCount) {
    for (const p of ECO_PRODUCTS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scanner-item";
      btn.dataset.product = p.id;
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = `<div class="scanner-item-title">${p.title}</div><div class="scanner-item-sub">${p.sub}</div>`;
      dom.scannerProducts.appendChild(btn);
    }
  }

  if (!dom.scannerActions.childElementCount) {
    for (const a of ECO_ACTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scanner-action";
      btn.dataset.action = a.id;
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = a.label;
      dom.scannerActions.appendChild(btn);
    }
  }

  dom.scannerProducts.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-product]");
    const productId = btn?.dataset?.product;
    if (!productId) return;
    setScannerSelection({ productId });
  });

  dom.scannerActions.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    const actionId = btn?.dataset?.action;
    if (!actionId) return;
    setScannerSelection({ actionId });
  });

  renderEcoScanner();
}

// --- Pickup request form ------------------------------------------------------
const PICKUP_STORAGE_KEY = "pickupRequests.v1";
let lastPickupText = "";

function setPickupStatus(message, kind = "info") {
  if (!dom.pickupStatus) return;
  dom.pickupStatus.classList.remove("is-ok", "is-err");
  if (kind === "ok") dom.pickupStatus.classList.add("is-ok");
  if (kind === "err") dom.pickupStatus.classList.add("is-err");
  dom.pickupStatus.textContent = message;
}

function buildPickupTextFromForm(form) {
  const fd = new FormData(form);
  const createdAt = new Date().toLocaleString();
  const name = String(fd.get("name") ?? "").trim();
  const contact = String(fd.get("contact") ?? "").trim();
  const address = String(fd.get("address") ?? "").trim();
  const waste = String(fd.get("waste") ?? "").trim();
  const volume = String(fd.get("volume") ?? "").trim();
  const comment = String(fd.get("comment") ?? "").trim();

  const wasteLabel = {
    plastic: "Plast",
    paper: "Papir/kartong",
    glass: "Glass",
    metal: "Metall",
    ewaste: "Elektronikk",
    mixed: "Blandet",
  }[waste];

  const lines = [
    `Forespørsel om henting og resirkulering`,
    `Dato: ${createdAt}`,
    ``,
    `Navn: ${name}`,
    `Kontakt: ${contact}`,
    `Adresse: ${address}`,
    `Avfallstype: ${wasteLabel || waste || "—"}`,
    `Mengde: ${volume || "—"}`,
    `Kommentar: ${comment || "—"}`,
  ];
  return lines.join("\n");
}

function persistPickupRequest(text) {
  const raw = localStorage.getItem(PICKUP_STORAGE_KEY);
  const prev = safeParseJSON(raw);
  const list = Array.isArray(prev) ? prev : [];
  list.unshift({ createdAt: Date.now(), text });
  list.splice(20);
  localStorage.setItem(PICKUP_STORAGE_KEY, JSON.stringify(list));
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function initPickupForm() {
  if (!dom.pickupForm) return;

  dom.pickupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (typeof dom.pickupForm.reportValidity === "function" && !dom.pickupForm.reportValidity()) return;

    const text = buildPickupTextFromForm(dom.pickupForm);
    lastPickupText = text;
    persistPickupRequest(text);
    setPickupStatus("Lagret. Trykk «Kopier» eller «Last ned .txt».", "ok");
  });

  dom.pickupCopy?.addEventListener("click", async () => {
    const text = lastPickupText || buildPickupTextFromForm(dom.pickupForm);
    lastPickupText = text;
    const ok = await copyToClipboard(text);
    if (ok) setPickupStatus("Kopiert til utklippstavlen.", "ok");
    else {
      window.prompt("Kopier forespørselen:", text);
      setPickupStatus("Åpnet et vindu for manuell kopiering.", "info");
    }
  });

  dom.pickupDownload?.addEventListener("click", () => {
    const text = lastPickupText || buildPickupTextFromForm(dom.pickupForm);
    lastPickupText = text;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(text, `pickup-request-${stamp}.txt`);
    setPickupStatus("Filen er lastet ned.", "ok");
  });
}

// --- Eco-spectrum emotions ----------------------------------------------------
const EMO_PLAN_KEY = "ecoSpectrum.plan.v1";
const EMO_LAST_KEY = "ecoSpectrum.lastEmotion.v1";
const EMO_PLAN_MAX = 7;

// Data (use as-is; can be reformatted in UI).
const emotionsData = {
  anxiety: {
    title: "Uro",
    validationLine: "Det er helt normalt å kjenne uro når verden føles for stor.",
    copingTips: [
      "Smalt fokus: velg én handling, ikke ti.",
      "Skill mellom det du kan kontrollere og det du ikke kan.",
      "Uro blir mindre når det finnes en plan.",
    ],
    actionsToday: [
      "Ta med en flergangsflaske/kopp.",
      "Si nei til pose: bruk handlenett eller bær i hånden.",
      "Del opp avfallet hjemme i minst to kategorier.",
      "Slå av unødvendig lys/ladere i dag.",
      "Velg én ting og bestem: selg/gis bort, ikke kast.",
      "Ta et bilde av nærmeste batteri-innsamling, så du ikke glemmer.",
    ],
    actionsWeek: [
      "Samle batterier/pærer og lever dem inn.",
      "En uke uten engangsflasker — bruk egen beholder.",
      "Lag ett måltid slik at du bruker opp restene.",
      "Reparer én ting (knapp, glidelås, kabel) i stedet for å bytte.",
      "Prøv å kjøpe én ting brukt i stedet for ny.",
      "Velg et produkt uten unødvendig emballasje minst tre ganger.",
    ],
  },
  anger: {
    title: "Sinne",
    validationLine: "Sinne er energi. Den kan rettes mot handling.",
    copingTips: [
      "Gjør følelsen til ett konkret steg: «hva kan jeg gjøre akkurat nå?»",
      "Velg handlinger som endrer systemet, ikke bare deg.",
      "Hold tempoet: litt og jevnlig slår å brenne ut på én dag.",
    ],
    actionsToday: [
      "Dropp den mest meningsløse engangs-tingen i dag.",
      "Spør på kafé: «kan jeg få i min egen kopp?»",
      "Del en post/Story med én fakta og ett tips.",
      "Støtt et lokalt initiativ/petisjon for kildesortering (hvis det finnes).",
      "Plukk søppel i 5 minutter nær hjemmet (trygt).",
      "Del et mottakspunkt for avfall/ting med en venn.",
    ],
    actionsWeek: [
      "Arranger et mini-bytte av ting med venner.",
      "Finn et verksted/repair café i byen.",
      "Gi bort klær til gjenbruk eller materialgjenvinning.",
      "Halver leveranser med mye emballasje.",
      "Skriv til en butikk/kafé og be om kildesortering.",
      "Prøv en uke uten engangs-kaffe.",
    ],
  },
  fatigue: {
    title: "Utmattelse",
    validationLine: "Utmattelse er et signal om å senke belastningen, ikke å gi opp.",
    copingTips: [
      "Velg den letteste handlingen — det teller også.",
      "Ikke sammenlign deg med perfekte bilder.",
      "Hvile er en del av bærekraft.",
    ],
    actionsToday: [
      "Ta ett enkelt steg: nett/flaske/boks.",
      "Ikke kjøp noe ekstra «på følelser» i dag.",
      "Sorter én kategori: bare papir eller bare plast.",
      "Velg større pakning i stedet for flere små.",
      "Bruk det du allerede har hjemme i stedet for å kjøpe nytt.",
      "Sett en påminnelse om batterier/elektronikk til helgen.",
    ],
    actionsWeek: [
      "Kjøp brukt eller byt én gang i stedet for ny.",
      "Gå gjennom én hylle og gi bort det du ikke trenger.",
      "Lag en «dag uten levering».",
      "Lær én enkel reparasjon (knapp, søm, kabel).",
      "Velg tre produkter med mindre emballasje.",
      "Samle resirkulerbart og lever alt i én tur.",
    ],
  },
  motivation: {
    title: "Motivasjon",
    validationLine: "Kult. Bruk denne energien til å gjøre det til en vane.",
    copingTips: [
      "Sett et lite mål for en uke, ikke for livet.",
      "Gjør det enkelt: legg nett/flaske klart på forhånd.",
      "Marker fremgang — motivasjon liker synlige resultater.",
    ],
    actionsToday: [
      "Lag et mini-kit: handlenett + flaske + matboks.",
      "Sorter og gjør klar resirkulerbart.",
      "Velg reparasjon i stedet for å kjøpe nytt (hvis mulig).",
      "Kjøp én ting brukt.",
      "Kutt emballasje: velg løsvekt/refill/større pakning.",
      "Fortell én person om en sirkulær idé.",
    ],
    actionsWeek: [
      "Gjør en utfordring: 7 dager med flergangsflaske.",
      "Lever inn elektronikk/batterier.",
      "Finn og prøv en repair-/serviceløsning for én ting.",
      "Lag handleliste for å unngå ekstra kjøp.",
      "Arranger bytte av klær eller ting.",
      "Lag én enkel «upcycle» (gjør om noe i stedet for å kaste).",
    ],
  },
  apathy: {
    title: "Likegyldighet",
    validationLine: "Likegyldighet dukker ofte opp når temaet føles for fjernt.",
    copingTips: [
      "Gjør noe som også lønner seg for deg: sparer penger/tid.",
      "Start med én gjenstand — ikke med hele verden.",
      "Noen ganger kommer interessen etter det første enkle steget.",
    ],
    actionsToday: [
      "Ta med handlenett — det er bare mer praktisk.",
      "Kjøp drikke i større pakning i stedet for små.",
      "Ikke ta engangsbestikk/servietter «for sikkerhets skyld».",
      "Gi bort én ting til brukt i stedet for å kaste.",
      "Velg varer med mindre emballasje.",
      "Åpne kartet: hvor er nærmeste sted for batteriinnsamling?",
    ],
    actionsWeek: [
      "Prøv å kjøpe brukt én gang — for å spare penger.",
      "Gjør en liten rydderunde: hva kan selges/gis bort?",
      "Kutt engangs-kaffe minst to ganger.",
      "Lever resirkulerbart i én tur.",
      "Finn et reparasjonstilbud for telefon/hodetelefoner.",
      "Prøv én vane fra listen og vurder om det ble enklere.",
    ],
  },
};

function pickDifferent(list, previous) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  let next = arr[Math.floor(Math.random() * arr.length)];
  let guard = 12;
  while (next === previous && guard-- > 0) next = arr[Math.floor(Math.random() * arr.length)];
  return next;
}

function normalizePlan(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of arr) {
    const t = String(item ?? "").trim();
    if (!t) continue;
    if (out.includes(t)) continue;
    out.push(t);
  }
  return out.slice(0, EMO_PLAN_MAX);
}

function initEcoSpectrumEmotions() {
  if (!dom.panelEmotions || !dom.emotionGrid) return;

  const buttons = [...dom.emotionGrid.querySelectorAll("button[data-emotion]")];
  if (!buttons.length) return;

  const state = {
    selected: null,
    today: "",
    week: "",
    plan: normalizePlan(safeParseJSON(localStorage.getItem(EMO_PLAN_KEY))),
  };

  const setNote = (text) => {
    if (!dom.emotionNote) return;
    dom.emotionNote.textContent = text || "";
  };

  const persistPlan = () => {
    localStorage.setItem(EMO_PLAN_KEY, JSON.stringify(state.plan));
  };

  const renderPlan = () => {
    if (!dom.emotionPlanList) return;
    dom.emotionPlanList.innerHTML = "";

    if (!state.plan.length) {
      const li = document.createElement("li");
      li.className = "emotion-plan-item emotion-plan-item--empty";
      li.textContent = "Tomt foreløpig. Lagre en handling, så dukker den opp her.";
      dom.emotionPlanList.appendChild(li);
      return;
    }

    for (const text of state.plan) {
      const li = document.createElement("li");
      li.className = "emotion-plan-item";
      li.textContent = text;
      dom.emotionPlanList.appendChild(li);
    }
  };

  const animateResponse = () => {
    if (reduceMotion || !dom.emotionResponse) return;
    dom.emotionResponse.classList.remove("is-enter");
    void dom.emotionResponse.offsetHeight;
    dom.emotionResponse.classList.add("is-enter");
  };

  const renderResponse = () => {
    if (!dom.emotionResponse || !state.selected) return;
    const data = emotionsData[state.selected];
    if (!data) return;

    if (dom.emotionValidation) dom.emotionValidation.textContent = data.validationLine;
    if (dom.emotionTips) {
      dom.emotionTips.innerHTML = "";
      for (const tip of data.copingTips) {
        const li = document.createElement("li");
        li.textContent = tip;
        dom.emotionTips.appendChild(li);
      }
    }

    if (dom.emotionToday) dom.emotionToday.textContent = state.today || "-";
    if (dom.emotionWeek) dom.emotionWeek.textContent = state.week || "-";

    dom.emotionResponse.hidden = false;
    animateResponse();
  };

  const rerollActions = () => {
    if (!state.selected) return;
    const data = emotionsData[state.selected];
    if (!data) return;
    state.today = pickDifferent(data.actionsToday, state.today);
    state.week = pickDifferent(data.actionsWeek, state.week);
    renderResponse();
  };

  const setSelected = (emotionKey, { persist = true } = {}) => {
    if (!emotionsData[emotionKey]) return;
    state.selected = emotionKey;
    if (persist) localStorage.setItem(EMO_LAST_KEY, emotionKey);

    for (const btn of buttons) {
      const isActive = btn.dataset.emotion === emotionKey;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }

    setNote("");
    rerollActions();
  };

  dom.emotionGrid.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-emotion]");
    const key = btn?.dataset?.emotion;
    if (!key) return;
    setSelected(key);
  });

  dom.emotionReroll?.addEventListener("click", () => {
    if (!state.selected) return setNote("Velg en følelse først.");
    setNote("");
    rerollActions();
  });

  dom.emotionSave?.addEventListener("click", () => {
    if (!state.selected) return setNote("Velg en følelse først.");
    if (!state.today || !state.week) rerollActions();

    const title = emotionsData[state.selected]?.title ?? "Følelse";
    const itemsToAdd = [
      `${title} — I dag: ${state.today}`,
      `${title} — For uken: ${state.week}`,
    ];

    const next = [...itemsToAdd, ...state.plan].filter(Boolean);
    state.plan = normalizePlan(next);
    persistPlan();
    renderPlan();
    setNote("Lagt til i planen.");
  });

  dom.emotionPlanClear?.addEventListener("click", () => {
    state.plan = [];
    persistPlan();
    renderPlan();
    setNote("Planen er tømt.");
  });

  dom.emotionPlanDownload?.addEventListener("click", () => {
    if (!state.plan.length) return setNote("Planen er tom. Legg til handlinger først.");
    setNote("");
    const stamp = new Date().toISOString().slice(0, 10);
    const lines = ["Min plan — Planet Reboot", "", ...state.plan.map((t, i) => `${i + 1}. ${t}`), ""];
    downloadTextFile(lines.join("\n"), `my-plan-${stamp}.txt`);
  });

  renderPlan();

  const last = String(localStorage.getItem(EMO_LAST_KEY) ?? "").trim();
  if (last && emotionsData[last]) setSelected(last, { persist: false });
}

initEcoScanner();
initPickupForm();

function resetSimulation() {
  isTimeUp = false;
  state.health = DEFAULT_HEALTH;
  state.yearsLeft = DEFAULT_YEARS;
  spawnTypeCursor = 0;
  clearAllTrash();
  hideConsequence();
  updateHUD();
  updatePlanetLook();
  persistState();
}

dom.btnReset?.addEventListener("click", resetSimulation);
dom.btnErrorClose?.addEventListener("click", () => setOverlayVisible(dom.overlayError, false));

// --- Boot --------------------------------------------------------------------
async function initScene() {
  if (dom.loadingText) dom.loadingText.textContent = "Laster modeller…";

  const [planetResult, trashResult, bottleResult, garbageResult, sputnikResult] = await Promise.allSettled([
    loadGLB(MODEL_PLANET),
    loadGLB(MODEL_TRASH),
    loadGLB(MODEL_BOTTLE),
    loadGLB(MODEL_GARBAGE),
    loadGLB(MODEL_SPUTNIK),
  ]);

  // Planet
  if (planetResult.status === "fulfilled") {
    planetRoot = planetResult.value.scene;
    planetGroup.add(planetRoot);
    centerAndScaleToRadius(planetRoot, 1);
  } else {
    const fallback = buildFallbackPlanet();
    planetRoot = new THREE.Group();
    planetRoot.add(fallback);
    planetGroup.add(planetRoot);
    showLoadError("Kunne ikke laste planet-modellen. Bruker en enkel variant.");
  }

  planetRoot.updateWorldMatrix(true, true);
  const planetBox = new THREE.Box3().setFromObject(planetRoot);
  const planetSphere = planetBox.getBoundingSphere(new THREE.Sphere());
  planetRadius = planetSphere.radius > 0 ? planetSphere.radius : 1;

  planetPickMeshes = [];
  planetRoot.traverse((obj) => {
    if (!obj.isMesh) return;
    planetPickMeshes.push(obj);
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) fixMaterialColorMaps(m);
  });

  // Camera distances based on planet size
  controls.target.set(0, 0, 0);
  controls.minDistance = planetRadius * 2.05;
  controls.maxDistance = planetRadius * 5.6;
  camera.position.set(0, planetRadius * 0.35, planetRadius * 3.2);
  camera.lookAt(controls.target);
  controls.update();

  // Space mode (satellites)
  if (sputnikResult.status === "fulfilled") {
    sputnikTemplate = sputnikResult.value.scene;
    sputnikTemplate.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) fixMaterialColorMaps(m);
    });
  } else {
    sputnikTemplate = buildFallbackSputnik();
    showLoadError("Kunne ikke laste satellitt-modellen. Bruker en enkel variant.");
  }
  centerAndScaleToRadius(sputnikTemplate, planetRadius * 0.32);
  buildSatellites();

  // Trash instancing (trash / bottle / garbage)
  litterMeshes.length = 0;
  litterBaseScales.length = 0;

  const desiredTrashRadius = planetRadius * 0.06;
  trashSurfaceOffset = desiredTrashRadius * 0.55;
  trashMinDistanceSq = Math.pow(desiredTrashRadius * 1.15 * 2.15, 2);

  const types = [
    { key: "trash", result: trashResult },
    { key: "bottle", result: bottleResult },
    { key: "garbage", result: garbageResult },
  ];

  for (const t of types) {
    let build = null;
    if (t.result.status === "fulfilled") build = buildTrashGeometryFromGLTF(t.result.value);
    if (!build) {
      build = buildFallbackTrashGeometry();
      showLoadError(`Kunne ikke laste ${t.key}-modellen. Bruker en enkel variant.`);
    }

    build.geometry.computeBoundingSphere();
    const radiusLocal = build.geometry.boundingSphere?.radius ?? 0.1;
    const baseScale = radiusLocal > 0 ? desiredTrashRadius / radiusLocal : 0.085;
    litterBaseScales.push(baseScale);

    const mesh = new THREE.InstancedMesh(build.geometry, build.material, MAX_TRASH_INSTANCES);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    planetGroup.add(mesh);
    litterMeshes.push(mesh);
  }

  initTrashSlots();
  const restoredTrash = restoreTrashFromPacked(stored?.trash);
  if (!restoredTrash && state.trashCount > 0) restoreTrashFromCount(state.trashCount);

  updatePlanetLook();
  hideLoading();
}

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  const dtSim = Math.min(dt, 0.033);

  controls.update();

  // Keep background centered on the camera so it fills the whole viewport.
  bgGroup.position.copy(camera.position);

  if (!reduceMotion && sceneMode === "planet" && state.autoRotateEnabled) planetGroup.rotation.y += dt * 0.22;

  // Update matrices after planet rotation (used for flight targets).
  planetGroup.updateWorldMatrix(true, false);

  updateStarTwinkle(clock.elapsedTime);

  if (sceneMode === "space" && !reduceMotion && state.autoRotateEnabled) {
    updateSatellites(dtSim, clock.elapsedTime);
  }

  // Trash flight + scale in/out
  if (sceneMode === "planet" && litterMeshes.length && !reduceMotion) {
    let anyMatrixChanged = false;
    const meshDirty = new Array(litterMeshes.length).fill(false);
    let trashCountDirty = false;

    // planetGroup transforms (world <-> local)
    planetGroup.getWorldQuaternion(tmpQuatB);
    tmpQuatC.copy(tmpQuatB).invert(); // inv planet quat
    tmpMat4b.copy(planetGroup.matrixWorld).invert(); // inv planet mat (world -> local)

    for (let k = 0; k < trashActive.length; k += 1) {
      const i = trashActive[k];
      const slot = trashSlots[i];
      let matrixDirty = false;

      if (slot.flying && !slot.removing) {
        stepTrashFlight(slot, dtSim, tmpQuatB, tmpQuatC, tmpMat4b);
        matrixDirty = true;
      }

      const speed = slot.target > slot.scaleT ? 7.0 : 6.0;
      const next = damp(slot.scaleT, slot.target, speed, dtSim);

      if (Math.abs(next - slot.scaleT) > 0.0005) {
        slot.scaleT = next;
        matrixDirty = true;
      }

      if (slot.removing && slot.scaleT <= 0.03) {
        const slotType = slot.type;
        finalizeTrashRemoval(i);
        anyMatrixChanged = true;
        meshDirty[slotType] = true;
        trashCountDirty = true;
        k -= 1;
        continue;
      }

      if (matrixDirty) {
        setTrashInstanceMatrix(i, slot.scaleT);
        anyMatrixChanged = true;
        meshDirty[slot.type] = true;
      }
    }
    if (anyMatrixChanged) {
      for (let m = 0; m < meshDirty.length; m += 1) {
        if (!meshDirty[m]) continue;
        litterMeshes[m].instanceMatrix.needsUpdate = true;
      }
    }
    if (trashCountDirty) {
      state.trashCount = trashActive.length;
      updateHUD();
      persistState();
    }
  }

  const nowMs = performance.now();
  updateRecycleFx(nowMs);
  updateConsequence(nowMs);
  updatePlanetLook();
  renderer.render(scene, camera);
}

window.addEventListener(
  "resize",
  () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  },
  { passive: true }
);

try {
  await initScene();
  if (!reduceMotion && dom.btnPause)
    dom.btnPause.textContent = controls.autoRotate ? "Pause rotasjon" : "Fortsett rotasjon";
  tick();
} catch (err) {
  showLoadError("Kunne ikke starte 3D-scenen. Sørg for at nettleseren støtter WebGL.");
  // eslint-disable-next-line no-console
  console.error(err);
}

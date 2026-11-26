// main.js — Skyline Ridge Run: the game loop. Arcade flight physics with
// throttle discipline (stall, fuel burn, gear and touchdown quality), the
// chase camera, ring/landing/crash detection and the screenshot presets.
import * as THREE from 'three';
import { buildTerrain, buildRunway, buildRiverAndLake, buildTrees, buildRings,
  buildClouds, buildSky, terrainHeight, RUNWAY } from './world.js';
import { buildAircraft, spinPropeller, setGearVisible } from './aircraft.js';
import { createInput, consumePress } from './input.js';
import { createAudio } from './audio.js';
import { createHud, formatClock } from './hud.js';
import { createMissionRun, MISSIONS } from './missions.js';

const MAX_SPEED = 78;        // m/s at full throttle
const STALL_SPEED = 17;      // m/s — below this she sinks no matter the pitch
const CRASH_VSPEED = 9;      // m/s descent on touchdown that breaks the plane
const FUEL_BURN = 0.0035;    // fraction of tank per second at full throttle
const params = new URLSearchParams(window.location.search);
const PRESET = params.get('preset') || '';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('scene').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 5000);
buildSky(scene);
buildTerrain(scene);
const { stripTopY } = buildRunway(scene);
buildRiverAndLake(scene);
buildTrees(scene);
const rings = buildRings(scene);
const clouds = buildClouds(scene);

const plane = buildAircraft();
scene.add(plane);

const input = createInput();
const audio = createAudio();
const hud = createHud();

const flight = {
  pos: new THREE.Vector3(0, 42, 330),
  yaw: 0, pitch: 0, roll: 0,
  speed: 0, throttle: 0,
  vspeed: 0, fuel: 1, damage: 0,
  gearDown: true, airborne: false,
  crashed: false, landed: false, started: false,
  autoFly: false, autoPitch: 0.03, lastGroundY: 0,
};
let mission = createMissionRun('rings');
let lastTime = performance.now();
let messageCooldown = 0;

function resetFlight(missionId) {
  const def = MISSIONS[missionId] || MISSIONS.rings;
  mission = createMissionRun(missionId);
  flight.pos.set(def.start.x, def.start.y, def.start.z);
  flight.yaw = def.start.heading;
  flight.pitch = 0; flight.roll = 0;
  flight.speed = def.start.speed; flight.throttle = def.start.throttle;
  flight.vspeed = 0; flight.fuel = 1; flight.damage = 0;
  flight.gearDown = true; flight.airborne = def.start.y > terrainHeight(def.start.x, def.start.z) + 6;
  flight.crashed = false; flight.landed = false; flight.started = true;
  flight.autoFly = false;
  rings.forEach((r) => r.material.color.setHex(0xff9a2f));
  rings.forEach((r, i) => { r.visible = missionId === 'rings' || missionId === 'canyon' ? true : i === 0; });
  hud.hideOverlay();
  hud.showMessage(def.title, def.briefing, 5200);
  audio.start();
}

function applyPreset(name) {
  // Screenshot presets: real game states reachable by flying, chosen by URL
  // so the maker can frame the cover, a climb, a ring pass and a landing.
  const spots = {
    cover:   { x: 0, y: 78, z: 480, yaw: 0, pitch: 0.02, speed: 52, throttle: 0.66, mission: 'rings' },
    climb:   { x: -180, y: 175, z: 120, yaw: -0.9, pitch: 0.16, speed: 58, throttle: 0.78, mission: 'rings' },
    ring:    { x: 0, y: 92, z: -330, yaw: 0, pitch: 0, speed: 56, throttle: 0.72, mission: 'rings' },
    landing: { x: 4, y: 26, z: 420, yaw: 0, pitch: -0.06, speed: 30, throttle: 0.34, mission: 'landing' },
  };
  const s = spots[name] || spots.cover;
  resetFlight(s.mission);
  flight.pos.set(s.x, s.y, s.z);
  flight.yaw = s.yaw; flight.pitch = s.pitch; flight.roll = name === 'climb' ? 0.5 : 0;
  flight.speed = s.speed; flight.throttle = s.throttle;
  flight.airborne = true;
  flight.autoFly = true;   // gentle auto-level keeps her flying straight for the shot
  flight.autoPitch = name === 'landing' ? -0.045 : 0.03;
  flight.snapCamera = true; // start the shot framed on the plane, no slow catch-up
  hud.clearMessage();
  if (name === 'ring') hud.showMessage('RING 1 AHEAD', 'Fly through the glowing hoop', 4000);
  if (name === 'landing') hud.showMessage('FINAL APPROACH', 'Runway 27 — gear down, throttle easy', 4000);
  if (name === 'cover') hud.showMessage('', '');
}

function updateFlight(dt) {
  if (!flight.started || flight.crashed) return;
  // One-shot keys.
  if (consumePress(input, 'KeyG')) { flight.gearDown = !flight.gearDown; setGearVisible(plane, flight.gearDown); }
  if (consumePress(input, 'KeyM')) { const m = audio.toggleMute(); hud.showMessage(m ? 'SOUND OFF' : 'SOUND ON', '', 1200); }
  if (consumePress(input, 'KeyR')) { resetFlight(mission.def.id); return; }
  if (consumePress(input, 'KeyP')) { flight.autoFly = !flight.autoFly; }

  // Any stick input hands the plane back to the pilot.
  if (Math.abs(input.pitch) > 0.05 || Math.abs(input.roll) > 0.05 || input.throttleUp || input.throttleDown) {
    flight.autoFly = false;
  }

  // Throttle: W/S move it, fuel starvation forces it to idle.
  if (input.throttleUp) flight.throttle = Math.min(1, flight.throttle + dt * 0.45);
  if (input.throttleDown) flight.throttle = Math.max(0, flight.throttle - dt * 0.6);
  if (flight.fuel <= 0) flight.throttle = Math.max(0, flight.throttle - dt * 0.5);
  flight.fuel = Math.max(0, flight.fuel - FUEL_BURN * (0.25 + flight.throttle) * dt);

  // Attitude: bank to turn, pitch to climb and dive; the plane eases back level.
  const targetRoll = flight.autoFly ? 0 : input.roll * 0.9;
  const targetPitch = flight.autoFly ? flight.autoPitch : -input.pitch * 0.42;
  flight.roll += (targetRoll - flight.roll) * Math.min(1, dt * 2.2);
  flight.pitch += (targetPitch - flight.pitch) * Math.min(1, dt * 1.8);
  // Yaw follows the bank (a coordinated turn) plus rudder.
  flight.yaw -= (flight.roll * 0.55 + input.yaw * 0.35) * (flight.speed / MAX_SPEED) * dt * 1.4;

  // Speed chases the throttle; drag grows in a hard bank.
  const targetSpeed = flight.throttle * MAX_SPEED * (1 - Math.abs(flight.roll) * 0.14);
  flight.speed += (targetSpeed - flight.speed) * Math.min(1, dt * 0.55);
  if (flight.speed < 4) flight.speed = 4;

  // Vertical speed: pitch and power lift her, a stall drops her.
  const stalling = flight.speed < STALL_SPEED && flight.airborne;
  let vy = Math.sin(flight.pitch) * flight.speed;
  if (stalling) vy -= (STALL_SPEED - flight.speed) * 0.55;
  if (!flight.airborne) vy = Math.max(0, vy);
  flight.vspeed = vy;

  const forward = new THREE.Vector3(-Math.sin(flight.yaw), 0, -Math.cos(flight.yaw));
  flight.pos.addScaledVector(forward, flight.speed * dt);
  flight.pos.y += vy * dt;

  // Keep her inside the valley.
  const edge = 1250;
  if (Math.abs(flight.pos.x) > edge || Math.abs(flight.pos.z) > edge) {
    flight.yaw += Math.PI * dt * 0.4;
    hud.showMessage('TURN BACK', 'You are leaving the valley', 1500);
  }
  if (flight.pos.y > 420) { flight.pos.y = 420; flight.pitch = Math.min(flight.pitch, 0); }

  // Ground contact: runway landing, field landing, or crash.
  const groundY = terrainHeight(flight.pos.x, flight.pos.z);
  const onRunway = Math.abs(flight.pos.x - RUNWAY.x) < RUNWAY.width / 2 &&
    Math.abs(flight.pos.z - RUNWAY.z) < RUNWAY.length / 2;
  const groundLevel = onRunway ? stripTopY : groundY;
  if (flight.pos.y <= groundLevel + 1.6) {
    flight.pos.y = groundLevel + 1.6;
    const descent = -vy;
    const gentle = descent < 3.5 && flight.speed < 34 && flight.gearDown;
    if (!flight.airborne) {
      // Rolling along the ground: friction bleeds speed, steering still works.
      flight.speed = Math.max(0, flight.speed - dt * 14);
      if (onRunway && flight.speed < 12 && !flight.scoredLanding && flight.started) {
        flight.scoredLanding = true;
        const quality = Math.max(0, 1 - descent / 4 - Math.abs(flight.roll) / 1.2);
        const pts = mission.addLandingPoints(quality);
        audio.chime(true);
        flight.fuel = 1;
        hud.showMessage('TOUCHDOWN! +' + pts, 'Refuelled — take off again and keep flying', 3600);
      }
      if (flight.speed < 2) flight.landed = false;
    } else if (onRunway && gentle) {
      flight.airborne = false;
      flight.pitch = 0; flight.roll *= 0.4;
      audio.chime(true);
    } else if (onRunway && descent < CRASH_VSPEED && flight.speed < 46) {
      // Hard but survivable: damage, a bounce, and a warning.
      flight.airborne = false;
      flight.damage += 30;
      flight.pitch = 0;
      audio.thud();
      hud.showMessage('HARD LANDING', 'Damage ' + Math.round(flight.damage) + '% — be gentler next time', 3000);
      if (flight.damage >= 100) crashPlane('The airframe gave out after the hard landing.');
    } else {
      crashPlane(onRunway ? 'You came in too fast and too steep for runway 27.'
        : 'Terrain impact at ' + Math.round(flight.speed * 1.94) + ' knots.');
    }
  } else {
    flight.airborne = true;
    flight.landed = false;
    flight.scoredLanding = false;
  }

  // Canyon run: low over the gorge pays while the meter runs.
  if (mission.def.id === 'canyon' && flight.airborne) {
    const agl = flight.pos.y - groundY;
    if (agl < 37 && flight.speed > 30) {
      const pts = mission.addLowTime(dt);
      if (pts > 0) { audio.chime(true); hud.showMessage('+40 LOW PASS', 'Stay under 120 ft to keep scoring', 1400); }
    } else mission.breakLowStreak();
  }

  // Rings: the next hoop glows green, passing it scores and lights the next.
  if (mission.def.id === 'rings' && !mission.finished && flight.airborne) {
    const ring = rings[mission.nextRing];
    if (ring) {
      ring.material.color.setHex(0x39d353);
      const d = flight.pos.distanceTo(ring.position);
      if (d < 17) {
        mission.addRingPoints();
        audio.chime(true);
        ring.material.color.setHex(0xff9a2f);
        if (mission.finished) {
          hud.showMessage(mission.finishReason, 'Final score ' + mission.score + ' — press R to fly again', 6000);
        } else {
          hud.showMessage('RING ' + mission.ringsHit + '!', 'Next ring is glowing green', 1600);
        }
      }
    }
  }

  // Fuel warnings.
  if (flight.fuel < 0.25 && flight.fuel > 0 && messageCooldown <= 0) {
    hud.showMessage('LOW FUEL', 'Land on runway 27 to refuel', 2500);
    messageCooldown = 8;
  }
  messageCooldown -= dt;
  mission.elapsed += dt;
}

function crashPlane(reason) {
  flight.crashed = true;
  flight.speed = 0;
  flight.throttle = 0;
  audio.thud();
  hud.showMessage('CRASHED', reason + ' Press R to fly again.', 0);
}

function updateCamera(dt) {
  const forward = new THREE.Vector3(-Math.sin(flight.yaw), 0, -Math.cos(flight.yaw));
  const desired = flight.pos.clone()
    .addScaledVector(forward, -23)
    .add(new THREE.Vector3(0, 7.5, 0));
  if (flight.snapCamera) {
    camera.position.copy(desired);
    flight.snapCamera = false;
  } else {
    camera.position.lerp(desired, Math.min(1, dt * 3.2));
  }
  const look = flight.pos.clone().addScaledVector(forward, 26);
  look.y -= 4; // look slightly below the plane so the runway and rings fill the frame
  camera.lookAt(look);
  // The plane sits slightly below centre so the runway and rings stay in view.
  plane.position.copy(flight.pos);
  plane.rotation.set(0, 0, 0);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = flight.yaw;
  plane.rotation.x = flight.pitch;
  plane.rotation.z = flight.roll;
  spinPropeller(plane, dt, flight.throttle);
  // Blob shadow tracks the ground under the plane.
  const shadow = plane.userData.blobShadow;
  const gy = terrainHeight(flight.pos.x, flight.pos.z);
  const agl = Math.max(0, flight.pos.y - gy);
  shadow.position.set(0, -flight.pos.y + gy + 0.6, 0);
  shadow.material.opacity = Math.max(0, 0.24 - agl * 0.0012);
  shadow.scale.setScalar(Math.max(0.4, 1 - agl * 0.001));
  // Clouds drift slowly across the valley.
  clouds.children.forEach((c) => {
    c.position.x += c.userData.drift * dt;
    if (c.position.x > 1300) c.position.x = -1300;
  });
  // Ring hoops bob gently so the course feels alive.
  rings.forEach((r, i) => {
    r.position.y = r.userData.baseY + Math.sin(performance.now() / 900 + i * 1.3) * 1.2;
  });
}

function updateHud() {
  const groundY = terrainHeight(flight.pos.x, flight.pos.z);
  const altFeet = Math.max(0, (flight.pos.y - groundY) * 3.28);
  const speedKnots = flight.speed * 1.94;
  const headingDeg = ((flight.yaw * 57.2958) % 360 + 360) % 360;
  hud.setInstruments(altFeet, speedKnots, headingDeg, flight.vspeed * 196.85);
  hud.setFuel(flight.fuel);
  hud.setThrottle(flight.throttle, flight.gearDown, flight.crashed);
  hud.setAttitude(flight.pitch, flight.roll);
  hud.setMission(mission.def.title, mission.def.sub, mission.scoreText(), formatClock(mission.elapsed));
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  updateFlight(dt);
  updateCamera(dt);
  updateHud();
  audio.setFlightSound(flight.throttle, flight.speed * 1.94, flight.airborne);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.onMissionPick((id) => resetFlight(id));
// Dev hook for play-testing: read live flight state from the console.
window.__skyline = { flight, rings, get mission() { return mission; } };
if (PRESET) {
  applyPreset(PRESET);
} else {
  hud.showOverlay();
  // Idle attract mode: the plane sits on the runway, prop ticking over.
  flight.pos.set(0, stripTopY + 1.6, 180);
  flight.yaw = 0; flight.speed = 0; flight.throttle = 0.12;
  flight.airborne = false;
  camera.position.set(14, stripTopY + 9, 218);
  camera.lookAt(0, stripTopY + 3, 0);
}
requestAnimationFrame(loop);

// world.js — builds the Ridge Valley: procedural low-poly terrain, the airfield
// runway, the glowing ring course, river, lake, trees and drifting clouds.
// One shared height function drives both the mesh and flight collision.
import * as THREE from 'three';

export const WORLD_SIZE = 2600;
export const RUNWAY = { x: 0, z: 0, length: 620, width: 44, heading: 0 };

function ridgeNoise(x, z) {
  // Cheap deterministic value-noise from layered sines — no texture files needed.
  const a = Math.sin(x * 0.0041 + z * 0.0023) * Math.cos(z * 0.0031 - x * 0.0017);
  const b = Math.sin(x * 0.0113 - z * 0.0087) * Math.cos(x * 0.0071 + z * 0.0093);
  const c = Math.sin((x + z) * 0.0016) * Math.cos((x - z) * 0.0021);
  return a * 0.55 + b * 0.30 + c * 0.15;
}

export function terrainHeight(x, z) {
  // Valley floor near the runway, mountains rising toward the map edges.
  const dist = Math.sqrt(x * x + z * z);
  const edge = Math.pow(Math.max(0, dist - 520) / 780, 2.2);
  const hills = ridgeNoise(x, z);
  let h = 14 + hills * 26 + edge * 210;
  // Flatten a generous apron around the runway so landings are fair and the
  // strip sits proud of the ground instead of buried under terrain bumps.
  // The flat corridor runs the runway's full length (plateau to |z| = 340,
  // tapering out by 480) so no bump can poke through the strip anywhere.
  const zFlat = Math.max(0, 1 - Math.max(0, Math.abs(z) - 340) / 140);
  const xFlat = Math.max(0, 1 - Math.abs(x) / 95);
  const nearRunway = xFlat * zFlat;
  h = h * (1 - nearRunway) + 2.2 * nearRunway;
  // Carve the river gorge on the west side.
  const gorge = Math.exp(-Math.pow((x + 560 - Math.sin(z * 0.004) * 90) / 130, 2));
  h -= gorge * 16;
  return Math.max(0.5, h);
}

function colorForHeight(h, x, z, out) {
  // One coherent palette: green valley fields, dry grass, rock, snow caps.
  if (h > 150) return out.setRGB(0.92, 0.93, 0.96);          // snow
  if (h > 105) return out.setRGB(0.48, 0.44, 0.40);          // rock
  if (h > 62) return out.setRGB(0.42, 0.55, 0.30);           // high grass
  if (h > 30) return out.setRGB(0.35, 0.58, 0.26);           // meadow
  const field = Math.floor((x + 1300) / 190 + (z + 1300) / 230) % 2 === 0;
  if (field) return out.setRGB(0.55, 0.66, 0.28);            // pale crop field
  return out.setRGB(0.30, 0.55, 0.24);                       // deep green field
}

export function buildTerrain(scene) {
  const segments = 150;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    colorForHeight(h, x, z, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function buildRunway(scene) {
  const group = new THREE.Group();
  const stripMat = new THREE.MeshLambertMaterial({ color: 0x3d4149 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.width, 1.2, RUNWAY.length), stripMat);
  strip.position.set(RUNWAY.x, terrainHeight(RUNWAY.x, RUNWAY.z) + 0.4, RUNWAY.z);
  group.add(strip);
  // Centreline dashes and threshold bars.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (let z = -RUNWAY.length / 2 + 40; z < RUNWAY.length / 2 - 20; z += 44) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 18), dashMat);
    dash.position.set(RUNWAY.x, strip.position.y + 0.8, z);
    group.add(dash);
  }
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  for (const sx of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, RUNWAY.length), edgeMat);
    edge.position.set(RUNWAY.x + sx * (RUNWAY.width / 2 - 1), strip.position.y + 0.8, RUNWAY.z);
    group.add(edge);
  }
  // "27" painted at the south threshold, built from boxes.
  const numMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const seven = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 2), numMat);
  seven.position.set(RUNWAY.x - 6, strip.position.y + 0.8, RUNWAY.z + RUNWAY.length / 2 - 26);
  group.add(seven);
  // Windsock on a pole beside the runway.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 16, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  pole.position.set(RUNWAY.x + 42, terrainHeight(RUNWAY.x + 42, 120) + 8, 120);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 9, 8, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xff7a2f, side: THREE.DoubleSide }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(RUNWAY.x + 47, pole.position.y + 7, 120);
  sock.name = 'windsock';
  group.add(sock);
  // Low hangar + control tower silhouettes at the apron.
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(46, 14, 30),
    new THREE.MeshLambertMaterial({ color: 0x8a97a5 }));
  hangar.position.set(RUNWAY.x - 70, terrainHeight(RUNWAY.x - 70, 60) + 7, 60);
  group.add(hangar);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5, 34, 8),
    new THREE.MeshLambertMaterial({ color: 0xdde5ec }));
  tower.position.set(RUNWAY.x + 70, terrainHeight(RUNWAY.x + 70, -80) + 17, -80);
  group.add(tower);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 5, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0x2f6fb2 }));
  cab.position.set(RUNWAY.x + 70, terrainHeight(RUNWAY.x + 70, -80) + 36, -80);
  group.add(cab);
  scene.add(group);
  return { group, stripTopY: strip.position.y + 1 };
}

export function buildRiverAndLake(scene) {
  const group = new THREE.Group();
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2f7fc2, transparent: true, opacity: 0.9 });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(150, 24), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-720, 6, -620);
  group.add(lake);
  for (let i = 0; i < 14; i++) {
    const z = -560 + i * 90;
    const x = -560 + Math.sin(z * 0.004) * 90;
    const seg = new THREE.Mesh(new THREE.CircleGeometry(52, 14), waterMat);
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(x, terrainHeight(x, z) + 1.2, z);
    group.add(seg);
  }
  scene.add(group);
  return group;
}

export function buildTrees(scene) {
  // Deterministic pseudo-random scatter so the valley reads the same every run.
  let seed = 1234567;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2a, flatShading: true });
  const trunkGeo = new THREE.CylinderGeometry(0.9, 1.3, 7, 5);
  const leafGeo = new THREE.ConeGeometry(5.5, 16, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 260);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 260);
  const m = new THREE.Matrix4();
  let placed = 0, guard = 0;
  while (placed < 260 && guard++ < 4000) {
    const x = (rnd() - 0.5) * 2300, z = (rnd() - 0.5) * 2300;
    const h = terrainHeight(x, z);
    if (h > 78 || h < 8) continue;                       // no trees on peaks or the apron
    if (Math.abs(x) < 120 && Math.abs(z) < 420) continue; // keep the runway clear
    const s = 0.8 + rnd() * 0.9;
    m.makeScale(s, s, s); m.setPosition(x, h + 3.5 * s, z);
    trunks.setMatrixAt(placed, m);
    m.makeScale(s, s, s); m.setPosition(x, h + (7 + 7) * s, z);
    leaves.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = placed; leaves.count = placed;
  scene.add(trunks); scene.add(leaves);
  return { trunks, leaves };
}

export function buildRings(scene) {
  // The ring course: 8 glowing hoops looping out from the airfield and home.
  const spots = [
    [0, 95, -420], [260, 110, -720], [640, 150, -560], [760, 170, -60],
    [520, 130, 420], [120, 100, 700], [-320, 120, 560], [-420, 105, 60],
  ];
  const rings = [];
  const geo = new THREE.TorusGeometry(16, 1.6, 10, 28);
  spots.forEach(([x, y, z], i) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9a2f });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(x, Math.max(y, terrainHeight(x, z) + 34), z);
    ring.lookAt(x, ring.position.y, z - 200);
    ring.userData.index = i;
    ring.userData.baseY = ring.position.y;
    scene.add(ring);
    // A slim beacon pole under each ring so it reads from far away.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, ring.position.y - terrainHeight(x, z), 5),
      new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.45 }));
    pole.position.set(x, (ring.position.y + terrainHeight(x, z)) / 2, z);
    scene.add(pole);
    rings.push(ring);
  });
  return rings;
}

export function buildClouds(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  let seed = 987654;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rnd() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = 14 + rnd() * 22;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
      puff.position.set((rnd() - 0.5) * 60, (rnd() - 0.5) * 8, (rnd() - 0.5) * 26);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set((rnd() - 0.5) * 2400, 240 + rnd() * 90, (rnd() - 0.5) * 2400);
    cloud.userData.drift = 1.5 + rnd() * 2.5;
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

export function buildSky(scene) {
  scene.background = new THREE.Color(0x7ec0ee);
  scene.fog = new THREE.Fog(0x9fd0f0, 700, 2400);
  const hemi = new THREE.HemisphereLight(0xbfdfff, 0x5a7a4a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(600, 900, 300);
  scene.add(sun);
  // A visible sun disc so the sky has a direction to fly toward.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, fog: false }));
  disc.position.set(900, 620, -1400);
  disc.lookAt(0, 60, 0);
  scene.add(disc);
}

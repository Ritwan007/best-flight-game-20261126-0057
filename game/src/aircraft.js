// aircraft.js — builds the little red prop plane from primitives so it looks
// built, not drawn: fuselage, wings, tail, spinning propeller, landing gear.
import * as THREE from 'three';

export function buildAircraft() {
  const plane = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xd23b2e, flatShading: true });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf5ead2, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36, flatShading: true });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ff, flatShading: true });

  // Fuselage: tapered nose cone + body + tail cone.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.72, 5.4, 10), red);
  body.rotation.x = Math.PI / 2;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.9, 10), cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.6;
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.2, 10), red);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 3.8;
  plane.add(tailCone);

  // Canopy: a glass bubble the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), glass);
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.85, -0.9);
  plane.add(canopy);

  // Main wings with cream tips, and the tailplane + fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 1.9), red);
  wing.position.set(0, -0.15, -0.4);
  plane.add(wing);
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 1.9), cream);
    tip.position.set(sx * 5.35, -0.15, -0.4);
    plane.add(tip);
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xff4040 : 0x40ff70 }));
    navLight.position.set(sx * 5.9, -0.1, -0.4);
    plane.add(navLight);
  }
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.2), cream);
  tailplane.position.set(0, 0.15, 4.2);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 1.6), red);
  fin.position.set(0, 0.95, 4.3);
  plane.add(fin);

  // Propeller: hub + two blades, spun every frame by main.js.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 8), dark);
  hub.rotation.x = -Math.PI / 2;
  hub.position.z = -4.6;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 3.4, 0.12);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(bladeGeo, dark);
    blade.rotation.z = a;
    blade.position.z = -4.55;
    prop.add(blade);
  }
  prop.position.z = 0;
  plane.add(prop);
  plane.userData.propeller = prop;

  // Landing gear: two main wheels + tail wheel, hidden when retracted.
  const gear = new THREE.Group();
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    strut.position.set(sx * 1.1, -0.9, -0.6);
    gear.add(strut);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(sx * 1.1, -1.45, -0.6);
    gear.add(wheel);
  }
  const tailWheel = new THREE.Mesh(wheelGeo, dark);
  tailWheel.scale.setScalar(0.55);
  tailWheel.position.set(0, -0.75, 4.0);
  gear.add(tailWheel);
  plane.add(gear);
  plane.userData.gear = gear;

  // Soft blob shadow under the plane helps landings read at a glance.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.name = 'blobShadow';
  plane.add(shadow);
  plane.userData.blobShadow = shadow;

  plane.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return plane;
}

export function spinPropeller(plane, dt, throttle) {
  const prop = plane.userData.propeller;
  if (prop) prop.rotation.z += dt * (4 + throttle * 46);
}

export function setGearVisible(plane, down) {
  const gear = plane.userData.gear;
  if (gear) gear.visible = down;
}

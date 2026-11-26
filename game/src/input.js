// input.js — keyboard + mouse flight controls, kept apart from the physics so
// the game loop only ever reads one clean control state object.
export function createInput() {
  const keys = new Set();
  const state = {
    pitch: 0,      // -1 pull up .. +1 push down (from keys or mouse)
    roll: 0,       // -1 .. +1 bank
    yaw: 0,        // -1 .. +1 rudder
    throttleUp: false,
    throttleDown: false,
    mouseX: 0,     // -1 .. +1 across the window
    mouseY: 0,
    mouseActive: false,
    pressed: new Set(), // one-shot keys consumed by the loop (G, R, M, ...)
  };

  function updateDerived() {
    let pitch = 0, roll = 0, yaw = 0;
    if (keys.has('ArrowUp')) pitch -= 1;
    if (keys.has('ArrowDown')) pitch += 1;
    if (keys.has('ArrowLeft')) roll -= 1;
    if (keys.has('ArrowRight')) roll += 1;
    if (keys.has('KeyA')) yaw -= 1;
    if (keys.has('KeyD')) yaw += 1;
    // Mouse steering blends in gently when the mouse has moved recently.
    if (state.mouseActive) {
      pitch += state.mouseY * 0.7;
      roll += state.mouseX * 0.8;
    }
    state.pitch = Math.max(-1, Math.min(1, pitch));
    state.roll = Math.max(-1, Math.min(1, roll));
    state.yaw = Math.max(-1, Math.min(1, yaw));
    state.throttleUp = keys.has('KeyW');
    state.throttleDown = keys.has('KeyS');
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) state.pressed.add(e.code);
    keys.add(e.code);
    updateDerived();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); updateDerived(); });
  window.addEventListener('mousemove', (e) => {
    state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    state.mouseActive = true;
    updateDerived();
  });
  window.addEventListener('blur', () => { keys.clear(); updateDerived(); });
  return state;
}

export function consumePress(state, code) {
  if (state.pressed.has(code)) { state.pressed.delete(code); return true; }
  return false;
}

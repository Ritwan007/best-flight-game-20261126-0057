// hud.js — owns every DOM readout: instruments, fuel, throttle, attitude,
// mission panel and the big centre messages. The 3D loop never touches the DOM.
const $ = (id) => document.getElementById(id);

const HEADING_NAMES = ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST',
  'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'];

export function createHud() {
  const hud = {
    setInstruments(altFeet, speedKnots, headingDeg, vspeedFpm) {
      $('altValue').textContent = String(Math.max(0, Math.round(altFeet)));
      $('speedValue').textContent = String(Math.max(0, Math.round(speedKnots)));
      const h = ((Math.round(headingDeg) % 360) + 360) % 360;
      $('headingValue').textContent = String(h).padStart(3, '0') + '°';
      $('headingName').textContent = HEADING_NAMES[Math.round(h / 45) % 8];
      $('vspeedValue').textContent = (vspeedFpm >= 0 ? '+' : '') + String(Math.round(vspeedFpm));
    },
    setFuel(fuel01) {
      const bar = $('fuelBar');
      bar.style.width = Math.max(0, Math.min(100, fuel01 * 100)).toFixed(1) + '%';
      bar.classList.toggle('low', fuel01 < 0.25);
    },
    setThrottle(throttle01, gearDown, crashed) {
      $('throttleBar').style.width = (throttle01 * 100).toFixed(0) + '%';
      $('throttlePct').textContent = Math.round(throttle01 * 100) + '% · GEAR ' +
        (gearDown ? 'DOWN' : 'UP') + (crashed ? ' · CRASHED' : ' · FLAPS UP');
    },
    setAttitude(pitchRad, rollRad) {
      const inner = $('horizonInner');
      const pitchPx = Math.max(-40, Math.min(40, pitchRad * 90));
      inner.style.transform = 'translateY(' + pitchPx.toFixed(1) + 'px) rotate(' + (-rollRad * 57.3).toFixed(1) + 'deg)';
    },
    setMission(title, sub, scoreText, timeText) {
      $('missionTitle').textContent = title;
      $('missionSub').textContent = sub;
      $('missionScore').textContent = scoreText;
      $('missionTimer').textContent = timeText;
    },
    showMessage(big, small, stickyMs) {
      $('centerBig').textContent = big;
      $('centerSmall').textContent = small || '';
      if (hud._msgTimer) clearTimeout(hud._msgTimer);
      if (stickyMs) {
        hud._msgTimer = setTimeout(() => hud.clearMessage(), stickyMs);
      }
    },
    clearMessage() {
      $('centerBig').textContent = '';
      $('centerSmall').textContent = '';
    },
    showOverlay() { $('overlay').classList.remove('hidden'); },
    hideOverlay() { $('overlay').classList.add('hidden'); },
    onMissionPick(handler) {
      document.querySelectorAll('.missionBtn').forEach((btn) => {
        btn.addEventListener('click', () => handler(btn.dataset.mission));
      });
    },
  };
  return hud;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return 'TIME ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

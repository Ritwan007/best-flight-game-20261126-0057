// audio.js — all sound is synthesised with WebAudio oscillators and noise, so
// the game ships no audio files and loads nothing from the network.
export function createAudio() {
  const api = {
    ctx: null, master: null, engineOsc: null, engineOsc2: null,
    engineGain: null, windSrc: null, windGain: null, muted: false, started: false,
  };

  function ensureContext() {
    if (api.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    api.ctx = new Ctx();
    api.master = api.ctx.createGain();
    api.master.gain.value = 0.5;
    api.master.connect(api.ctx.destination);
    // Engine: two detuned sawtooth oscillators through a low-pass filter.
    api.engineOsc = api.ctx.createOscillator();
    api.engineOsc.type = 'sawtooth';
    api.engineOsc.frequency.value = 70;
    api.engineOsc2 = api.ctx.createOscillator();
    api.engineOsc2.type = 'square';
    api.engineOsc2.frequency.value = 35;
    const filter = api.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    api.engineGain = api.ctx.createGain();
    api.engineGain.gain.value = 0;
    api.engineOsc.connect(filter); api.engineOsc2.connect(filter);
    filter.connect(api.engineGain); api.engineGain.connect(api.master);
    api.engineOsc.start(); api.engineOsc2.start();
    // Wind: looped filtered noise whose gain follows airspeed.
    const len = api.ctx.sampleRate * 2;
    const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    api.windSrc = api.ctx.createBufferSource();
    api.windSrc.buffer = buf; api.windSrc.loop = true;
    const windFilter = api.ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 900; windFilter.Q.value = 0.6;
    api.windGain = api.ctx.createGain();
    api.windGain.gain.value = 0;
    api.windSrc.connect(windFilter); windFilter.connect(api.windGain); api.windGain.connect(api.master);
    api.windSrc.start();
  }

  api.start = () => {
    ensureContext();
    if (api.ctx && api.ctx.state === 'suspended') api.ctx.resume();
    api.started = true;
  };

  api.setFlightSound = (throttle, speedKnots, flying) => {
    if (!api.ctx || !api.started) return;
    const t = api.ctx.currentTime;
    const rpm = 55 + throttle * 95;
    api.engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
    api.engineOsc2.frequency.setTargetAtTime(rpm * 0.5 + 2, t, 0.1);
    api.engineGain.gain.setTargetAtTime(api.muted ? 0 : (flying ? 0.05 + throttle * 0.09 : 0.03), t, 0.15);
    api.windGain.gain.setTargetAtTime(api.muted ? 0 : Math.min(0.12, speedKnots / 1600), t, 0.2);
  };

  api.chime = (good) => {
    if (!api.ctx || !api.started || api.muted) return;
    const t = api.ctx.currentTime;
    [good ? 880 : 440, good ? 1318 : 330].forEach((f, i) => {
      const o = api.ctx.createOscillator(), g = api.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.22, t + i * 0.09 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5);
      o.connect(g); g.connect(api.master);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.55);
    });
  };

  api.thud = () => {
    if (!api.ctx || !api.started || api.muted) return;
    const t = api.ctx.currentTime;
    const o = api.ctx.createOscillator(), g = api.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(api.master);
    o.start(t); o.stop(t + 0.45);
  };

  api.toggleMute = () => {
    api.muted = !api.muted;
    if (api.master) api.master.gain.value = api.muted ? 0 : 0.5;
    return api.muted;
  };
  return api;
}

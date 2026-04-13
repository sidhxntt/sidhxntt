// ==================== AUDIO SYSTEM ====================
class AudioSystem {
  constructor() {
    this.ctx = null;
    this.isActive = false;
    this.masterGain = null;
    this.analyser = null;
    this.dataArray = null;
    this.oscillators = [];
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.isActive = true;
    this.startAmbient();
    this.fadeIn(0.12, 3);
  }

  fadeIn(target, duration) {
    this.masterGain.gain.linearRampToValueAtTime(
      target,
      this.ctx.currentTime + duration,
    );
  }

  startAmbient() {
    const freqs = [55, 82.5, 110, 165, 220];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.value = 0.03 / (i + 1);
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.1 + i * 0.05;
      lfoGain.gain.value = 0.01;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      this.oscillators.push({ osc, gain, lfo });
    });
  }

  playInteraction(type) {
    if (!this.isActive) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    if (type === "click") {
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "hover") {
      osc.frequency.value = 1200;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "scroll") {
      osc.frequency.value = 200 + Math.random() * 400;
      osc.type = "triangle";
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "silence") {
      osc.frequency.value = 440;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2000;
      filter.frequency.linearRampToValueAtTime(200, now + 1.5);
      osc.disconnect();
      osc.connect(filter);
      filter.connect(gain);
      osc.start(now);
      osc.stop(now + 1.5);
    } else if (type === "noise") {
      const bufferSize = this.ctx.sampleRate * 0.3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++)
        data[i] = (Math.random() * 2 - 1) * 0.3;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      source.start(now);
    } else if (type === "transition") {
      osc.frequency.value = 150;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  }

  // ---- Doppler shift system ----
  initDopplerShift() {
    if (!this.ctx || this.dopplerActive) return;
    this.dopplerActive = true;
    this.dopplerSmooth = 0; // smoothed direction value  -1…+1
    this.dopplerIntensity = 0; // smoothed speed magnitude   0…1
    // Store each oscillator's original frequency for reference
    this.oscillators.forEach((o) => {
      o.baseFreq = o.osc.frequency.value;
    });
  }

  updateDopplerShift(scrollDelta, velocity) {
    if (!this.dopplerActive || !this.ctx) return;

    const now = this.ctx.currentTime;
    const ramp = 0.12; // smooth ramp for organic feel

    // scrollDelta > 0 = scrolling DOWN (approaching), < 0 = scrolling UP (receding)
    // Doppler: approaching → higher pitch, receding → lower pitch
    // We invert the real-world convention slightly for feel:
    // scrolling down (exploring forward) = pitch rises gently
    // scrolling up (going back)          = pitch drops gently

    // Normalise direction to -1…+1
    const rawDir =
      Math.sign(scrollDelta) * Math.min(Math.abs(scrollDelta) / 60, 1);
    this.dopplerSmooth += (rawDir - this.dopplerSmooth) * 0.08;

    // Normalise speed to 0…1
    const rawIntensity = Math.min(velocity / 3000, 1);
    this.dopplerIntensity += (rawIntensity - this.dopplerIntensity) * 0.06;

    // Max pitch shift: ±8% at full warp speed (musically ~a semitone)
    const maxShiftRatio = 0.08;
    const shiftRatio =
      this.dopplerSmooth * this.dopplerIntensity * maxShiftRatio;

    this.oscillators.forEach((o) => {
      const shifted = o.baseFreq * (1 + shiftRatio);
      o.osc.frequency.linearRampToValueAtTime(shifted, now + ramp);
    });

    // Also apply a subtle detune spread — fast scrolling widens the
    // stereo image by detuning odd/even oscillators asymmetrically
    const detuneCents = this.dopplerIntensity * 12; // up to 12 cents
    this.oscillators.forEach((o, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      o.osc.detune.linearRampToValueAtTime(
        sign * detuneCents * this.dopplerSmooth,
        now + ramp,
      );
    });
  }

  // When scroll stops, smoothly return to base pitch
  decayDoppler() {
    if (!this.dopplerActive || !this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = 0.25;

    // Decay toward zero
    this.dopplerSmooth *= 0.92;
    this.dopplerIntensity *= 0.94;

    if (Math.abs(this.dopplerSmooth) < 0.001 && this.dopplerIntensity < 0.001)
      return;

    const maxShiftRatio = 0.08;
    const shiftRatio =
      this.dopplerSmooth * this.dopplerIntensity * maxShiftRatio;
    this.oscillators.forEach((o, i) => {
      const shifted = o.baseFreq * (1 + shiftRatio);
      o.osc.frequency.linearRampToValueAtTime(shifted, now + ramp);
      const sign = i % 2 === 0 ? 1 : -1;
      const detuneCents = this.dopplerIntensity * 12;
      o.osc.detune.linearRampToValueAtTime(
        sign * detuneCents * this.dopplerSmooth,
        now + ramp,
      );
    });
  }

  // ---- Velocity-reactive audio layer ----
  initVelocityLayer() {
    if (!this.ctx || this.velocityLayerActive) return;
    this.velocityLayerActive = true;

    // White noise source for "whoosh" texture
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(
      1,
      bufferSize,
      this.ctx.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;
    this.whooshNoise = this.ctx.createBufferSource();
    this.whooshNoise.buffer = noiseBuffer;
    this.whooshNoise.loop = true;

    // Bandpass filter that sweeps with velocity
    this.whooshFilter = this.ctx.createBiquadFilter();
    this.whooshFilter.type = "bandpass";
    this.whooshFilter.frequency.value = 200;
    this.whooshFilter.Q.value = 2.5;

    // Gain for whoosh volume
    this.whooshGain = this.ctx.createGain();
    this.whooshGain.gain.value = 0;

    // Tonal sweep oscillator — rising pitch with velocity
    this.sweepOsc = this.ctx.createOscillator();
    this.sweepOsc.type = "sawtooth";
    this.sweepOsc.frequency.value = 60;

    // Resonant filter on the sweep for harmonic shimmer
    this.sweepFilter = this.ctx.createBiquadFilter();
    this.sweepFilter.type = "bandpass";
    this.sweepFilter.frequency.value = 300;
    this.sweepFilter.Q.value = 8;

    this.sweepGain = this.ctx.createGain();
    this.sweepGain.gain.value = 0;

    // Sub-bass rumble oscillator for visceral depth
    this.rumbleOsc = this.ctx.createOscillator();
    this.rumbleOsc.type = "sine";
    this.rumbleOsc.frequency.value = 35;

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;

    // Wire up: noise → bandpass → gain → master
    this.whooshNoise.connect(this.whooshFilter);
    this.whooshFilter.connect(this.whooshGain);
    this.whooshGain.connect(this.masterGain);

    // Wire up: sweep osc → resonant filter → gain → master
    this.sweepOsc.connect(this.sweepFilter);
    this.sweepFilter.connect(this.sweepGain);
    this.sweepGain.connect(this.masterGain);

    // Wire up: rumble → gain → master
    this.rumbleOsc.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);

    this.whooshNoise.start();
    this.sweepOsc.start();
    this.rumbleOsc.start();
  }

  updateVelocityAudio(intensity) {
    if (!this.velocityLayerActive || !this.ctx) return;
    const now = this.ctx.currentTime;
    const rampTime = 0.08; // fast response

    // Whoosh noise: volume and filter sweep
    // intensity 0 → silent, 200Hz  |  intensity 1 → loud, 6000Hz
    const whooshVol = Math.pow(intensity, 1.5) * 0.18;
    const whooshFreq = 200 + intensity * 5800;
    const whooshQ = 2.5 - intensity * 1.5; // wider band at high speed
    this.whooshGain.gain.linearRampToValueAtTime(whooshVol, now + rampTime);
    this.whooshFilter.frequency.linearRampToValueAtTime(
      whooshFreq,
      now + rampTime,
    );
    this.whooshFilter.Q.linearRampToValueAtTime(
      Math.max(0.5, whooshQ),
      now + rampTime,
    );

    // Tonal sweep: pitch rises with velocity
    // 60Hz at rest → 800Hz at full warp
    const sweepFreq = 60 + intensity * 740;
    const sweepFilterFreq = 300 + intensity * 3700;
    const sweepVol = Math.pow(intensity, 2) * 0.06;
    this.sweepOsc.frequency.linearRampToValueAtTime(sweepFreq, now + rampTime);
    this.sweepFilter.frequency.linearRampToValueAtTime(
      sweepFilterFreq,
      now + rampTime,
    );
    this.sweepGain.gain.linearRampToValueAtTime(sweepVol, now + rampTime);

    // Sub-bass rumble: subtle, crescendos with speed
    const rumbleFreq = 35 + intensity * 25;
    const rumbleVol = Math.pow(intensity, 1.8) * 0.12;
    this.rumbleOsc.frequency.linearRampToValueAtTime(
      rumbleFreq,
      now + rampTime,
    );
    this.rumbleGain.gain.linearRampToValueAtTime(rumbleVol, now + rampTime);
  }

  updateScene(sceneIndex) {
    if (!this.isActive) return;
    const sceneFreqs = [
      [55, 82.5, 110, 165, 220], // 0: Hero
      [65, 98, 130, 196, 261], // 1: Power of Sound
      [73, 110, 146, 220, 293], // 2: Product Reveal
      [82, 123, 164, 246, 329], // 3: Immersive
      [55, 110, 165, 220, 330], // 4: Noise Isolation
      [98, 147, 196, 294, 392], // 5: Engineering
      [77, 116, 155, 233, 311], // 6: Testimonials
      [92, 138, 184, 276, 368], // 7: App Ecosystem
      [69, 104, 138, 207, 277], // 8: Colors
      [87, 130, 174, 261, 348], // 9: Comparison
      [65, 130, 196, 261, 392], // 10: Final
    ];
    const freqs = sceneFreqs[sceneIndex] || sceneFreqs[0];
    const now = this.ctx.currentTime;
    this.oscillators.forEach((o, i) => {
      if (freqs[i]) {
        o.osc.frequency.linearRampToValueAtTime(freqs[i], now + 2);
        // Update doppler base frequencies so shifts are relative to new scene
        o.baseFreq = freqs[i];
      }
    });
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(128).fill(50);
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }
}

const audio = new AudioSystem();

// ==================== SCROLL VELOCITY TRACKER ====================
class VelocityTracker {
  constructor() {
    this.velocity = 0;
    this.rawVelocity = 0;
    this.scrollDelta = 0; // signed px delta per frame
    this.smoothDelta = 0; // smoothed signed delta
    this.lastScrollTop = 0;
    this.lastTime = performance.now();
    this.intensity = 0; // 0 = calm, 1 = max warp
    this.smoothIntensity = 0;
    this.decayRate = 0.92;
    this.maxVelocity = 4000; // px/s threshold for full warp
    this.warpOverlay = null;
    this.streaksContainer = null;
    this.streaks = [];
    this.numStreaks = 30;
    this.initialized = false;
  }

  init() {
    this.warpOverlay = document.getElementById("warpOverlay");
    this.streaksContainer = document.getElementById("velocityStreaks");
    this.createStreaks();
    this.initialized = true;
  }

  createStreaks() {
    for (let i = 0; i < this.numStreaks; i++) {
      const streak = document.createElement("div");
      streak.className = "velocity-streak";
      streak.style.left = Math.random() * 100 + "%";
      streak.style.top = Math.random() * 100 + "%";
      streak.style.opacity = 0;
      const hue = Math.random() > 0.5 ? "155,93,229" : "0,245,212";
      const altHue = Math.random() > 0.5 ? "255,107,53" : "255,255,255";
      streak.style.background = `linear-gradient(to bottom, transparent, rgba(${hue},0.5), rgba(${altHue},0.2), transparent)`;
      streak.style.width = 0.5 + Math.random() * 1.5 + "px";
      this.streaksContainer.appendChild(streak);
      this.streaks.push({
        el: streak,
        baseX: Math.random() * 100,
        speed: 0.5 + Math.random() * 1.5,
        maxHeight: 60 + Math.random() * 200,
      });
    }
  }

  update(scrollTop) {
    const now = performance.now();
    const dt = Math.max(now - this.lastTime, 1) / 1000; // seconds
    this.lastTime = now;

    const rawDelta = scrollTop - this.lastScrollTop; // signed
    this.scrollDelta = rawDelta;
    this.smoothDelta += (rawDelta - this.smoothDelta) * 0.15;
    this.rawVelocity = Math.abs(rawDelta) / dt;
    this.lastScrollTop = scrollTop;

    // Smooth velocity
    this.velocity = this.velocity * 0.7 + this.rawVelocity * 0.3;

    // Map to 0–1 intensity
    const targetIntensity = Math.min(this.velocity / this.maxVelocity, 1);
    this.intensity =
      this.intensity * this.decayRate + targetIntensity * (1 - this.decayRate);

    // Smooth for visual application
    this.smoothIntensity += (this.intensity - this.smoothIntensity) * 0.08;

    if (this.initialized) {
      this.applyVisuals();
    }
  }

  applyVisuals() {
    const si = this.smoothIntensity;

    // Warp overlay blur + vignette
    const blurPx = si * 6;
    const active = si > 0.05;
    this.warpOverlay.style.backdropFilter = `blur(${blurPx}px)`;
    this.warpOverlay.style.webkitBackdropFilter = `blur(${blurPx}px)`;
    this.warpOverlay.classList.toggle("active", active);

    // Velocity streaks
    this.streaksContainer.style.opacity = si > 0.08 ? 1 : 0;
    this.streaks.forEach((s, i) => {
      const streakIntensity = Math.max(0, si - 0.1) / 0.9;
      const h = streakIntensity * s.maxHeight;
      s.el.style.height = h + "px";
      s.el.style.opacity = streakIntensity * 0.7;
      // Drift position on fast scroll
      const drift = Math.sin(performance.now() * 0.001 * s.speed + i) * si * 5;
      s.el.style.left = s.baseX + drift + "%";
    });
  }

  // Accessors for other systems
  getIntensity() {
    return this.smoothIntensity;
  }
  getMultiplier() {
    return 1 + this.smoothIntensity * 3;
  } // 1x–4x range
  getWaveAmplitude() {
    return 1 + this.smoothIntensity * 5;
  } // 1x–6x
}

const velocityTracker = new VelocityTracker();

// ==================== CUSTOM CURSOR ====================
const cursor = document.getElementById("cursor");
const cursorDot = document.getElementById("cursorDot");
let mouseX = window.innerWidth / 2,
  mouseY = window.innerHeight / 2;
let cursorX = mouseX,
  cursorY = mouseY;
let lastRippleTime = 0;

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  const now = Date.now();
  if (now - lastRippleTime > 250 && audio.isActive) {
    createSoundRipple(e.clientX, e.clientY);
    lastRippleTime = now;
  }
});

function createSoundRipple(x, y) {
  const ripple = document.createElement("div");
  ripple.className = "sound-ripple";
  ripple.style.left = x - 60 + "px";
  ripple.style.top = y - 60 + "px";
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 1000);
}

function updateCursor() {
  cursorX += (mouseX - cursorX) * 0.12;
  cursorY += (mouseY - cursorY) * 0.12;
  cursor.style.left = cursorX + "px";
  cursor.style.top = cursorY + "px";
  cursorDot.style.left = mouseX + "px";
  cursorDot.style.top = mouseY + "px";
  requestAnimationFrame(updateCursor);
}
updateCursor();

document.querySelectorAll("a, button, .hotspot, .magnetic").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    cursor.classList.add("hover");
    audio.playInteraction("hover");
  });
  el.addEventListener("mouseleave", () => cursor.classList.remove("hover"));
});

// ==================== MAGNETIC BUTTONS ====================
document.querySelectorAll(".magnetic").forEach((el) => {
  el.addEventListener("mousemove", (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "translate(0, 0)";
  });
});

// ==================== ENTRY CANVAS ====================
const entryCanvas = document.getElementById("entryCanvas");
const ectx = entryCanvas.getContext("2d");

function resizeEntryCanvas() {
  entryCanvas.width = window.innerWidth;
  entryCanvas.height = window.innerHeight;
}
resizeEntryCanvas();

const entryParticles = [];
for (let i = 0; i < 80; i++) {
  entryParticles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.5 + 0.1,
  });
}

let entryActive = true;
function drawEntryParticles() {
  if (!entryActive) return;
  ectx.clearRect(0, 0, entryCanvas.width, entryCanvas.height);
  entryParticles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = entryCanvas.width;
    if (p.x > entryCanvas.width) p.x = 0;
    if (p.y < 0) p.y = entryCanvas.height;
    if (p.y > entryCanvas.height) p.y = 0;
    ectx.beginPath();
    ectx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ectx.fillStyle = `rgba(255,255,255,${p.opacity})`;
    ectx.fill();
  });
  requestAnimationFrame(drawEntryParticles);
}
drawEntryParticles();

// ==================== WAVE CANVAS ====================
const waveCanvas = document.getElementById("waveCanvas");
const wctx = waveCanvas.getContext("2d");

function resizeWaveCanvas() {
  waveCanvas.width = window.innerWidth;
  waveCanvas.height = window.innerHeight;
}
resizeWaveCanvas();

let waveActive = false;
function drawWaves() {
  if (!waveActive) return;
  wctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  const freq = audio.getFrequencyData();
  const avgBass = (freq[0] + freq[1] + freq[2] + freq[3]) / 4;
  const avgMid = (freq[10] + freq[11] + freq[12] + freq[13]) / 4;
  const t = Date.now() * 0.001;

  // Velocity-driven amplitude multiplier
  const waveAmp = velocityTracker.getWaveAmplitude();
  const velIntensity = velocityTracker.getIntensity();

  // More wave layers during fast scroll
  const waveCount = 5 + Math.floor(velIntensity * 6);

  for (let w = 0; w < waveCount; w++) {
    wctx.beginPath();
    const spread = waveCount > 5 ? 0.06 : 0.1;
    const baseY = waveCanvas.height * (0.15 + w * spread);
    const step = velIntensity > 0.3 ? 2 : 3; // Higher resolution at speed
    for (let x = 0; x < waveCanvas.width; x += step) {
      const n = x / waveCanvas.width;
      const freqIdx = Math.floor(n * freq.length);
      const baseAmplitude = (freq[freqIdx] || 50) * 0.15 + avgBass * 0.1;
      const amplitude = baseAmplitude * waveAmp;
      const turbulence = velIntensity * Math.sin(n * 20 + t * 4) * 15;
      const y =
        baseY +
        Math.sin(n * 6 + t + w) * amplitude +
        Math.cos(n * 3 - t * 0.5) * (avgMid * 0.1) +
        turbulence;
      if (x === 0) wctx.moveTo(x, y);
      else wctx.lineTo(x, y);
    }
    const baseAlpha = 0.03 + (avgBass / 255) * 0.04;
    const alpha = baseAlpha + velIntensity * 0.06;
    const colors = [
      "rgba(155,93,229,",
      "rgba(0,245,212,",
      "rgba(255,107,53,",
      "rgba(255,255,255,",
      "rgba(0,150,255,",
      "rgba(255,0,110,",
      "rgba(255,190,11,",
      "rgba(58,134,255,",
      "rgba(155,93,229,",
      "rgba(0,245,212,",
      "rgba(255,107,53,",
    ];
    wctx.strokeStyle = colors[w % colors.length] + alpha + ")";
    wctx.lineWidth = 1 + velIntensity * 1.5;
    wctx.stroke();
  }
  requestAnimationFrame(drawWaves);
}

// ==================== PARTICLE CANVAS ====================
const particleCanvas = document.getElementById("particleCanvas");
const pctx = particleCanvas.getContext("2d");

function resizeParticleCanvas() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}
resizeParticleCanvas();

const particles = [];
for (let i = 0; i < 120; i++) {
  particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    baseX: Math.random() * window.innerWidth,
    baseY: Math.random() * window.innerHeight,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.005 + 0.002,
    offset: Math.random() * Math.PI * 2,
    color:
      Math.random() > 0.5
        ? "155,93,229"
        : Math.random() > 0.5
          ? "0,245,212"
          : "255,107,53",
  });
}

// Dynamic particle pool — velocity spawns extra particles
const velocityParticles = [];
const MAX_VELOCITY_PARTICLES = 200;

function spawnVelocityParticle() {
  if (velocityParticles.length >= MAX_VELOCITY_PARTICLES) return;
  const colors = [
    "155,93,229",
    "0,245,212",
    "255,107,53",
    "255,0,110",
    "255,190,11",
  ];
  velocityParticles.push({
    x: Math.random() * particleCanvas.width,
    y: Math.random() * particleCanvas.height,
    vx: (Math.random() - 0.5) * 4,
    vy: -2 - Math.random() * 6, // shoot upward
    size: 0.5 + Math.random() * 2,
    life: 1.0,
    decay: 0.008 + Math.random() * 0.015,
    color: colors[Math.floor(Math.random() * colors.length)],
    trail: [],
  });
}

let particlesActive = false;
function drawParticles() {
  if (!particlesActive) return;
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  const freq = audio.getFrequencyData();
  const avgBass = (freq[0] + freq[1] + freq[2] + freq[3]) / 4 / 255;
  const t = Date.now() * 0.001;

  // Velocity modifiers
  const velMult = velocityTracker.getMultiplier();
  const velIntensity = velocityTracker.getIntensity();

  // Spawn velocity particles proportional to scroll speed
  const spawnCount = Math.floor(velIntensity * 8);
  for (let s = 0; s < spawnCount; s++) spawnVelocityParticle();

  // --- BASE PARTICLES (velocity-enhanced) ---
  particles.forEach((p, i) => {
    const freqIdx = i % freq.length;
    const freqVal = (freq[freqIdx] || 50) / 255;

    // Movement range amplified by velocity
    const moveRange = 30 + avgBass * 50 + velIntensity * 80;
    const moveRangeY = 20 + avgBass * 40 + velIntensity * 60;
    p.x = p.baseX + Math.sin(t * p.speed * 100 + p.offset) * moveRange;
    p.y = p.baseY + Math.cos(t * p.speed * 80 + p.offset) * moveRangeY;

    // Vertical drift during fast scroll (warp sensation)
    p.y -= velIntensity * 2;

    const dx = mouseX - p.x,
      dy = mouseY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 150) {
      const force = (150 - dist) / 150;
      p.x -= dx * force * 0.05;
      p.y -= dy * force * 0.05;
    }

    // Size & brightness boosted by velocity
    const size = (p.size + freqVal * 3 * avgBass) * (1 + velIntensity * 1.5);
    const alpha = Math.min(0.2 + freqVal * 0.5 + velIntensity * 0.3, 1);
    pctx.beginPath();
    pctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    pctx.fillStyle = `rgba(${p.color},${alpha})`;
    pctx.fill();

    // Glow halo amplified during warp
    if (freqVal > 0.3 || velIntensity > 0.2) {
      const glowSize = size + 4 + velIntensity * 8;
      pctx.beginPath();
      pctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
      pctx.fillStyle = `rgba(${p.color},${alpha * 0.15})`;
      pctx.fill();
    }
  });

  // --- VELOCITY PARTICLES (ephemeral streaking particles) ---
  for (let i = velocityParticles.length - 1; i >= 0; i--) {
    const vp = velocityParticles[i];
    vp.trail.push({ x: vp.x, y: vp.y });
    if (vp.trail.length > 6) vp.trail.shift();

    vp.x += vp.vx;
    vp.y += vp.vy;
    vp.life -= vp.decay;

    if (vp.life <= 0) {
      velocityParticles.splice(i, 1);
      continue;
    }

    // Draw trail
    if (vp.trail.length > 1) {
      pctx.beginPath();
      pctx.moveTo(vp.trail[0].x, vp.trail[0].y);
      for (let ti = 1; ti < vp.trail.length; ti++) {
        pctx.lineTo(vp.trail[ti].x, vp.trail[ti].y);
      }
      pctx.strokeStyle = `rgba(${vp.color},${vp.life * 0.3})`;
      pctx.lineWidth = vp.size * 0.5;
      pctx.stroke();
    }

    // Draw head
    pctx.beginPath();
    pctx.arc(vp.x, vp.y, vp.size * vp.life, 0, Math.PI * 2);
    pctx.fillStyle = `rgba(${vp.color},${vp.life * 0.8})`;
    pctx.fill();
  }

  // --- CONNECTION LINES (distance threshold grows with velocity) ---
  const connectDist = 80 + velIntensity * 60;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < connectDist) {
        pctx.beginPath();
        pctx.moveTo(particles[i].x, particles[i].y);
        pctx.lineTo(particles[j].x, particles[j].y);
        const lineAlpha = (1 - d / connectDist) * (0.06 + velIntensity * 0.08);
        pctx.strokeStyle = `rgba(255,255,255,${lineAlpha})`;
        pctx.lineWidth = 0.5 + velIntensity;
        pctx.stroke();
      }
    }
  }
  requestAnimationFrame(drawParticles);
}

// ==================== SPATIAL CANVAS ====================
function initSpatialCanvas() {
  const canvas = document.getElementById("spatialCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * 0.5;
    canvas.height = rect.height;
  }
  resize();

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const freq = audio.getFrequencyData();
    const t = Date.now() * 0.001;
    const cx = canvas.width * 0.5,
      cy = canvas.height * 0.5;

    for (let i = 0; i < 8; i++) {
      const freqVal = (freq[i * 4] || 50) / 255;
      const radius = 40 + i * 30 + freqVal * 30;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      const alpha = 0.05 + freqVal * 0.1;
      ctx.strokeStyle =
        i % 2 === 0 ? `rgba(155,93,229,${alpha})` : `rgba(0,245,212,${alpha})`;
      ctx.lineWidth = 1 + freqVal * 2;
      ctx.stroke();
    }

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const idx = Math.floor((a / (Math.PI * 2)) * freq.length);
      const freqVal = (freq[idx] || 50) / 255;
      const len = 50 + freqVal * 120;
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(a + t * 0.2) * 30,
        cy + Math.sin(a + t * 0.2) * 30,
      );
      ctx.lineTo(
        cx + Math.cos(a + t * 0.2) * len,
        cy + Math.sin(a + t * 0.2) * len,
      );
      ctx.strokeStyle = `rgba(255,255,255,${0.03 + freqVal * 0.08})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ==================== NOISE PARTICLES ====================
function createNoiseParticles() {
  const container = document.getElementById("noiseParticles");
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div");
    p.className = "noise-particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = Math.random() * 100 + "%";
    p.style.animationDuration = 2 + Math.random() * 3 + "s";
    p.style.animationDelay = Math.random() * 2 + "s";
    container.appendChild(p);
  }
}
createNoiseParticles();

// ==================== CTA ====================
document.getElementById("ctaBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  audio.playInteraction("click");
});

// ==================== RESIZE ====================
window.addEventListener("resize", () => {
  resizeWaveCanvas();
  resizeParticleCanvas();
  resizeEntryCanvas();
});

// ==================== TOUCH ====================
document.addEventListener("touchstart", (e) => {
  if (audio.isActive) {
    audio.playInteraction("click");
    const touch = e.touches[0];
    createSoundRipple(touch.clientX, touch.clientY);
  }
});

// ==================== GSAP SCROLL SYSTEM ====================
let gsapInitialized = false;
let currentScene = 0;

function initGSAP() {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  const scroller = document.getElementById("scrollContainer");
  const sections = gsap.utils.toArray(".section");

  // ---------- PARALLAX SHAPES: fade in on load + scroll-driven Y shift ----------
  document.querySelectorAll(".parallax-shape").forEach((shape) => {
    gsap.set(shape, { opacity: 0 });
    const speed = parseFloat(shape.dataset.speed) || 0.3;

    ScrollTrigger.create({
      trigger: shape.closest(".section"),
      scroller,
      start: "top bottom",
      end: "bottom top",
      onEnter: () => gsap.to(shape, { opacity: 1, duration: 1.5 }),
      onLeave: () => gsap.to(shape, { opacity: 0, duration: 0.8 }),
      onEnterBack: () => gsap.to(shape, { opacity: 1, duration: 1.5 }),
      onLeaveBack: () => gsap.to(shape, { opacity: 0, duration: 0.8 }),
      onUpdate: (self) => {
        gsap.set(shape, { y: self.progress * -200 * speed });
      },
    });
  });

  // ---------- BG GRADIENT fade in per scene ----------
  document.querySelectorAll(".scene-bg-grad").forEach((grad) => {
    ScrollTrigger.create({
      trigger: grad.closest(".section"),
      scroller,
      start: "top 80%",
      end: "bottom 20%",
      onEnter: () =>
        gsap.to(grad, { opacity: 1, duration: 1.5, ease: "power2.out" }),
      onLeave: () =>
        gsap.to(grad, { opacity: 0, duration: 1, ease: "power2.in" }),
      onEnterBack: () =>
        gsap.to(grad, { opacity: 1, duration: 1.5, ease: "power2.out" }),
      onLeaveBack: () =>
        gsap.to(grad, { opacity: 0, duration: 1, ease: "power2.in" }),
    });
  });

  // ---------- HERO: parallax orb + marquee on scroll ----------
  const heroOrb = document.getElementById("heroOrb");
  const heroHint = document.querySelector(".hero-scroll-hint");
  gsap.to(heroOrb, {
    scrollTrigger: {
      trigger: "#scene0",
      scroller,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
    scale: 1.6,
    opacity: 0,
    ease: "none",
  });
  gsap.to(".hero-marquee", {
    scrollTrigger: {
      trigger: "#scene0",
      scroller,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
    y: -120,
    opacity: 0,
    ease: "none",
  });
  if (heroHint) {
    gsap.to(heroHint, {
      scrollTrigger: {
        trigger: "#scene0",
        scroller,
        start: "5% top",
        end: "20% top",
        scrub: true,
      },
      opacity: 0,
      y: -20,
      ease: "none",
    });
  }

  // ---------- SCENE 1: Power of Sound — staggered text reveal ----------
  const s1 = document.getElementById("scene1Content");
  if (s1) {
    const tl1 = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene1",
        scroller,
        start: "top 70%",
        end: "center center",
        scrub: 1,
      },
    });
    tl1
      .to(s1.querySelector(".scene-label"), {
        opacity: 1,
        y: 0,
        duration: 0.3,
      })
      .to(
        s1.querySelector(".scene-headline"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.1",
      )
      .to(
        s1.querySelector(".scene-sub"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2",
      )
      .to(
        s1.querySelector(".scene-stats"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2",
      );

    const s1Quote = s1.querySelector(".scene1-quote");
    if (s1Quote) {
      tl1.to(s1Quote, { opacity: 1, y: 0, duration: 0.5 }, "-=0.2");
    }

    // Parallax out
    gsap.to(s1, {
      scrollTrigger: {
        trigger: "#scene1",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -80,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- SCENE 2: Product Reveal — dramatic scale-in ----------
  const s2 = document.getElementById("scene2Content");
  const prodContainer = document.getElementById("productContainer");
  if (s2) {
    const tl2 = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene2",
        scroller,
        start: "top 65%",
        end: "center 40%",
        scrub: 1.5,
      },
    });

    tl2.to(s2.querySelector(".scene-label"), {
      opacity: 1,
      y: 0,
      duration: 0.2,
    });

    if (prodContainer) {
      tl2.to(
        prodContainer,
        { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.4)" },
        "-=0.1",
      );
    }

    tl2
      .to(
        s2.querySelector(".scene-headline"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.3",
      )
      .to(
        s2.querySelector(".scene-sub"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.2",
      )
      .to(
        s2.querySelector(".product-badges"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.2",
      );
  }

  // ---------- SCENE 3: Spatial Audio — staggered reveal ----------
  const s3 = document.getElementById("scene3Content");
  if (s3) {
    const tl3 = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene3",
        scroller,
        start: "top 70%",
        end: "center center",
        scrub: 1,
      },
    });
    tl3
      .to(s3.querySelector(".scene-label"), {
        opacity: 1,
        y: 0,
        duration: 0.3,
      })
      .to(
        s3.querySelector(".scene-headline"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.1",
      )
      .to(
        s3.querySelector(".scene-sub"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2",
      )
      .to(
        s3.querySelector(".feature-list"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2",
      );

    gsap.to(s3, {
      scrollTrigger: {
        trigger: "#scene3",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -80,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- SCENE 4: Noise Isolation ----------
  const s4 = document.getElementById("scene4Content");
  if (s4) {
    const tl4 = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene4",
        scroller,
        start: "top 70%",
        end: "center center",
        scrub: 1,
      },
    });
    tl4
      .to(s4.querySelector(".scene-label"), {
        opacity: 1,
        y: 0,
        duration: 0.3,
      })
      .to(
        s4.querySelector(".scene-headline"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.1",
      )
      .to(
        s4.querySelector(".scene-sub"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2",
      )
      .to(
        s4.querySelector(".noise-toggle"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.2",
      )
      .to(
        s4.querySelector(".anc-stats"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.2",
      )
      .to(
        s4.querySelector(".anc-modes"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.2",
      );

    gsap.to(s4, {
      scrollTrigger: {
        trigger: "#scene4",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -80,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- SCENE 5: Engineering — stagger cards ----------
  const s5 = document.getElementById("scene5Content");
  if (s5) {
    const tl5 = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene5",
        scroller,
        start: "top 70%",
        end: "center 35%",
        scrub: 1,
      },
    });
    tl5
      .to(s5.querySelector(".scene-label"), {
        opacity: 1,
        y: 0,
        duration: 0.3,
      })
      .to(
        s5.querySelector(".scene-headline"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.1",
      );

    const cards = s5.querySelectorAll(".component-card");
    cards.forEach((card, i) => {
      tl5.to(
        card,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          ease: "back.out(1.2)",
        },
        `-=${i === 0 ? 0.1 : 0.25}`,
      );
    });

    const specsStrip = s5.querySelector(".specs-strip");
    if (specsStrip) {
      tl5.to(specsStrip, { opacity: 1, y: 0, duration: 0.4 }, "-=0.1");
    }

    gsap.to(s5, {
      scrollTrigger: {
        trigger: "#scene5",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -60,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- SCENE 6: Testimonials — stagger cards ----------
  const s6t = document.getElementById("scene6Content");
  if (s6t) {
    const tl6t = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene6",
        scroller,
        start: "top 70%",
        end: "center 35%",
        scrub: 1,
      },
    });
    tl6t
      .to(s6t.querySelector(".scene-label"), {
        opacity: 1,
        y: 0,
        duration: 0.3,
      })
      .to(
        s6t.querySelector(".scene-headline"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.1",
      )
      .to(
        s6t.querySelector(".scene-sub"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2",
      );

    const testimonialCards = s6t.querySelectorAll(".testimonial-card");
    testimonialCards.forEach((card, i) => {
      tl6t.to(
        card,
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: "back.out(1.1)",
        },
        `-=${i === 0 ? 0.1 : 0.25}`,
      );
    });

    gsap.to(s6t, {
      scrollTrigger: {
        trigger: "#scene6",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -60,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- SCENE 7: App Ecosystem — stagger feature cards ----------
  const s7a = document.getElementById("scene7Content");
  if (s7a) {
    const tl7a = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene7",
        scroller,
        start: "top 70%",
        end: "center 35%",
        scrub: 1,
      },
    });
    tl7a
      .to(s7a.querySelector(".scene-label"), {
        opacity: 1,
        y: 0,
        duration: 0.3,
      })
      .to(
        s7a.querySelector(".scene-headline"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.1",
      )
      .to(
        s7a.querySelector(".scene-sub"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2",
      );

    const appCards = s7a.querySelectorAll(".app-feature-card");
    appCards.forEach((card, i) => {
      tl7a.to(
        card,
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "back.out(1.15)",
        },
        `-=${i === 0 ? 0.1 : 0.22}`,
      );
    });

    tl7a.to(
      s7a.querySelector(".app-badges"),
      { opacity: 1, y: 0, duration: 0.4 },
      "-=0.1",
    );

    gsap.to(s7a, {
      scrollTrigger: {
        trigger: "#scene7",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -60,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- SCENE 8: Colors & Materials — reveal swatches ----------
  const s8c = document.getElementById("scene8Content");

  if (s8c) {
    const tl8c = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene8",
        scroller,
        start: "top 70%",
        end: "center 35%",
        scrub: 1,
      },
    });

    const label = s8c.querySelector(".scene-label");
    const headline = s8c.querySelector(".scene-headline");
    const sub = s8c.querySelector(".scene-sub");
    const materialInfo = s8c.querySelector(".color-material-info");
    const colorOptions = s8c.querySelectorAll(".color-option");

    if (label) {
      tl8c.to(label, { opacity: 1, y: 0, duration: 0.3 });
    }

    if (headline) {
      tl8c.to(headline, { opacity: 1, y: 0, duration: 0.5 }, "-=0.1");
    }

    if (sub) {
      tl8c.to(sub, { opacity: 1, y: 0, duration: 0.5 }, "-=0.2");
    }

    if (colorOptions.length) {
      colorOptions.forEach((opt, i) => {
        tl8c.to(
          opt,
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "back.out(1.3)",
          },
          `-=${i === 0 ? 0.1 : 0.3}`,
        );
      });
    }

    if (materialInfo) {
      tl8c.to(materialInfo, { opacity: 1, y: 0, duration: 0.4 }, "-=0.1");
    }

    gsap.to(s8c, {
      scrollTrigger: {
        trigger: "#scene8",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -60,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- SCENE 9: Comparison — animated bar chart ----------
  const s9c = document.getElementById("scene9Content");
  if (s9c) {
    const tl9c = gsap.timeline({
      scrollTrigger: {
        trigger: "#scene9",
        scroller,
        start: "top 70%",
        end: "center 30%",
        scrub: 1,
      },
    });

    // Intro text stagger
    tl9c
      .to(s9c.querySelector(".compare-intro .scene-label"), {
        opacity: 1,
        y: 0,
        duration: 0.3,
      })
      .to(
        s9c.querySelector(".compare-intro .scene-headline"),
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.1",
      )
      .to(
        s9c.querySelector(".compare-intro .compare-sub"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.2",
      )
      .to(
        s9c.querySelector(".compare-header"),
        { opacity: 1, y: 0, duration: 0.3 },
        "-=0.1",
      );

    // Rows stagger in + bars fill
    const rows = s9c.querySelectorAll(".compare-row");
    rows.forEach((row, i) => {
      tl9c.to(
        row,
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: "power2.out",
        },
        `-=${i === 0 ? 0 : 0.2}`,
      );

      // Animate bar fills inside this row
      const fills = row.querySelectorAll(".compare-bar-fill");
      fills.forEach((fill) => {
        const target = parseFloat(fill.dataset.target) || 0;
        tl9c.to(
          fill,
          {
            width: target + "%",
            duration: 0.6,
            ease: "power3.out",
          },
          "<",
        );
      });
    });

    // Verdict badge + footnote
    tl9c
      .to(
        s9c.querySelector(".compare-verdict"),
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.1",
      )
      .to(
        s9c.querySelector(".compare-footnote"),
        { opacity: 1, y: 0, duration: 0.3 },
        "-=0.1",
      );

    // Parallax exit
    gsap.to(s9c, {
      scrollTrigger: {
        trigger: "#scene9",
        scroller,
        start: "center center",
        end: "bottom top",
        scrub: true,
      },
      y: -60,
      opacity: 0.3,
      ease: "none",
    });
  }

  // ---------- Velocity tracking + scroll-linked sound ----------
  velocityTracker.init();

  let lastScrollSoundTime = 0;
  scroller.addEventListener("scroll", () => {
    // Feed scroll position to velocity tracker
    velocityTracker.update(scroller.scrollTop);

    const now = Date.now();
    // Faster scrolling = more frequent sound pulses
    const soundInterval = Math.max(
      120,
      400 - velocityTracker.getIntensity() * 300,
    );
    if (now - lastScrollSoundTime > soundInterval) {
      audio.playInteraction("scroll");
      lastScrollSoundTime = now;
    }
  });

  // Initialize velocity audio layer + doppler system
  audio.initVelocityLayer();
  audio.initDopplerShift();

  // Continuous velocity decay + audio update even when not scrolling
  let velocityDecayRAF;
  function decayVelocity() {
    const scroller = document.getElementById("scrollContainer");
    const scrollTop = scroller?.scrollTop || 0;
    velocityTracker.update(scrollTop);

    // Feed current velocity intensity into the audio engine every frame
    audio.updateVelocityAudio(velocityTracker.getIntensity());

    // Feed doppler shift — use smoothed signed delta and absolute velocity
    if (Math.abs(velocityTracker.smoothDelta) > 0.5) {
      audio.updateDopplerShift(
        velocityTracker.smoothDelta,
        velocityTracker.velocity,
      );
    } else {
      audio.decayDoppler();
    }

    velocityDecayRAF = requestAnimationFrame(decayVelocity);
  }
  decayVelocity();

  gsapInitialized = true;
}

function onSceneEnter(index) {
  if (index === currentScene) return;
  currentScene = index;
  audio.updateScene(index);
  audio.playInteraction("transition");
  updateProgressDots(index);
}

function updateProgressDots(active) {
  document.querySelectorAll(".progress-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === active);
  });
}

// ==================== PROGRESS DOT NAVIGATION ====================
document.querySelectorAll(".progress-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    const sceneIdx = parseInt(dot.dataset.scene);
    const target = document.querySelector(`[data-scene="${sceneIdx}"]`);
    if (target && gsapInitialized) {
      const scroller = document.getElementById("scrollContainer");
      gsap.to(scroller, {
        scrollTo: { y: target, offsetY: 0 },
        duration: 1.5,
        ease: "power3.inOut",
      });
      audio.playInteraction("click");
    }
  });
});

// ==================== ENTRY BUTTON ====================
document.getElementById("enterBtn").addEventListener("click", async () => {
  audio.playInteraction("click");
  await audio.init();
  document.getElementById("entryScreen").classList.add("hidden");
  entryActive = false;

  setTimeout(() => {
    const sc = document.getElementById("scrollContainer");
    sc.classList.add("active");
    document.getElementById("nav").classList.add("visible");
    document.getElementById("soundIndicator").classList.add("visible");
    document.getElementById("scrollProgress").classList.add("visible");
    waveActive = true;
    particlesActive = true;
    drawWaves();
    drawParticles();
    initSpatialCanvas();
    initGSAP();
  }, 800);
});

// <!-- ─── SCRIPT (add to script.js or before </body>) ─────────────────────── -->

(function () {
  const hamburger = document.getElementById('navHamburger');
  const overlay   = document.getElementById('mobileNavOverlay');
  const backdrop  = document.getElementById('mobileNavBackdrop');
 
  function openMenu() {
    overlay.classList.add('is-open');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
 
  function closeMenu() {
    overlay.classList.remove('is-open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
 
  hamburger.addEventListener('click', () => {
    overlay.classList.contains('is-open') ? closeMenu() : openMenu();
  });
 
  // Close on backdrop click
  backdrop.addEventListener('click', closeMenu);
 
  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeMenu();
  });
 
  // Close when a link is tapped
  overlay.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });
})();
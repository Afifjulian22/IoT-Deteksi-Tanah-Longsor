/**
 * Sistem Telemetri & Deteksi Dini Longsor (Digital Twin 3D Maket Akrilik HD)
 * Laboratorium Geoteknik & IoT ESP32 - BPBD Purbalingga
 *
 * Model: Maket Uji Lereng Flume Akrilik Transparan (Acrylic Aquarium Apparatus)
 * Dimensi: 60 x 30 x 40 cm (Skala Maket Geoteknik Uji Laboratorium)
 */

// Global State
const state = {
  pitch: 2.1,
  roll: 0.8,
  moisture: 32,
  rain: 0,
  vibration: 0.03,
  status: 'AMAN',
  leadTimeSeconds: 0,
  isBuzzerActive: true,
  autoLoop: false,
  autoLoopTimer: null,
  wireframe: false,
  acrylicMode: 0, // 0: HD Realistic, 1: X-Ray Subtle, 2: Hidden (Soil Only)
  audioCtx: null,
  cameraTarget: null
};

// ==========================================
// PROCEDURAL HD TEXTURE GENERATORS
// ==========================================

// Granular Soil, Bedrock & Clay Procedural Textures
function createGranularTexture(type, baseColorHex, speckleColors, noiseIntensity) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, 512, 512);

  // Strata layering for clay / subsoil
  if (type === 'clay') {
    for (let y = 0; y < 512; y += 4) {
      const alpha = 0.06 + Math.sin(y * 0.04) * 0.04 + (Math.random() - 0.5) * 0.02;
      ctx.fillStyle = (y % 8 === 0) ? `rgba(90, 50, 30, ${alpha})` : `rgba(140, 85, 55, ${alpha})`;
      ctx.fillRect(0, y, 512, 4);
    }
  }

  // Gravel / Aggregate for bedrock drainage layer
  if (type === 'bedrock') {
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      const rad = 2 + Math.random() * 6;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(51, 65, 85, 0.4)' : 'rgba(30, 41, 59, 0.5)';
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Organic speckling and earth grains
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * noiseIntensity;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n * 0.8));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n * 0.6));
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// Laser-Etched Measurement Grid Texture for Transparent Acrylic Front Wall
function createAcrylicGridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 512);

  // Outer technical border
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 1024 - 32, 512 - 32);

  // Corner crosshair registration marks
  const corners = [
    [16, 16], [1024 - 16, 16],
    [16, 512 - 16], [1024 - 16, 512 - 16]
  ];
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
  ctx.lineWidth = 1.5;
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();
  });

  // Cross-section engineering grid lines (5cm x 5cm equivalent)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);

  // Vertical grid lines
  for (let x = 64; x < 1000; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, 512 - 24);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let y = 48; y < 500; y += 48) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(1024 - 24, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Centimeter measurement scales on left and right borders
  ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';

  // Height scale (0 to 40 cm) along left edge
  for (let h = 0; h <= 40; h += 5) {
    const yPos = 512 - 40 - (h / 40) * (512 - 80);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = (h % 10 === 0) ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(16, yPos);
    ctx.lineTo(h % 10 === 0 ? 32 : 24, yPos);
    ctx.stroke();

    if (h % 10 === 0) {
      ctx.fillText(`${h}cm`, 36, yPos + 3);
    }
  }

  // Length scale (0 to 60 cm) along bottom edge
  ctx.textAlign = 'center';
  for (let l = 0; l <= 60; l += 10) {
    const xPos = 40 + (l / 60) * (1024 - 80);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xPos, 512 - 16);
    ctx.lineTo(xPos, 512 - 28);
    ctx.stroke();
    ctx.fillText(`${l}cm`, xPos, 512 - 32);
  }

  // Technical laboratory branding etched at top
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.fillText('BPBD PURBALINGGA | FLUME AKRILIK OPTIS 5MM', 48, 38);

  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
  ctx.fillText('MAKET GEOTEKNIK DETEKSI LONGSOR & INFILTRASI AIR • REFRAKSI PMMA n=1.49', 48, 52);

  // Critical Shear Monitoring Zone Bracket
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(260, 110, 280, 220);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.75)';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillText('[ ZONA KRITIS BIDANG GELINCIR ]', 270, 128);

  // Water drainage mark at bottom right
  ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.textAlign = 'right';
  ctx.fillText('DRAINASE & REMBESAN AIR →', 1024 - 40, 512 - 40);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Procedural Circuit Board Texture for ESP32 & Moisture Sensor
function createPCBTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f3820'; // FR4 Green PCB
  ctx.fillRect(0, 0, 256, 256);

  // Copper traces
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2;
  for (let i = 20; i < 240; i += 24) {
    ctx.beginPath();
    ctx.moveTo(20, i);
    ctx.lineTo(80, i);
    ctx.lineTo(120, i + 12);
    ctx.lineTo(236, i + 12);
    ctx.stroke();
  }

  // Microcontroller chip (ESP32)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(80, 80, 96, 96);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('ESP-WROOM-32', 88, 128);

  // Gold connector pins
  ctx.fillStyle = '#fbbf24';
  for (let y = 40; y < 220; y += 14) {
    ctx.fillRect(24, y, 10, 6);
    ctx.fillRect(222, y, 10, 6);
  }

  return new THREE.CanvasTexture(canvas);
}


// ==========================================
// HIGH-FIDELITY WEB AUDIO SOUND ENGINE
// ==========================================
// 100% Procedural synthesis (Zero external MP3 dependencies)
// Menghasilkan:
// 1. Suara Hujan Realistis (Pink Noise + Bandpass Filter + Raindrop Droplet Clicks)
// 2. Suara Gemuruh Longsor (Deep Seismic Earth Rumble + Low-Frequency Roar + Soil Cracking)
// 3. Suara Sirene Alarm Evakuasi (Wailing Emergency Dual-Tone Siren)
// 4. Suara Piezo Buzzer Sensor ESP32 (Physical 2.8kHz Square Wave Hardware Chirp)

const SoundEngine = {
  ctx: null,
  isMuted: false,
  noiseBuffer: null,

  // Continuous audio nodes
  rainSource: null,
  rainFilter: null,
  rainGain: null,
  dropletTimer: null,

  rumbleSource: null,
  rumbleFilter: null,
  rumbleSubOsc: null,
  rumbleLFO: null,
  rumbleGain: null,
  rumbleTimer: null,

  sirenOsc: null,
  sirenLFO: null,
  sirenGain: null,
  sirenTimer: null,

  init() {
    if (this.ctx) return this.ctx;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.createNoiseBuffer();
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
    return this.ctx;
  },

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  createNoiseBuffer() {
    if (!this.ctx) return;
    // Generate 3 seconds of high-quality pink/brown noise
    const bufferSize = this.ctx.sampleRate * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
  },

  // ----------------------------------------
  // 1. SUARA HUJAN & RIKSAAN AIR (Rain Audio)
  // ----------------------------------------
  updateRain(intensityPercent) {
    if (this.isMuted) {
      this.stopRain();
      return;
    }
    this.resume();
    if (!this.ctx) return;

    if (intensityPercent <= 0) {
      this.stopRain();
      return;
    }

    const targetGain = Math.min(0.25, (intensityPercent / 100) * 0.22);

    if (!this.rainSource) {
      if (!this.noiseBuffer) this.createNoiseBuffer();
      this.rainSource = this.ctx.createBufferSource();
      this.rainSource.buffer = this.noiseBuffer;
      this.rainSource.loop = true;

      // Bandpass filter for realistic rain patter
      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.setValueAtTime(1600, this.ctx.currentTime);
      this.rainFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.rainSource.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.ctx.destination);
      this.rainSource.start();

      // Start raindrop clicks
      this.scheduleRainDroplets();
    }

    // Dynamic frequency adjustment based on rain intensity
    const freq = 1200 + (intensityPercent / 100) * 1400;
    this.rainFilter.frequency.linearRampToValueAtTime(freq, this.ctx.currentTime + 0.15);
    this.rainGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.15);
  },

  scheduleRainDroplets() {
    if (this.dropletTimer) clearTimeout(this.dropletTimer);
    if (!this.rainSource || this.isMuted || state.rain <= 0) return;

    // Trigger individual water droplet clicks hitting acrylic/soil
    const clickFreq = 2200 + Math.random() * 2200;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(clickFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(clickFreq * 0.4, this.ctx.currentTime + 0.015);

      const dropVol = (state.rain / 100) * 0.04;
      gain.gain.setValueAtTime(dropVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.018);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } catch (e) {}

    const nextDelay = Math.max(30, 250 - state.rain * 2.2 + Math.random() * 40);
    this.dropletTimer = setTimeout(() => this.scheduleRainDroplets(), nextDelay);
  },

  stopRain() {
    if (this.dropletTimer) {
      clearTimeout(this.dropletTimer);
      this.dropletTimer = null;
    }
    if (this.rainGain && this.ctx) {
      this.rainGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      setTimeout(() => {
        if (this.rainSource) {
          try { this.rainSource.stop(); this.rainSource.disconnect(); } catch (e) {}
          this.rainSource = null;
        }
      }, 250);
    }
  },

  // ----------------------------------------
  // 2. SUARA GEMURUH LONGSOR & TANAH RETAK
  // ----------------------------------------
  triggerLandslideRumble(intensity = 1.0) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const duration = 2.8 * intensity;

      // Deep rumble noise filtered at low-pass ~75Hz
      const rumbleNoise = this.ctx.createBufferSource();
      if (!this.noiseBuffer) this.createNoiseBuffer();
      rumbleNoise.buffer = this.noiseBuffer;
      rumbleNoise.loop = true;

      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(80 * intensity, now);
      rumbleFilter.Q.setValueAtTime(4.5, now);

      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.01, now);
      rumbleGain.gain.linearRampToValueAtTime(0.24 * intensity, now + 0.35);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Sub-bass seismic oscillator (38Hz - 54Hz vibrating rumble)
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(42, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + duration);

      // Tremolo LFO for rolling ground movement
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(4.5, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.12 * intensity, now);
      lfo.connect(lfoGain.gain);

      rumbleNoise.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      subOsc.connect(rumbleFilter);
      rumbleGain.connect(this.ctx.destination);

      rumbleNoise.start(now);
      subOsc.start(now);
      rumbleNoise.stop(now + duration);
      subOsc.stop(now + duration);

      // Soil snapping / tension cracking sound
      this.triggerSoilCrackSnap(now + 0.15);
      if (intensity > 0.6) {
        this.triggerSoilCrackSnap(now + 0.6);
        this.triggerSoilCrackSnap(now + 1.1);
      }
    } catch (e) {
      console.warn('Rumble playback error:', e);
    }
  },

  triggerSoilCrackSnap(timeOffset) {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, timeOffset);
      osc.frequency.exponentialRampToValueAtTime(90, timeOffset + 0.08);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, timeOffset);
      filter.Q.setValueAtTime(2.0, timeOffset);

      gain.gain.setValueAtTime(0.15, timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(timeOffset);
      osc.stop(timeOffset + 0.1);
    } catch (e) {}
  },

  // ----------------------------------------
  // 3. SUARA SIRENE ALARM DARURAT (Emergency Alarm)
  // ----------------------------------------
  updateSiren(status) {
    if (this.isMuted) {
      this.stopSiren();
      return;
    }
    this.resume();
    if (!this.ctx) return;

    if (status === 'BAHAYA') {
      this.startEvacuationSiren();
    } else if (status === 'WASPADA') {
      this.startWarningBeeps();
    } else {
      this.stopSiren();
    }
  },

  startEvacuationSiren() {
    this.stopSiren();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();

      this.sirenOsc.type = 'sawtooth';

      // Wailing siren frequency modulation (750Hz to 1100Hz every 0.5s)
      this.sirenLFO = this.ctx.createOscillator();
      this.sirenLFO.type = 'triangle';
      this.sirenLFO.frequency.setValueAtTime(1.8, now); // Wailing speed

      const lfoDepth = this.ctx.createGain();
      lfoDepth.gain.setValueAtTime(180, now);
      this.sirenOsc.frequency.setValueAtTime(880, now);

      this.sirenLFO.connect(lfoDepth);
      lfoDepth.connect(this.sirenOsc.frequency);

      this.sirenGain.gain.setValueAtTime(0.01, now);
      this.sirenGain.gain.linearRampToValueAtTime(0.12, now + 0.2);

      // Lowpass filter to soften harshness
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);

      this.sirenOsc.connect(filter);
      filter.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);

      this.sirenOsc.start();
      this.sirenLFO.start();
    } catch (e) {
      console.warn('Siren start error:', e);
    }
  },

  startWarningBeeps() {
    this.stopSiren();
    if (!this.ctx || this.isMuted) return;

    // Periodic dual warning beep every 1.8 seconds
    const playWarningBeep = () => {
      if (state.status !== 'WASPADA' || this.isMuted) {
        clearInterval(this.sirenTimer);
        this.sirenTimer = null;
        return;
      }
      this.playESP32Buzzer('warning');
    };

    playWarningBeep();
    this.sirenTimer = setInterval(playWarningBeep, 1800);
  },

  stopSiren() {
    if (this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
    if (this.sirenGain && this.ctx) {
      this.sirenGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      setTimeout(() => {
        if (this.sirenOsc) {
          try { this.sirenOsc.stop(); this.sirenOsc.disconnect(); } catch (e) {}
          this.sirenOsc = null;
        }
        if (this.sirenLFO) {
          try { this.sirenLFO.stop(); this.sirenLFO.disconnect(); } catch (e) {}
          this.sirenLFO = null;
        }
      }, 180);
    }
  },

  // ----------------------------------------
  // 4. SUARA PIEZO BUZZER HARDWARE ESP32
  // ----------------------------------------
  playESP32Buzzer(mode = 'click') {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Sharp piezo buzzer 2800 Hz square wave
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (mode === 'critical') {
        // 3 Rapid high-pitched chirps
        osc.frequency.setValueAtTime(2900, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(3200, now + 0.12);
        gain2.gain.setValueAtTime(0.12, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc2.connect(gain2); gain2.connect(this.ctx.destination);

        osc.start(now); osc.stop(now + 0.11);
        osc2.start(now + 0.12); osc2.stop(now + 0.23);
      } else if (mode === 'warning') {
        // Dual medium piezo beep
        osc.frequency.setValueAtTime(2700, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(2700, now + 0.16);
        gain2.gain.setValueAtTime(0.08, now + 0.16);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc2.connect(gain2); gain2.connect(this.ctx.destination);

        osc.start(now); osc.stop(now + 0.13);
        osc2.start(now + 0.16); osc2.stop(now + 0.29);
      } else if (mode === 'info') {
        // Single pleasant beep
        osc.frequency.setValueAtTime(1800, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.16);
      } else {
        // Sensor click / telemetry packet ping
        osc.frequency.setValueAtTime(3500, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.035);
        osc.start(now); osc.stop(now + 0.04);
      }
    } catch (e) {
      console.warn('Buzzer sound error:', e);
    }
  },

  // Toggle Mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    state.isBuzzerActive = !this.isMuted;
    if (this.isMuted) {
      this.stopRain();
      this.stopSiren();
    } else {
      this.resume();
      if (state.rain > 0) this.updateRain(state.rain);
      this.updateSiren(state.status);
    }
    return !this.isMuted;
  }
};


// ==========================================
// 1. THREE.JS ULTRA-HD ACRYLIC FLUME SCENE
// ==========================================
let scene, camera, renderer, controls;
let slopeGroup, slidingSoilWedge, bedrockMesh, subsoilMesh;
let sensorStakeMesh, sensorLedMesh;
let rainParticles, rainGeometry;
let rainMistCones = [];
let failureTensionCrack;
let acrylicTankGroup, acrylicMaterials = [];
let groundwaterMesh;
let piezometerFluid;

function initThreeJS() {
  const container = document.getElementById('three-container');
  if (!container) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d14);

  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(7.5, 4.8, 7.5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // HD Color Management & ACES Tone Mapping
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  }
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.02;
  controls.target.set(0, 1.2, 0);

  // Studio Lighting for Acrylic Glass & Soil Textures
  setupHDLighting();

  // Laboratory Bench Table Floor
  buildLaboratoryWorkbench();

  // Build the Realistic Slope Model with Acrylic Aquarium Enclosure
  buildRealisticSlope();

  // Build Rain & Mist Spray System
  buildRainSystem();

  // Setup Camera Preset Buttons & Controls
  setupCameraControls();

  window.addEventListener('resize', onWindowResize);
  animate();
}

function setupHDLighting() {
  // Soft cool laboratory ambient light
  const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.75);
  scene.add(ambientLight);

  // Key directional light (Overhead laboratory luminaire casting soft shadows)
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.35);
  mainLight.position.set(6, 12, 7);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 25;
  mainLight.shadow.camera.left = -6;
  mainLight.shadow.camera.right = 6;
  mainLight.shadow.camera.top = 6;
  mainLight.shadow.camera.bottom = -6;
  mainLight.shadow.bias = -0.0004;
  scene.add(mainLight);

  // Fill light (Cool cyan lab bounce)
  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
  fillLight.position.set(-6, 4, -4);
  scene.add(fillLight);

  // Specular rim light (Produces crisp, glossy highlights on acrylic glass edges)
  const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
  rimLight.position.set(0, 4, -7);
  scene.add(rimLight);

  // Internal flume inspection spotlight (Simulates overhead LED inspection rail)
  const tankSpot = new THREE.SpotLight(0xe0f2fe, 1.1, 14, Math.PI / 4, 0.35, 1.2);
  tankSpot.position.set(0, 4.5, 0);
  tankSpot.target.position.set(0, 1.0, 0);
  scene.add(tankSpot);
  scene.add(tankSpot.target);
}

function buildLaboratoryWorkbench() {
  // Heavy-duty composite laboratory test table beneath the aquarium
  const benchGeo = new THREE.BoxGeometry(7.4, 0.25, 3.8);
  const benchMat = new THREE.MeshStandardMaterial({
    color: 0x141824,
    metalness: 0.25,
    roughness: 0.7
  });
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.position.set(0, -0.125, 0);
  bench.receiveShadow = true;
  scene.add(bench);

  // Rubber vibration isolation damper feet at 4 corners
  const footGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const feetPos = [
    [-3.2, -0.29, -1.5], [3.2, -0.29, -1.5],
    [-3.2, -0.29, 1.5], [3.2, -0.29, 1.5]
  ];
  feetPos.forEach(([fx, fy, fz]) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(fx, fy, fz);
    scene.add(foot);
  });

  // Laboratory floor coordinate grid
  const grid = new THREE.GridHelper(14, 28, 0x334155, 0x1e293b);
  grid.position.y = -0.33;
  scene.add(grid);
}

function buildRealisticSlope() {
  slopeGroup = new THREE.Group();
  scene.add(slopeGroup);

  // Procedural HD Textures
  const humusTex = createGranularTexture('humus', '#3d281a', ['#261910', '#4a3222'], 42);
  const clayTex = createGranularTexture('clay', '#6c4b32', ['#4e3320', '#855e3e'], 32);
  const bedrockTex = createGranularTexture('bedrock', '#1e293b', ['#334155', '#0f172a'], 22);

  // 1. Bedrock / Bottom Perforated Drainage Foundation Layer
  const baseGeo = new THREE.BoxGeometry(5.4, 0.24, 2.38);
  const baseMat = new THREE.MeshStandardMaterial({
    map: bedrockTex,
    color: 0x242b3a,
    roughness: 0.85
  });
  bedrockMesh = new THREE.Mesh(baseGeo, baseMat);
  bedrockMesh.position.set(0, 0.20, 0);
  bedrockMesh.receiveShadow = true;
  slopeGroup.add(bedrockMesh);

  // Perforated drainage plate at the toe
  const drainPlateGeo = new THREE.BoxGeometry(0.7, 0.04, 2.36);
  const drainPlateMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.8,
    roughness: 0.3
  });
  const drainPlate = new THREE.Mesh(drainPlateGeo, drainPlateMat);
  drainPlate.position.set(2.35, 0.33, 0);
  slopeGroup.add(drainPlate);

  // 2. Stable Lower Subsoil (Dense Clay Incline)
  // Geotechnical slope profile (~32° natural slope)
  const slopeShape = new THREE.Shape();
  slopeShape.moveTo(-2.6, 0.32);
  slopeShape.lineTo(2.6, 0.32);      // Toe bottom
  slopeShape.lineTo(2.6, 0.65);      // Toe lip retaining edge
  slopeShape.lineTo(0.4, 1.25);      // Lower shear boundary
  slopeShape.lineTo(-1.3, 1.85);     // Mid crest
  slopeShape.lineTo(-2.6, 1.85);     // Back crest
  slopeShape.closePath();

  const subsoilGeo = new THREE.ExtrudeGeometry(slopeShape, {
    steps: 1,
    depth: 2.36,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2
  });
  subsoilGeo.center();

  const subsoilMat = new THREE.MeshStandardMaterial({
    map: clayTex,
    color: 0x5a3e2b,
    roughness: 0.88
  });
  subsoilMesh = new THREE.Mesh(subsoilGeo, subsoilMat);
  subsoilMesh.position.set(0, 1.08, 0);
  subsoilMesh.castShadow = true;
  subsoilMesh.receiveShadow = true;
  slopeGroup.add(subsoilMesh);

  // 3. Upper Active Sliding Soil Wedge (The geotechnical mass that shears)
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-1.25, 1.85);
  wedgeShape.lineTo(0.4, 1.25);
  wedgeShape.lineTo(0.4, 1.62);
  wedgeShape.lineTo(-1.15, 2.15);
  wedgeShape.closePath();

  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    steps: 1,
    depth: 2.32,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2
  });
  wedgeGeo.center();

  const wedgeMat = new THREE.MeshStandardMaterial({
    map: humusTex,
    color: 0x6e472a,
    roughness: 0.82
  });
  slidingSoilWedge = new THREE.Mesh(wedgeGeo, wedgeMat);
  slidingSoilWedge.position.set(-0.35, 1.85, 0);
  slidingSoilWedge.castShadow = true;
  slidingSoilWedge.receiveShadow = true;
  slopeGroup.add(slidingSoilWedge);

  // Vegetated Organic Turf Crust on Slope Surface
  const turfGeo = new THREE.BoxGeometry(2.15, 0.04, 2.34);
  const turfMat = new THREE.MeshStandardMaterial({
    color: 0x1b4332,
    roughness: 0.95
  });
  const turfMesh = new THREE.Mesh(turfGeo, turfMat);
  turfMesh.position.set(-0.06, 0.28, 0);
  turfMesh.rotation.z = -0.32;
  slidingSoilWedge.add(turfMesh);

  // Miniature soil erosion marker pins along the slope
  for (let i = 0; i < 5; i++) {
    const pinGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7 });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(-0.7 + i * 0.35, 0.33, (Math.random() - 0.5) * 1.6);
    turfMesh.add(pin);
  }

  // 4. Physical IoT Sensor Node (ESP32 DOIT DevKit V1 Smart Probe)
  const stakeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.75, 16);
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
  sensorStakeMesh = new THREE.Mesh(stakeGeo, stakeMat);
  sensorStakeMesh.position.set(0.1, 0.52, 0.3);
  sensorStakeMesh.castShadow = true;
  slidingSoilWedge.add(sensorStakeMesh);

  // Weatherproof IP67 Enclosure with Smoked Acrylic Lid
  const boxBaseGeo = new THREE.BoxGeometry(0.22, 0.16, 0.15);
  const boxBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  const boxBase = new THREE.Mesh(boxBaseGeo, boxBaseMat);
  boxBase.position.y = 0.38;
  sensorStakeMesh.add(boxBase);

  // Circuit board inside visible through translucent lid
  const pcbGeo = new THREE.BoxGeometry(0.18, 0.02, 0.12);
  const pcbMat = new THREE.MeshStandardMaterial({ map: createPCBTexture(), roughness: 0.6 });
  const pcb = new THREE.Mesh(pcbGeo, pcbMat);
  pcb.position.set(0, 0.44, 0);
  sensorStakeMesh.add(pcb);

  // Clear poly lid
  const lidGeo = new THREE.BoxGeometry(0.224, 0.03, 0.154);
  const lidMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.65,
    roughness: 0.1,
    transmission: 0.85
  });
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.set(0, 0.47, 0);
  sensorStakeMesh.add(lid);

  // Whip Antenna
  const antGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.25, 8);
  const antMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.95 });
  const antMesh = new THREE.Mesh(antGeo, antMat);
  antMesh.position.set(0.08, 0.58, 0);
  sensorStakeMesh.add(antMesh);

  // Status LED Beacon on Box
  const ledGeo = new THREE.SphereGeometry(0.035, 16, 16);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  sensorLedMesh = new THREE.Mesh(ledGeo, ledMat);
  sensorLedMesh.position.set(-0.06, 0.46, 0.078);
  sensorStakeMesh.add(sensorLedMesh);

  // Capacitive Soil Moisture Sensor (v1.2 FR4 PCB embedded in soil, visible through acrylic)
  const probeGeo = new THREE.BoxGeometry(0.08, 0.35, 0.015);
  const probeMat = new THREE.MeshStandardMaterial({ color: 0x15803d, metalness: 0.6, roughness: 0.4 });
  const soilProbe = new THREE.Mesh(probeGeo, probeMat);
  soilProbe.position.set(0.65, 0.95, 1.15); // Mounted close to front acrylic wall
  slopeGroup.add(soilProbe);

  // Gold prongs on probe
  const prongGeo = new THREE.BoxGeometry(0.02, 0.18, 0.018);
  const prongMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9 });
  const p1 = new THREE.Mesh(prongGeo, prongMat); p1.position.set(-0.02, -0.06, 0); soilProbe.add(p1);
  const p2 = new THREE.Mesh(prongGeo, prongMat); p2.position.set(0.02, -0.06, 0); soilProbe.add(p2);

  // 5. Tension Failure Crack Line (Exposed shear scarp)
  const crackCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.28, 1.88, -1.15),
    new THREE.Vector3(-1.22, 1.86, -0.4),
    new THREE.Vector3(-1.29, 1.89, 0.4),
    new THREE.Vector3(-1.24, 1.87, 1.15)
  ]);
  const crackGeo = new THREE.TubeGeometry(crackCurve, 24, 0.025, 8, false);
  const crackMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  failureTensionCrack = new THREE.Mesh(crackGeo, crackMat);
  failureTensionCrack.visible = false;
  slopeGroup.add(failureTensionCrack);

  // 6. Dynamic Groundwater Saturation Table (Muka Air Tanah Meniscus)
  const waterGeo = new THREE.BoxGeometry(5.42, 0.4, 2.39);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.55,
    roughness: 0.05,
    transmission: 0.92,
    ior: 1.333,
    clearcoat: 1.0,
    depthWrite: false
  });
  groundwaterMesh = new THREE.Mesh(waterGeo, waterMat);
  groundwaterMesh.position.set(0, 0.22, 0);
  slopeGroup.add(groundwaterMesh);

  // 7. ULTRA-HD TRANSPARENT ACRYLIC FLUME TANK (AQUARIUM ENCLOSURE)
  buildAcrylicFlumeTank();
}

function buildAcrylicFlumeTank() {
  acrylicTankGroup = new THREE.Group();
  slopeGroup.add(acrylicTankGroup);
  acrylicMaterials = [];

  // PMMA Acrylic Glass Physical Material
  const acrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.90,
    roughness: 0.03,
    metalness: 0.02,
    transmission: 0.96,
    ior: 1.491, // Exact Polymethyl Methacrylate (PMMA) acrylic index of refraction
    reflectivity: 0.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    thickness: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  acrylicMaterials.push(acrylicMat);

  // Front Wall with Laser-Etched Measurement Grid Texture
  const frontAcrylicMat = new THREE.MeshPhysicalMaterial({
    map: createAcrylicGridTexture(),
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.94,
    roughness: 0.04,
    metalness: 0.02,
    transmission: 0.94,
    ior: 1.491,
    reflectivity: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    thickness: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  acrylicMaterials.push(frontAcrylicMat);

  const tankWidth = 5.8;
  const tankHeight = 2.75;
  const tankDepth = 2.55;
  const wallThick = 0.05;

  // Front Acrylic Pane
  const frontPaneGeo = new THREE.BoxGeometry(tankWidth, tankHeight, wallThick);
  const frontPane = new THREE.Mesh(frontPaneGeo, frontAcrylicMat);
  frontPane.position.set(0, tankHeight / 2, tankDepth / 2);
  acrylicTankGroup.add(frontPane);

  // Back Acrylic Pane
  const backPaneGeo = new THREE.BoxGeometry(tankWidth, tankHeight, wallThick);
  const backPane = new THREE.Mesh(backPaneGeo, acrylicMat);
  backPane.position.set(0, tankHeight / 2, -tankDepth / 2);
  acrylicTankGroup.add(backPane);

  // Left Acrylic Pane (Crest End)
  const leftPaneGeo = new THREE.BoxGeometry(wallThick, tankHeight, tankDepth);
  const leftPane = new THREE.Mesh(leftPaneGeo, acrylicMat);
  leftPane.position.set(-tankWidth / 2, tankHeight / 2, 0);
  acrylicTankGroup.add(leftPane);

  // Right Acrylic Pane (Toe & Drainage End)
  const rightPaneGeo = new THREE.BoxGeometry(wallThick, tankHeight, tankDepth);
  const rightPane = new THREE.Mesh(rightPaneGeo, acrylicMat);
  rightPane.position.set(tankWidth / 2, tankHeight / 2, 0);
  acrylicTankGroup.add(rightPane);

  // Bottom Thick Acrylic Base Tray
  const baseTrayGeo = new THREE.BoxGeometry(tankWidth + 0.12, 0.12, tankDepth + 0.12);
  const baseTrayMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.3
  });
  const baseTray = new THREE.Mesh(baseTrayGeo, baseTrayMat);
  baseTray.position.set(0, 0.06, 0);
  acrylicTankGroup.add(baseTray);

  // Top Rim Reinforcing Rails (Aquarium Edge Flanges)
  const railMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.8,
    transmission: 0.9,
    roughness: 0.1
  });
  acrylicMaterials.push(railMat);

  const railFrontGeo = new THREE.BoxGeometry(tankWidth, 0.04, 0.12);
  const railFront = new THREE.Mesh(railFrontGeo, railMat);
  railFront.position.set(0, tankHeight, tankDepth / 2 - 0.04);
  acrylicTankGroup.add(railFront);

  const railBackGeo = new THREE.BoxGeometry(tankWidth, 0.04, 0.12);
  const railBack = new THREE.Mesh(railBackGeo, railMat);
  railBack.position.set(0, tankHeight, -tankDepth / 2 + 0.04);
  acrylicTankGroup.add(railBack);

  // Corner Structural Metal Brackets (4 corners)
  const cornerMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.25
  });
  const cornerGeo = new THREE.BoxGeometry(0.08, tankHeight + 0.02, 0.08);

  const corners = [
    [-tankWidth / 2, tankDepth / 2],
    [tankWidth / 2, tankDepth / 2],
    [-tankWidth / 2, -tankDepth / 2],
    [tankWidth / 2, -tankDepth / 2]
  ];
  corners.forEach(([cx, cz]) => {
    const bracket = new THREE.Mesh(cornerGeo, cornerMat);
    bracket.position.set(cx, tankHeight / 2, cz);
    acrylicTankGroup.add(bracket);
  });

  // Drainage Valve Assembly at Toe (Matching 2D CAD engineering schematic)
  const valvePipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 16);
  const valvePipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
  const valvePipe = new THREE.Mesh(valvePipeGeo, valvePipeMat);
  valvePipe.rotation.z = Math.PI / 2;
  valvePipe.position.set(tankWidth / 2 + 0.1, 0.28, 0.8);
  acrylicTankGroup.add(valvePipe);

  // Blue Ball Valve Handle
  const handleGeo = new THREE.BoxGeometry(0.12, 0.02, 0.04);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(tankWidth / 2 + 0.18, 0.35, 0.8);
  acrylicTankGroup.add(handle);

  // Transparent Acrylic Piezometer Standpipe (Pore Pressure Column on Front Wall)
  const piezometerTubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.8, 16);
  const piezometerTubeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.85,
    transmission: 0.95,
    roughness: 0.05,
    depthWrite: false
  });
  acrylicMaterials.push(piezometerTubeMat);

  const piezometerTube = new THREE.Mesh(piezometerTubeGeo, piezometerTubeMat);
  piezometerTube.position.set(-0.6, 1.35, tankDepth / 2 + 0.06);
  acrylicTankGroup.add(piezometerTube);

  // Internal Blue Water Column inside Piezometer
  const piezometerFluidGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.6, 16);
  const piezometerFluidMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  piezometerFluid = new THREE.Mesh(piezometerFluidGeo, piezometerFluidMat);
  piezometerFluid.position.set(-0.6, 0.75, tankDepth / 2 + 0.06);
  acrylicTankGroup.add(piezometerFluid);
}

function buildRainSystem() {
  // Overhead Rain Simulator Manifold Bar (Across top rim of the flume)
  const manifoldBarGeo = new THREE.CylinderGeometry(0.03, 0.03, 5.4, 16);
  const manifoldMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });
  const manifoldBar = new THREE.Mesh(manifoldBarGeo, manifoldMat);
  manifoldBar.rotation.z = Math.PI / 2;
  manifoldBar.position.set(0, 2.78, 0);
  slopeGroup.add(manifoldBar);

  // 4 Brass Spray Nozzles pointing down
  const nozzlePositions = [-1.8, -0.6, 0.6, 1.8];
  rainMistCones = [];

  nozzlePositions.forEach((nx) => {
    // Nozzle head
    const nozGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.08, 12);
    const nozMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9 });
    const noz = new THREE.Mesh(nozGeo, nozMat);
    noz.position.set(nx, 2.72, 0);
    slopeGroup.add(noz);

    // Animated Translucent Mist Spray Cone
    const mistGeo = new THREE.ConeGeometry(0.55, 1.6, 16, 1, true);
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mistCone = new THREE.Mesh(mistGeo, mistMat);
    mistCone.position.set(nx, 1.9, 0);
    mistCone.visible = false;
    slopeGroup.add(mistCone);
    rainMistCones.push(mistCone);
  });

  // Dynamic Falling Rain Drops
  const count = 450;
  rainGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 5.2;
    positions[i + 1] = Math.random() * 2.4 + 0.6;
    positions[i + 2] = (Math.random() - 0.5) * 2.3;
  }

  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.045,
    transparent: true,
    opacity: 0.8
  });

  rainParticles = new THREE.Points(rainGeometry, mat);
  rainParticles.visible = false;
  slopeGroup.add(rainParticles);
}

// Camera View Presets with Smooth Transition
function setCameraView(preset) {
  let targetPos, targetLook;
  if (preset === 'iso') {
    targetPos = new THREE.Vector3(7.5, 4.8, 7.5);
    targetLook = new THREE.Vector3(0, 1.2, 0);
  } else if (preset === 'front') {
    // Cross-section view directly through the transparent front acrylic wall!
    targetPos = new THREE.Vector3(0, 1.4, 6.2);
    targetLook = new THREE.Vector3(0, 1.4, 0);
  } else if (preset === 'top') {
    targetPos = new THREE.Vector3(0, 7.8, 0.2);
    targetLook = new THREE.Vector3(0, 1.2, 0);
  } else if (preset === 'sensor') {
    targetPos = new THREE.Vector3(0.5, 2.6, 2.7);
    targetLook = new THREE.Vector3(0.1, 1.8, 0.3);
  }

  if (targetPos && targetLook) {
    state.cameraTarget = { pos: targetPos, look: targetLook };
  }

  // Update button active styling
  ['btn-view-iso', 'btn-view-front', 'btn-view-top', 'btn-view-sensor'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === `btn-view-${preset}`) {
      el.className = 'px-2 py-0.5 rounded bg-sky-700 text-white text-[11px] font-medium transition';
    } else {
      el.className = 'px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition';
    }
  });
}

function setupCameraControls() {
  const btnIso = document.getElementById('btn-view-iso');
  if (btnIso) btnIso.addEventListener('click', () => setCameraView('iso'));

  const btnFront = document.getElementById('btn-view-front');
  if (btnFront) btnFront.addEventListener('click', () => setCameraView('front'));

  const btnTop = document.getElementById('btn-view-top');
  if (btnTop) btnTop.addEventListener('click', () => setCameraView('top'));

  const btnSensor = document.getElementById('btn-view-sensor');
  if (btnSensor) btnSensor.addEventListener('click', () => setCameraView('sensor'));

  const btnAcrylic = document.getElementById('btn-toggle-acrylic');
  if (btnAcrylic) {
    btnAcrylic.addEventListener('click', () => {
      state.acrylicMode = (state.acrylicMode + 1) % 3;
      if (state.acrylicMode === 0) {
        btnAcrylic.textContent = '💎 Akrilik: HD';
        btnAcrylic.className = 'px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 text-[11px] font-medium transition';
        if (acrylicTankGroup) acrylicTankGroup.visible = true;
        acrylicMaterials.forEach(m => { m.opacity = 0.94; m.transmission = 0.95; });
      } else if (state.acrylicMode === 1) {
        btnAcrylic.textContent = '🔎 Akrilik: X-Ray';
        btnAcrylic.className = 'px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-400 text-[11px] font-medium transition';
        if (acrylicTankGroup) acrylicTankGroup.visible = true;
        acrylicMaterials.forEach(m => { m.opacity = 0.25; m.transmission = 0.99; });
      } else {
        btnAcrylic.textContent = '🪵 Tanpa Akrilik';
        btnAcrylic.className = 'px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-[11px] font-medium transition';
        if (acrylicTankGroup) acrylicTankGroup.visible = false;
      }
    });
  }
}

function onWindowResize() {
  const container = document.getElementById('three-container');
  if (!container || !renderer || !camera) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

let animClock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const delta = animClock.getDelta();
  const time = animClock.getElapsedTime();

  // Smooth Camera Lerping towards target preset
  if (state.cameraTarget) {
    camera.position.lerp(state.cameraTarget.pos, 0.08);
    controls.target.lerp(state.cameraTarget.look, 0.08);
    if (camera.position.distanceTo(state.cameraTarget.pos) < 0.05) {
      state.cameraTarget = null;
    }
  }

  if (slopeGroup) {
    // Physical tilting from inclinometer telemetry (Pitch & Roll)
    const targetPitch = THREE.MathUtils.degToRad(state.pitch);
    const targetRoll = THREE.MathUtils.degToRad(state.roll);

    slopeGroup.rotation.z = THREE.MathUtils.lerp(slopeGroup.rotation.z, targetPitch, 0.1);
    slopeGroup.rotation.x = THREE.MathUtils.lerp(slopeGroup.rotation.x, targetRoll, 0.1);

    // Geotechnical Failure Simulation within the Acrylic Aquarium
    if (state.status === 'BAHAYA') {
      // Rotational shear collapse: upper wedge slips along circular arc!
      slidingSoilWedge.position.x = THREE.MathUtils.lerp(slidingSoilWedge.position.x, 0.35, 0.08);
      slidingSoilWedge.position.y = THREE.MathUtils.lerp(slidingSoilWedge.position.y, 1.55, 0.08);
      slidingSoilWedge.rotation.z = THREE.MathUtils.lerp(slidingSoilWedge.rotation.z, -0.22, 0.08);
      failureTensionCrack.visible = true;
    } else if (state.status === 'WASPADA') {
      // Micro-shear creep displacement
      slidingSoilWedge.position.x = THREE.MathUtils.lerp(slidingSoilWedge.position.x, -0.20, 0.05);
      slidingSoilWedge.position.y = THREE.MathUtils.lerp(slidingSoilWedge.position.y, 1.80, 0.05);
      slidingSoilWedge.rotation.z = THREE.MathUtils.lerp(slidingSoilWedge.rotation.z, -0.05, 0.05);
      failureTensionCrack.visible = (Math.sin(time * 6) > 0);
    } else {
      // Stable resting state
      slidingSoilWedge.position.x = THREE.MathUtils.lerp(slidingSoilWedge.position.x, -0.35, 0.1);
      slidingSoilWedge.position.y = THREE.MathUtils.lerp(slidingSoilWedge.position.y, 1.85, 0.1);
      slidingSoilWedge.rotation.z = THREE.MathUtils.lerp(slidingSoilWedge.rotation.z, 0, 0.1);
      failureTensionCrack.visible = false;
    }
  }

  // Groundwater Saturation Level & Piezometer Tube height
  if (groundwaterMesh) {
    const targetWaterY = 0.22 + (state.moisture / 100) * 0.45;
    groundwaterMesh.position.y = THREE.MathUtils.lerp(groundwaterMesh.position.y, targetWaterY, 0.05);
    groundwaterMesh.scale.y = 0.8 + (state.moisture / 100) * 0.8;
  }
  if (piezometerFluid) {
    const targetScale = 0.4 + (state.moisture / 100) * 1.8;
    piezometerFluid.scale.y = THREE.MathUtils.lerp(piezometerFluid.scale.y, targetScale, 0.05);
    piezometerFluid.position.y = 0.5 + (state.moisture / 100) * 0.65;
  }

  // LED Beacon on ESP32 Sensor
  if (sensorLedMesh) {
    if (state.status === 'BAHAYA') {
      sensorLedMesh.material.color.setHex(0xef4444);
      sensorLedMesh.visible = (Math.sin(time * 14) > 0);
    } else if (state.status === 'WASPADA') {
      sensorLedMesh.material.color.setHex(0xf59e0b);
      sensorLedMesh.visible = (Math.sin(time * 6) > 0);
    } else {
      sensorLedMesh.material.color.setHex(0x10b981);
      sensorLedMesh.visible = true;
    }
  }

  // Rain particles & mist animation
  const isRaining = state.rain > 0;
  if (rainParticles) rainParticles.visible = isRaining;
  rainMistCones.forEach(cone => {
    cone.visible = isRaining;
    if (isRaining) {
      cone.scale.x = 1.0 + Math.sin(time * 8) * 0.08;
      cone.scale.z = 1.0 + Math.cos(time * 8) * 0.08;
    }
  });

  if (rainParticles && isRaining) {
    const pos = rainGeometry.attributes.position.array;
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] -= 0.12 * (state.rain / 50 + 0.5);
      if (pos[i] < 0.35) pos[i] = 2.75 + Math.random() * 0.4;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
}


// ==========================================
// 2. CHART.JS REAL-TIME TELEMETRY
// ==========================================
let telemetryChart;
const maxDataPoints = 30;

function initTelemetryChart() {
  const ctx = document.getElementById('telemetryChart').getContext('2d');
  const labels = Array.from({ length: maxDataPoints }, (_, i) => `-${maxDataPoints - i}s`);
  const initialPitch = Array(maxDataPoints).fill(state.pitch);
  const initialMoist = Array(maxDataPoints).fill(state.moisture);

  telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Pitch (°)',
          data: initialPitch,
          borderColor: '#38bdf8',
          borderWidth: 1.8,
          tension: 0.25,
          pointRadius: 0,
          yAxisID: 'y'
        },
        {
          label: 'Kelembapan (%)',
          data: initialMoist,
          borderColor: '#60a5fa',
          borderWidth: 1.5,
          borderDash: [3, 3],
          tension: 0.25,
          pointRadius: 0,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 10 }
        },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#64748b', font: { size: 9, family: 'JetBrains Mono' } }
        },
        y: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 40,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#38bdf8', font: { size: 9, family: 'JetBrains Mono' } }
        },
        y1: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: { color: '#60a5fa', font: { size: 9, family: 'JetBrains Mono' } }
        }
      }
    }
  });
}

function updateChart() {
  if (!telemetryChart) return;
  const datasets = telemetryChart.data.datasets;
  datasets[0].data.shift();
  datasets[0].data.push(state.pitch);

  datasets[1].data.shift();
  datasets[1].data.push(state.moisture);

  telemetryChart.update();
}


// ==========================================
// 3. CLASSIFICATION & EVALUATION
// ==========================================
function evaluateSystemStatus() {
  const prevStatus = state.status;

  if (state.pitch >= 15.0 || (state.moisture > 82 && state.pitch >= 9.0) || state.vibration > 0.6) {
    state.status = 'BAHAYA';
  } else if (state.pitch >= 6.0 || state.moisture >= 65 || state.rain > 50) {
    state.status = 'WASPADA';
  } else {
    state.status = 'AMAN';
  }

  if (prevStatus !== state.status) {
    if (state.status === 'BAHAYA') {
      addIncident('P1', `BAHAYA: Deformasi geser lereng terkonfirmasi! (Pitch: ${state.pitch.toFixed(1)}°, Getar: ${state.vibration.toFixed(2)}g)`);
      SoundEngine.triggerLandslideRumble(1.0);  // Suara Gemuruh Runtuhan Tanah
      SoundEngine.playESP32Buzzer('critical'); // Alarm Sensor di Alat ESP32
      SoundEngine.updateSiren('BAHAYA');       // Sirene Alarm Evakuasi
    } else if (state.status === 'WASPADA') {
      addIncident('P2', `WASPADA: Tingkat kejenuhan tanah melampaui ambang batas (${state.moisture}%) dan terdeteksi deformasi mikro.`);
      SoundEngine.triggerLandslideRumble(0.45); // Suara Retakan Mikro Tanah
      SoundEngine.playESP32Buzzer('warning');  // Beep Peringatan Sensor di Alat
      SoundEngine.updateSiren('WASPADA');      // Peringatan Intermiten
      state.leadTimeSeconds = 1;
    } else if (state.status === 'AMAN') {
      addIncident('INFO', `STATUS NORMAL: Lereng maket stabil kembali (Pitch: ${state.pitch.toFixed(1)}°).`);
      SoundEngine.playESP32Buzzer('info');
      SoundEngine.updateSiren('AMAN');
      state.leadTimeSeconds = 0;
    }
  }

  if (rainParticles) rainParticles.visible = state.rain > 0;
  updateDOMUI();
}

function updateDOMUI() {
  document.getElementById('val-pitch').textContent = `${state.pitch.toFixed(1)}°`;
  document.getElementById('val-roll').textContent = `${state.roll.toFixed(1)}°`;
  document.getElementById('val-moisture').textContent = `${state.moisture}%`;
  document.getElementById('bar-moisture').style.width = `${state.moisture}%`;
  document.getElementById('val-rain').textContent = `${state.rain}%`;
  document.getElementById('val-vibe').textContent = `${state.vibration.toFixed(2)}g`;

  const mPitch = document.getElementById('modal-pitch-val');
  if (mPitch) mPitch.textContent = `Pitch: ${state.pitch.toFixed(1)}° | Roll: ${state.roll.toFixed(1)}°`;
  const mMoist = document.getElementById('modal-moist-val');
  if (mMoist) mMoist.textContent = `${state.moisture}%`;

  const tiltRate = (state.status === 'BAHAYA') ? '2.45°/s' : (state.status === 'WASPADA') ? '0.40°/s' : '0.04°/s';
  document.getElementById('val-tilt-rate').textContent = tiltRate;
  document.getElementById('val-spray-status').textContent = state.rain > 0 ? `Aktif (${state.rain}%)` : 'Off';

  const cardAlert = document.getElementById('card-alert');
  const badgeP = document.getElementById('badge-alert-p');
  const textAlert = document.getElementById('text-alert-status');
  const textDesc = document.getElementById('text-alert-desc');
  const hudShear = document.getElementById('hud-shear-warning');
  const hudNode = document.getElementById('hud-node-status');
  const svgDot = document.getElementById('svg-node-dot');

  cardAlert.classList.remove('border-emerald-600/50', 'border-amber-500/60', 'border-rose-600/60');

  if (state.status === 'BAHAYA') {
    cardAlert.classList.add('border-rose-600/60');
    badgeP.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-800';
    badgeP.textContent = 'P1 - BAHAYA';
    textAlert.className = 'text-xl lg:text-2xl font-bold text-rose-400 tracking-tight';
    textAlert.textContent = 'KERUNTUHAN LERENG';
    textDesc.textContent = 'Peringatan evakuasi: Bidang gelincir aktif runtuh.';
    hudShear.classList.remove('hidden');
    hudNode.textContent = 'NODE-01 (KRITIS)';
    hudNode.className = 'text-rose-400 font-bold';
    if (svgDot) svgDot.setAttribute('fill', '#ef4444');

    document.getElementById('ml-rf-pred').textContent = 'BAHAYA (97.1%)';
    document.getElementById('ml-rf-pred').className = 'text-rose-400 font-bold';
    document.getElementById('ml-base-pred').textContent = 'BAHAYA';
    document.getElementById('ml-base-pred').className = 'text-rose-400 font-bold';
  } else if (state.status === 'WASPADA') {
    cardAlert.classList.add('border-amber-500/60');
    badgeP.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800';
    badgeP.textContent = 'P2 - WASPADA';
    textAlert.className = 'text-xl lg:text-2xl font-bold text-amber-400 tracking-tight';
    textAlert.textContent = 'PERINGATAN DINI';
    textDesc.textContent = 'Infiltrasi air hujan tinggi, retakan mikro terbentuk.';
    hudShear.classList.add('hidden');
    hudNode.textContent = 'NODE-01 (WASPADA)';
    hudNode.className = 'text-amber-400 font-bold';
    if (svgDot) svgDot.setAttribute('fill', '#f59e0b');

    document.getElementById('ml-rf-pred').textContent = 'WASPADA (89.5%)';
    document.getElementById('ml-rf-pred').className = 'text-amber-400 font-bold';
    document.getElementById('ml-base-pred').textContent = 'WASPADA';
    document.getElementById('ml-base-pred').className = 'text-amber-400 font-bold';
  } else {
    cardAlert.classList.add('border-emerald-600/50');
    badgeP.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800';
    badgeP.textContent = 'P0 - AMAN';
    textAlert.className = 'text-xl lg:text-2xl font-bold text-emerald-400 tracking-tight';
    textAlert.textContent = 'KONDISI STABIL';
    textDesc.textContent = 'Tidak ada deformasi geser aktif.';
    hudShear.classList.add('hidden');
    hudNode.textContent = 'NODE-01 (STABIL)';
    hudNode.className = 'text-emerald-400 font-bold';
    if (svgDot) svgDot.setAttribute('fill', '#10b981');

    document.getElementById('ml-rf-pred').textContent = 'AMAN (96.8%)';
    document.getElementById('ml-rf-pred').className = 'text-emerald-400 font-bold';
    document.getElementById('ml-base-pred').textContent = 'AMAN';
    document.getElementById('ml-base-pred').className = 'text-emerald-400 font-bold';
  }

  // Moisture indicator
  const mCond = document.getElementById('text-moisture-condition');
  const bMoist = document.getElementById('badge-soil-status');
  if (state.moisture >= 75) {
    mCond.textContent = 'Jenuh Air';
    mCond.className = 'text-rose-400';
    bMoist.textContent = 'JENUH';
    bMoist.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-400 border border-rose-800';
  } else if (state.moisture >= 55) {
    mCond.textContent = 'Mendekati Jenuh';
    mCond.className = 'text-amber-400';
    bMoist.textContent = 'LEMBAP';
    bMoist.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-400 border border-amber-800';
  } else {
    mCond.textContent = 'Normal / Kering';
    mCond.className = 'text-slate-200';
    bMoist.textContent = 'OPTIMAL';
    bMoist.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-sky-400 border border-slate-700';
  }

  // Sync Slider values in UI
  document.getElementById('slider-pitch').value = state.pitch;
  document.getElementById('slider-pitch-val').textContent = `${state.pitch.toFixed(1)}°`;
  document.getElementById('slider-moist').value = state.moisture;
  document.getElementById('slider-moist-val').textContent = `${state.moisture}%`;
  document.getElementById('slider-rain').value = state.rain;
  document.getElementById('slider-rain-val').textContent = `${state.rain}%`;
  document.getElementById('slider-vibe').value = state.vibration;
  document.getElementById('slider-vibe-val').textContent = `${state.vibration.toFixed(2)}g`;
}


// ==========================================
// 4. INCIDENT LOG & DISPATCH
// ==========================================
function addIncident(severity, text) {
  const feed = document.getElementById('incident-feed');
  if (!feed) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const item = document.createElement('div');
  item.className = 'p-2 rounded bg-[#090c14] border border-slate-800 flex items-start justify-between space-x-2 transition hover:border-slate-700';

  let badgeColor = 'bg-slate-800 text-sky-400 border-slate-700';
  if (severity === 'P1') badgeColor = 'bg-rose-950 text-rose-400 border-rose-800';
  if (severity === 'P2') badgeColor = 'bg-amber-950 text-amber-400 border-amber-800';

  item.innerHTML = `
    <div class="flex-1">
      <div class="flex items-center space-x-2 mb-0.5">
        <span class="px-1 py-0.2 rounded text-[9px] font-mono font-bold border ${badgeColor}">${severity}</span>
        <span class="text-[10px] font-mono text-slate-500">${timeStr}</span>
      </div>
      <p class="text-[11px] text-slate-300 leading-tight">${text}</p>
    </div>
    <button onclick="ackSingle(this)" class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0">
      Ack
    </button>
  `;

  feed.prepend(item);
  if (feed.children.length > 20) feed.removeChild(feed.lastChild);
}

function ackSingle(btn) {
  btn.textContent = '✓ Ok';
  btn.classList.add('text-emerald-400', 'border-emerald-800');
  btn.disabled = true;
}

function acknowledgeCurrentAlert() {
  addIncident('INFO', `Operator mengonfirmasi status peringatan ${state.status}.`);
  closeDeviceModal();
}

function clearIncidentLog() {
  document.getElementById('incident-feed').innerHTML = '';
}


// ==========================================
// 5. SCENARIO PRESETS & AUTO LOOP
// ==========================================
function applyScenario(scenarioName) {
  if (scenarioName === 'normal') {
    state.pitch = 2.0;
    state.roll = 0.5;
    state.moisture = 30;
    state.rain = 0;
    state.vibration = 0.02;
    state.leadTimeSeconds = 0;
  } else if (scenarioName === 'rain') {
    state.pitch = 7.5;
    state.roll = 1.2;
    state.moisture = 72;
    state.rain = 75;
    state.vibration = 0.08;
  } else if (scenarioName === 'collapse') {
    state.pitch = 22.5;
    state.roll = 3.5;
    state.moisture = 90;
    state.rain = 95;
    state.vibration = 0.85;
  }
  SoundEngine.updateRain(state.rain);
  evaluateSystemStatus();
}

function manualSliderChange() {
  state.pitch = parseFloat(document.getElementById('slider-pitch').value);
  state.moisture = parseInt(document.getElementById('slider-moist').value);
  state.rain = parseInt(document.getElementById('slider-rain').value);
  state.vibration = parseFloat(document.getElementById('slider-vibe').value);
  SoundEngine.updateRain(state.rain);
  evaluateSystemStatus();
}

function toggleAutoDemo() {
  state.autoLoop = !state.autoLoop;
  const btn = document.getElementById('btn-auto-loop');
  if (state.autoLoop) {
    btn.className = 'px-2.5 py-1 rounded bg-rose-800 text-white border border-rose-600 text-xs font-medium transition';
    btn.textContent = '⏹ Stop Loop';
    startAutoLoop();
  } else {
    btn.className = 'px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 text-xs font-medium transition';
    btn.textContent = '▶ Auto-Loop Demo';
    clearInterval(state.autoLoopTimer);
  }
}

function startAutoLoop() {
  let step = 0;
  state.autoLoopTimer = setInterval(() => {
    step = (step + 1) % 40;
    if (step < 12) {
      state.pitch = 2.0 + Math.sin(step) * 0.2;
      state.moisture = 30 + step;
      state.rain = 0;
      state.vibration = 0.02;
    } else if (step < 28) {
      state.rain = 80;
      state.moisture = 55 + (step - 12) * 1.8;
      state.pitch = 4.0 + (step - 12) * 0.45;
      state.vibration = 0.06 + Math.random() * 0.04;
    } else {
      state.rain = 95;
      state.moisture = 88;
      state.pitch = 18.0 + Math.random() * 4;
      state.vibration = 0.75 + Math.random() * 0.2;
    }
    SoundEngine.updateRain(state.rain);
    evaluateSystemStatus();
  }, 1000);
}


// ==========================================
// 6. UI ACTIONS & MODALS
// ==========================================
function openDeviceModal() {
  document.getElementById('device-modal').classList.remove('hidden');
}

function closeDeviceModal() {
  document.getElementById('device-modal').classList.add('hidden');
}

function calibrateSensorZero() {
  state.pitch = 0.0;
  state.roll = 0.0;
  evaluateSystemStatus();
  addIncident('INFO', 'Kalibrasi nol MPU6050 tersimpan.');
}

// Wireframe toggle
document.getElementById('btn-toggle-wire').addEventListener('click', () => {
  state.wireframe = !state.wireframe;
  if (subsoilMesh) subsoilMesh.material.wireframe = state.wireframe;
  if (slidingSoilWedge) slidingSoilWedge.material.wireframe = state.wireframe;
  if (bedrockMesh) bedrockMesh.material.wireframe = state.wireframe;
});

// Reset Camera
document.getElementById('btn-reset-cam').addEventListener('click', () => {
  setCameraView('iso');
});

// Tabs: 3D vs 2D
const tab3D = document.getElementById('tab-3d');
const tab2D = document.getElementById('tab-2d');
const cont3D = document.getElementById('three-container');
const cont2D = document.getElementById('twod-container');
const threeControls = document.getElementById('three-controls');

tab3D.addEventListener('click', () => {
  tab3D.className = 'px-2.5 py-1 rounded text-xs font-medium bg-slate-800 text-sky-400 border border-slate-700 transition';
  tab2D.className = 'px-2.5 py-1 rounded text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition';
  cont3D.classList.remove('hidden');
  cont2D.classList.add('hidden');
  threeControls.classList.remove('hidden');
});

tab2D.addEventListener('click', () => {
  tab2D.className = 'px-2.5 py-1 rounded text-xs font-medium bg-slate-800 text-sky-400 border border-slate-700 transition';
  tab3D.className = 'px-2.5 py-1 rounded text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition';
  cont3D.classList.add('hidden');
  cont2D.classList.remove('hidden');
  threeControls.classList.add('hidden');
});

// Sound Toggle (Hujan, Gemuruh, Sirene, Sensor Piezo)
const btnSound = document.getElementById('btn-sound');
if (btnSound) {
  btnSound.addEventListener('click', () => {
    const isNowActive = SoundEngine.toggleMute();
    document.getElementById('sound-icon').textContent = isNowActive ? '🔊' : '🔇';
    document.getElementById('sound-label').textContent = isNowActive ? 'Audio: Aktif' : 'Audio: Mute';
    btnSound.classList.toggle('text-rose-400', !isNowActive);
    btnSound.classList.toggle('bg-rose-950/40', !isNowActive);
    if (isNowActive) {
      SoundEngine.playESP32Buzzer('click');
    }
  });
}

// Unlock Web Audio on first user interaction anywhere
['click', 'touchstart', 'keydown'].forEach(evtType => {
  window.addEventListener(evtType, () => {
    SoundEngine.resume();
  }, { once: true });
});

// Fullscreen
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// Toggle Demo Controller
document.getElementById('btn-toggle-demo').addEventListener('click', () => {
  const dock = document.getElementById('demo-controller');
  dock.classList.toggle('translate-y-full');
});


// ==========================================
// 7. INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  initTelemetryChart();
  evaluateSystemStatus();

  addIncident('INFO', 'Mikrokontroler ESP32 DOIT DevKit V1 aktif.');
  addIncident('INFO', 'Flume Akrilik Transparan HD & Kalibrasi MPU6050 siap.');

  setInterval(() => {
    const now = new Date();
    document.getElementById('live-clock').textContent = now.toTimeString().split(' ')[0] + ' WIB';

    if (state.status === 'WASPADA' || state.status === 'BAHAYA') {
      state.leadTimeSeconds++;
      document.getElementById('val-leadtime').textContent = `${state.leadTimeSeconds}s`;
    }

    if (!state.autoLoop) {
      const jitterP = (Math.random() - 0.5) * 0.08;
      const jitterR = (Math.random() - 0.5) * 0.05;
      state.pitch = Math.max(0, state.pitch + jitterP);
      state.roll = Math.max(0, state.roll + jitterR);
    }

    updateChart();
  }, 1000);
});

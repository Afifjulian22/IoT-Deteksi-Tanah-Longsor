/**
 * Sistem Telemetri & Deteksi Dini Longsor (Digital Twin 3D)
 * Laboratorium Geoteknik & IoT ESP32 - BPBD Purbalingga
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
  audioCtx: null
};

// Procedural Texture Generator for Soil & Rocks (Zero External Assets)
function createSoilTexture(baseHex, noiseAlpha) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Generate granular speckles / earth texture
  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseAlpha;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// Web Audio API Synthesizer (Crisp Technical Beeps)
function playBuzzerSound(type) {
  if (!state.isBuzzerActive) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!state.audioCtx) state.audioCtx = new AudioContext();
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();

    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);

    if (type === 'P1') { // Alarm Kritis Bahaya
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, state.audioCtx.currentTime);
      osc.frequency.setValueAtTime(400, state.audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(state.audioCtx.currentTime + 0.3);
    } else if (type === 'P2') { // Beep Peringatan Waspada
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.18);
      osc.start();
      osc.stop(state.audioCtx.currentTime + 0.18);
    }
  } catch (e) {
    console.warn('AudioContext requires interaction:', e);
  }
}

// ==========================================
// 1. THREE.JS REALISTIC GEOTECHNICAL SCENE
// ==========================================
let scene, camera, renderer, controls;
let slopeGroup, slidingSoilWedge, bedrockMesh, subsoilMesh;
let sensorStakeMesh, sensorLedMesh;
let rainParticles, rainGeometry;
let failureTensionCrack;

function initThreeJS() {
  const container = document.getElementById('three-container');
  if (!container) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d14);

  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(7.5, 5.0, 7.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2;
  controls.target.set(0, 1.0, 0);

  // Soft Studio Lighting
  const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
  mainLight.position.set(6, 12, 8);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 1024;
  mainLight.shadow.mapSize.height = 1024;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
  fillLight.position.set(-6, 4, -4);
  scene.add(fillLight);

  // Lab Coordinate Floor Grid
  const grid = new THREE.GridHelper(12, 24, 0x334155, 0x1e293b);
  grid.position.y = 0;
  scene.add(grid);

  // Build the Realistic Slope Model
  buildRealisticSlope();

  // Build Rain System
  buildRainSystem();

  window.addEventListener('resize', onWindowResize);
  animate();
}

function buildRealisticSlope() {
  slopeGroup = new THREE.Group();
  scene.add(slopeGroup);

  // Textures
  const humusTex = createSoilTexture('#453123', 45);
  const clayTex = createSoilTexture('#6b4c35', 35);
  const baseTex = createSoilTexture('#1e293b', 20);

  // 1. Bedrock / Bottom acrylic testbed base plate
  const baseGeo = new THREE.BoxGeometry(5.2, 0.3, 2.6);
  const baseMat = new THREE.MeshStandardMaterial({
    map: baseTex,
    color: 0x272e3d,
    roughness: 0.8
  });
  bedrockMesh = new THREE.Mesh(baseGeo, baseMat);
  bedrockMesh.position.set(0, 0.15, 0);
  bedrockMesh.receiveShadow = true;
  slopeGroup.add(bedrockMesh);

  // 2. Stable Lower Subsoil (Inclined slope ramp)
  // Create slope prism geometry using ExtrudeGeometry for natural slope angle (~30°)
  const slopeShape = new THREE.Shape();
  // Shape on XY plane:
  // Starts at toe (x: 2.2, y: 0.3) -> bottom left (x: -2.2, y: 0.3) -> crest (x: -2.2, y: 1.6) -> top flat -> slope face down
  slopeShape.moveTo(-2.3, 0.3);
  slopeShape.lineTo(2.3, 0.3);       // toe
  slopeShape.lineTo(2.3, 0.55);      // toe lip
  slopeShape.lineTo(0.5, 1.25);      // lower face
  slopeShape.lineTo(-1.2, 1.75);     // crest
  slopeShape.lineTo(-2.3, 1.75);     // back crest
  slopeShape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: 2.2,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3
  };

  const subsoilGeo = new THREE.ExtrudeGeometry(slopeShape, extrudeSettings);
  subsoilGeo.center(); // centers geometry
  const subsoilMat = new THREE.MeshStandardMaterial({
    map: clayTex,
    color: 0x5a3e2b,
    roughness: 0.9
  });
  subsoilMesh = new THREE.Mesh(subsoilGeo, subsoilMat);
  subsoilMesh.position.set(0, 1.05, 0);
  subsoilMesh.castShadow = true;
  subsoilMesh.receiveShadow = true;
  slopeGroup.add(subsoilMesh);

  // 3. Upper Active Sliding Soil Wedge (The mass that breaks and slides!)
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-1.2, 1.75);
  wedgeShape.lineTo(0.5, 1.25);
  wedgeShape.lineTo(0.4, 1.65);
  wedgeShape.lineTo(-1.1, 2.15);
  wedgeShape.closePath();

  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    steps: 1,
    depth: 2.0,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2
  });
  wedgeGeo.center();

  const wedgeMat = new THREE.MeshStandardMaterial({
    map: humusTex,
    color: 0x6e472a,
    roughness: 0.85
  });
  slidingSoilWedge = new THREE.Mesh(wedgeGeo, wedgeMat);
  slidingSoilWedge.position.set(-0.35, 1.85, 0);
  slidingSoilWedge.castShadow = true;
  slidingSoilWedge.receiveShadow = true;
  slopeGroup.add(slidingSoilWedge);

  // Top Natural Vegetation / Soil Crust
  const turfGeo = new THREE.BoxGeometry(2.1, 0.04, 2.05);
  const turfMat = new THREE.MeshStandardMaterial({
    color: 0x22543d,
    roughness: 0.95
  });
  const turfMesh = new THREE.Mesh(turfGeo, turfMat);
  turfMesh.position.set(-0.05, 0.28, 0);
  turfMesh.rotation.z = -0.32; // match slope inclination
  slidingSoilWedge.add(turfMesh);

  // 4. Physical Realistic IoT Sensor Node
  const stakeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.65, 16);
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  sensorStakeMesh = new THREE.Mesh(stakeGeo, stakeMat);
  sensorStakeMesh.position.set(0.1, 0.5, 0.2);
  sensorStakeMesh.castShadow = true;
  slidingSoilWedge.add(sensorStakeMesh);

  // IP67 Weatherproof Box Enclosure
  const boxGeo = new THREE.BoxGeometry(0.18, 0.14, 0.12);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const boxMesh = new THREE.Mesh(boxGeo, boxMat);
  boxMesh.position.y = 0.32;
  sensorStakeMesh.add(boxMesh);

  // External Whip Antenna
  const antGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8);
  const antMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.9 });
  const antMesh = new THREE.Mesh(antGeo, antMat);
  antMesh.position.set(0.06, 0.48, 0);
  sensorStakeMesh.add(antMesh);

  // Status LED Beacon on Box
  const ledGeo = new THREE.SphereGeometry(0.03, 16, 16);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  sensorLedMesh = new THREE.Mesh(ledGeo, ledMat);
  sensorLedMesh.position.set(0, 0.35, 0.065);
  sensorStakeMesh.add(sensorLedMesh);

  // 5. Tension Failure Crack Line (Exposed scarp)
  const crackCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.25, 1.78, -1.0),
    new THREE.Vector3(-1.20, 1.77, -0.3),
    new THREE.Vector3(-1.26, 1.79, 0.4),
    new THREE.Vector3(-1.22, 1.76, 1.0)
  ]);
  const crackGeo = new THREE.TubeGeometry(crackCurve, 20, 0.015, 6, false);
  const crackMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  failureTensionCrack = new THREE.Mesh(crackGeo, crackMat);
  failureTensionCrack.visible = false;
  slopeGroup.add(failureTensionCrack);

  // 6. Transparent Acrylic Flume Outer Walls
  const flumeMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.12,
    roughness: 0.05,
    transmission: 0.92,
    thickness: 0.4
  });
  const flumeGeo = new THREE.BoxGeometry(5.4, 2.5, 2.7);
  const flumeMesh = new THREE.Mesh(flumeGeo, flumeMat);
  flumeMesh.position.y = 1.35;
  slopeGroup.add(flumeMesh);
}

function buildRainSystem() {
  const count = 350;
  rainGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 5.2;
    positions[i + 1] = Math.random() * 4 + 1.2;
    positions[i + 2] = (Math.random() - 0.5) * 2.5;
  }

  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.035,
    transparent: true,
    opacity: 0.75
  });

  rainParticles = new THREE.Points(rainGeometry, mat);
  rainParticles.visible = false;
  scene.add(rainParticles);
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

  if (slopeGroup) {
    // Rotation tilts the slope directly from pitch & roll telemetry
    const targetPitch = THREE.MathUtils.degToRad(state.pitch);
    const targetRoll = THREE.MathUtils.degToRad(state.roll);

    slopeGroup.rotation.z = THREE.MathUtils.lerp(slopeGroup.rotation.z, targetPitch, 0.1);
    slopeGroup.rotation.x = THREE.MathUtils.lerp(slopeGroup.rotation.x, targetRoll, 0.1);

    // Dynamic Geotechnical Failure Simulation
    if (state.status === 'BAHAYA') {
      // The upper soil wedge shears and slides down the slip surface!
      slidingSoilWedge.position.x = THREE.MathUtils.lerp(slidingSoilWedge.position.x, 0.45, 0.08);
      slidingSoilWedge.position.y = THREE.MathUtils.lerp(slidingSoilWedge.position.y, 1.45, 0.08);
      slidingSoilWedge.rotation.z = THREE.MathUtils.lerp(slidingSoilWedge.rotation.z, -0.18, 0.08);
      failureTensionCrack.visible = true;
    } else if (state.status === 'WASPADA') {
      // Subtle micro-shear displacement
      slidingSoilWedge.position.x = THREE.MathUtils.lerp(slidingSoilWedge.position.x, -0.25, 0.05);
      slidingSoilWedge.position.y = THREE.MathUtils.lerp(slidingSoilWedge.position.y, 1.80, 0.05);
      failureTensionCrack.visible = (Math.sin(time * 6) > 0);
    } else {
      // Stable undisturbed resting state
      slidingSoilWedge.position.x = THREE.MathUtils.lerp(slidingSoilWedge.position.x, -0.35, 0.1);
      slidingSoilWedge.position.y = THREE.MathUtils.lerp(slidingSoilWedge.position.y, 1.85, 0.1);
      slidingSoilWedge.rotation.z = THREE.MathUtils.lerp(slidingSoilWedge.rotation.z, 0, 0.1);
      failureTensionCrack.visible = false;
    }
  }

  // LED Beacon on sensor
  if (sensorLedMesh) {
    if (state.status === 'BAHAYA') {
      sensorLedMesh.material.color.setHex(0xef4444);
      sensorLedMesh.visible = Math.sin(time * 12) > 0;
    } else if (state.status === 'WASPADA') {
      sensorLedMesh.material.color.setHex(0xf59e0b);
      sensorLedMesh.visible = Math.sin(time * 6) > 0;
    } else {
      sensorLedMesh.material.color.setHex(0x10b981);
      sensorLedMesh.visible = true;
    }
  }

  // Rain Particles falling
  if (rainParticles && rainParticles.visible) {
    const pos = rainGeometry.attributes.position.array;
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] -= 0.14 * (state.rain / 50 + 0.4);
      if (pos[i] < 0.2) pos[i] = 4.2 + Math.random();
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
      playBuzzerSound('P1');
    } else if (state.status === 'WASPADA') {
      addIncident('P2', `WASPADA: Tingkat kejenuhan tanah melampaui ambang batas (${state.moisture}%) dan terdeteksi deformasi mikro.`);
      playBuzzerSound('P2');
      state.leadTimeSeconds = 1;
    } else if (state.status === 'AMAN') {
      addIncident('INFO', `STATUS NORMAL: Lereng maket stabil kembali (Pitch: ${state.pitch.toFixed(1)}°).`);
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
  evaluateSystemStatus();
}

function manualSliderChange() {
  state.pitch = parseFloat(document.getElementById('slider-pitch').value);
  state.moisture = parseInt(document.getElementById('slider-moist').value);
  state.rain = parseInt(document.getElementById('slider-rain').value);
  state.vibration = parseFloat(document.getElementById('slider-vibe').value);
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
});

// Reset Camera
document.getElementById('btn-reset-cam').addEventListener('click', () => {
  if (camera && controls) {
    camera.position.set(7.5, 5.0, 7.5);
    controls.target.set(0, 1.0, 0);
  }
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

// Sound Toggle
const btnSound = document.getElementById('btn-sound');
btnSound.addEventListener('click', () => {
  state.isBuzzerActive = !state.isBuzzerActive;
  document.getElementById('sound-icon').textContent = state.isBuzzerActive ? '🔔' : '🔕';
  document.getElementById('sound-label').textContent = state.isBuzzerActive ? 'Buzzer: Aktif' : 'Buzzer: Mute';
  btnSound.classList.toggle('text-rose-400', !state.isBuzzerActive);
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
  addIncident('INFO', 'Kalibrasi MPU6050 & Capacitive ADC1 siap.');

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

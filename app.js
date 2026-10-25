/**
 * Virtual Hydraulic & Electrical Laboratory Simulation
 * Đại học Kỹ thuật - Công nghệ Cần Thơ (CTUT)
 * High-precision Circuit Solver, Bézier Wire Engine, and Real-time Hydraulic Physics
 */

// ============================================================================
// 1. GLOBAL STATE & SOUND SYNTHESIZER
// ============================================================================
const state = {
  currentLab: 4,
  mode: 'practice', // 'practice' | 'exam'
  selectedWireColor: '#e63946', // default red (+24V)
  soundEnabled: true,
  guideLinesEnabled: false,

  // Selected source jack for wiring
  selectedJackId: null,

  // List of active wires: { id, fromId, toId, color }
  wires: [],

  // Physical simulation variables
  mainPower: false,
  startPressed: false,
  stopPressed: false,
  sparePressed: false,

  k1CoilActive: false,
  k2CoilActive: false,
  k3CoilActive: false,
  solenoidYActive: false,

  s1Tripped: false, // Pressure switch 30 bar threshold
  pistonPos: 0.0,   // 0.0 (retracted) -> 1.0 (fully extended / pressing workpiece)
  pressureBar: 0.0, // 0 to 35 bar
  throttleRate: 0.5, // 0.2 to 1.0 speed multiplier

  // Buzz Lamp Module & Proximity Sensor state
  lampsActive: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
  buzzerActive: false,
  proxTripped: false,
  proxOutputting: false,

  // Ergonomic Viewport & Scale State
  zoomScale: 1.0,
  fitScreenMode: true,
  sidebarCollapsed: false,

  // Audio Context
  audioCtx: null,
};

// Web Audio API sound generator
function initAudio() {
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audioCtx = new AudioContext();
  }
}

function playClickSound(freq = 800, duration = 0.04) {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + duration);
  } catch (e) {
    console.warn(e);
  }
}

function playRelayClick() {
  playClickSound(1200, 0.03);
  setTimeout(() => playClickSound(600, 0.03), 20);
}

let lastBuzzerBeepTime = 0;
function triggerBuzzerSound() {
  if (!state.soundEnabled || !state.audioCtx) return;
  const now = Date.now();
  if (now - lastBuzzerBeepTime > 240) {
    lastBuzzerBeepTime = now;
    playClickSound(2400, 0.12);
  }
}

// ============================================================================
// 2. DOM ELEMENTS & INITIALIZATION
// ============================================================================
const dom = {
  viewport: document.getElementById('bench-viewport'),
  cablesSvg: document.getElementById('cables-svg'),
  hardwareLayout: document.getElementById('bench-hardware'),

  labSelect: document.getElementById('lab-select'),
  modePracticeBtn: document.getElementById('btn-mode-practice'),
  modeExamBtn: document.getElementById('btn-mode-exam'),

  checkWiringBtn: document.getElementById('btn-check-wiring'),
  autoWireBtn: document.getElementById('btn-auto-wire'),
  clearWiresBtn: document.getElementById('btn-clear-wires'),
  toggleSoundBtn: document.getElementById('btn-toggle-sound'),
  soundIcon: document.getElementById('sound-icon'),
  toggleGuideBtn: document.getElementById('btn-toggle-guide-lines'),
  zoomResetBtn: document.getElementById('btn-zoom-reset'),

  wireColors: document.querySelectorAll('.color-btn'),
  wireCountDisplay: document.getElementById('wire-count'),
  systemStatusDot: document.getElementById('system-status-dot'),
  systemStatusText: document.getElementById('system-status-text'),
  diagnosticLog: document.getElementById('diagnostic-log'),

  // Hardware controls
  mainPowerSwitch: document.getElementById('main-power-switch'),
  powerSwitchText: document.getElementById('power-switch-text'),
  voltmeterNeedle: document.getElementById('voltmeter-needle'),

  btnStart: document.getElementById('phys-btn-start'),
  btnStop: document.getElementById('phys-btn-stop'),
  btnYellow: document.getElementById('phys-btn-yellow'),

  ledK1: document.getElementById('led-k1'),
  ledK2: document.getElementById('led-k2'),
  ledK3: document.getElementById('led-k3'),
  ledSolenoidY: document.getElementById('led-solenoid-y'),
  valveStateBadge: document.getElementById('valve-state-badge'),
  ledPswitch: document.getElementById('led-pswitch'),

  gaugeNeedle: document.getElementById('gauge-needle-group'),
  gaugePressureNum: document.getElementById('gauge-pressure-num'),
  throttleKnob: document.getElementById('throttle-knob'),
  throttleSpeedText: document.getElementById('throttle-speed-text'),

  pistonPuck: document.getElementById('piston-puck'),
  pistonRod: document.getElementById('piston-rod'),
  chamberLeft: document.getElementById('oil-left'),
  chamberRight: document.getElementById('oil-right'),
  workpieceBlock: document.getElementById('workpiece-block'),
  pistonMotionState: document.getElementById('piston-motion-state'),

  // Buzz Lamp Module
  pilotLamp1: document.getElementById('pilot-lamp-1'),
  pilotLamp2: document.getElementById('pilot-lamp-2'),
  pilotLamp3: document.getElementById('pilot-lamp-3'),
  pilotLamp4: document.getElementById('pilot-lamp-4'),
  pilotLamp5: document.getElementById('pilot-lamp-5'),
  pilotLamp6: document.getElementById('pilot-lamp-6'),
  buzzerSounderFace: document.getElementById('buzzer-sounder-face'),
  buzzerWave: document.getElementById('buzzer-wave'),

  // Proximity Sensor B1
  ledProximity: document.getElementById('led-proximity'),
  proxStatusBadge: document.getElementById('prox-status-badge'),

  // Schematics tabs
  tabElecBtn: document.getElementById('tab-elec-btn'),
  tabHydBtn: document.getElementById('tab-hyd-btn'),
  elecSchematicView: document.getElementById('elec-schematic-view'),
  hydSchematicView: document.getElementById('hyd-schematic-view'),

  // Modal
  modalWireGuide: document.getElementById('modal-wire-guide'),
  modalBodyContent: document.getElementById('modal-body-content'),
  btnCloseModal: document.getElementById('btn-close-modal'),

  // Ergonomic Workspace & Toolbar Elements
  sidebarPanel: document.getElementById('sidebar-panel'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  btnCloseSidebar: document.getElementById('btn-close-sidebar'),
  sidebarToggleIcon: document.getElementById('sidebar-toggle-icon'),
  sidebarToggleText: document.getElementById('sidebar-toggle-text'),

  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnFitScreen: document.getElementById('btn-fit-screen'),
  btnToggleFullscreen: document.getElementById('btn-toggle-fullscreen'),
  zoomPercentBadge: document.getElementById('zoom-percent-badge'),
  benchZoomWrapper: document.getElementById('bench-zoom-wrapper'),

  btnQuickAutoWire: document.getElementById('btn-quick-auto-wire'),
  btnQuickCheck: document.getElementById('btn-quick-check'),
};

// ============================================================================
// 3. WIRING ENGINE (INTERACTIVE BÉZIER PATCH CORDS)
// ============================================================================

// Helper: Get Jack center coordinate relative to bench-hardware (accounting for Zoom Scale)
function getJackCoords(jackElement) {
  const rect = jackElement.getBoundingClientRect();
  const parentRect = dom.hardwareLayout.getBoundingClientRect();
  const scale = state.zoomScale || 1.0;
  return {
    x: (rect.left - parentRect.left + rect.width / 2) / scale,
    y: (rect.top - parentRect.top + rect.height / 2) / scale,
  };
}

// Generate smooth sagging Bézier curve path string
function generateCablePath(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);

  // Natural gravity droop (catenary approximation)
  const sag = Math.max(30, dist * 0.22);
  const cp1x = p1.x;
  const cp1y = p1.y + sag;
  const cp2x = p2.x;
  const cp2y = p2.y + sag;

  return `M ${p1.x.toFixed(1)},${p1.y.toFixed(1)} C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
}

// Render all active wires onto the SVG layer
function renderWires() {
  dom.cablesSvg.innerHTML = '';
  const jacks = document.querySelectorAll('.jack');
  const jackMap = {};
  jacks.forEach(j => {
    jackMap[j.dataset.id] = j;
  });

  state.wires.forEach((wire, index) => {
    const el1 = jackMap[wire.fromId];
    const el2 = jackMap[wire.toId];
    if (!el1 || !el2) return;

    const p1 = getJackCoords(el1);
    const p2 = getJackCoords(el2);

    const pathData = generateCablePath(p1, p2);

    // Cable shadow path for 3D realism
    const shadowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shadowPath.setAttribute('d', pathData);
    shadowPath.setAttribute('fill', 'none');
    shadowPath.setAttribute('stroke', 'rgba(0,0,0,0.3)');
    shadowPath.setAttribute('stroke-width', '6');
    shadowPath.setAttribute('stroke-linecap', 'round');
    shadowPath.setAttribute('transform', 'translate(1, 3)');
    dom.cablesSvg.appendChild(shadowPath);

    // Main Cable path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', wire.color);
    path.setAttribute('stroke-width', '4.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('data-wire-index', index);
    path.setAttribute('title', `Dây cắm: ${wire.fromId} ⮂ ${wire.toId} (Nhấp để xóa)`);

    // Click on cable to unplug/delete it
    path.addEventListener('click', (e) => {
      e.stopPropagation();
      removeWire(index);
    });

    dom.cablesSvg.appendChild(path);
  });

  dom.wireCountDisplay.textContent = state.wires.length;
}

// Handle Jack Click
function handleJackClick(jackEl) {
  initAudio();
  const jackId = jackEl.dataset.id;
  const jackLabel = jackEl.dataset.label || jackId;

  // If no source jack selected yet, select this as source
  if (!state.selectedJackId) {
    state.selectedJackId = jackId;
    jackEl.classList.add('selected-source');
    logDiagnostic(`📌 Đã chọn cọc: <strong>${jackLabel}</strong>. Bây giờ hãy nhấp vào cọc đích để nối dây.`, 'info');
    playClickSound(950, 0.05);
    return;
  }

  // If clicking the same jack, deselect it
  if (state.selectedJackId === jackId) {
    state.selectedJackId = null;
    jackEl.classList.remove('selected-source');
    logDiagnostic(`Đã hủy chọn cọc ${jackLabel}.`, 'info');
    return;
  }

  // Check if wire already exists between these 2 jacks
  const exists = state.wires.some(w =>
    (w.fromId === state.selectedJackId && w.toId === jackId) ||
    (w.fromId === jackId && w.toId === state.selectedJackId)
  );

  if (exists) {
    logDiagnostic(`⚠️ Hai cọc này đã được nối dây từ trước!`, 'warn');
    clearJackSelection();
    return;
  }

  // Create new wire
  const newWire = {
    id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    fromId: state.selectedJackId,
    toId: jackId,
    color: state.selectedWireColor,
  };

  state.wires.push(newWire);
  playClickSound(550, 0.08);

  const srcEl = document.querySelector(`.jack[data-id="${state.selectedJackId}"]`);
  const srcLabel = srcEl ? (srcEl.dataset.label || state.selectedJackId) : state.selectedJackId;
  logDiagnostic(`🔌 Đã cắm dây nối: <strong>${srcLabel}</strong> ⮂ <strong>${jackLabel}</strong>`, 'info');

  clearJackSelection();
  renderWires();
}

function clearJackSelection() {
  state.selectedJackId = null;
  document.querySelectorAll('.jack.selected-source').forEach(el => el.classList.remove('selected-source'));
  const tempPath = document.getElementById('temp-cable');
  if (tempPath) tempPath.remove();
}

// Rubber-band live cable while dragging / connecting
function updateTempCable(mousePos) {
  if (!state.selectedJackId) return;
  const srcEl = document.querySelector(`.jack[data-id="${state.selectedJackId}"]`);
  if (!srcEl) return;

  let tempPath = document.getElementById('temp-cable');
  if (!tempPath) {
    tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('id', 'temp-cable');
    tempPath.setAttribute('fill', 'none');
    tempPath.setAttribute('stroke-width', '4');
    tempPath.setAttribute('stroke-dasharray', '6, 4');
    tempPath.setAttribute('pointer-events', 'none');
    dom.cablesSvg.appendChild(tempPath);
  }

  const p1 = getJackCoords(srcEl);
  const p2 = mousePos;
  tempPath.setAttribute('stroke', state.selectedWireColor);
  tempPath.setAttribute('d', generateCablePath(p1, p2));
}

function removeWire(index) {
  if (index >= 0 && index < state.wires.length) {
    const w = state.wires[index];
    state.wires.splice(index, 1);
    playClickSound(400, 0.05);
    logDiagnostic(`✂️ Đã rút dây nối giữa ${w.fromId} và ${w.toId}.`, 'warn');
    renderWires();
  }
}

function clearAllWires() {
  if (state.wires.length === 0) return;
  state.wires = [];
  clearJackSelection();
  renderWires();
  playClickSound(300, 0.1);
  logDiagnostic(`🗑️ Đã rút toàn bộ dây trên bảng thực hành!`, 'warn');
}

// Log Diagnostic message to panel
function logDiagnostic(msg, type = 'info') {
  const item = document.createElement('div');
  item.className = `log-item ${type}`;
  item.innerHTML = msg;
  dom.diagnosticLog.appendChild(item);
  dom.diagnosticLog.scrollTop = dom.diagnosticLog.scrollHeight;
}

// ============================================================================
// 4. CIRCUIT GRAPH SOLVER & STEP-BY-STEP VERIFIER FOR LAB 4
// ============================================================================

/**
 * Standard ideal wiring connections for Lab 4 using the realistic TPA Modules:
 * - VCC (+V) Bus across top rail
 * - GND (-V) Bus across bottom rail
 * - Pushbuttons: PB1 (STOP), PB2 (RESET), PB3 (START) with C, NC, NO
 * - Relays: RL1, RL2, RL3 exactly matching the 8-pin TPA panel layout:
 *   Coil (8 +, 1 -), Contact 1 (COM 3, NC 2, NO 4), Contact 2 (COM 6, NC 7, NO 5)
 */
const IDEAL_LAB_4_WIRES = [
  { fromId: 'BTN_VCC_5', toId: 'PB3_C', color: '#e63946', desc: 'Cấp +24V từ hàng VCC vào chân chung C của nút START (PB3)' },
  { fromId: 'RLY_VCC_1', toId: 'RL1_3', color: '#e63946', desc: 'Cấp +24V từ hàng VCC vào chân chung 3 của tiếp điểm duy trì RL1' },
  { fromId: 'PB3_NO', toId: 'RL1_4', color: '#f4a261', desc: 'Đấu song song chân NO của nút START (PB3) với chân NO 4 của RL1 (tự giữ)' },
  { fromId: 'PB3_NO', toId: 'Y_1', color: '#2a9d8f', desc: 'Cấp nguồn điều khiển từ cụm START/RL1 sang Cuộn van điện từ Y (+)' },
  { fromId: 'PB3_NO', toId: 'PB1_C', color: '#f4a261', desc: 'Đưa tín hiệu từ START/RL1 sang chân chung C của nút dừng STOP (PB1)' },
  { fromId: 'PB1_NC', toId: 'RL2_3', color: '#f4a261', desc: 'Từ chân thường đóng NC của STOP sang chân chung 3 của Rơ le ngắt RL2' },
  { fromId: 'RL2_2', toId: 'RL1_8', color: '#2a9d8f', desc: 'Từ chân thường đóng NC 2 của RL2 vào cuộn hút RL1 chân 8 (+)' },
  { fromId: 'RL1_1', toId: 'RLY_GND_1', color: '#1d3557', desc: 'Nối chân âm cuộn RL1 (chân 1) về hàng GND (-V)' },
  { fromId: 'Y_2', toId: 'BTN_GND_5', color: '#1d3557', desc: 'Nối chân âm Cuộn van Y (-) về hàng GND (-V)' },
  { fromId: 'PWR_VCC_1', toId: 'S1_1', color: '#e63946', desc: 'Cấp nguồn +24V từ hàng VCC vào Công tắc áp suất S1 (cực V+)' },
  { fromId: 'S1_2', toId: 'RL2_8', color: '#f4a261', desc: 'Từ đầu ra S1 (cực V-) vào cuộn hút RL2 chân 8 (+)' },
  { fromId: 'RL2_1', toId: 'RLY_GND_2', color: '#1d3557', desc: 'Nối chân âm cuộn RL2 (chân 1) về hàng GND (-V)' },
];

// Disjoint-set / Graph Adjacency builder
function buildNetworkGraph(extraSwitches = {}) {
  const adj = {};
  function addEdge(u, v) {
    if (!u || !v) return;
    if (!adj[u]) adj[u] = new Set();
    if (!adj[v]) adj[v] = new Set();
    adj[u].add(v);
    adj[v].add(u);
  }

  // 1. All VCC (+V) Bus jacks are internally connected together across all modules
  const vccJacks = [
    'PWR_VCC_1', 'PWR_VCC_2', 'PWR_VCC_3',
    'BTN_VCC_1', 'BTN_VCC_2', 'BTN_VCC_3', 'BTN_VCC_4', 'BTN_VCC_5',
    'RLY_VCC_1', 'RLY_VCC_2', 'RLY_VCC_3', 'RLY_VCC_4', 'RLY_VCC_5',
    'BUZZ_VCC_1', 'BUZZ_VCC_2', 'BUZZ_VCC_3', 'BUZZ_VCC_4', 'BUZZ_VCC_5',
    'PWR_P1', 'PWR_P2', 'PWR_P3'
  ];
  for (let i = 0; i < vccJacks.length - 1; i++) {
    addEdge(vccJacks[i], vccJacks[i + 1]);
  }

  // 2. All GND (-V) Bus jacks are internally connected together across all modules
  const gndJacks = [
    'PWR_GND_1', 'PWR_GND_2', 'PWR_GND_3',
    'BTN_GND_1', 'BTN_GND_2', 'BTN_GND_3', 'BTN_GND_4', 'BTN_GND_5',
    'RLY_GND_1', 'RLY_GND_2', 'RLY_GND_3', 'RLY_GND_4', 'RLY_GND_5',
    'BUZZ_GND_1', 'BUZZ_GND_2', 'BUZZ_GND_3', 'BUZZ_GND_4', 'BUZZ_GND_5',
    'PWR_N1', 'PWR_N2', 'PWR_N3'
  ];
  for (let i = 0; i < gndJacks.length - 1; i++) {
    addEdge(gndJacks[i], gndJacks[i + 1]);
  }

  // 3. Aliasing between legacy / schematic IDs and physical TPA terminal names
  addEdge('START_3', 'PB3_C');
  addEdge('START_4', 'PB3_NO');
  addEdge('STOP_1', 'PB1_C');
  addEdge('STOP_2', 'PB1_NC');

  // RL1 aliases
  addEdge('RL1_8', 'K1_A1');
  addEdge('RL1_1', 'K1_A2');
  addEdge('RL1_3', 'K1_C');
  addEdge('RL1_3', 'K1_3');
  addEdge('RL1_4', 'K1_NO');
  addEdge('RL1_4', 'K1_4');
  addEdge('RL1_2', 'K1_NC');
  addEdge('RL1_2', 'K1_2');

  // RL2 aliases
  addEdge('RL2_8', 'K2_A1');
  addEdge('RL2_1', 'K2_A2');
  addEdge('RL2_3', 'K2_C');
  addEdge('RL2_3', 'K2_1');
  addEdge('RL2_2', 'K2_NC');
  addEdge('RL2_2', 'K2_2');
  addEdge('RL2_4', 'K2_NO');

  // RL3 aliases
  addEdge('RL3_8', 'K3_A1');
  addEdge('RL3_1', 'K3_A2');
  addEdge('RL3_3', 'K3_C');
  addEdge('RL3_4', 'K3_NO');
  addEdge('RL3_2', 'K3_NC');

  // 4. External physical wires connected by student
  state.wires.forEach(w => {
    addEdge(w.fromId, w.toId);
  });

  // 5. Button Contacts (C, NC, NO)
  // Button PB3 (START):
  if (extraSwitches.start) {
    addEdge('PB3_C', 'PB3_NO');
  } else {
    addEdge('PB3_C', 'PB3_NC');
  }

  // Button PB1 (STOP):
  if (extraSwitches.stopNC !== false) {
    addEdge('PB1_C', 'PB1_NC');
  } else {
    addEdge('PB1_C', 'PB1_NO');
  }

  // Button PB2 (RESET):
  if (extraSwitches.spare) {
    addEdge('PB2_C', 'PB2_NO');
  } else {
    addEdge('PB2_C', 'PB2_NC');
  }

  // 6. Relay Contacts (Matching DPDT 8-pin TPA Relay: Contact 1 = 3-2-4, Contact 2 = 6-7-5)
  // Relay RL1 (K1):
  if (extraSwitches.k1NO) {
    addEdge('RL1_3', 'RL1_4');
    addEdge('RL1_6', 'RL1_5');
  } else {
    addEdge('RL1_3', 'RL1_2');
    addEdge('RL1_6', 'RL1_7');
  }

  // Relay RL2 (K2):
  if (extraSwitches.k2NC !== false) {
    addEdge('RL2_3', 'RL2_2');
    addEdge('RL2_6', 'RL2_7');
  } else {
    addEdge('RL2_3', 'RL2_4');
    addEdge('RL2_6', 'RL2_5');
  }

  // Relay RL3 (K3):
  if (extraSwitches.k3NO) {
    addEdge('RL3_3', 'RL3_4');
    addEdge('RL3_6', 'RL3_5');
  } else {
    addEdge('RL3_3', 'RL3_2');
    addEdge('RL3_6', 'RL3_7');
  }

  // 7. Pressure Switch S1 (Contact 1-2 / V+ to V-):
  if (extraSwitches.s1NO) {
    addEdge('S1_1', 'S1_2');
    addEdge('S1_VCC', 'S1_GND');
    addEdge('S1_VPLUS', 'S1_VMINUS');
  }
  // Pin aliases for S1
  addEdge('S1_1', 'S1_VCC');
  addEdge('S1_1', 'S1_VPLUS');
  addEdge('S1_2', 'S1_GND');
  addEdge('S1_2', 'S1_VMINUS');

  // 8. Proximity Sensor B1 (When powered & target detected, internal PNP connects +V to OUT):
  if (extraSwitches.proxActive) {
    addEdge('PROX_VCC', 'PROX_OUT');
  }

  return adj;
}

// Check connectivity between two nodes in the graph
function isConnected(adj, startNode, targetNode) {
  if (!adj[startNode] || !adj[targetNode]) return false;
  const visited = new Set();
  const queue = [startNode];
  visited.add(startNode);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === targetNode) return true;
    for (const neighbor of adj[cur]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}

// Comprehensive circuit validator
function validateLab4Circuit() {
  const report = {
    valid: true,
    errors: [],
    successes: [],
  };

  const VCC = 'PWR_VCC_1';
  const GND = 'PWR_GND_1';

  // 1. Check for dead short circuit between +24V (VCC) and 0V (GND)!
  const bareAdj = buildNetworkGraph();
  if (isConnected(bareAdj, VCC, GND)) {
    report.valid = false;
    report.errors.push('🔥 CẢNH BÁO NGUY HIỂM: Ngắn mạch trực tiếp (Chập hàng +V vào -V)! Hãy rút ngay dây nối tắt!');
    return report;
  }

  // 2. Check Relay RL1 (K1) circuit
  // With START pressed, STOP unpressed (NC closed), RL2 de-energized (NC 3-2 closed)
  const startAdj = buildNetworkGraph({ start: true, stopNC: true, k2NC: true });
  const k1HasPlus = isConnected(startAdj, VCC, 'RL1_8');
  const k1HasGnd = isConnected(startAdj, GND, 'RL1_1');

  if (!k1HasPlus) {
    report.valid = false;
    report.errors.push('❌ Cuộn RL1 (chân 8 +) chưa nhận được +24V khi nhấn nút START (PB3). Kiểm tra lại dây từ START qua nút STOP (PB1) và tiếp điểm NC (chân 3-2) của RL2.');
  } else {
    report.successes.push('✓ Nhánh kích cuộn Rơ le RL1 (chân 8 +) qua nút START thông mạch.');
  }

  if (!k1HasGnd) {
    report.valid = false;
    report.errors.push('❌ Cuộn RL1 (chân 1 -) chưa được nối về hàng -V / GND.');
  } else {
    report.successes.push('✓ Chân âm RL1 (chân 1 -) đã nối hàng GND.');
  }

  // 3. Check RL1 Self-latching (Duy trì qua chân 3 COM và chân 4 NO của RL1)
  // START released (start: false), RL1 contact closed (k1NO: true), stopNC: true, k2NC: true
  const latchAdj = buildNetworkGraph({ start: false, k1NO: true, stopNC: true, k2NC: true });
  const k1Latched = isConnected(latchAdj, VCC, 'RL1_8');
  if (!k1Latched) {
    report.valid = false;
    report.errors.push('❌ Thiếu tiếp điểm tự duy trì RL1 (chân 3 và chân 4)! Cần cấp +V vào chân 3 của RL1 và nối chân 4 của RL1 song song với chân NO của nút START.');
  } else {
    report.successes.push('✓ Mạch tự duy trì tiếp điểm RL1 (chân 3-4 NO) chính xác.');
  }

  // 4. Check Solenoid Valve Y
  // When RL1 is active, Solenoid Y should get +24V and 0V
  const solHasPlus = isConnected(latchAdj, VCC, 'Y_1');
  const solHasGnd = isConnected(latchAdj, GND, 'Y_2');

  if (!solHasPlus) {
    report.valid = false;
    report.errors.push('❌ Cuộn van điện từ Y (chân +) chưa được cấp nguồn từ cụm START / RL1.');
  } else {
    report.successes.push('✓ Cuộn van Y (+) đã nối thông mạch với nhánh RL1.');
  }

  if (!solHasGnd) {
    report.valid = false;
    report.errors.push('❌ Cuộn van điện từ Y (chân -) chưa nối về hàng -V / GND.');
  } else {
    report.successes.push('✓ Chân van Y (-) đã nối về hàng GND.');
  }

  // 5. Check Pressure Switch S1 & Relay RL2 (K2)
  // When S1 trips (s1NO: true)
  const pressAdj = buildNetworkGraph({ s1NO: true });
  const k2HasPlus = isConnected(pressAdj, VCC, 'RL2_8');
  const k2HasGnd = isConnected(pressAdj, GND, 'RL2_1');

  if (!k2HasPlus) {
    report.valid = false;
    report.errors.push('❌ Cuộn RL2 (chân 8 +) chưa được nối qua Công tắc áp suất S1 (V+ / V-) về hàng +V.');
  } else {
    report.successes.push('✓ Nhánh Công tắc áp suất S1 (V+ / V-) cấp nguồn cho cuộn RL2 (chân 8 +) chính xác.');
  }

  if (!k2HasGnd) {
    report.valid = false;
    report.errors.push('❌ Cuộn RL2 (chân 1 -) chưa nối về hàng -V / GND.');
  } else {
    report.successes.push('✓ Chân âm RL2 (chân 1 -) đã nối hàng GND.');
  }

  // 6. Check RL2 Trip Action (When RL2 energizes, NC 3-2 opens, dropping RL1 and Y)
  const k2TripAdj = buildNetworkGraph({ start: false, k1NO: true, stopNC: true, k2NC: false });
  const k1Cut = !isConnected(k2TripAdj, VCC, 'RL1_8');
  if (!k1Cut) {
    report.valid = false;
    report.errors.push('❌ Tiếp điểm ngắt của RL2 (chân 3 và chân 2 NC) chưa ngắt được cuộn RL1 khi đạt áp suất ép.');
  } else {
    report.successes.push('✓ Tiếp điểm RL2 (chân 3-2 NC) ngắt cuộn RL1 và van Y tự động hoàn hảo.');
  }

  return report;
}

// ============================================================================
// 5. DYNAMIC PHYSICS & HYDRAULIC SIMULATION ENGINE (60 FPS)
// ============================================================================
let simTimer = null;

function startSimulationLoop() {
  if (simTimer) cancelAnimationFrame(simTimer);

  let lastTime = performance.now();

  function update(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;

    stepSimulation(dt);
    renderSimulationView();

    simTimer = requestAnimationFrame(update);
  }

  simTimer = requestAnimationFrame(update);
}

function stepSimulation(dt) {
  // If main power is OFF, immediately turn off all coils & drop pressure
  if (!state.mainPower) {
    state.k1CoilActive = false;
    state.k2CoilActive = false;
    state.solenoidYActive = false;
    state.s1Tripped = false;
    state.buzzerActive = false;
    state.proxOutputting = false;
    for (let i = 1; i <= 6; i++) state.lampsActive[i] = false;
    state.pressureBar = Math.max(0, state.pressureBar - dt * 25);
    return;
  }

  const VCC = 'PWR_VCC_1';
  const GND = 'PWR_GND_1';

  // Build active dynamic circuit graph
  const liveAdj = buildNetworkGraph({
    start: state.startPressed,
    stopNC: !state.stopPressed,
    k1NO: state.k1CoilActive,
    k2NC: !state.k2CoilActive,
    s1NO: state.s1Tripped,
    proxActive: state.proxOutputting,
  });

  // Check short circuit during live run
  if (isConnected(liveAdj, VCC, GND)) {
    // Short circuit tripped power supply breaker!
    state.mainPower = false;
    dom.mainPowerSwitch.classList.remove('on');
    dom.powerSwitchText.textContent = 'TRIP';
    playClickSound(200, 0.3);
    logDiagnostic('🔥 RƠ LE BẢO VỆ NGUỒN ĐÃ NHẢY! Phát hiện ngắn mạch trên bàn thí nghiệm!', 'error');
    return;
  }

  // 1. Solve Relay K1 Coil
  const k1Energized = isConnected(liveAdj, VCC, 'K1_A1') && isConnected(liveAdj, GND, 'K1_A2');
  if (k1Energized !== state.k1CoilActive) {
    state.k1CoilActive = k1Energized;
    if (k1Energized) playRelayClick();
  }

  // 2. Solve Solenoid Valve Y
  const yEnergized = isConnected(liveAdj, VCC, 'Y_1') && isConnected(liveAdj, GND, 'Y_2');
  if (yEnergized !== state.solenoidYActive) {
    state.solenoidYActive = yEnergized;
    if (yEnergized) playClickSound(700, 0.06);
  }

  // 3. Solve Relay K2 Coil
  const k2Energized = isConnected(liveAdj, VCC, 'K2_A1') && isConnected(liveAdj, GND, 'K2_A2');
  if (k2Energized !== state.k2CoilActive) {
    state.k2CoilActive = k2Energized;
    if (k2Energized) playRelayClick();
  }

  // 4. Update Button Lamps (if connected by user)
  const lampPB1 = document.getElementById('lamp-pb1');
  const lampPB2 = document.getElementById('lamp-pb2');
  const lampPB3 = document.getElementById('lamp-pb3');
  if (lampPB1) lampPB1.classList.toggle('active', isConnected(liveAdj, VCC, 'PB1_LP') && isConnected(liveAdj, GND, 'PB1_LN'));
  if (lampPB2) lampPB2.classList.toggle('active', isConnected(liveAdj, VCC, 'PB2_LP') && isConnected(liveAdj, GND, 'PB2_LN'));
  if (lampPB3) lampPB3.classList.toggle('active', isConnected(liveAdj, VCC, 'PB3_LP') && isConnected(liveAdj, GND, 'PB3_LN'));

  // 5. Solve Proximity Sensor B1
  const proxPowered = isConnected(liveAdj, VCC, 'PROX_VCC') && isConnected(liveAdj, GND, 'PROX_GND');
  state.proxTripped = state.pistonPos >= 0.70;
  const isProxOut = proxPowered && state.proxTripped;
  if (isProxOut !== state.proxOutputting) {
    state.proxOutputting = isProxOut;
    if (isProxOut) {
      playClickSound(1100, 0.05);
      logDiagnostic('🎯 [CẢM BIẾN TIỆM CẬN B1]: Đã phát hiện vị trí cần Piston/Phôi!', 'info');
    }
  }

  // 6. Solve Pilot Lamps 1 to 6 (BUZZ LAMP MODULE)
  for (let i = 1; i <= 6; i++) {
    const posId = `LAMP${i}_POS`;
    const negId = `LAMP${i}_NEG`;
    state.lampsActive[i] = isConnected(liveAdj, VCC, posId) && isConnected(liveAdj, GND, negId);
  }

  // 7. Solve Buzzer (BUZZ LAMP MODULE)
  const isBuzzing = isConnected(liveAdj, VCC, 'BUZZ_POS') && isConnected(liveAdj, GND, 'BUZZ_NEG');
  state.buzzerActive = isBuzzing;
  if (isBuzzing) {
    triggerBuzzerSound();
  }

  // 8. Hydraulic Motion & Pressure Dynamics
  const extendSpeed = 0.45 * state.throttleRate; // controlled by throttle valve
  const retractSpeed = 0.65; // fast return by spring/port B

  if (state.solenoidYActive) {
    // Valve 4/2 shifted: Pump flow enters Base chamber (Port A)
    if (state.pistonPos < 0.88) {
      // Piston extending freely towards workpiece
      state.pistonPos += extendSpeed * dt;
      // Normal operating pressure while moving
      state.pressureBar = Math.min(10.0, state.pressureBar + dt * 20);
    } else {
      // Contacting workpiece! Piston is stopped by mechanical resistance
      state.pistonPos = 0.88; // hard stop
      // Pressure surges rapidly as pump deadheads against workpiece
      state.pressureBar = Math.min(32.5, state.pressureBar + dt * 35);

      // Trigger Pressure Switch S1 at 30 bar (3.0 MPa)
      if (state.pressureBar >= 30.0) {
        if (!state.s1Tripped) {
          state.s1Tripped = true;
          playClickSound(1400, 0.08);
          logDiagnostic('⚡ [ÁP SUẤT ĐẠT 30 bar]: Công tắc S1 đóng tiếp điểm ⮂ Kích hoạt Rơ le ngắt K2!', 'success');
        }
      }
    }
  } else {
    // Solenoid Y de-energized: Valve 4/2 spring returns (Port B)
    if (state.pistonPos > 0.0) {
      // Piston retracts
      state.pistonPos = Math.max(0.0, state.pistonPos - retractSpeed * dt);
      state.pressureBar = Math.max(6.0, state.pressureBar - dt * 40);
    } else {
      // Piston fully back at home position
      state.pistonPos = 0.0;
      state.pressureBar = Math.max(2.5, state.pressureBar - dt * 20);
    }

    // Reset Pressure Switch S1 once pressure drops below 26 bar (hysteresis)
    if (state.pressureBar < 26.0 && state.s1Tripped) {
      state.s1Tripped = false;
    }
  }
}

function renderSimulationView() {
  // Power indicator & Voltmeter
  const unoDcOk = document.getElementById('uno-dc-ok-dot');
  if (state.mainPower) {
    dom.voltmeterNeedle.classList.add('powered');
    if (unoDcOk) unoDcOk.classList.add('active');
    dom.systemStatusDot.className = 'status-dot active';
    dom.systemStatusText.textContent = 'NGUỒN 24V ĐANG BẬT';
  } else {
    dom.voltmeterNeedle.classList.remove('powered');
    if (unoDcOk) unoDcOk.classList.remove('active');
    dom.systemStatusDot.className = 'status-dot';
    dom.systemStatusText.textContent = 'SẴN SÀNG (TẮT NGUỒN)';
  }

  // Relay LEDs & Animated Switch Blades (Matching TPA 8-Pin Relay)
  dom.ledK1.classList.toggle('active', state.k1CoilActive);
  dom.ledK2.classList.toggle('active', state.k2CoilActive);

  const armRL1_1 = document.getElementById('arm-rl1-1');
  const armRL1_2 = document.getElementById('arm-rl1-2');
  if (armRL1_1) armRL1_1.classList.toggle('energized', state.k1CoilActive);
  if (armRL1_2) armRL1_2.classList.toggle('energized', state.k1CoilActive);

  const armRL2_1 = document.getElementById('arm-rl2-1');
  const armRL2_2 = document.getElementById('arm-rl2-2');
  if (armRL2_1) armRL2_1.classList.toggle('energized', state.k2CoilActive);
  if (armRL2_2) armRL2_2.classList.toggle('energized', state.k2CoilActive);

  const armRL3_1 = document.getElementById('arm-rl3-1');
  const armRL3_2 = document.getElementById('arm-rl3-2');
  if (armRL3_1) armRL3_1.classList.toggle('energized', state.k3CoilActive);
  if (armRL3_2) armRL3_2.classList.toggle('energized', state.k3CoilActive);

  // Pushbutton Switch Blade Animations (C to NC/NO)
  const bladePB1 = document.getElementById('btn-blade-pb1');
  const bladePB2 = document.getElementById('btn-blade-pb2');
  const bladePB3 = document.getElementById('btn-blade-pb3');
  if (bladePB1) bladePB1.classList.toggle('pressed', state.stopPressed);
  if (bladePB2) bladePB2.classList.toggle('pressed', state.sparePressed);
  if (bladePB3) bladePB3.classList.toggle('pressed', state.startPressed);

  // Solenoid Valve status
  dom.ledSolenoidY.classList.toggle('active', state.solenoidYActive);
  if (state.solenoidYActive) {
    dom.valveStateBadge.textContent = 'VỊ TRÍ 1 (CUỘN Y HÚT - P→A)';
    dom.valveStateBadge.classList.add('active');
  } else {
    dom.valveStateBadge.textContent = 'VỊ TRÍ 0 (LÒ XO HỒI - P→B)';
    dom.valveStateBadge.classList.remove('active');
  }

  // Pressure Switch LED
  dom.ledPswitch.classList.toggle('active', state.s1Tripped);

  // Proximity Sensor LED & Badge
  if (dom.ledProximity) dom.ledProximity.classList.toggle('active', state.proxTripped);
  if (dom.proxStatusBadge) {
    if (state.proxTripped) {
      dom.proxStatusBadge.textContent = '🎯 ĐÃ PHÁT HIỆN PISTON';
      dom.proxStatusBadge.classList.add('active');
    } else {
      dom.proxStatusBadge.textContent = 'CHỜ PHÔI/PISTON';
      dom.proxStatusBadge.classList.remove('active');
    }
  }

  // BUZZ LAMP MODULE: Pilot Lamps (1 to 6)
  for (let i = 1; i <= 6; i++) {
    const el = dom[`pilotLamp${i}`];
    if (el) el.classList.toggle('active', !!state.lampsActive[i]);
  }

  // BUZZ LAMP MODULE: Buzzer Disc & Waves
  if (dom.buzzerSounderFace) dom.buzzerSounderFace.classList.toggle('active', state.buzzerActive);
  if (dom.buzzerWave) dom.buzzerWave.classList.toggle('active', state.buzzerActive);

  // Pressure Gauge needle rotation & digital readout
  // Angle: 0 bar -> -120 deg, 30 bar -> +40 deg, 40 bar -> +90 deg
  const needleAngle = -120 + (state.pressureBar / 40.0) * 210;
  dom.gaugeNeedle.setAttribute('transform', `rotate(${needleAngle.toFixed(1)}, 60, 60)`);
  dom.gaugePressureNum.textContent = state.pressureBar.toFixed(1);

  // Hydraulic Cylinder Visualization
  const maxStrokePx = 180;
  const currentRodWidth = 20 + state.pistonPos * maxStrokePx;
  dom.pistonRod.style.width = `${currentRodWidth}px`;
  dom.pistonPuck.style.left = `${state.pistonPos * 220}px`;

  // Oil fill colors
  dom.chamberLeft.style.width = `${state.pistonPos * 230}px`;
  dom.chamberRight.style.width = `${Math.max(0, (1 - state.pistonPos) * 230)}px`;

  // Workpiece pressed state
  if (state.pistonPos >= 0.87) {
    dom.workpieceBlock.classList.add('pressed');
    dom.pistonMotionState.textContent = `TRẠNG THÁI: ĐANG ÉP PHÔI (P = ${state.pressureBar.toFixed(1)} bar)`;
    dom.pistonMotionState.style.color = '#dc2626';
  } else if (state.solenoidYActive) {
    dom.workpieceBlock.classList.remove('pressed');
    dom.pistonMotionState.textContent = 'TRẠNG THÁI: CẦN XI LANH ĐANG TIẾN RA ÉP...';
    dom.pistonMotionState.style.color = '#0284c7';
  } else if (state.pistonPos > 0.0) {
    dom.workpieceBlock.classList.remove('pressed');
    dom.pistonMotionState.textContent = 'TRẠNG THÁI: CẦN XI LANH ĐANG TỰ ĐỘNG CO VỀ...';
    dom.pistonMotionState.style.color = '#f59e0b';
  } else {
    dom.workpieceBlock.classList.remove('pressed');
    dom.pistonMotionState.textContent = 'TRẠNG THÁI: CO VÀO HẾT (CHỜ LỆNH START)';
    dom.pistonMotionState.style.color = '#334155';
  }
}

// ============================================================================
// 6. AUTO-WIRING & TUTORIAL GUIDE
// ============================================================================
function applyAutoWiring() {
  initAudio();
  state.wires = [];

  IDEAL_LAB_4_WIRES.forEach((w, i) => {
    state.wires.push({
      id: `ideal_${i}`,
      fromId: w.fromId,
      toId: w.toId,
      color: w.color,
    });
  });

  renderWires();
  playRelayClick();
  logDiagnostic('✨ Đã tự động cắm toàn bộ 12 dây mẫu chuẩn cho Bài 4. Hãy bật Nguồn và ấn START để vận hành!', 'success');
}

function showWireGuideModal() {
  dom.modalBodyContent.innerHTML = `
    <p style="margin-bottom: 12px; color: #94a3b8;">
      Bảng danh mục các bước cắm dây chi tiết theo sơ đồ nguyên lý chuẩn (Bài 4):
    </p>
    <table class="step-table">
      <thead>
        <tr>
          <th>Bước</th>
          <th>Cọc Nguồn</th>
          <th>Cọc Đích</th>
          <th>Màu dây</th>
          <th>Mục đích chức năng</th>
        </tr>
      </thead>
      <tbody>
        ${IDEAL_LAB_4_WIRES.map((w, idx) => `
          <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><code>${w.fromId}</code></td>
            <td><code>${w.toId}</code></td>
            <td><span style="display:inline-block; width:12px; height:12px; background:${w.color}; border-radius:50%; vertical-align:middle; margin-right:4px;"></span> ${w.color === '#e63946' ? 'Đỏ (+24V)' : (w.color === '#1d3557' ? 'Đen (0V)' : 'Vàng/Xanh')}</td>
            <td>${w.desc}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  dom.modalWireGuide.style.display = 'flex';
  dom.modalWireGuide.classList.remove('hidden');
}

// ============================================================================
// 7. ERGONOMIC WORKSPACE CONTROLS & AUTO-FIT ENGINE
// ============================================================================

// Wire Color picker helper (synchronizes topbar & sidebar color palettes)
function selectWireColor(colorHex) {
  state.selectedWireColor = colorHex;
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === colorHex);
  });
  initAudio();
  playClickSound(750, 0.03);
}

// Toggle Sidebar Panel
function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  if (dom.sidebarPanel) {
    dom.sidebarPanel.classList.toggle('collapsed', state.sidebarCollapsed);
  }
  if (dom.sidebarToggleIcon) {
    dom.sidebarToggleIcon.textContent = state.sidebarCollapsed ? '▶' : '◀';
  }
  if (dom.sidebarToggleText) {
    dom.sidebarToggleText.textContent = state.sidebarCollapsed ? 'Mở bảng' : 'Bảng điều khiển';
  }
  setTimeout(() => autoFitWorkbench(), 280);
}

// Zoom & Auto-Fit Workbench
function autoFitWorkbench() {
  const viewport = dom.viewport;
  const bench = dom.hardwareLayout;
  const wrapper = dom.benchZoomWrapper;
  if (!viewport || !bench || !wrapper) return;

  if (state.fitScreenMode) {
    const padX = 24;
    const padY = 24;
    const availW = viewport.clientWidth - padX;
    const availH = viewport.clientHeight - padY;

    const benchW = 1260;
    const benchH = bench.offsetHeight || 670;

    const scaleX = availW / benchW;
    const scaleY = availH / benchH;
    let scale = Math.min(scaleX, scaleY);
    scale = Math.min(Math.max(scale, 0.45), 1.15);

    state.zoomScale = scale;
    bench.style.transform = `scale(${scale})`;
    wrapper.style.width = `${benchW * scale}px`;
    wrapper.style.height = `${benchH * scale}px`;

    if (dom.zoomPercentBadge) {
      dom.zoomPercentBadge.textContent = `${Math.round(scale * 100)}%`;
    }
    if (dom.btnFitScreen) {
      dom.btnFitScreen.classList.add('active-fit');
    }
  } else {
    const scale = state.zoomScale || 1.0;
    const benchW = 1260;
    const benchH = bench.offsetHeight || 670;

    bench.style.transform = `scale(${scale})`;
    wrapper.style.width = `${benchW * scale}px`;
    wrapper.style.height = `${benchH * scale}px`;

    if (dom.zoomPercentBadge) {
      dom.zoomPercentBadge.textContent = `${Math.round(scale * 100)}%`;
    }
    if (dom.btnFitScreen) {
      dom.btnFitScreen.classList.remove('active-fit');
    }
  }

  renderWires();
}

function zoomIn() {
  state.fitScreenMode = false;
  state.zoomScale = Math.min(1.4, (state.zoomScale || 1.0) + 0.1);
  autoFitWorkbench();
}

function zoomOut() {
  state.fitScreenMode = false;
  state.zoomScale = Math.max(0.45, (state.zoomScale || 1.0) - 0.1);
  autoFitWorkbench();
}

function toggleFitScreen() {
  state.fitScreenMode = !state.fitScreenMode;
  if (state.fitScreenMode) {
    logDiagnostic('⛶ Đã bật chế độ Vừa màn hình (Fit to Screen) - Loại bỏ cuộn trang.', 'info');
  }
  autoFitWorkbench();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }).catch(err => console.warn(err));
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
  setTimeout(() => autoFitWorkbench(), 180);
}

// ============================================================================
// 8. EVENT LISTENERS SETUP
// ============================================================================
function setupEventListeners() {
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.color) selectWireColor(btn.dataset.color);
    });
  });

  // Banana Jack click delegation
  document.querySelectorAll('.jack').forEach(jack => {
    jack.addEventListener('click', (e) => {
      e.stopPropagation();
      handleJackClick(jack);
    });
  });

  // Workbench canvas click (cancels active jack selection)
  dom.viewport.addEventListener('click', () => {
    if (state.selectedJackId) {
      clearJackSelection();
      logDiagnostic('Đã hủy chọn cọc cắm.', 'info');
    }
  });

  // Track mousemove for live rubber-band wire preview (scaled to zoom scale)
  dom.hardwareLayout.addEventListener('mousemove', (e) => {
    if (state.selectedJackId) {
      const parentRect = dom.hardwareLayout.getBoundingClientRect();
      const scale = state.zoomScale || 1.0;
      const mousePos = {
        x: (e.clientX - parentRect.left) / scale,
        y: (e.clientY - parentRect.top) / scale,
      };
      updateTempCable(mousePos);
    }
  });

  // Action buttons
  dom.checkWiringBtn.addEventListener('click', () => {
    initAudio();
    const res = validateLab4Circuit();
    if (res.valid) {
      playClickSound(1200, 0.15);
      logDiagnostic('🎉 CHÚC MỪNG! Mạch đấu dây của bạn chính xác 100%! Có thể Bật nguồn và nhấn START để chạy thử thiết bị ép.', 'success');
    } else {
      playClickSound(300, 0.2);
      logDiagnostic('⚠️ PHÁT HIỆN LỖI ĐẤU DÂY:', 'warn');
      res.errors.forEach(err => logDiagnostic(err, 'error'));
      if (res.successes.length > 0) {
        logDiagnostic(`(Đã đạt ${res.successes.length} / ${res.successes.length + res.errors.length} nhánh mạch)`, 'info');
      }
    }
  });

  dom.autoWireBtn.addEventListener('click', applyAutoWiring);
  dom.clearWiresBtn.addEventListener('click', clearAllWires);

  // Sound toggle
  dom.toggleSoundBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    dom.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    logDiagnostic(`Âm thanh: ${state.soundEnabled ? 'BẬT' : 'TẮT'}`, 'info');
  });

  // Main Rocker Switch
  dom.mainPowerSwitch.addEventListener('click', () => {
    initAudio();
    state.mainPower = !state.mainPower;
    dom.mainPowerSwitch.classList.toggle('on', state.mainPower);
    dom.powerSwitchText.textContent = state.mainPower ? 'ON' : 'OFF';
    playClickSound(state.mainPower ? 600 : 350, 0.08);
    logDiagnostic(state.mainPower ? '⚡ Đã BẬT công tắc nguồn 24VDC.' : '🔌 Đã TẮT nguồn điện bàn thực hành.', 'info');
  });

  // Button handlers
  const handleStartDown = (e) => {
    if (e.cancelable) e.preventDefault();
    initAudio();
    state.startPressed = true;
    playClickSound(850, 0.04);
  };
  const handleStopDown = (e) => {
    if (e.cancelable) e.preventDefault();
    initAudio();
    state.stopPressed = true;
    playClickSound(450, 0.05);
    logDiagnostic('🛑 Đã nhấn nút dừng STOP (PB1).', 'warn');
  };
  const handleYellowDown = (e) => {
    if (e.cancelable) e.preventDefault();
    initAudio();
    state.sparePressed = true;
    playClickSound(650, 0.04);
    logDiagnostic('🟡 Đã nhấn nút RESET (PB2).', 'info');
  };
  const handleReleaseAll = () => {
    if (state.startPressed) {
      state.startPressed = false;
      playClickSound(550, 0.03);
    }
    if (state.stopPressed) {
      state.stopPressed = false;
      playClickSound(550, 0.03);
    }
    if (state.sparePressed) {
      state.sparePressed = false;
      playClickSound(550, 0.03);
    }
  };

  dom.btnStart.addEventListener('mousedown', handleStartDown);
  dom.btnStart.addEventListener('touchstart', handleStartDown, { passive: false });

  dom.btnStop.addEventListener('mousedown', handleStopDown);
  dom.btnStop.addEventListener('touchstart', handleStopDown, { passive: false });

  if (dom.btnYellow) {
    dom.btnYellow.addEventListener('mousedown', handleYellowDown);
    dom.btnYellow.addEventListener('touchstart', handleYellowDown, { passive: false });
  }

  window.addEventListener('mouseup', handleReleaseAll);
  window.addEventListener('touchend', handleReleaseAll);

  // Throttle valve knob rotation
  let knobAngle = 0;
  dom.throttleKnob.addEventListener('click', () => {
    initAudio();
    knobAngle = (knobAngle + 45) % 180;
    dom.throttleKnob.style.transform = `rotate(${knobAngle}deg)`;
    state.throttleRate = 0.2 + (knobAngle / 180) * 0.8;
    dom.throttleSpeedText.textContent = `Tốc độ: ${(state.throttleRate * 100).toFixed(0)}%`;
    playClickSound(900 + knobAngle * 2, 0.04);
  });

  // Schematic Tabs switch
  dom.tabElecBtn.addEventListener('click', () => {
    dom.tabElecBtn.classList.add('active');
    dom.tabHydBtn.classList.remove('active');
    dom.elecSchematicView.classList.add('active');
    dom.hydSchematicView.classList.remove('active');
  });
  dom.tabHydBtn.addEventListener('click', () => {
    dom.tabHydBtn.classList.add('active');
    dom.tabElecBtn.classList.remove('active');
    dom.hydSchematicView.classList.add('active');
    dom.elecSchematicView.classList.remove('active');
  });

  // Mode buttons
  dom.modePracticeBtn.addEventListener('click', () => {
    state.mode = 'practice';
    dom.modePracticeBtn.classList.add('active');
    dom.modeExamBtn.classList.remove('active');
    dom.autoWireBtn.style.display = 'flex';
    dom.checkWiringBtn.textContent = '⚡ Kiểm tra đấu dây';
    logDiagnostic('📖 Chế độ LUYỆN TẬP: Được hỗ trợ gợi ý sơ đồ và chức năng đấu dây mẫu.', 'info');
  });

  dom.modeExamBtn.addEventListener('click', () => {
    state.mode = 'exam';
    dom.modeExamBtn.classList.add('active');
    dom.modePracticeBtn.classList.remove('active');
    dom.autoWireBtn.style.display = 'none';
    dom.checkWiringBtn.textContent = '🎯 Nghiệm thu / Nộp bài';
    logDiagnostic('🎯 Chế độ KIỂM TRA (EXAM): Ẩn chức năng đấu dây mẫu. Hãy tự cắm và bấm Nghiệm thu khi hoàn tất!', 'warn');
  });

  // Guide lines toggle
  dom.toggleGuideBtn.addEventListener('click', showWireGuideModal);
  const closeModal = () => {
    dom.modalWireGuide.classList.add('hidden');
    dom.modalWireGuide.style.display = 'none';
  };
  dom.btnCloseModal.addEventListener('click', closeModal);
  dom.modalWireGuide.addEventListener('click', (e) => {
    if (e.target === dom.modalWireGuide) closeModal();
  });

  // Toggle Sidebar Collapse
  if (dom.btnToggleSidebar) dom.btnToggleSidebar.addEventListener('click', toggleSidebar);
  if (dom.btnCloseSidebar) dom.btnCloseSidebar.addEventListener('click', toggleSidebar);

  // Zoom Controls & Fullscreen
  if (dom.btnZoomOut) dom.btnZoomOut.addEventListener('click', zoomOut);
  if (dom.btnZoomIn) dom.btnZoomIn.addEventListener('click', zoomIn);
  if (dom.btnFitScreen) dom.btnFitScreen.addEventListener('click', toggleFitScreen);
  if (dom.btnToggleFullscreen) dom.btnToggleFullscreen.addEventListener('click', toggleFullscreen);

  // Quick Action Buttons on Topbar
  if (dom.btnQuickAutoWire) dom.btnQuickAutoWire.addEventListener('click', applyAutoWiring);
  if (dom.btnQuickCheck) dom.btnQuickCheck.addEventListener('click', () => {
    initAudio();
    const res = validateLab4Circuit();
    if (res.valid) {
      playClickSound(1200, 0.15);
      logDiagnostic('🎉 CHÚC MỪNG! Mạch đấu dây chính xác 100%! Bật nguồn và nhấn START để vận hành.', 'success');
    } else {
      playClickSound(300, 0.2);
      logDiagnostic('⚠️ PHÁT HIỆN LỖI ĐẤU DÂY:', 'warn');
      res.errors.forEach(err => logDiagnostic(err, 'error'));
      if (res.successes.length > 0) {
        logDiagnostic(`(Đã đạt ${res.successes.length} / ${res.successes.length + res.errors.length} nhánh mạch)`, 'info');
      }
    }
  });

  // Hotkey listener (1, 2, 3, 4, B, F, Escape)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === '1') selectWireColor('#e63946');
    else if (e.key === '2') selectWireColor('#1d3557');
    else if (e.key === '3') selectWireColor('#f4a261');
    else if (e.key === '4') selectWireColor('#2a9d8f');
    else if (e.key === 'b' || e.key === 'B') toggleSidebar();
    else if (e.key === 'f' || e.key === 'F') toggleFitScreen();
    else if (e.key === 'Escape') {
      if (state.selectedJackId) {
        clearJackSelection();
        logDiagnostic('Đã hủy chọn cọc cắm.', 'info');
      }
      if (dom.modalWireGuide) {
        dom.modalWireGuide.classList.add('hidden');
        dom.modalWireGuide.style.display = 'none';
      }
    }
  });

  // Window resize re-renders and auto-fits
  window.addEventListener('resize', () => {
    if (state.fitScreenMode) {
      autoFitWorkbench();
    } else {
      renderWires();
    }
  });

  // Mobile Orientation Change listener
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      autoFitWorkbench();
    }, 250);
  });

  // Landscape Orientation Prompt Dismiss Button (Mobile)
  const promptEl = document.getElementById('landscape-prompt');
  const btnDismiss = document.getElementById('btn-dismiss-landscape');
  if (btnDismiss && promptEl) {
    btnDismiss.addEventListener('click', () => {
      promptEl.classList.add('dismissed');
      promptEl.style.display = 'none';
      autoFitWorkbench();
    });
  }

  // Lab Selector (Support for Labs 1 to 6)
  dom.labSelect.addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    switchLab(val);
  });
}

function switchLab(labId) {
  state.currentLab = labId;
  clearAllWires();

  const titleEl = document.getElementById('lab-title-text');
  const descEl = document.getElementById('lab-desc-content');

  const LABS_INFO = {
    1: {
      title: 'Bài 1: Thực hành thiết bị phân loại',
      desc: '<p>Điều khiển trực tiếp xi lanh tác dụng kép sử dụng van điện từ 4/2. Nhấn START: piston duỗi đẩy chi tiết ra khỏi băng tải; nhả START: piston co về hết.</p>',
    },
    2: {
      title: 'Bài 2: Thực hành lựa chọn phần tử trên băng tải',
      desc: '<p>Điều khiển gián tiếp qua rơ le, kết hợp van tiết lưu một chiều và van giảm áp. Hiệu chỉnh thời gian và tốc độ duỗi của xi lanh.</p>',
    },
    3: {
      title: 'Bài 3: Thực hành thiết bị uốn tôn',
      desc: '<p>Mạch điện tự duy trì K1. Nhấn nút 1: xi lanh duỗi ép tôn chữ U; nhấn nút 2: xi lanh co về.</p>',
    },
    4: {
      title: 'Bài 4: Thực hành thiết bị ép lắp chi tiết',
      desc: '<p>Tự động co về khi áp suất buồng ép đạt <strong>30 bar (3.0 MPa)</strong> nhờ Công tắc áp suất S1 kết hợp Rơ le ngắt K2 và mạch tự duy trì K1.</p>',
    },
    5: {
      title: 'Bài 5: Thực hành máy dập ép (Mạch vi phân)',
      desc: '<p>Sử dụng mạch thủy lực vi phân (differential circuit) để tăng tốc độ tiến ra của cần piston với bộ nguồn lưu lượng thấp.</p>',
    },
    6: {
      title: 'Bài 6: Thiết bị dẫn tiến cho máy khoan',
      desc: '<p>Mạch chạy nhanh (ăn dao nhanh) và chuyển sang tốc độ dẫn tiến gia công chậm bằng công tắc hành trình và van tiết lưu.</p>',
    },
  };

  const info = LABS_INFO[labId] || LABS_INFO[4];
  titleEl.textContent = info.title;
  descEl.innerHTML = info.desc;

  if (labId !== 4) {
    logDiagnostic(`📌 Bạn đã chuyển sang ${info.title}. Hiện tại Bài 4 đang được tối ưu hóa đầy đủ nhất cho kỳ thi/ôn tập!`, 'info');
  } else {
    logDiagnostic(`✨ Đã nạp Bài thực hành số 4. Sẵn sàng cắm dây!`, 'success');
  }
}

// ============================================================================
// 8. APP INITIALIZATION (ROBUST MULTI-STAGE LOADER)
// ============================================================================
function initApp() {
  try {
    // Detect mobile phone / small screens: automatically collapse sidebar for maximum bench room
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 900;
    if (isMobile) {
      state.sidebarCollapsed = true;
      if (dom.sidebarPanel) dom.sidebarPanel.classList.add('collapsed');
      if (dom.sidebarToggleIcon) dom.sidebarToggleIcon.textContent = '▶';
      if (dom.sidebarToggleText) dom.sidebarToggleText.textContent = 'Mở bảng';
    }

    setupEventListeners();
    autoFitWorkbench();
    startSimulationLoop();
    logDiagnostic('🚀 Hệ thống Mô Phỏng Thủy Lực Khí Nén đã sẵn sàng!', 'success');
    logDiagnostic('💡 Mẹo thao tác: Nhấn [1, 2, 3, 4] để đổi màu dây, [B] để ẩn/hiện bảng điều khiển, [F] để vừa màn hình.', 'info');
  } catch (err) {
    console.error('Initialization error:', err);
    logDiagnostic('❌ Lỗi khởi động: ' + err.message, 'error');
  }
}

// Ensure execution whether DOM is still loading or already parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Re-render Bézier wires after all fonts, styles, and assets are fully loaded
window.addEventListener('load', () => {
  autoFitWorkbench();
});

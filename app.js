// Neural Emotion Streamer - Main Application Orchestrator

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingBar = document.querySelector('.loading-bar');
  const loadingStatus = document.querySelector('.loading-status');
  
  const video = document.getElementById('webcam-video');
  const canvas = document.getElementById('mesh-canvas');
  const ctx = canvas.getContext('2d');
  const borderFrame = document.getElementById('border-frame');
  const webcamStatus = document.getElementById('webcam-status');
  const modeStatus = document.getElementById('mode-status');
  const lockStatus = document.getElementById('lock-status');
  const fpsCounter = document.getElementById('fps-counter');
  
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const btnToggleMesh = document.getElementById('btn-toggle-mesh');
  const btnToggleParticles = document.getElementById('btn-toggle-particles');
  const simControlsPanel = document.getElementById('sim-controls-panel');
  const terminalLines = document.getElementById('terminal-lines');
  
  const floatingLabelsContainer = document.getElementById('floating-labels-container');
  const meshOverlayAlert = document.getElementById('mesh-overlay-alert');

  // --- Constants & System States ---
  let isWebcamActive = false;
  let isMeshVisible = true;
  let areParticlesActive = true;
  let currentMode = 'SIMULATOR'; // 'SIMULATOR' or 'WEBCAM'
  let isFaceLocked = false;
  
  let cameraInstance = null;
  let faceMeshInstance = null;
  
  // Frame rate logging
  let lastFrameTime = performance.now();
  let frameCount = 0;
  
  // Statistical Tracking
  const detectionCounts = { neutral: 450, happy: 82, angry: 28, sad: 104, surprised: 40, fearful: 15, disgusted: 9 };
  const avgVelocities = { neutral: 0.12, happy: 0.0, angry: 0.0, sad: 0.0, surprised: 0.0, fearful: 0.0, disgusted: 0.0 };
  
  // Current frame and smoothed emotions (smooth value to avoid jitters)
  const currentEmotions = { neutral: 1.0, happy: 0, angry: 0, sad: 0, surprised: 0, fearful: 0, disgusted: 0 };
  const smoothEmotions = { neutral: 1.0, happy: 0, angry: 0, sad: 0, surprised: 0, fearful: 0, disgusted: 0 };
  const smoothingFactor = 0.15;
  let activeEmotion = 'neutral';

  // --- Initialize Flow Visualizer ---
  let visualizer = null;
  if (window.EmotionVisualizer) {
    visualizer = new window.EmotionVisualizer('flow-canvas');
  }

  // Particle System (Mesh Canvas Overlay Particles)
  const overlayParticles = [];

  // --- 3D Face Wireframe Model for Simulator Mode ---
  // Coordinates in 3D: centered at (0,0,0)
  const syntheticFaceModel = {
    vertices: [],
    lines: [],
    // Groups of vertex indexes for modular rendering
    groups: {
      silhouette: [],
      leftEyebrow: [],
      rightEyebrow: [],
      leftEye: [],
      rightEye: [],
      nose: [],
      innerMouth: [],
      outerMouth: [],
      connectors: []
    }
  };

  // --- Initialize Synthetic 3D Model ---
  function buildSyntheticFace() {
    let index = 0;
    
    // 1. Silhouette Outline (Ellipse-like in 3D)
    const silCount = 18;
    for (let i = 0; i < silCount; i++) {
      const angle = (i / silCount) * Math.PI * 2;
      const x = Math.sin(angle) * 70;
      const y = -Math.cos(angle) * 90 + 10;
      // Elliptic back curvature in Z
      const z = Math.cos(angle) * -30 - 15;
      syntheticFaceModel.vertices.push({ x, y, z, ox: x, oy: y, oz: z });
      syntheticFaceModel.groups.silhouette.push(index++);
    }
    // Connect silhouette lines
    for (let i = 0; i < silCount; i++) {
      syntheticFaceModel.lines.push([
        syntheticFaceModel.groups.silhouette[i],
        syntheticFaceModel.groups.silhouette[(i + 1) % silCount]
      ]);
    }

    // 2. Eyebrows
    const browY = -35;
    // Left Eyebrow
    for (let i = 0; i < 5; i++) {
      const x = -40 + i * 8;
      const y = browY - (i === 0 || i === 4 ? 2 : 5);
      const z = 20 - Math.abs(2 - i) * 2;
      syntheticFaceModel.vertices.push({ x, y, z, ox: x, oy: y, oz: z });
      syntheticFaceModel.groups.leftEyebrow.push(index++);
    }
    // Right Eyebrow
    for (let i = 0; i < 5; i++) {
      const x = 8 + i * 8;
      const y = browY - (i === 0 || i === 4 ? 2 : 5);
      const z = 20 - Math.abs(2 - i) * 2;
      syntheticFaceModel.vertices.push({ x, y, z, ox: x, oy: y, oz: z });
      syntheticFaceModel.groups.rightEyebrow.push(index++);
    }
    // Connect eyebrows
    for (let i = 0; i < 4; i++) {
      syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEyebrow[i], syntheticFaceModel.groups.leftEyebrow[i+1]]);
      syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEyebrow[i], syntheticFaceModel.groups.rightEyebrow[i+1]]);
    }

    // 3. Eyes
    const eyeY = -18;
    // Left Eye circle
    const eyeR = 7;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = -24 + Math.cos(angle) * eyeR;
      const y = eyeY + Math.sin(angle) * (eyeR * 0.7);
      const z = 25;
      syntheticFaceModel.vertices.push({ x, y, z, ox: x, oy: y, oz: z });
      syntheticFaceModel.groups.leftEye.push(index++);
    }
    // Right Eye circle
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = 24 + Math.cos(angle) * eyeR;
      const y = eyeY + Math.sin(angle) * (eyeR * 0.7);
      const z = 25;
      syntheticFaceModel.vertices.push({ x, y, z, ox: x, oy: y, oz: z });
      syntheticFaceModel.groups.rightEye.push(index++);
    }
    // Connect eye shapes
    for (let i = 0; i < 6; i++) {
      syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEye[i], syntheticFaceModel.groups.leftEye[(i+1)%6]]);
      syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEye[i], syntheticFaceModel.groups.rightEye[(i+1)%6]]);
    }

    // 4. Nose
    // Bridge (vertical)
    syntheticFaceModel.vertices.push({ x: 0, y: -20, z: 27, ox: 0, oy: -20, oz: 27 }); // Nose top (brow junction)
    syntheticFaceModel.groups.nose.push(index++);
    syntheticFaceModel.vertices.push({ x: 0, y: 5, z: 38, ox: 0, oy: 5, oz: 38 });  // Tip
    syntheticFaceModel.groups.nose.push(index++);
    // Base (nostrils horizontal)
    syntheticFaceModel.vertices.push({ x: -12, y: 15, z: 30, ox: -12, oy: 15, oz: 30 }); // Left nostril
    syntheticFaceModel.groups.nose.push(index++);
    syntheticFaceModel.vertices.push({ x: 12, y: 15, z: 30, ox: 12, oy: 15, oz: 30 });  // Right nostril
    syntheticFaceModel.groups.nose.push(index++);
    
    // Connect nose
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[0], syntheticFaceModel.groups.nose[1]]); // Bridge
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[1], syntheticFaceModel.groups.nose[2]]); // Tip to left
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[1], syntheticFaceModel.groups.nose[3]]); // Tip to right
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[2], syntheticFaceModel.groups.nose[3]]); // Base

    // 5. Mouth (Outer & Inner Lips)
    const mouthY = 35;
    const mouthW = 28;
    const mouthH = 10;
    // Outer loop
    const outerIndices = [
      { x: -mouthW, y: mouthY, z: 22 }, // Left corner
      { x: -mouthW/2, y: mouthY - 4, z: 26 }, // Upper left
      { x: 0, y: mouthY - 6, z: 28 }, // Upper center
      { x: mouthW/2, y: mouthY - 4, z: 26 }, // Upper right
      { x: mouthW, y: mouthY, z: 22 }, // Right corner
      { x: mouthW/2, y: mouthY + 5, z: 25 }, // Lower right
      { x: 0, y: mouthY + 8, z: 27 }, // Lower center
      { x: -mouthW/2, y: mouthY + 5, z: 25 }  // Lower left
    ];
    outerIndices.forEach(p => {
      syntheticFaceModel.vertices.push({ x: p.x, y: p.y, z: p.z, ox: p.x, oy: p.y, oz: p.z });
      syntheticFaceModel.groups.outerMouth.push(index++);
    });
    for (let i = 0; i < 8; i++) {
      syntheticFaceModel.lines.push([
        syntheticFaceModel.groups.outerMouth[i],
        syntheticFaceModel.groups.outerMouth[(i+1)%8]
      ]);
    }

    // 6. Cross connection cage lines for 3D depth effect
    // Forehead connectors
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEyebrow[0], syntheticFaceModel.groups.silhouette[3]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEyebrow[2], syntheticFaceModel.groups.silhouette[4]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEyebrow[2], syntheticFaceModel.groups.silhouette[14]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEyebrow[4], syntheticFaceModel.groups.silhouette[15]]);
    
    // Temple/Cheek connectors
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEye[3], syntheticFaceModel.groups.silhouette[5]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEye[0], syntheticFaceModel.groups.silhouette[13]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.outerMouth[0], syntheticFaceModel.groups.silhouette[7]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.outerMouth[4], syntheticFaceModel.groups.silhouette[11]]);
    
    // Eye to Brow
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEyebrow[1], syntheticFaceModel.groups.leftEye[1]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEyebrow[3], syntheticFaceModel.groups.rightEye[1]]);
    
    // Nose bridge to inner eyebrow centers
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[0], syntheticFaceModel.groups.leftEyebrow[4]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[0], syntheticFaceModel.groups.rightEyebrow[0]]);
    
    // Eye to Nose
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEye[5], syntheticFaceModel.groups.nose[0]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEye[4], syntheticFaceModel.groups.nose[0]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.leftEye[4], syntheticFaceModel.groups.nose[2]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.rightEye[3], syntheticFaceModel.groups.nose[3]]);

    // Nose base to Mouth upper lip
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[2], syntheticFaceModel.groups.outerMouth[1]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[3], syntheticFaceModel.groups.outerMouth[3]]);
    syntheticFaceModel.lines.push([syntheticFaceModel.groups.nose[1], syntheticFaceModel.groups.outerMouth[2]]);
  }

  // --- Boot Loading sequence ---
  function runBootSequence() {
    const steps = [
      { text: "Loading spatial grid modules...", progress: 15 },
      { text: "Mapping facial topological vertices...", progress: 38 },
      { text: "Compiling WebGL particle emitters...", progress: 54 },
      { text: "Connecting bio-metric feedback lines...", progress: 78 },
      { text: "Synchronizing system clock signals...", progress: 92 },
      { text: "Core systems initialized. ENGAGING.", progress: 100 }
    ];
    
    let currentStep = 0;
    
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        loadingStatus.textContent = step.text;
        loadingBar.style.width = `${step.progress}%`;
        
        let logType = 'system-line';
        if (step.progress === 100) logType = 'success-line';
        logToTerminal(`[SYS] ${step.text.toUpperCase()}`, logType);
        
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          loadingOverlay.classList.add('fade-out');
          logToTerminal("[SYS] NEURAL INTERFACE ONLINE.", 'success-line');
          
          // Animate sys-load to a steady reading
          setInterval(() => {
            const loadVal = Math.floor(10 + Math.random() * 8);
            document.getElementById('sys-load').textContent = `${loadVal}%`;
          }, 3000);
        }, 500);
      }
    }, 450);
  }

  // --- Terminal Logging Utility ---
  function logToTerminal(text, type = 'log-line') {
    const row = document.createElement('div');
    row.className = `term-line ${type}`;
    
    const timeStr = new Date().toISOString().substring(11, 19);
    row.textContent = `[${timeStr}] ${text}`;
    
    terminalLines.appendChild(row);
    
    // Restrict lines count to keep terminal memory low
    while (terminalLines.children.length > 40) {
      terminalLines.removeChild(terminalLines.firstChild);
    }
    
    // Auto Scroll
    terminalLines.parentElement.scrollTop = terminalLines.parentElement.scrollHeight;
  }

  // --- Particle Utilities ---
  function spawnOverlayParticle(x, y, color) {
    if (!areParticlesActive) return;
    
    overlayParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3 - 0.5,
      size: 1.5 + Math.random() * 2.5,
      alpha: 1,
      color,
      decay: 0.015 + Math.random() * 0.015
    });
  }

  function updateAndDrawOverlayParticles() {
    ctx.save();
    for (let i = overlayParticles.length - 1; i >= 0; i--) {
      const p = overlayParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      
      if (p.alpha <= 0) {
        overlayParticles.splice(i, 1);
        continue;
      }
      
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = p.size * 3;
      ctx.shadowColor = p.color;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Simulation Rig & Projection ---
  let rotX = 0, rotY = 0, rotZ = 0;
  
  function applyDeformationsToSyntheticFace(emotion) {
    const v = syntheticFaceModel.vertices;
    const g = syntheticFaceModel.groups;
    
    // Reset to base positions first
    v.forEach(pt => {
      pt.x = pt.ox;
      pt.y = pt.oy;
      pt.z = pt.oz;
    });

    if (emotion === 'happy') {
      // Smile pull corners outwards/upwards
      const mouthL = v[g.outerMouth[0]];
      const mouthR = v[g.outerMouth[4]];
      mouthL.x -= 8; mouthL.y -= 7; mouthL.z += 5;
      mouthR.x += 8; mouthR.y -= 7; mouthR.z += 5;
      
      // Upper lip curve up
      v[g.outerMouth[1]].y -= 4;
      v[g.outerMouth[2]].y -= 5;
      v[g.outerMouth[3]].y -= 4;
      
      // Cheeks rise (silhouette corners)
      v[g.silhouette[5]].x -= 3; v[g.silhouette[5]].y -= 3;
      v[g.silhouette[13]].x += 3; v[g.silhouette[13]].y -= 3;
    } 
    else if (emotion === 'angry') {
      // Brows pull downwards and inwards
      g.leftEyebrow.forEach((idx, i) => {
        v[idx].y += 6 - i; // Pull inner parts down more
        v[idx].x += 3;
      });
      g.rightEyebrow.forEach((idx, i) => {
        v[idx].y += 2 + i; // Pull inner parts down more
        v[idx].x -= 3;
      });
      // Mouth tightly closed & compressed
      v[g.outerMouth[2]].y += 2;
      v[g.outerMouth[6]].y -= 2;
    }
    else if (emotion === 'sad') {
      // Inner brows pull upwards
      v[g.leftEyebrow[4]].y -= 6;
      v[g.rightEyebrow[0]].y -= 6;
      
      // Mouth corners pull downwards
      const mouthL = v[g.outerMouth[0]];
      const mouthR = v[g.outerMouth[4]];
      mouthL.y += 6; mouthR.y += 6;
      
      v[g.outerMouth[2]].y += 2;
      v[g.outerMouth[6]].y += 4;
    }
    else if (emotion === 'surprised') {
      // Brows pull high up
      g.leftEyebrow.forEach(idx => v[idx].y -= 10);
      g.rightEyebrow.forEach(idx => v[idx].y -= 10);
      
      // Eyes open wide
      g.leftEye.forEach((idx, i) => {
        if (i === 1 || i === 2) v[idx].y -= 3;
        if (i === 4 || i === 5) v[idx].y += 3;
      });
      g.rightEye.forEach((idx, i) => {
        if (i === 1 || i === 2) v[idx].y -= 3;
        if (i === 4 || i === 5) v[idx].y += 3;
      });
      
      // Mouth opens in oval shape
      const mouthL = v[g.outerMouth[0]];
      const mouthR = v[g.outerMouth[4]];
      mouthL.x += 2;
      mouthR.x -= 2;
      v[g.outerMouth[2]].y -= 8; // Top lip rises
      v[g.outerMouth[6]].y += 12; // Bottom lip drops
    }
    else if (emotion === 'fearful') {
      // Brows pull high and together
      g.leftEyebrow.forEach(idx => { v[idx].y -= 5; v[idx].x += 3; });
      g.rightEyebrow.forEach(idx => { v[idx].y -= 5; v[idx].x -= 3; });
      
      // Mouth slightly open but pulled back
      v[g.outerMouth[0]].x -= 4;
      v[g.outerMouth[4]].x += 4;
      v[g.outerMouth[6]].y += 4;
    }
    else if (emotion === 'disgusted') {
      // Brows squenched down
      g.leftEyebrow.forEach(idx => v[idx].y += 2);
      g.rightEyebrow.forEach(idx => v[idx].y += 2);
      
      // Nose wrinkles (points move up)
      v[g.nose[1]].y -= 4;
      v[g.nose[2]].y -= 4;
      v[g.nose[3]].y -= 4;
      
      // Upper lip raised high (sneering)
      v[g.outerMouth[1]].y -= 6;
      v[g.outerMouth[2]].y -= 8;
      v[g.outerMouth[3]].y -= 6;
    }
  }

  function project3DTo2D(vertex, width, height) {
    // Rotation calculations
    // Rotate Y
    let x1 = vertex.x * Math.cos(rotY) - vertex.z * Math.sin(rotY);
    let z1 = vertex.x * Math.sin(rotY) + vertex.z * Math.cos(rotY);
    
    // Rotate X
    let y2 = vertex.y * Math.cos(rotX) - z1 * Math.sin(rotX);
    let z2 = vertex.y * Math.sin(rotX) + z1 * Math.cos(rotX);
    
    // Rotate Z
    let x3 = x1 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
    let y3 = x1 * Math.sin(rotZ) + y2 * Math.cos(rotZ);
    
    // Camera settings
    const dist = 280;
    const scale = 260;
    
    // Perspective Division
    const perspective = scale / (z2 + dist);
    const px = x3 * perspective + width / 2;
    const py = y3 * perspective + height / 2;
    
    return { x: px, y: py };
  }

  function drawSyntheticMesh() {
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Draw radar background target circles
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w/2, h/2, 100, 0, Math.PI * 2);
    ctx.arc(w/2, h/2, 180, 0, Math.PI * 2);
    ctx.stroke();
    
    // Crosshair markers in center
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(w/2 - 20, h/2); ctx.lineTo(w/2 + 20, h/2);
    ctx.moveTo(w/2, h/2 - 20); ctx.lineTo(w/2, h/2 + 20);
    ctx.stroke();

    if (!isMeshVisible) return;

    // Apply active emotion morph to 3D shape
    applyDeformationsToSyntheticFace(activeEmotion);
    
    // Project all vertices
    const projectedPoints = syntheticFaceModel.vertices.map(pt => project3DTo2D(pt, w, h));
    
    // Get colors matching active theme
    const activeColor = getComputedStyle(document.body).getPropertyValue('--theme-color').trim();
    
    // Draw Mesh Lines
    ctx.beginPath();
    ctx.strokeStyle = activeColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = activeColor;
    ctx.lineWidth = 1.2;
    
    syntheticFaceModel.lines.forEach(([vA, vB]) => {
      const ptA = projectedPoints[vA];
      const ptB = projectedPoints[vB];
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow

    // Draw mesh dots for intersections
    ctx.fillStyle = '#ffffff';
    projectedPoints.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Emanate particles from eyes and mouth
    if (Math.random() < 0.3) {
      const leftEye = projectedPoints[syntheticFaceModel.groups.leftEye[0]];
      const rightEye = projectedPoints[syntheticFaceModel.groups.rightEye[0]];
      const mouth = projectedPoints[syntheticFaceModel.groups.outerMouth[2]];
      
      spawnOverlayParticle(leftEye.x, leftEye.y, activeColor);
      spawnOverlayParticle(rightEye.x, rightEye.y, activeColor);
      spawnOverlayParticle(mouth.x, mouth.y, activeColor);
    }

    // Draw floating tag next to simulated face
    // Let's anchor it to the top-right of the projected head silhouette
    const anchorNode = projectedPoints[syntheticFaceModel.groups.silhouette[14]]; // Top right forehead area
    renderFloatingStatsCard(anchorNode.x, anchorNode.y, activeEmotion, smoothEmotions[activeEmotion]);
  }

  // --- Real-time Floating Label Management ---
  function renderFloatingStatsCard(x, y, label, percentage) {
    floatingLabelsContainer.innerHTML = ''; // Clear prior entries
    
    const card = document.createElement('div');
    card.className = 'floating-label-card';
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    
    const confVal = Math.floor(82 + percentage * 17);
    
    card.innerHTML = `
      <span class="floating-title">ANALYSIS IN PROGRESS</span>
      <span class="floating-value">${label.toUpperCase()} : ${Math.floor(percentage * 100)}%</span>
      <span class="floating-confidence"><i class="fa-solid fa-circle-check"></i> LOCK: ${confVal}%</span>
    `;
    
    floatingLabelsContainer.appendChild(card);
  }

  // --- Real-time Geometric Heuristics (Webcam Mode) ---
  function processFacialMetrics(landmarks) {
    // MediaPipe face mesh has 468+ landmarks.
    // Let's identify normalized coordinates. Coordinates are 0 to 1 normalized.
    // Helper to calculate 3D distance
    const dist3D = (a, b) => {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    };

    // Landmark indexes:
    // Left eye outer: 33, Right eye outer: 263
    // Mouth left: 61, Mouth right: 291
    // Top inner lip: 13, Bottom inner lip: 14
    // Left eyebrow inner: 107, Right eyebrow inner: 336
    // Left eye upper eyelid: 159, Right eye upper eyelid: 386
    
    const ptLeftEyeOuter = landmarks[33];
    const ptRightEyeOuter = landmarks[263];
    const ptMouthLeft = landmarks[61];
    const ptMouthRight = landmarks[291];
    const ptLipTop = landmarks[13];
    const ptLipBottom = landmarks[14];
    const ptLeftBrowInner = landmarks[107];
    const ptRightBrowInner = landmarks[336];
    const ptLeftEyeUpper = landmarks[159];
    const ptRightEyeUpper = landmarks[386];

    // Normalize distances based on face width scale (inter-eye width)
    const faceWidth = dist3D(ptLeftEyeOuter, ptRightEyeOuter);
    if (faceWidth === 0) return;

    const mouthWidth = dist3D(ptMouthLeft, ptMouthRight) / faceWidth;
    const mouthHeight = dist3D(ptLipTop, ptLipBottom) / faceWidth;
    
    // Smile calculations: check if mouth corners are higher relative to the mouth center.
    // Lower y-value means higher height on screen.
    const lipCenterY = (ptLipTop.y + ptLipBottom.y) / 2;
    const smileFactorLeft = (lipCenterY - ptMouthLeft.y) / faceWidth;
    const smileFactorRight = (lipCenterY - ptMouthRight.y) / faceWidth;
    const averageSmile = (smileFactorLeft + smileFactorRight) / 2;

    // Eyebrow raises (distance to eyes)
    const browHeightL = dist3D(ptLeftBrowInner, ptLeftEyeUpper) / faceWidth;
    const browHeightR = dist3D(ptRightBrowInner, ptRightEyeUpper) / faceWidth;
    const averageBrowHeight = (browHeightL + browHeightR) / 2;

    // Build raw logits / signals
    let rawHappy = 0;
    let rawAngry = 0;
    let rawSad = 0;
    let rawSurprised = 0;
    let rawFearful = 0;
    let rawDisgusted = 0;
    let rawNeutral = 0.15; // default base threshold

    // Happy logic: mouth wide horizontally, corners pulled upwards
    if (averageSmile > 0.05) {
      rawHappy = averageSmile * 5.0;
    }
    
    // Surprised logic: mouth open wide vertically, eyebrows raised high
    if (mouthHeight > 0.15 && averageBrowHeight > 0.28) {
      rawSurprised = (mouthHeight * 3) + (averageBrowHeight * 2);
    }

    // Sad logic: corners pulled down (negative smile), brows raised/squeezed
    if (averageSmile < -0.01) {
      rawSad = Math.abs(averageSmile) * 4.0;
    }

    // Angry logic: eyebrows compressed down (low distance to eyes), mouth tight
    if (averageBrowHeight < 0.21) {
      rawAngry = (0.24 - averageBrowHeight) * 6.0;
      if (mouthHeight < 0.05) rawAngry += 0.2; // Tense mouth adds to angry
    }

    // Fearful logic: brows high (high brow distance) and mouth open slightly
    if (averageBrowHeight > 0.26 && mouthHeight > 0.05 && mouthHeight < 0.15) {
      rawFearful = (averageBrowHeight - 0.24) * 3.0;
    }

    // Disgusted logic: mouth slightly open, eyes squinted, brows lowered slightly
    if (averageSmile < 0 && averageBrowHeight < 0.23 && mouthHeight > 0.03) {
      rawDisgusted = 0.4;
    }

    // Safe thresholds & softmax/normalization
    const total = rawHappy + rawAngry + rawSad + rawSurprised + rawFearful + rawDisgusted + rawNeutral;
    
    currentEmotions.happy = rawHappy / total;
    currentEmotions.angry = rawAngry / total;
    currentEmotions.sad = rawSad / total;
    currentEmotions.surprised = rawSurprised / total;
    currentEmotions.fearful = rawFearful / total;
    currentEmotions.disgusted = rawDisgusted / total;
    currentEmotions.neutral = rawNeutral / total;
  }

  // --- Draw Real-time Webcam Mesh Overlays ---
  function drawWebcamMesh(landmarks) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    if (!isMeshVisible) return;

    const activeColor = getComputedStyle(document.body).getPropertyValue('--theme-color').trim();
    
    // Save context and apply horizontal flip to match mirrored video feed
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 8;
    ctx.shadowColor = activeColor;

    // Use MediaPipe connectivity mapping standard simplified contours:
    // Left eye boundary coordinates index: 33, 160, 158, 133, 153, 144
    // Right eye boundary: 362, 385, 387, 263, 373, 380
    // Face silhouette: outer contour loop
    
    // For visual premium aesthetic, let's draw connections of indices:
    // Draw all points connecting to their sequential index to show detailed meshes
    ctx.beginPath();
    
    // Instead of drawing all 468 landmarks which is cluttered, we select standard groups:
    const drawContour = (indices, close = false) => {
      if (indices.length === 0) return;
      const pt0 = landmarks[indices[0]];
      ctx.moveTo(pt0.x * w, pt0.y * h);
      for (let i = 1; i < indices.length; i++) {
        const pt = landmarks[indices[i]];
        ctx.lineTo(pt.x * w, pt.y * h);
      }
      if (close) {
        ctx.lineTo(pt0.x * w, pt0.y * h);
      }
    };

    // Define Face Feature Indices
    const silhouetteIdx = [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ];
    const leftEyeIdx = [33, 160, 158, 133, 153, 144];
    const rightEyeIdx = [362, 385, 387, 263, 373, 380];
    const leftBrowIdx = [70, 63, 105, 66, 107];
    const rightBrowIdx = [336, 296, 334, 293, 300];
    const noseIdx = [168, 6, 197, 195, 5, 4, 45, 275, 440];
    const outerLipsIdx = [61, 185, 40, 39, 37, 0, 267, 269, 270, 291, 321, 319, 320, 311, 310, 312, 13, 82, 81, 80, 191, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

    drawContour(silhouetteIdx, true);
    drawContour(leftEyeIdx, true);
    drawContour(rightEyeIdx, true);
    drawContour(leftBrowIdx, false);
    drawContour(rightBrowIdx, false);
    drawContour(noseIdx, false);
    drawContour(outerLipsIdx, true);
    
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw little glowing points on landmarks
    ctx.fillStyle = '#ffffff';
    const pointsToDraw = [...leftEyeIdx, ...rightEyeIdx, ...leftBrowIdx, ...rightBrowIdx, 19, 4, 61, 291, 152, 10];
    pointsToDraw.forEach(idx => {
      const pt = landmarks[idx];
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore(); // Restore context to normal for unmirrored coordinate drawings/labels

    // Emit particles from eyes/mouth locations (pass horizontally flipped X coordinates)
    if (Math.random() < 0.25) {
      const ptL = landmarks[159];
      const ptR = landmarks[386];
      const ptM = landmarks[13];
      
      spawnOverlayParticle(w - (ptL.x * w), ptL.y * h, activeColor);
      spawnOverlayParticle(w - (ptR.x * w), ptR.y * h, activeColor);
      spawnOverlayParticle(w - (ptM.x * w), ptM.y * h, activeColor);
    }

    // Anchor floating label card to center forehead landmark (idx 9, mirror horizontally)
    const forehead = landmarks[9];
    const mirroredX = w - (forehead.x * w);
    renderFloatingStatsCard(mirroredX, forehead.y * h, activeEmotion, smoothEmotions[activeEmotion]);
  }

  // --- Core Application Loop ---
  function systemTick() {
    frameCount++;
    
    // FPS Calculations
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      const currentFps = (frameCount * 1000) / (now - lastFrameTime);
      fpsCounter.textContent = currentFps.toFixed(1);
      frameCount = 0;
      lastFrameTime = now;
    }

    // Smooth emotion readings
    Object.keys(currentEmotions).forEach(key => {
      smoothEmotions[key] += (currentEmotions[key] - smoothEmotions[key]) * smoothingFactor;
    });

    // Find primary emotion
    let maxVal = -1;
    let nextActive = 'neutral';
    Object.entries(smoothEmotions).forEach(([emo, val]) => {
      if (val > maxVal) {
        maxVal = val;
        nextActive = emo;
      }
    });

    if (nextActive !== activeEmotion) {
      activeEmotion = nextActive;
      
      // Update body class for styling transitions
      document.body.className = 'cyberpunk-theme';
      document.body.classList.add(`${activeEmotion}-theme`);
      
      // Trigger log statement in console
      logToTerminal(`EMOTION SIGNATURE DETECTED: [${activeEmotion.toUpperCase()}]`, 'system-line');
      
      // Update detection count
      detectionCounts[activeEmotion]++;
      document.getElementById(`cnt-${activeEmotion}`).textContent = String(detectionCounts[activeEmotion]).padStart(3, '0');
    }

    // Update statistical details in HUD gauges
    Object.entries(smoothEmotions).forEach(([emo, val]) => {
      // Update progress bar width
      const bar = document.getElementById(`bar-${emo}`);
      if (bar) bar.style.width = `${Math.floor(val * 100)}%`;
      
      // Update percentage text
      const pct = document.getElementById(`pct-${emo}`);
      if (pct) pct.textContent = `${String(Math.floor(val * 100)).padStart(2, '0')}%`;
      
      // Active row glow
      const row = document.querySelector(`.emotion-gauge-row[data-emotion="${emo}"]`);
      if (row) {
        if (emo === activeEmotion) {
          row.classList.add('active');
        } else {
          row.classList.remove('active');
        }
      }

      // Slightly oscillate average values to look dynamic
      if (emo === activeEmotion) {
        avgVelocities[emo] = 0.4 * val + (Math.random() * 0.05);
      } else {
        avgVelocities[emo] *= 0.95; // Decay
      }
      const avg = document.getElementById(`avg-${emo}`);
      if (avg) avg.textContent = avgVelocities[emo].toFixed(2);
    });

    // Update abstract flow canvas weights
    if (visualizer) {
      visualizer.updateEmotions(smoothEmotions, activeEmotion);
    }

    // Render mesh loop depending on mode
    if (currentMode === 'SIMULATOR') {
      // Rotate 3D virtual wireframe
      rotY += 0.012;
      rotX = Math.sin(rotY * 0.5) * 0.15;
      rotZ = Math.cos(rotY * 0.3) * 0.05;
      
      drawSyntheticMesh();
    }
    
    // Draw particles overlaying the video feeds
    updateAndDrawOverlayParticles();
    
    requestAnimationFrame(systemTick);
  }

  // --- MediaPipe FaceMesh Callback ---
  function onFaceMeshResults(results) {
    if (currentMode !== 'WEBCAM') return;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      if (!isFaceLocked) {
        isFaceLocked = true;
        lockStatus.textContent = "LOCKED";
        lockStatus.className = "stat-value text-green";
        meshOverlayAlert.classList.add('hidden');
        logToTerminal("[SYS] NEURAL FACE LOCK DETECTED AND STABILIZED.", "success-line");
      }
      
      const faceLandmarks = results.multiFaceLandmarks[0];
      processFacialMetrics(faceLandmarks);
      drawWebcamMesh(faceLandmarks);
    } else {
      if (isFaceLocked) {
        isFaceLocked = false;
        lockStatus.textContent = "DISENGAGED";
        lockStatus.className = "stat-value text-red";
        meshOverlayAlert.classList.remove('hidden');
        logToTerminal("[WARN] COGNITIVE NEURAL TRACKING INTERRUPTED.", "warning-line");
      }
      
      // Decay back to neutral
      Object.keys(currentEmotions).forEach(key => {
        currentEmotions[key] = key === 'neutral' ? 1.0 : 0.0;
      });
      
      // Clear overlay canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Webcam Activation / Deactivation ---
  async function toggleWebcam() {
    if (isWebcamActive) {
      // Disabling Webcam
      logToTerminal("[SYS] TERMINATING CAMERA DATA STREAM.", "warning-line");
      
      if (cameraInstance) {
        await cameraInstance.stop();
        cameraInstance = null;
      }
      
      video.srcObject = null;
      video.classList.remove('active');
      
      currentMode = 'SIMULATOR';
      isWebcamActive = false;
      isFaceLocked = false;
      
      webcamStatus.innerHTML = '<span class="status-indicator offline"></span> OFFLINE';
      modeStatus.textContent = 'SIMULATOR';
      modeStatus.className = 'stat-value text-blue';
      lockStatus.textContent = 'DISENGAGED';
      lockStatus.className = 'stat-value text-red';
      
      btnToggleCamera.innerHTML = '<i class="fa-solid fa-camera"></i> ENABLE WEBCAM';
      btnToggleCamera.classList.remove('active');
      meshOverlayAlert.classList.add('hidden');
      
      // Remove webcam-specific console buttons
      simControlsPanel.style.display = 'flex';
      
      logToTerminal("[SYS] EMULATION MODULE RE-ACTIVATED.", "system-line");
    } else {
      // Enabling Webcam
      logToTerminal("[SYS] INITIALIZING CAMERA DATA CAPTURE...", "system-line");
      btnToggleCamera.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENGAGING FEED...';
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        
        video.srcObject = stream;
        video.classList.add('active');
        isWebcamActive = true;
        currentMode = 'WEBCAM';
        
        webcamStatus.innerHTML = '<span class="status-indicator online"></span> ONLINE';
        modeStatus.textContent = 'WEBCAM';
        modeStatus.className = 'stat-value text-green';
        btnToggleCamera.innerHTML = '<i class="fa-solid fa-camera-rotate"></i> DISABLE WEBCAM';
        btnToggleCamera.classList.add('active');
        meshOverlayAlert.classList.remove('hidden');
        
        // Hide direct emulator buttons to encourage physical expression
        simControlsPanel.style.display = 'none';
        
        // Initialize MediaPipe FaceMesh if needed
        if (!faceMeshInstance) {
          logToTerminal("[SYS] LOADING MEDIAPIPE FACE MESH MODEL CORE...", "system-line");
          faceMeshInstance = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
          });
          
          faceMeshInstance.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          
          faceMeshInstance.onResults(onFaceMeshResults);
        }
        
        cameraInstance = new Camera(video, {
          onFrame: async () => {
            if (isWebcamActive && faceMeshInstance) {
              await faceMeshInstance.send({ image: video });
            }
          },
          width: 640,
          height: 480
        });
        
        logToTerminal("[SYS] WEBCAM CORE STREAM CAPTURE INITIATED.", "success-line");
        cameraInstance.start();
        
      } catch (err) {
        logToTerminal(`[ERR] WEBCAM STARTUP FAILED: ${err.message}`, "error-line");
        alert("Unable to open camera. Check permissions or make sure another app is not using it.");
        
        // Revert UI to emulator
        isWebcamActive = false;
        currentMode = 'SIMULATOR';
        btnToggleCamera.innerHTML = '<i class="fa-solid fa-camera"></i> ENABLE WEBCAM';
        btnToggleCamera.classList.remove('active');
        webcamStatus.innerHTML = '<span class="status-indicator offline"></span> OFFLINE';
        modeStatus.textContent = 'SIMULATOR';
        modeStatus.className = 'stat-value text-blue';
        simControlsPanel.style.display = 'flex';
      }
    }
  }

  // --- Resize Canvas for Resolution Mapping ---
  function resizeCanvases() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // --- Button & Control Click Handlers ---
  btnToggleCamera.addEventListener('click', toggleWebcam);
  
  btnToggleMesh.addEventListener('click', () => {
    isMeshVisible = !isMeshVisible;
    btnToggleMesh.classList.toggle('active');
    btnToggleMesh.innerHTML = `<i class="fa-solid fa-network-wired"></i> MESH: ${isMeshVisible ? 'ON' : 'OFF'}`;
    logToTerminal(`[SYS] WIREFRAME RENDER CONFIG CHANGED: ${isMeshVisible ? 'ON' : 'OFF'}`);
  });

  btnToggleParticles.addEventListener('click', () => {
    areParticlesActive = !areParticlesActive;
    btnToggleParticles.classList.toggle('active');
    btnToggleParticles.innerHTML = `<i class="fa-solid fa-sparkles"></i> PARTICLES: ${areParticlesActive ? 'ON' : 'OFF'}`;
    logToTerminal(`[SYS] PARTICLE GENERATOR STATE: ${areParticlesActive ? 'ON' : 'OFF'}`);
  });

  // Simulator Buttons Controls
  document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selected = e.target.getAttribute('data-sim-emotion');
      
      document.querySelectorAll('.sim-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Inject synthetic weights (fully setting active emotion)
      Object.keys(currentEmotions).forEach(key => {
        currentEmotions[key] = key === selected ? 1.0 : 0.0;
      });
      
      logToTerminal(`[SIM] MANUAL EMOTION TRIGGER SENT: ${selected.toUpperCase()}`, "log-line");
    });
  });

  // --- Startup Execution ---
  buildSyntheticFace();
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  
  // Set default timestamp
  const formatTime = () => {
    const d = new Date();
    const yr = d.getUTCFullYear();
    const mo = String(d.getUTCMonth()+1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    const hr = String(d.getUTCHours()).padStart(2, '0');
    const mn = String(d.getUTCMinutes()).padStart(2, '0');
    const sc = String(d.getUTCSeconds()).padStart(2, '0');
    document.getElementById('current-timestamp').textContent = `${yr}-${mo}-${dy} ${hr}:${mn}:${sc} UTC`;
  };
  formatTime();
  setInterval(formatTime, 1000);

  runBootSequence();
  systemTick();
});

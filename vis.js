// Emotional Energy Flow Visualizer Engine
class EmotionVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Emotion mapping configurations
    this.emotionConfigs = {
      neutral: { color: '#00f0ff', particleCount: 30, speed: 0.8, noise: 0.1, waveCount: 2 },
      happy: { color: '#ffe600', particleCount: 50, speed: 1.8, noise: 0.5, waveCount: 4 },
      angry: { color: '#ff2255', particleCount: 70, speed: 3.2, noise: 2.2, waveCount: 6 },
      sad: { color: '#0066ff', particleCount: 20, speed: 0.4, noise: 0.05, waveCount: 1 },
      surprised: { color: '#df33ff', particleCount: 60, speed: 2.5, noise: 1.5, waveCount: 5 },
      fearful: { color: '#ff8c00', particleCount: 45, speed: 2.0, noise: 1.8, waveCount: 3 },
      disgusted: { color: '#39ff14', particleCount: 25, speed: 1.0, noise: 0.8, waveCount: 2 }
    };

    this.particles = [];
    this.waves = [];
    this.currentEmotions = {
      neutral: 1.0,
      happy: 0.0,
      angry: 0.0,
      sad: 0.0,
      surprised: 0.0,
      fearful: 0.0,
      disgusted: 0.0
    };
    
    this.activeEmotion = 'neutral';
    this.time = 0;
    
    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Populate initial waves
    for (let i = 0; i < 6; i++) {
      this.waves.push({
        yOffset: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.02,
        amplitude: 15 + Math.random() * 25,
        frequency: 0.005 + Math.random() * 0.01,
        colorIndex: i
      });
    }

    // Start render loop
    this.tick();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width;
    this.height = rect.height;
  }

  updateEmotions(emotions, primary) {
    this.currentEmotions = { ...emotions };
    this.activeEmotion = primary;
    
    // Dynamic particle generation throttle
    const targetParticleCount = Math.max(20, Math.floor(
      (emotions.neutral * this.emotionConfigs.neutral.particleCount) +
      (emotions.happy * this.emotionConfigs.happy.particleCount) +
      (emotions.angry * this.emotionConfigs.angry.particleCount) +
      (emotions.sad * this.emotionConfigs.sad.particleCount) +
      (emotions.surprised * this.emotionConfigs.surprised.particleCount) +
      (emotions.fearful * this.emotionConfigs.fearful.particleCount) +
      (emotions.disgusted * this.emotionConfigs.disgusted.particleCount)
    ));

    // Spawn / cull particles
    if (this.particles.length < targetParticleCount) {
      const needed = targetParticleCount - this.particles.length;
      for (let i = 0; i < needed; i++) {
        this.spawnParticle(true); // Spawn anywhere initially
      }
    } else if (this.particles.length > targetParticleCount) {
      this.particles.length = targetParticleCount;
    }
  }

  spawnParticle(randomX = false) {
    // Select weighted emotion for this particle
    const rand = Math.random();
    let accum = 0;
    let selectedEmotion = 'neutral';
    
    for (const [emo, val] of Object.entries(this.currentEmotions)) {
      accum += val;
      if (rand <= accum) {
        selectedEmotion = emo;
        break;
      }
    }

    const cfg = this.emotionConfigs[selectedEmotion];
    
    this.particles.push({
      x: randomX ? Math.random() * this.width : -20,
      y: Math.random() * this.height,
      size: 1 + Math.random() * 3,
      speed: cfg.speed * (0.8 + Math.random() * 0.4),
      noise: cfg.noise,
      color: cfg.color,
      emotion: selectedEmotion,
      life: 0.2 + Math.random() * 0.8,
      decay: 0.005 + Math.random() * 0.01,
      angle: Math.random() * Math.PI * 2
    });
  }

  drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.01)';
    this.ctx.lineWidth = 1;
    const gridSize = 40;
    
    for (let x = 0; x < this.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }

  drawFlowCurves() {
    this.time += 0.01;
    this.ctx.save();
    
    // Draw waves representing core active emotional currents
    Object.entries(this.currentEmotions).forEach(([emotion, intensity]) => {
      if (intensity < 0.05) return; // Skip barely visible emotions
      
      const config = this.emotionConfigs[emotion];
      this.ctx.beginPath();
      this.ctx.lineWidth = 1.5 + (intensity * 2);
      this.ctx.strokeStyle = this.hexToRgba(config.color, intensity * 0.35);
      this.ctx.shadowBlur = intensity * 15;
      this.ctx.shadowColor = config.color;

      const waveCount = config.waveCount;
      for (let w = 0; w < waveCount; w++) {
        this.ctx.beginPath();
        for (let x = 0; x < this.width; x += 10) {
          let y = this.height / 2;
          
          // Apply specialized wave functions depending on active emotion
          if (emotion === 'neutral') {
            // Calm sine waves
            y += Math.sin(x * 0.006 + this.time * 0.5 + w) * 20;
          } else if (emotion === 'happy') {
            // Bubbling active upward-skewed curves
            y += Math.sin(x * 0.01 + this.time * 1.5 + w) * 35 - 15;
            y += Math.cos(x * 0.005 - this.time * 0.8) * 10;
          } else if (emotion === 'angry') {
            // Jagged saw-tooth/sharp electrical vectors
            y += (Math.sin(x * 0.03 + this.time * 3.5) > 0 ? 1 : -1) * 30 * intensity;
            y += Math.cos(x * 0.1 - this.time * 5.0) * 10 * intensity;
          } else if (emotion === 'sad') {
            // Slow drooping downward sagging curves
            y += Math.sin(x * 0.004 + this.time * 0.2 + w) * 15 + (40 * intensity);
          } else if (emotion === 'surprised') {
            // Erratic high-amplitude bursts
            y += Math.sin(x * 0.015 + this.time * 2.0) * Math.sin(x * 0.002) * 80 * intensity;
          } else if (emotion === 'fearful') {
            // Shivering jittery lines
            y += Math.sin(x * 0.05 + this.time * 4.0) * 15 + (Math.random() - 0.5) * 8;
          } else if (emotion === 'disgusted') {
            // Swirling, organic waves
            y += Math.sin(x * 0.008 + this.time * 0.9) * Math.cos(x * 0.004 + this.time * 0.5) * 45;
          }

          if (x === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        }
        this.ctx.stroke();
      }
    });

    this.ctx.restore();
  }

  drawParticles() {
    this.ctx.save();
    
    this.particles.forEach((p, idx) => {
      const cfg = this.emotionConfigs[p.emotion];
      
      // Compute behavior depending on emotion flow direction
      if (p.emotion === 'neutral') {
        p.x += p.speed;
        p.y += Math.sin(p.x * 0.01) * p.noise * 5;
      } else if (p.emotion === 'happy') {
        p.x += p.speed * 1.1;
        p.y -= p.speed * 0.5; // Bubbles up
        p.y += Math.sin(p.x * 0.02) * 2;
      } else if (p.emotion === 'angry') {
        p.x += p.speed * 1.5;
        p.y += (Math.random() - 0.5) * p.noise * 8; // Jagged vibrations
      } else if (p.emotion === 'sad') {
        p.x += p.speed * 0.5;
        p.y += p.speed * 0.8; // Drifts downward like rain
      } else if (p.emotion === 'surprised') {
        p.angle += 0.02;
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
      } else if (p.emotion === 'fearful') {
        p.x += p.speed * (0.8 + Math.random() * 0.4);
        p.y += (Math.random() - 0.5) * 15; // Shaking
      } else if (p.emotion === 'disgusted') {
        p.x += p.speed * 0.8;
        p.y += Math.sin(p.x * 0.005 + p.speed) * 4;
      }

      // Border bounds wrap or recycle
      if (p.x > this.width + 20 || p.y < -20 || p.y > this.height + 20) {
        this.particles.splice(idx, 1);
        this.spawnParticle(false);
        return;
      }

      // Draw particle with matching color glow
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = p.size * 3;
      this.ctx.shadowColor = p.color;
      
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  tick() {
    if (!this.canvas) return;
    
    // Subtle trail effect
    this.ctx.fillStyle = 'rgba(8, 9, 12, 0.15)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.drawGrid();
    this.drawFlowCurves();
    this.drawParticles();
    
    requestAnimationFrame(() => this.tick());
  }
}

// Export visualizer to window object for access in app.js
window.EmotionVisualizer = EmotionVisualizer;

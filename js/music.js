/* ============================================
   music.js - 音乐播放器
   优先播放 mp3 文件，加载失败时自动切换到
   Web Audio API 合成的夏日轻音乐
   ============================================ */

/* -------- 合成音乐引擎 -------- */
class SynthEngine {
  constructor(onProgress, onLoopEnd) {
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.isPlaying = false;
    this.timer = null;
    this.loopStartTime = 0;
    this.onProgress = onProgress || (() => {});
    this.onLoopEnd = onLoopEnd || (() => {});

    // 夏日风格和弦进行 C - G - Am - F (I-V-vi-IV)
    this.bpm = 76;
    this.beat = 60 / this.bpm;
    this.chords = [
      { name: 'C',  arp: [261.63, 329.63, 392.00, 523.25], mel: [659.25, 783.99, 880.00, 783.99] },
      { name: 'G',  arp: [196.00, 246.94, 293.66, 392.00], mel: [587.33, 783.99, 880.00, 783.99] },
      { name: 'Am', arp: [220.00, 261.63, 329.63, 440.00], mel: [523.25, 659.25, 783.99, 659.25] },
      { name: 'F',  arp: [174.61, 220.00, 261.63, 349.23], mel: [523.25, 698.46, 880.00, 698.46] },
    ];
    this.beatsPerChord = 4;
    this.totalBeats = this.chords.length * this.beatsPerChord;
    this.duration = this.totalBeats * this.beat; // 单循环秒数
  }

  _ensureCtx() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    // 主音量
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;

    // 简单混响（用卷积 + 衰减白噪声）
    this.reverbNode = this.ctx.createGain();
    this.reverbNode.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);
  }

  // 单个柔和音色（钢琴/竖琴感的合成）
  _playNote(freq, time, duration, volume = 0.18, type = 'sine') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    // ADSR 包络
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(volume * 0.4, time + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    gain.connect(this.reverbNode);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  _scheduleLoop() {
    if (!this.ctx) return;
    const startTime = this.ctx.currentTime;
    this.loopStartTime = startTime;

    for (let i = 0; i < this.chords.length; i++) {
      const chord = this.chords[i];
      const chordStart = startTime + i * this.beatsPerChord * this.beat;

      // 琶音：每拍一个音
      for (let j = 0; j < 4; j++) {
        const t = chordStart + j * this.beat;
        this._playNote(chord.arp[j], t, this.beat * 0.9, 0.10, 'sine');
        // 加一个低八度叠加，厚实感
        this._playNote(chord.arp[j] * 0.5, t, this.beat * 0.9, 0.06, 'triangle');
      }

      // 旋律：在后两拍
      for (let k = 0; k < chord.mel.length; k++) {
        const t = chordStart + (2 + k * 0.5) * this.beat;
        this._playNote(chord.mel[k], t, this.beat * 0.6, 0.08, 'triangle');
      }

      // 根音（低音铺底）
      this._playNote(chord.arp[0] * 0.25, chordStart, this.beatsPerChord * this.beat * 0.95, 0.05, 'sine');
    }

    // 安排循环
    this.timer = setTimeout(() => {
      if (this.isPlaying) {
        this.onLoopEnd();
        this._scheduleLoop();
      }
    }, this.duration * 1000 - 100);
  }

  _tickProgress() {
    if (!this.isPlaying || !this.ctx) return;
    const elapsed = this.ctx.currentTime - this.loopStartTime;
    const cycle = this.duration;
    const inCycle = ((elapsed % cycle) + cycle) % cycle;
    this.onProgress(inCycle / cycle, elapsed);
    requestAnimationFrame(() => this._tickProgress());
  }

  play() {
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPlaying = true;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.4);
    this._scheduleLoop();
    this._tickProgress();
  }

  pause() {
    this.isPlaying = false;
    clearTimeout(this.timer);
    if (this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    }
  }

  stop() {
    this.pause();
    if (this.ctx) {
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    }
  }
}

/* -------- 音乐播放器主类 -------- */
class MusicPlayer {
  constructor() {
    this.player = document.getElementById('music-player');
    this.playIcon = document.getElementById('music-play-icon');
    this.panel = document.getElementById('music-panel');
    this.toggleBtn = document.getElementById('music-toggle-play');
    this.progressBar = document.getElementById('music-progress-bar');
    this.currentTimeEl = document.getElementById('music-current');
    this.durationEl = document.getElementById('music-duration');

    this.isPlaying = false;
    this.useSynth = true;  // 默认用合成器（无 mp3 文件）
    this.synth = null;
    this.userInteracted = false;

    // 初始化合成器
    this.synth = new SynthEngine(
      (ratio, elapsed) => {
        if (this.progressBar) this.progressBar.style.width = (ratio * 100) + '%';
        if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(elapsed % this.synth.duration);
      },
      () => {}
    );
    if (this.durationEl) this.durationEl.textContent = this.formatTime(this.synth.duration);

    this.bindEvents();

    // 自动播放尝试
    setTimeout(() => this.tryAutoplay(), 800);
  }

  bindEvents() {
    if (this.player) {
      this.player.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }
    if (this.panel) {
      this.panel.addEventListener('click', (e) => e.stopPropagation());
    }
    document.addEventListener('click', () => {
      if (this.panel) this.panel.classList.remove('show');
    }, { passive: true });
  }

  tryAutoplay() {
    if (!SITE_CONFIG.music.autoplay) return;
    this.play();
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  play() {
    this.synth.play();
    this.isPlaying = true;
    if (this.player) this.player.classList.add('playing');
    if (this.playIcon) this.playIcon.textContent = '⏸';
    if (this.toggleBtn) this.toggleBtn.textContent = '⏸';
  }

  pause() {
    this.synth.pause();
    this.isPlaying = false;
    if (this.player) this.player.classList.remove('playing');
    if (this.playIcon) this.playIcon.textContent = '▶';
    if (this.toggleBtn) this.toggleBtn.textContent = '▶';
  }

  formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.musicPlayer = new MusicPlayer();
});

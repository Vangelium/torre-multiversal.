/* Torre Multiversal · Rey Slime · sonido (v2 · 13-11-2026)
 *
 * Efectos y música de jefe sintetizados en el momento con WebAudio, usando
 * el MISMO contexto y los mismos buses del juego (app.audio): respetan los
 * volúmenes de Ajustes (efectos → bus sfx, música → bus music).
 */
(function (root) {
  'use strict';

  class ReyAudio {
    constructor(app) {
      this.app = app; this.music = null; this._noise = null;
      this.track = null; this.trackInfo = null; this._trackLoading = null;
      this.loadTrack();
    }
    // ── Pista del jefe reemplazable (beta/audio/rey-slime.json) ──────────────
    // Si el manifiesto apunta a un archivo, se usa ese audio en bucle; si no,
    // suena la pista temporal sintetizada. Cambiar la música = cambiar el JSON.
    loadTrack() {
      if (this._trackLoading || typeof fetch !== 'function') return this._trackLoading;
      this._trackLoading = fetch('audio/rey-slime.json', { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : null))
        .then(info => {
          this.trackInfo = info || null;
          if (!info || typeof info.track !== 'string' || !/^[\w.-]+\.(mp3|ogg|m4a|wav)$/i.test(info.track)) return null;
          return fetch('audio/' + info.track).then(r => (r.ok ? r.arrayBuffer() : null));
        })
        .then(buf => { if (buf) this._trackBytes = buf; })
        .catch(() => { /* sin pista: se usa la temporal */ });
      return this._trackLoading;
    }
    decodeTrack() {
      const ctx = this.ctx;
      if (this.track || !ctx || !this._trackBytes || this._decoding) return;
      this._decoding = true;
      ctx.decodeAudioData(this._trackBytes.slice(0)).then(b => { this.track = b; }).catch(() => { this._trackBytes = null; }).finally(() => { this._decoding = false; });
    }
    get ctx() { const a = this.app.audio; return a && a.ctx && a.ctx.state === 'running' ? a.ctx : null; }
    bus(kind) { const a = this.app.audio; return a && a.buses ? a.buses[kind] : null; }
    noise() {
      const ctx = this.ctx; if (!ctx) return null;
      if (this._noise && this._noise.sampleRate === ctx.sampleRate) return this._noise;
      const len = ctx.sampleRate * 1.5, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return (this._noise = b);
    }
    // Envolvente básica.
    env(g, t, a, peak, hold, rel) {
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      g.gain.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    }
    tone({ wave = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.2, at = 0, a = 0.005, bus = 'sfx', filter = null, q = 1, detune = 0 }) {
      const ctx = this.ctx, out = this.bus(bus); if (!ctx || !out) return;
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave; o.frequency.setValueAtTime(f0, t); o.detune.value = detune;
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      let node = o;
      if (filter) { const fl = ctx.createBiquadFilter(); fl.type = filter.type; fl.frequency.value = filter.f; fl.Q.value = q; o.connect(fl); node = fl; }
      node.connect(g); g.connect(out);
      this.env(g, t, a, vol, dur * 0.25, dur * 0.75);
      o.start(t); o.stop(t + a + dur + 0.05);
    }
    hiss({ dur = 0.3, vol = 0.15, at = 0, type = 'lowpass', f0 = 800, f1 = f0, q = 0.8, a = 0.01, bus = 'sfx' }) {
      const ctx = this.ctx, out = this.bus(bus), buf = this.noise(); if (!ctx || !out || !buf) return;
      const t = ctx.currentTime + at, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(f0, t); if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      src.connect(fl); fl.connect(g); g.connect(out);
      this.env(g, t, a, vol, dur * 0.2, dur * 0.8);
      src.start(t, Math.random() * 0.5); src.stop(t + a + dur + 0.05);
    }

    // ── Efectos ────────────────────────────────────────────────────────────
    place(i = 0) { // un limo sube a su pedestal
      const n = [523, 587, 659, 784, 880, 988, 1047, 1175, 1319, 1568][i % 10];
      this.tone({ wave: 'triangle', f0: n, f1: n * 1.5, dur: 0.12, vol: 0.12 });
      this.tone({ wave: 'sine', f0: n * 2, dur: 0.3, vol: 0.05, at: 0.05 });
    }
    unplace() { this.tone({ wave: 'triangle', f0: 660, f1: 330, dur: 0.14, vol: 0.1 }); }
    chime(i) { // runas que se encienden una a una (pentatónica)
      const n = [392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319][i % 10];
      this.tone({ wave: 'sine', f0: n, dur: 0.9, vol: 0.09 });
      this.tone({ wave: 'triangle', f0: n * 2.01, dur: 0.5, vol: 0.035, at: 0.01 });
    }
    gloop(i) { // un limo cae en la masa central
      const p = 1 + i * 0.07;
      this.tone({ wave: 'sine', f0: 380 * p, f1: 120 * p, dur: 0.16, vol: 0.2 });
      this.tone({ wave: 'sine', f0: 900 * p, f1: 1500 * p, dur: 0.06, vol: 0.05, at: 0.08 });
      this.hiss({ dur: 0.08, vol: 0.05, type: 'bandpass', f0: 1200, q: 2 });
    }
    rumble(dur = 2) {
      this.hiss({ dur, vol: 0.32, type: 'lowpass', f0: 90, f1: 180, a: dur * 0.6 });
      this.tone({ wave: 'sine', f0: 42, f1: 58, dur, vol: 0.22, a: dur * 0.5 });
    }
    whoosh(up = true) { this.hiss({ dur: 0.35, vol: 0.14, type: 'bandpass', f0: up ? 400 : 2400, f1: up ? 2600 : 300, q: 1.2 }); }
    boom(big = true) {
      this.tone({ wave: 'sine', f0: big ? 110 : 160, f1: 32, dur: big ? 0.9 : 0.35, vol: big ? 0.5 : 0.28 });
      this.hiss({ dur: big ? 0.8 : 0.3, vol: big ? 0.35 : 0.18, type: 'lowpass', f0: big ? 1400 : 900, f1: 120 });
    }
    thud() { this.tone({ wave: 'sine', f0: 150, f1: 55, dur: 0.14, vol: 0.18 }); this.hiss({ dur: 0.08, vol: 0.06, f0: 600 }); }
    crownLand() {
      [1568, 2093, 2637].forEach((f, i) => this.tone({ wave: 'triangle', f0: f, dur: 0.6, vol: 0.07, at: i * 0.03 }));
      this.boom(true);
    }
    roar() {
      const ctx = this.ctx; if (!ctx) return;
      this.tone({ wave: 'sawtooth', f0: 210, f1: 95, dur: 1.4, vol: 0.2, a: 0.06, filter: { type: 'lowpass', f: 900 }, q: 4 });
      this.tone({ wave: 'square', f0: 160, f1: 70, dur: 1.3, vol: 0.08, a: 0.08, detune: 18, filter: { type: 'lowpass', f: 600 } });
      this.hiss({ dur: 1.2, vol: 0.2, type: 'bandpass', f0: 500, f1: 260, q: 0.9, a: 0.05 });
    }
    warn() { this.tone({ wave: 'square', f0: 880, f1: 990, dur: 0.07, vol: 0.05 }); }
    summon() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone({ wave: 'triangle', f0: f, f1: f * 0.5, dur: 0.25, vol: 0.08, at: i * 0.07 }));
      this.hiss({ dur: 0.6, vol: 0.1, type: 'highpass', f0: 2000 });
    }
    pop() { this.tone({ wave: 'sine', f0: 600, f1: 1800, dur: 0.12, vol: 0.12 }); }
    deflate() {
      this.tone({ wave: 'sine', f0: 420, f1: 70, dur: 1.4, vol: 0.18, a: 0.02 });
      this.tone({ wave: 'triangle', f0: 300, f1: 60, dur: 1.2, vol: 0.06, detune: 30 });
    }
    victory() {
      const seq = [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42], [988, 0.62], [1047, 0.74], [1319, 0.9]];
      seq.forEach(([f, at], i) => this.tone({ wave: i < 4 ? 'square' : 'triangle', f0: f, dur: i === seq.length - 1 ? 0.9 : 0.16, vol: 0.09, at, bus: 'music' }));
      [262, 330, 392].forEach(f => this.tone({ wave: 'triangle', f0: f, dur: 1.6, vol: 0.06, at: 0.9, bus: 'music' }));
    }
    pardon() { [523, 659, 784, 988, 1175, 1568].forEach((f, i) => this.tone({ wave: 'sine', f0: f, dur: 0.7, vol: 0.07, at: i * 0.08 })); }
    forge() {
      this.tone({ wave: 'triangle', f0: 2093, dur: 1.2, vol: 0.08 });
      this.tone({ wave: 'triangle', f0: 3136, dur: 0.9, vol: 0.05, at: 0.02 });
      this.hiss({ dur: 0.25, vol: 0.12, type: 'highpass', f0: 3000 });
    }

    // ── Música del jefe ────────────────────────────────────────────────────
    // Re menor, 148 ppm. Bajo ostinato + bombo + caja + arpegio. Se programa
    // por adelantado en pequeños bloques (sin cortes si el teléfono va lento).
    // ── Formas II y III ──
    transform(form = 2) { // la masa se retuerce, crece y ruge
      this.rumble(2.4);
      this.hiss({ dur: 1.6, vol: 0.12, type: 'bandpass', f0: 180, f1: 1400, q: 2 });
      [0, 0.35, 0.7, 1.05].forEach((at, i) => this.tone({ wave: 'sine', f0: 90 + i * 30, f1: 260 + i * 60, dur: 0.3, vol: 0.12, at }));
      this.tone({ wave: 'sawtooth', f0: form === 3 ? 55 : 70, f1: form === 3 ? 41 : 52, dur: 1.2, vol: 0.14, at: 1.6, filter: { type: 'lowpass', f: 600 } });
      setTimeout(() => { this.roar(); this.boom(true); }, 2000);
    }
    stomp() { this.tone({ wave: 'sine', f0: 95, f1: 38, dur: 0.22, vol: 0.22 }); this.hiss({ dur: 0.12, vol: 0.07, f0: 380 }); }
    chargeUp(dur = 0.9) { // el puño del Rey se carga de luz
      this.tone({ wave: 'sawtooth', f0: 110, f1: 660, dur, vol: 0.06, filter: { type: 'lowpass', f: 1800 } });
      this.tone({ wave: 'sine', f0: 220, f1: 1320, dur, vol: 0.05 });
    }
    punch() { // Puñetazo del Rey
      this.boom(true);
      this.hiss({ dur: 0.5, vol: 0.2, type: 'lowpass', f0: 2600, f1: 200 });
      this.tone({ wave: 'square', f0: 70, f1: 30, dur: 0.5, vol: 0.12, filter: { type: 'lowpass', f: 400 } });
    }
    crunch() { // madera que cruje y se astilla
      for (let i = 0; i < 4; i++) this.hiss({ dur: 0.05, vol: 0.12, type: 'bandpass', f0: 900 + i * 500, q: 3, at: i * 0.045 });
      this.tone({ wave: 'triangle', f0: 180, f1: 90, dur: 0.18, vol: 0.08, at: 0.05 });
    }
    spines() { // brotan las espinas
      for (let i = 0; i < 6; i++) this.tone({ wave: 'square', f0: 1400 - i * 80, f1: 2600, dur: 0.05, vol: 0.04, at: i * 0.03 });
      this.hiss({ dur: 0.25, vol: 0.14, type: 'highpass', f0: 3000 });
    }
    suck(dur = 1.4) { this.hiss({ dur, vol: 0.12, type: 'bandpass', f0: 2400, f1: 250, q: 1.5 }); this.tone({ wave: 'sine', f0: 600, f1: 120, dur, vol: 0.06 }); }
    spit() { for (let i = 0; i < 5; i++) this.tone({ wave: 'sine', f0: 300 + i * 90, f1: 900, dur: 0.08, vol: 0.08, at: i * 0.04 }); }
    /** Intensidad de la música: 1, 2 o 3 según la forma del Rey (solo la pista temporal). */
    setIntensity(n) { this.intensity = Math.max(1, Math.min(3, n | 0)); }

    startMusic() {
      const ctx = this.ctx; if (!ctx || this.music) return;
      const out = this.bus('music'); if (!out) return;
      const vol = this.trackInfo && Number.isFinite(this.trackInfo.volume) ? Math.max(0.05, Math.min(1.5, this.trackInfo.volume)) : 0.9;
      const master = ctx.createGain(); master.gain.value = 0.0001; master.connect(out);
      master.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 1.2);
      this.decodeTrack();
      if (this.track) {
        // Pista final (archivo).
        const src = ctx.createBufferSource();
        src.buffer = this.track; src.loop = true;
        const ls = this.trackInfo && Number.isFinite(this.trackInfo.loopStart) ? this.trackInfo.loopStart : 0;
        if (ls > 0 && ls < this.track.duration) { src.loopStart = ls; src.loopEnd = this.track.duration; }
        src.connect(master); src.start();
        this.music = { master, src, timer: 0, file: true };
        return;
      }
      const m = this.music = { master, next: ctx.currentTime + 0.1, step: 0, timer: 0 };
      const spbOf = () => 60 / (148 + ((this.intensity || 1) - 1) * 10) / 2; // corcheas (más rápido en cada forma)
      const D = 73.42, F = 87.31, C = 65.41, A = 55, Bb = 58.27, E = 82.41, Cs = 69.3;
      const bass = [D, D, F, D, D, D, A * 2, D, C, C, A, C, C, C, E, C, Bb, Bb, D, Bb, Bb, Bb, F, Bb, A, A, Cs, A, E, E, Cs, E];
      const arp = [293.7, 349.2, 440, 587.3, 440, 349.2];
      const play = (fn) => { try { fn(); } catch (_) { /* audio interrumpido */ } };
      const sched = () => {
        const c = this.ctx; if (!c || this.music !== m) return;
        while (m.next < c.currentTime + 0.35) {
          const t = m.next, s = m.step, bar = Math.floor(s / 8) % 16, spb = spbOf(), lvl = this.intensity || 1;
          play(() => {
            // Bajo.
            const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
            o.type = 'sawtooth'; o.frequency.value = bass[s % 32]; fl.type = 'lowpass'; fl.frequency.value = 520; fl.Q.value = 6;
            o.connect(fl); fl.connect(g); g.connect(m.master);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.95);
            o.start(t); o.stop(t + spb);
            // Bombo en negras.
            if (s % 2 === 0) {
              const k = c.createOscillator(), kg = c.createGain();
              k.frequency.setValueAtTime(130, t); k.frequency.exponentialRampToValueAtTime(42, t + 0.12);
              k.connect(kg); kg.connect(m.master);
              kg.gain.setValueAtTime(0.0001, t); kg.gain.exponentialRampToValueAtTime(0.4, t + 0.004); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
              k.start(t); k.stop(t + 0.22);
            }
            // Caja en 2 y 4 + platillo suave en corcheas.
            const buf = this.noise();
            if (buf) {
              const hit = (vol, f, dur, type) => {
                const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
                n.buffer = buf; nf.type = type; nf.frequency.value = f; n.connect(nf); nf.connect(ng); ng.connect(m.master);
                ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(vol, t + 0.003); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                n.start(t, Math.random()); n.stop(t + dur + 0.02);
              };
              if (s % 8 === 4) hit(0.22, 1800, 0.16, 'bandpass');
              if (bar >= 2) hit(s % 2 ? 0.03 : 0.05, 7000, 0.05, 'highpass');
            }
            // Forma II: sub-bajo que empuja. Forma III: metales en cada compás.
            if (lvl >= 2 && s % 2 === 0) {
              const o2 = c.createOscillator(), g2 = c.createGain();
              o2.type = 'sine'; o2.frequency.value = bass[s % 32] / 2; o2.connect(g2); g2.connect(m.master);
              g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + spb * 1.8);
              o2.start(t); o2.stop(t + spb * 2);
            }
            if (lvl >= 3 && s % 8 === 0) {
              [1, 1.5, 2].forEach(mul => {
                const b = c.createOscillator(), bg = c.createGain(), bf = c.createBiquadFilter();
                b.type = 'sawtooth'; b.frequency.value = bass[s % 32] * 2 * mul; bf.type = 'lowpass'; bf.frequency.value = 1400;
                b.connect(bf); bf.connect(bg); bg.connect(m.master);
                bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.05, t + 0.03); bg.gain.exponentialRampToValueAtTime(0.0001, t + spb * 3.5);
                b.start(t); b.stop(t + spb * 4);
              });
            }
            // Arpegio a partir del compás 4 (entrada progresiva; siempre en la Forma III).
            if ((bar >= 4 || lvl >= 3) && (bar % 4 !== 3 || lvl >= 2)) {
              const root = bass[s % 32] * 4, f = arp[s % 6] * (root / 293.7);
              const a = c.createOscillator(), ag = c.createGain();
              a.type = 'square'; a.frequency.value = f; a.connect(ag); ag.connect(m.master);
              ag.gain.setValueAtTime(0.0001, t); ag.gain.exponentialRampToValueAtTime(0.025, t + 0.01); ag.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.8);
              a.start(t); a.stop(t + spb);
            }
          });
          m.next += spb; m.step++;
        }
        m.timer = setTimeout(sched, 90);
      };
      sched();
    }
    stopMusic(fade = 1.2) {
      const m = this.music; if (!m) return;
      this.music = null; clearTimeout(m.timer);
      if (m.src) { try { m.src.stop((this.ctx ? this.ctx.currentTime : 0) + fade + 0.1); } catch (_) { /* ya detenida */ } }
      const c = this.ctx;
      if (c) { m.master.gain.cancelScheduledValues(c.currentTime); m.master.gain.setValueAtTime(m.master.gain.value || 0.5, c.currentTime); m.master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade); }
      setTimeout(() => { try { m.master.disconnect(); } catch (_) { /* ya desconectado */ } }, fade * 1000 + 200);
    }
  }

  root.TMReyAudio = ReyAudio;
})(typeof window !== 'undefined' ? window : globalThis);

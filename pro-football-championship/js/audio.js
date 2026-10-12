/**
 * PRO FOOTBALL CHAMPIONSHIP - PROCEDURAL WEB AUDIO SYNTHESIZER
 * Zero external audio files required! 100% reliable and instantaneous.
 */

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.crowdGain = null;
        this.crowdSource = null;
        this.isCrowdPlaying = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.initialized = true;
            this.setupCrowdAmbience();
        } catch (e) {
            console.warn("AudioContext not supported or blocked", e);
        }
    }

    resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.enabled = !this.enabled;
        if (this.crowdGain) {
            this.crowdGain.gain.setValueAtTime(this.enabled ? 0.08 : 0, this.ctx ? this.ctx.currentTime : 0);
        }
        return this.enabled;
    }

    // Ball kick sound: thud + leather pop
    playKick(power = 1.0) {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const clampedPower = Math.min(Math.max(power, 0.2), 1.5);

        // Low frequency thud
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140 * clampedPower, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

        gain.gain.setValueAtTime(0.7 * clampedPower, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);

        // Snap/Click noise
        const bufferSize = this.ctx.sampleRate * 0.04;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1800, now);
        noiseFilter.Q.setValueAtTime(2.0, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4 * clampedPower, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
    }

    // Referee Whistle
    playWhistle(type = 'short') {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const duration = type === 'long' ? 0.9 : (type === 'double' ? 0.7 : 0.35);

        const playSinglePulse = (startTime, pulseDuration) => {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            // Dual tone authentic whistle harmonics
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(2850, startTime);
            osc2.frequency.setValueAtTime(3120, startTime);

            // Modulating vibrato for real air turbulence
            const mod = this.ctx.createOscillator();
            const modGain = this.ctx.createGain();
            mod.frequency.setValueAtTime(24, startTime);
            modGain.gain.setValueAtTime(80, startTime);
            mod.connect(osc1.frequency);
            mod.connect(osc2.frequency);
            mod.start(startTime);
            mod.stop(startTime + pulseDuration);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.04);
            gain.gain.setValueAtTime(0.28, startTime + pulseDuration - 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + pulseDuration);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.ctx.destination);

            osc1.start(startTime);
            osc2.start(startTime);
            osc1.stop(startTime + pulseDuration);
            osc2.stop(startTime + pulseDuration);
        };

        if (type === 'double') {
            playSinglePulse(now, 0.22);
            playSinglePulse(now + 0.3, 0.38);
        } else {
            playSinglePulse(now, duration);
        }
    }

    // Goal Post Metallic Hit (Clang!)
    playPostHit() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const frequencies = [820, 1420, 2150, 3100];

        frequencies.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now);

            const decTime = 0.5 + idx * 0.15;
            gain.gain.setValueAtTime(0.25 / (idx + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + decTime);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + decTime);
        });
    }

    // Net Swish
    playNetHit() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const dur = 0.35;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
        }

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(now);
    }

    // Slide Tackle on grass
    playTackle() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const dur = 0.3;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(250, now + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(now);
    }

    // Goal Celebration: Massive stadium cheer + air horn
    playGoalCelebration() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // Referee full-time/goal whistle
        this.playWhistle('long');

        // Stadium Air Horn blast!
        const hornNotes = [311.13, 392.00, 466.16]; // Eb, G, Bb major triad
        hornNotes.forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + 0.1);

            gain.gain.setValueAtTime(0.001, now + 0.1);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.2);
            gain.gain.setValueAtTime(0.16, now + 0.9);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2200, now);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + 0.1);
            osc.stop(now + 1.45);
        });

        // Surge crowd noise
        this.surgeCrowd(2.5, 3.5);
    }

    // Crowd ambience looping generator
    setupCrowdAmbience() {
        if (!this.ctx || this.crowdSource) return;

        // 3 seconds of looped shaped crowd noise
        const dur = 4.0;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);

        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                // Pink noise filter approximation
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut * 0.95) + (white * 0.05);
                data[i] = lastOut * 1.8;
            }
        }

        this.crowdSource = this.ctx.createBufferSource();
        this.crowdSource.buffer = buffer;
        this.crowdSource.loop = true;

        const filter1 = this.ctx.createBiquadFilter();
        filter1.type = 'bandpass';
        filter1.frequency.value = 650;
        filter1.Q.value = 0.8;

        this.crowdGain = this.ctx.createGain();
        this.crowdGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        this.crowdSource.connect(filter1);
        filter1.connect(this.crowdGain);
        this.crowdGain.connect(this.ctx.destination);

        this.crowdSource.start(0);
        this.isCrowdPlaying = true;
    }

    surgeCrowd(multiplier = 2.0, duration = 2.0) {
        if (!this.enabled || !this.crowdGain || !this.ctx) return;
        const now = this.ctx.currentTime;
        const base = 0.08;
        this.crowdGain.gain.cancelScheduledValues(now);
        this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
        this.crowdGain.gain.linearRampToValueAtTime(base * multiplier, now + 0.4);
        this.crowdGain.gain.linearRampToValueAtTime(base * multiplier * 0.8, now + duration * 0.6);
        this.crowdGain.gain.exponentialRampToValueAtTime(base, now + duration);
    }

    // UI Click sound
    playClick() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.055);
    }
}

window.soundSystem = new SoundSystem();

/**
 * TYMVERA Signature Alarm & Acoustic Engine
 * Features:
 * - Single Flagship Sound: "TYMVERA Obsidian Beacon" — loud, crisp, punchy, high-urgency acoustic synthesizer
 * - Dynamics compressor limiter node for maximum perceived loudness without distortion on mobile speakers
 * - Silent Audio Keep-Alive carrier to prevent mobile browser / PWA timer throttling during screen sleep
 * - Screen Wake Lock support during active alarm ringing
 * - Synchronized tactile vibration pattern
 * - Universal AudioContext unlocker on first user touch/click/interaction
 */

let activeAudioCtx = null;
let activeCompressor = null;
let activeAlarmInterval = null;
let activeWakeLock = null;
let activeOscillators = [];
let keepAliveOsc = null;
let keepAliveGain = null;

/**
 * Returns or creates the persistent AudioContext with dynamic broadcast limiter
 */
export function getAudioContext() {
  try {
    if (typeof window === 'undefined') return null;

    if (!activeAudioCtx || activeAudioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        activeAudioCtx = new AudioContextClass();

        // Dynamics Compressor acts as a broadcast limiter:
        // Maximizes loudness and punches up transients while preventing speaker clipping
        activeCompressor = activeAudioCtx.createDynamicsCompressor();
        activeCompressor.threshold.setValueAtTime(-16, activeAudioCtx.currentTime);
        activeCompressor.knee.setValueAtTime(6, activeAudioCtx.currentTime);
        activeCompressor.ratio.setValueAtTime(10, activeAudioCtx.currentTime);
        activeCompressor.attack.setValueAtTime(0.003, activeAudioCtx.currentTime);
        activeCompressor.release.setValueAtTime(0.12, activeAudioCtx.currentTime);
        activeCompressor.connect(activeAudioCtx.destination);
      }
    }

    if (activeAudioCtx && activeAudioCtx.state === 'suspended') {
      activeAudioCtx.resume().catch(() => {});
    }

    return activeAudioCtx;
  } catch (err) {
    console.warn('[AlarmEngine] Failed to create AudioContext:', err);
    return null;
  }
}

/**
 * Master output destination (routed through compressor limiter)
 */
function getMasterDestination(ctx) {
  return activeCompressor || ctx.destination;
}

let silentAudioEl = null;
let keepAliveStarted = false;

/**
 * Starts an inaudible audio carrier and active MediaSession to keep the mobile OS from freezing
 * timer threads and audio contexts when the device screen locks or is placed in a pocket.
 */
export function startAudioKeepAlive() {
  if (keepAliveStarted) return;
  keepAliveStarted = true;

  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (!keepAliveOsc) {
        keepAliveOsc = ctx.createOscillator();
        keepAliveGain = ctx.createGain();

        // Inaudible amplitude (0.00002) at 35Hz
        keepAliveGain.gain.setValueAtTime(0.00002, ctx.currentTime);
        keepAliveOsc.frequency.setValueAtTime(35, ctx.currentTime);

        keepAliveOsc.connect(keepAliveGain);
        keepAliveGain.connect(ctx.destination);
        keepAliveOsc.start();
      }
    }

    // HTML5 Audio silent loop for mobile OS media framework immunity
    if (typeof window !== 'undefined' && !silentAudioEl) {
      silentAudioEl = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      silentAudioEl.loop = true;
      silentAudioEl.volume = 0.0001;
      silentAudioEl.setAttribute('playsinline', '');
      silentAudioEl.setAttribute('webkit-playsinline', '');

      const playPromise = silentAudioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'TYMVERA Active Routine Monitor',
          artist: 'Section Alerts & Alarms Armed',
          album: 'TYMVERA',
          artwork: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
        });
      }
    }
  } catch (e) {
    // Keep-alive is best-effort
  }
}

/**
 * Global unlocker attached to user interactions (touch, click, keydown).
 * Primes the audio context and launches keep-alive carrier once, then removes listeners.
 */
export function initAudioContextUnlocker() {
  if (typeof window === 'undefined') return;

  const events = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];
  let handled = false;

  const unlockAudio = () => {
    if (handled) return;
    handled = true;

    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      startAudioKeepAlive();
    } catch (e) {}

    events.forEach((evt) => {
      try {
        window.removeEventListener(evt, unlockAudio, { capture: true });
      } catch (e) {}
    });
  };

  events.forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { passive: true, capture: true, once: true });
  });
}

/**
 * Request Screen Wake Lock during active ringing so smartphone displays remain on
 */
async function acquireWakeLock() {
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      activeWakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {}
}

function releaseWakeLock() {
  try {
    if (activeWakeLock) {
      activeWakeLock.release();
      activeWakeLock = null;
    }
  } catch {}
}

/**
 * Stop active ringing alarm and release wake lock
 */
export function stopAlarmSound() {
  if (activeAlarmInterval) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }

  activeOscillators.forEach((node) => {
    try {
      node.stop();
      node.disconnect();
    } catch {}
  });
  activeOscillators = [];

  releaseWakeLock();

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/**
 * TYMVERA Signature Obsidian Beacon Alarm
 * Loud, cutting, high-urgency acoustic synthesizer tailored to the dark obsidian theme.
 * Features:
 * - Sub-bass kick transient (140Hz -> 45Hz) for physical chest thump
 * - High-energy resonant dual beacon (1046.5Hz C6 + 1567.98Hz G6) with harmonic overtone (2093Hz C7 + 2637Hz E7)
 * - Rhythmic double-strike cadence (PULSE-PULSE ... PULSE-PULSE) repeating every 0.95s
 * - Max volume routed through dynamics compressor limiter
 */
export function playAlarmSound(volume = 1.0) {
  stopAlarmSound();
  acquireWakeLock();
  startAudioKeepAlive();

  try {
    const ctx = getAudioContext();
    if (!ctx) return () => {};

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const dest = getMasterDestination(ctx);

    const playCycle = () => {
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const vol = Math.min(1.0, Math.max(0.2, volume));

      // Master gain for this alarm cycle
      const cycleGain = ctx.createGain();
      cycleGain.gain.setValueAtTime(vol * 0.95, now);
      cycleGain.connect(dest);

      // Double-strike pattern timestamps:
      // Strike 1: t=0.00s (Beacon + Sub-kick)
      // Strike 2: t=0.14s (High Accent Strike)
      // Strike 3: t=0.38s (Beacon + Sub-kick)
      // Strike 4: t=0.52s (High Accent Strike)
      const strikes = [
        { time: now + 0.00, hasKick: true, freqs: [1046.5, 1567.98] },
        { time: now + 0.14, hasKick: false, freqs: [2093.0, 2637.02] },
        { time: now + 0.38, hasKick: true, freqs: [1046.5, 1567.98] },
        { time: now + 0.52, hasKick: false, freqs: [2093.0, 2637.02] },
      ];

      strikes.forEach((strike) => {
        const t = strike.time;

        // 1. Sub-bass punch transient (gives the alarm physical weight and presence)
        if (strike.hasKick) {
          const kickOsc = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(145, t);
          kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

          kickGain.gain.setValueAtTime(0.001, t);
          kickGain.gain.linearRampToValueAtTime(0.55 * vol, t + 0.006);
          kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);

          kickOsc.connect(kickGain);
          kickGain.connect(cycleGain);
          kickOsc.start(t);
          kickOsc.stop(t + 0.11);
          activeOscillators.push(kickOsc);
        }

        // 2. High-energy dual beacon tones (penetrates background noise)
        strike.freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          // Sawtooth filtered gives a sharp modern cyber acoustic edge
          osc.type = idx === 0 ? 'triangle' : 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(3200, t);
          filter.Q.setValueAtTime(2.0, t);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.45 * vol, t + 0.008);
          gain.gain.setValueAtTime(0.40 * vol, t + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(cycleGain);

          osc.start(t);
          osc.stop(t + 0.12);
          activeOscillators.push(osc);
        });
      });

      // Synchronized intense tactile vibration
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([140, 70, 140, 220, 140, 70, 140, 450]);
      }
    };

    playCycle();
    activeAlarmInterval = setInterval(playCycle, 950);

    return stopAlarmSound;
  } catch (err) {
    console.warn('[AlarmEngine] Alarm playback error:', err);
    return () => {};
  }
}

/**
 * TYMVERA Signature Focus Notification Chime
 * Loud, crisp, crystalline double-strike chime (1318.5Hz E6 -> 1975.5Hz B6 with 2637Hz sparkle).
 * Audible across a room with zero lag.
 */
export function playNotificationChime(volume = 0.95) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const dest = getMasterDestination(ctx);
    const now = ctx.currentTime;
    const vol = Math.min(1.0, Math.max(0.3, volume));

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(vol * 0.95, now);
    masterGain.connect(dest);

    // Strike 1 (t=0.0s): 1318.51Hz (E6) + 1975.53Hz (B6)
    // Strike 2 (t=0.10s): 1975.53Hz (B6) + 2637.02Hz (E7) + Sub punch
    const notes = [
      { t: now + 0.00, freq: 1318.51, type: 'triangle', dur: 0.35, gain: 0.45 },
      { t: now + 0.00, freq: 1975.53, type: 'sine', dur: 0.30, gain: 0.35 },
      { t: now + 0.10, freq: 1975.53, type: 'triangle', dur: 0.40, gain: 0.50 },
      { t: now + 0.10, freq: 2637.02, type: 'sine', dur: 0.45, gain: 0.40 },
    ];

    // Sub foundation on strike 2 for satisfying acoustic snap
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(220, now + 0.10);
    subGain.gain.setValueAtTime(0.001, now + 0.10);
    subGain.gain.linearRampToValueAtTime(0.25 * vol, now + 0.11);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(now + 0.10);
    subOsc.stop(now + 0.36);

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, n.t);

      gain.gain.setValueAtTime(0.001, n.t);
      gain.gain.linearRampToValueAtTime(n.gain * vol, n.t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, n.t + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(n.t);
      osc.stop(n.t + n.dur + 0.02);
    });

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 150]);
    }
  } catch (e) {
    console.warn('[AlarmEngine] Notification chime error:', e);
  }
}

/**
 * Calculate the auto-sync wake up time:
 * The starting time of the first waking block for today
 */
export function calculateAutoWakeTime(todaysBlocks) {
  if (!Array.isArray(todaysBlocks) || todaysBlocks.length === 0) return '06:00';

  const daytimeBlocks = todaysBlocks.filter(
    (b) => b && b.start && !b.name?.toLowerCase().includes('sleep')
  );

  const candidateBlocks = daytimeBlocks.length > 0 ? daytimeBlocks : todaysBlocks;
  const sorted = [...candidateBlocks].sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  return sorted[0]?.start || '06:00';
}

/**
 * Calculate the auto-sync sleep alarm time:
 * The end of the last evening schedule, or start of the designated sleep block
 */
export function calculateAutoSleepTime(todaysBlocks) {
  if (!Array.isArray(todaysBlocks) || todaysBlocks.length === 0) return '22:00';

  const sleepBlock = todaysBlocks.find((b) => b && b.name?.toLowerCase().includes('sleep'));
  if (sleepBlock && sleepBlock.start) {
    return sleepBlock.start;
  }

  const sorted = [...todaysBlocks].sort((a, b) => (a.end || '').localeCompare(b.end || ''));
  return sorted[sorted.length - 1]?.end || '22:00';
}

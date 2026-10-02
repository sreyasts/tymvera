/**
 * TYMVERA Picture-in-Picture (PiP) & Floating Focus Timer Engine
 * Features:
 * - Native Document Picture-in-Picture (Chromium 116+): True floating desktop window
 * - HTML5 Canvas Video PiP fallback for mobile and legacy browsers
 * - Full-Screen Minimalist Focus Mode
 * - In-App Floating Corner Widget (Minimized corner mode)
 * - Synchronized live countdown, pause/resume ("post and resume"), and task marks
 */

let activePipWindow = null;
let pipCanvas = null;
let pipVideo = null;
let pipCanvasAnimId = null;

/**
 * Format seconds into MM:SS or HH:MM:SS
 */
export function formatTimerSeconds(totalSecs) {
  if (totalSecs < 0) totalSecs = 0;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Request Document Picture-in-Picture (Native floating OS window on Windows/Mac)
 */
export async function openDocumentPipWindow({
  taskName,
  timeFormatted,
  isPaused,
  progressPct,
  onTogglePause,
  onClose,
}) {
  if (typeof window === 'undefined') return null;

  // If already open, focus it
  if (activePipWindow && !activePipWindow.closed) {
    activePipWindow.focus();
    return activePipWindow;
  }

  // 1. Modern Document Picture-in-Picture API
  if ('documentPictureInPicture' in window && typeof window.documentPictureInPicture.requestWindow === 'function') {
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 180,
      });

      activePipWindow = pipWin;

      // Copy stylesheet links into PiP window for perfect styling
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        try {
          pipWin.document.head.appendChild(node.cloneNode(true));
        } catch (e) {}
      });

      // Inject standalone minimalist styles
      const style = pipWin.document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #080808; color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; padding: 12px; user-select: none; overflow: hidden; }
        .pip-container { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
        .pip-header { display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
        .pip-task { color: #fff; font-size: 12px; font-weight: 800; max-width: 190px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pip-body { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
        .pip-timer { font-size: 32px; font-weight: 900; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -1px; color: ${isPaused ? '#FF9F0A' : '#fff'}; }
        .pip-pct-badge { font-size: 11px; font-family: ui-monospace, monospace; font-weight: 800; color: ${isPaused ? '#FF9F0A' : '#10B981'}; }
        .pip-controls { display: flex; gap: 8px; width: 100%; }
        .pip-btn { flex: 1; padding: 6px 10px; border-radius: 10px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease; }
        .pip-btn-primary { background: ${isPaused ? '#10B981' : '#F59E0B'}; color: #000; }
        .pip-btn-primary:hover { opacity: 0.9; }
        .pip-btn-sec { background: #1a1a1a; color: #ccc; border: 1px solid #333; }
        .pip-btn-sec:hover { background: #262626; color: #fff; }
      `;
      pipWin.document.head.appendChild(style);

      const renderDom = () => {
        const pctClamped = Math.max(0, Math.min(100, Math.round(progressPct || 0)));
        const fluidHeight = Math.max(0, Math.min(48, (pctClamped / 100) * 48));
        const fluidTopY = 56 - fluidHeight;
        const fluidColor = isPaused ? '#F59E0B' : pctClamped <= 20 ? '#EF4444' : '#10B981';

        pipWin.document.body.innerHTML = `
          <div class="pip-container">
            <div class="pip-header">
              <span class="pip-task" id="pip-task-title">${escapeHtml(taskName || 'TYMVERA Focus')}</span>
              <span id="pip-status-badge" style="color: ${fluidColor}; font-size: 10px; font-weight: 800;">● ${isPaused ? 'PAUSED' : 'FOCUS'}</span>
            </div>
            <div class="pip-body">
              <!-- SVG Liquid Bottle -->
              <svg width="34" height="60" viewBox="0 0 34 60" style="overflow: visible; filter: drop-shadow(0 2px 6px ${fluidColor}66);">
                <rect x="11" y="0" width="12" height="4" rx="2" fill="#333" stroke="#555" stroke-width="0.8"/>
                <rect x="9" y="4" width="16" height="5" fill="rgba(255,255,255,0.06)" stroke="#444" stroke-width="0.8"/>
                <rect x="2" y="9" width="30" height="49" rx="8" fill="#111" stroke="rgba(255,255,255,0.15)" stroke-width="1.2"/>
                <g clip-path="url(#pip-bclip)">
                  <rect id="pip-fluid-rect" x="2" y="${fluidTopY}" width="30" height="${fluidHeight + 4}" fill="${fluidColor}" style="transition: all 0.5s ease;"/>
                </g>
                <clipPath id="pip-bclip">
                  <rect x="3" y="10" width="28" height="47" rx="7"/>
                </clipPath>
                <!-- Glass Reflection Highlight -->
                <path d="M 6 14 L 6 52" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-linecap="round"/>
              </svg>
              <div>
                <div class="pip-timer" id="pip-time-display">${timeFormatted}</div>
                <div class="pip-pct-badge" id="pip-pct-display">${pctClamped}% Energy Remaining</div>
              </div>
            </div>
            <div class="pip-controls">
              <button class="pip-btn pip-btn-primary" id="pip-pause-btn">
                ${isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button class="pip-btn pip-btn-sec" id="pip-return-btn">
                ⤢ Dock Back
              </button>
            </div>
          </div>
        `;

        pipWin.document.getElementById('pip-pause-btn').onclick = () => {
          if (typeof onTogglePause === 'function') onTogglePause();
        };

        pipWin.document.getElementById('pip-return-btn').onclick = () => {
          pipWin.close();
        };
      };

      renderDom();

      pipWin.addEventListener('pagehide', () => {
        activePipWindow = null;
        if (typeof onClose === 'function') onClose();
      });

      return pipWin;
    } catch (err) {
      console.warn('[PiP Engine] Document Picture-in-Picture failed, falling back:', err);
    }
  }

  return null;
}

/**
 * Updates the existing Document Picture-in-Picture DOM smoothly
 */
export function updateDocumentPipWindow({
  taskName,
  timeFormatted,
  isPaused,
  progressPct,
  onTogglePause,
}) {
  if (!activePipWindow || activePipWindow.closed) return;

  try {
    const doc = activePipWindow.document;
    const taskEl = doc.getElementById('pip-task-title');
    const timeEl = doc.getElementById('pip-time-display');
    const progEl = doc.getElementById('pip-progress-bar');
    const badgeEl = doc.getElementById('pip-status-badge');
    const pauseBtn = doc.getElementById('pip-pause-btn');

    const fluidEl = doc.getElementById('pip-fluid-rect');
    const pctEl = doc.getElementById('pip-pct-display');

    if (taskEl) taskEl.textContent = taskName || 'TYMVERA Focus';
    if (timeEl) {
      timeEl.textContent = timeFormatted;
      timeEl.style.color = isPaused ? '#FF9F0A' : '#fff';
    }
    const pctClamped = Math.max(0, Math.min(100, Math.round(progressPct || 0)));
    const fluidHeight = Math.max(0, Math.min(48, (pctClamped / 100) * 48));
    const fluidTopY = 56 - fluidHeight;
    const fluidColor = isPaused ? '#FF9F0A' : pctClamped <= 20 ? '#EF4444' : '#10B981';

    if (fluidEl) {
      fluidEl.setAttribute('y', fluidTopY);
      fluidEl.setAttribute('height', fluidHeight + 4);
      fluidEl.setAttribute('fill', fluidColor);
    }
    if (pctEl) {
      pctEl.textContent = `${pctClamped}% Energy Remaining`;
      pctEl.style.color = fluidColor;
    }
    if (badgeEl) {
      badgeEl.textContent = isPaused ? '● PAUSED' : '● FOCUS';
      badgeEl.style.color = fluidColor;
    }
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
      pauseBtn.style.background = isPaused ? '#10B981' : '#F59E0B';
      pauseBtn.onclick = () => {
        if (typeof onTogglePause === 'function') onTogglePause();
      };
    }
  } catch (e) {}
}

/**
 * Close Document Picture-in-Picture
 */
export function closeDocumentPipWindow() {
  if (activePipWindow && !activePipWindow.closed) {
    try {
      activePipWindow.close();
    } catch (e) {}
  }
  activePipWindow = null;
}

/**
 * Fallback Video PiP for browsers without Document PiP
 */
export async function openVideoPipFallback({ taskName, timeFormatted, isPaused }) {
  if (typeof window === 'undefined') return false;

  try {
    if (!pipCanvas) {
      pipCanvas = document.createElement('canvas');
      pipCanvas.width = 400;
      pipCanvas.height = 240;
    }
    const ctx = pipCanvas.getContext('2d');

    const draw = () => {
      // Draw dark background
      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, 400, 240);

      // Header
      ctx.fillStyle = '#888';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(taskName ? taskName.slice(0, 28).toUpperCase() : 'TYMVERA FOCUS', 20, 40);

      // Timer
      ctx.fillStyle = isPaused ? '#FF9F0A' : '#FFFFFF';
      ctx.font = 'bold 64px monospace';
      ctx.fillText(timeFormatted, 20, 130);

      // Status
      ctx.fillStyle = isPaused ? '#FF9F0A' : '#32D74B';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(isPaused ? '⏸ PAUSED' : '⚡ FOCUSING', 20, 180);
    };

    draw();

    if (!pipVideo) {
      pipVideo = document.createElement('video');
      pipVideo.muted = true;
      pipVideo.playsInline = true;
      pipVideo.srcObject = pipCanvas.captureStream(10);
      document.body.appendChild(pipVideo);
      pipVideo.style.position = 'fixed';
      pipVideo.style.opacity = '0';
      pipVideo.style.pointerEvents = 'none';
      await pipVideo.play();
    }

    if (document.pictureInPictureElement !== pipVideo && pipVideo.requestPictureInPicture) {
      await pipVideo.requestPictureInPicture();
      return true;
    }
  } catch (e) {
    console.warn('[PiP Engine] Video PiP fallback failed:', e);
  }
  return false;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

/**
 * TYMVERA Picture-in-Picture (PiP) & Floating Focus Timer Engine
 * 
 * Supports:
 * 1. Native Document Picture-in-Picture (Desktop Chromium: Chrome, Edge, Brave, TYMVERA Desktop)
 *    - Genuine OS-level top-level window (WS_EX_TOPMOST) that floats over ALL windows and apps.
 * 2. Canvas Video Picture-in-Picture (Android Chrome/Brave and Mobile Browsers)
 *    - Real OS-level floating PiP overlay window on Android that stays on top of ALL apps.
 *    - Canvas re-draws in real-time on every second tick with background completed progress fill,
 *      task title, percentage badge, and giant countdown.
 *    - Intercepts native play/pause PiP actions to pause/resume routine focus.
 */

let activePipWindow = null;
let pipCanvas = null;
let pipVideo = null;
let currentPipParams = null;

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
 * Draw the high-definition PiP canvas for Android & Video PiP fallback
 */
function renderPipCanvasFrame(ctx, { taskName, timeFormatted, isPaused, progressPct }) {
  const w = 480;
  const h = 270;
  const pctClamped = Math.max(0, Math.min(100, Math.round(progressPct || 0)));

  // Base background
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, w, h);

  // Background Completed Portion Fill
  if (pctClamped > 0) {
    const fillWidth = (pctClamped / 100) * w;
    const grad = ctx.createLinearGradient(0, 0, fillWidth, 0);
    if (isPaused) {
      grad.addColorStop(0, 'rgba(217, 119, 6, 0.16)');
      grad.addColorStop(0.95, 'rgba(245, 158, 11, 0.32)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.85)');
    } else {
      grad.addColorStop(0, 'rgba(37, 99, 235, 0.16)');
      grad.addColorStop(0.95, 'rgba(59, 130, 246, 0.32)');
      grad.addColorStop(1, 'rgba(96, 165, 250, 0.85)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, fillWidth, h);

    // Glowing leading edge line
    ctx.fillStyle = isPaused ? '#f59e0b' : '#3b82f6';
    ctx.fillRect(fillWidth - 3, 0, 3, h);
  }

  // Header: Task Name
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#9ca3af';
  const title = (taskName || 'TYMVERA ROUTINE').toUpperCase();
  ctx.fillText(title.length > 25 ? title.slice(0, 23) + '...' : title, 26, 42);

  // Header: Percentage Badge
  ctx.font = 'bold 15px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = isPaused ? '#f59e0b' : '#60a5fa';
  const pctText = `${pctClamped}% COMPLETED`;
  const pctMetrics = ctx.measureText(pctText);
  ctx.fillText(pctText, w - pctMetrics.width - 26, 42);

  // Giant Countdown Timer
  ctx.font = '900 76px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.fillStyle = isPaused ? '#f59e0b' : '#ffffff';
  ctx.fillText(timeFormatted || '00:00', 24, 146);

  // Progress Bar Track
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(26, 182, w - 52, 8);
  if (pctClamped > 0) {
    ctx.fillStyle = isPaused ? '#f59e0b' : '#3b82f6';
    ctx.fillRect(26, 182, ((w - 52) * pctClamped) / 100, 8);
  }

  // Footer: Status Badge
  ctx.fillStyle = isPaused ? '#f59e0b' : '#10b981';
  ctx.beginPath();
  ctx.arc(34, 226, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isPaused ? '#f59e0b' : '#10b981';
  ctx.fillText(isPaused ? 'PAUSED' : 'LIVE ROUTINE FOCUS', 48, 232);

  // Footer: Brand
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('TYMVERA', w - 90, 232);
}

/**
 * Universal System Picture-in-Picture Launcher:
 * - Desktop Windows: Document Picture-in-Picture (Always-On-Top window over all apps)
 * - Android & Mobile: Video Picture-in-Picture (System floating box over all apps)
 */
export async function launchSystemPipTimer({
  taskName,
  timeFormatted,
  isPaused,
  progressPct,
  onTogglePause,
  onClose,
}) {
  if (typeof window === 'undefined') return null;

  currentPipParams = { taskName, timeFormatted, isPaused, progressPct, onTogglePause, onClose };

  // 1. Check if Document Picture-in-Picture window is already active
  if (activePipWindow && !activePipWindow.closed) {
    activePipWindow.focus();
    return { mode: 'document', window: activePipWindow };
  }

  // 2. Try Native Document Picture-in-Picture (Desktop Windows / Chrome / Edge / Brave)
  if ('documentPictureInPicture' in window && typeof window.documentPictureInPicture.requestWindow === 'function') {
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 340,
        height: 185,
      });

      activePipWindow = pipWin;

      // Copy stylesheet links into PiP window
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        try {
          pipWin.document.head.appendChild(node.cloneNode(true));
        } catch (e) {}
      });

      // Inject standalone high-contrast styles
      const style = pipWin.document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #08080a; color: #fff; display: flex; flex-direction: column; justify-content: space-between; height: 100vh; padding: 14px; user-select: none; overflow: hidden; position: relative; }
        .bg-fill { position: absolute; inset: 0; left: 0; z-index: 0; pointer-events: none; transition: width 0.4s ease; }
        .pip-container { position: relative; z-index: 10; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
        .pip-header { display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
        .pip-task { color: #fff; font-size: 13px; font-weight: 800; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pip-timer-row { display: flex; align-items: baseline; justify-content: space-between; margin: 4px 0 2px 0; }
        .pip-timer { font-size: 38px; font-weight: 900; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -1px; color: ${isPaused ? '#FF9F0A' : '#fff'}; }
        .pip-pct-badge { font-size: 11px; font-family: ui-monospace, monospace; font-weight: 800; color: #3b82f6; }
        .pip-progress-track { width: 100%; height: 6px; background: #1a1a1a; border-radius: 99px; overflow: hidden; position: relative; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.08); }
        .pip-progress-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #3b82f6); border-radius: 99px; transition: width 0.4s ease; box-shadow: 0 0 10px rgba(59,130,246,0.6); }
        .pip-controls { display: flex; gap: 8px; width: 100%; }
        .pip-btn { flex: 1; padding: 7px 10px; border-radius: 10px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease; }
        .pip-btn-primary { background: ${isPaused ? '#3b82f6' : '#F59E0B'}; color: ${isPaused ? '#fff' : '#000'}; }
        .pip-btn-primary:hover { opacity: 0.9; }
        .pip-btn-sec { background: #1a1a1a; color: #ccc; border: 1px solid #333; }
        .pip-btn-sec:hover { background: #262626; color: #fff; }
      `;
      pipWin.document.head.appendChild(style);

      const pctClamped = Math.max(0, Math.min(100, Math.round(progressPct || 0)));

      pipWin.document.body.innerHTML = `
        <div class="bg-fill" id="pip-bg-fill" style="width: ${pctClamped}%; background: ${
          isPaused
            ? 'linear-gradient(90deg, rgba(217, 119, 6, 0.18) 0%, rgba(245, 158, 11, 0.35) 98%, rgba(245, 158, 11, 0.85) 100%)'
            : 'linear-gradient(90deg, rgba(37, 99, 235, 0.18) 0%, rgba(59, 130, 246, 0.35) 98%, rgba(96, 165, 250, 0.85) 100%)'
        }; border-right: 2px solid ${isPaused ? '#f59e0b' : '#3b82f6'};"></div>
        <div class="pip-container">
          <div class="pip-header">
            <span class="pip-task" id="pip-task-title">${escapeHtml(taskName || 'TYMVERA Routine')}</span>
            <span id="pip-status-badge" style="color: ${isPaused ? '#FF9F0A' : '#3b82f6'}; font-size: 10px; font-weight: 800;">● ${isPaused ? 'PAUSED' : 'IN PROGRESS'}</span>
          </div>
          <div>
            <div class="pip-timer-row">
              <div class="pip-timer" id="pip-time-display">${timeFormatted}</div>
              <div class="pip-pct-badge" id="pip-pct-display">${pctClamped}% completed</div>
            </div>
            <div class="pip-progress-track">
              <div class="pip-progress-fill" id="pip-progress-fill" style="width: ${pctClamped}%;"></div>
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

      pipWin.addEventListener('pagehide', () => {
        activePipWindow = null;
        if (typeof onClose === 'function') onClose();
      });

      return { mode: 'document', window: pipWin };
    } catch (err) {
      console.warn('[PiP Engine] Document Picture-in-Picture failed, falling back to Video PiP:', err);
    }
  }

  // 3. Fallback: OS-level Video Picture-in-Picture (Android Chrome/Brave & Mobile)
  const videoPipSuccess = await openVideoPipStream({
    taskName,
    timeFormatted,
    isPaused,
    progressPct,
    onTogglePause,
  });

  if (videoPipSuccess) {
    return { mode: 'video', video: pipVideo };
  }

  return null;
}

/**
 * Open Video PiP Stream on Android / Mobile
 */
async function openVideoPipStream({ taskName, timeFormatted, isPaused, progressPct, onTogglePause }) {
  if (typeof window === 'undefined') return false;

  try {
    if (!pipCanvas) {
      pipCanvas = document.createElement('canvas');
      pipCanvas.width = 480;
      pipCanvas.height = 270;
    }
    const ctx = pipCanvas.getContext('2d');
    renderPipCanvasFrame(ctx, { taskName, timeFormatted, isPaused, progressPct });

    if (!pipVideo) {
      pipVideo = document.createElement('video');
      pipVideo.muted = true;
      pipVideo.playsInline = true;
      pipVideo.autoplay = true;
      pipVideo.srcObject = pipCanvas.captureStream(10);
      pipVideo.style.position = 'fixed';
      pipVideo.style.opacity = '0.001';
      pipVideo.style.pointerEvents = 'none';
      pipVideo.style.bottom = '0';
      pipVideo.style.right = '0';
      pipVideo.style.width = '1px';
      pipVideo.style.height = '1px';
      document.body.appendChild(pipVideo);

      // Listen to play/pause from OS PiP controls
      pipVideo.addEventListener('pause', () => {
        if (currentPipParams && !currentPipParams.isPaused && typeof currentPipParams.onTogglePause === 'function') {
          currentPipParams.onTogglePause();
        }
      });
      pipVideo.addEventListener('play', () => {
        if (currentPipParams && currentPipParams.isPaused && typeof currentPipParams.onTogglePause === 'function') {
          currentPipParams.onTogglePause();
        }
      });
    } else {
      pipVideo.srcObject = pipCanvas.captureStream(10);
    }

    await pipVideo.play();

    if (document.pictureInPictureElement !== pipVideo && pipVideo.requestPictureInPicture) {
      await pipVideo.requestPictureInPicture();
      return true;
    }
  } catch (err) {
    console.warn('[PiP Engine] Video PiP request failed:', err);
  }

  return false;
}

/**
 * Live updater for both Document PiP and Video PiP
 */
export function updateDocumentPipWindow({
  taskName,
  timeFormatted,
  isPaused,
  progressPct,
  onTogglePause,
}) {
  currentPipParams = { taskName, timeFormatted, isPaused, progressPct, onTogglePause };
  const pctClamped = Math.max(0, Math.min(100, Math.round(progressPct || 0)));

  // Update Document PiP DOM if open
  if (activePipWindow && !activePipWindow.closed) {
    try {
      const doc = activePipWindow.document;
      const taskEl = doc.getElementById('pip-task-title');
      const timeEl = doc.getElementById('pip-time-display');
      const badgeEl = doc.getElementById('pip-status-badge');
      const pauseBtn = doc.getElementById('pip-pause-btn');
      const progFill = doc.getElementById('pip-progress-fill');
      const bgFill = doc.getElementById('pip-bg-fill');
      const pctEl = doc.getElementById('pip-pct-display');

      if (taskEl) taskEl.textContent = taskName || 'TYMVERA Routine';
      if (timeEl) {
        timeEl.textContent = timeFormatted;
        timeEl.style.color = isPaused ? '#FF9F0A' : '#fff';
      }

      if (bgFill) {
        bgFill.style.width = `${pctClamped}%`;
        bgFill.style.background = isPaused
          ? 'linear-gradient(90deg, rgba(217, 119, 6, 0.18) 0%, rgba(245, 158, 11, 0.35) 98%, rgba(245, 158, 11, 0.85) 100%)'
          : 'linear-gradient(90deg, rgba(37, 99, 235, 0.18) 0%, rgba(59, 130, 246, 0.35) 98%, rgba(96, 165, 250, 0.85) 100%)';
        bgFill.style.borderRight = `2px solid ${isPaused ? '#f59e0b' : '#3b82f6'}`;
      }

      if (progFill) {
        progFill.style.width = `${pctClamped}%`;
        progFill.style.background = isPaused
          ? 'linear-gradient(90deg, #d97706, #f59e0b)'
          : 'linear-gradient(90deg, #2563eb, #3b82f6)';
      }
      if (pctEl) {
        pctEl.textContent = `${pctClamped}% completed`;
        pctEl.style.color = isPaused ? '#FF9F0A' : '#3b82f6';
      }
      if (badgeEl) {
        badgeEl.textContent = isPaused ? '● PAUSED' : '● IN PROGRESS';
        badgeEl.style.color = isPaused ? '#FF9F0A' : '#3b82f6';
      }
      if (pauseBtn) {
        pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
        pauseBtn.style.background = isPaused ? '#3b82f6' : '#F59E0B';
        pauseBtn.style.color = isPaused ? '#fff' : '#000';
        pauseBtn.onclick = () => {
          if (typeof onTogglePause === 'function') onTogglePause();
        };
      }
    } catch (e) {}
  }

  // Update Video PiP Canvas frame if active
  if (document.pictureInPictureElement && pipCanvas) {
    try {
      const ctx = pipCanvas.getContext('2d');
      renderPipCanvasFrame(ctx, { taskName, timeFormatted, isPaused, progressPct });
    } catch (e) {}
  }
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

  if (document.pictureInPictureElement && document.exitPictureInPicture) {
    try {
      document.exitPictureInPicture();
    } catch (e) {}
  }
}

/**
 * Backward compatibility alias
 */
export const openDocumentPipWindow = launchSystemPipTimer;
export const openVideoPipFallback = openVideoPipStream;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

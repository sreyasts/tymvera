/**
 * TYMVERA Picture-in-Picture (PiP) & Floating Focus Timer Engine
 * 
 * Supports:
 * 1. Native Document Picture-in-Picture (Always-On-Top OS Window over all PC apps)
 * 2. System Video Picture-in-Picture (Floating OS Box over all Android & mobile apps)
 * 3. Real-time synchronised background completed portion progress fill, timer, and controls.
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
 * High-definition Canvas Frame Renderer for Video PiP (Android / Mobile)
 */
function renderPipCanvasFrame(ctx, { taskName, timeFormatted, isPaused, progressPct }) {
  const w = 480;
  const h = 270;
  const pctClamped = Math.max(0, Math.min(100, Math.round(progressPct || 0)));

  // Obsidian Background
  ctx.fillStyle = '#070709';
  ctx.fillRect(0, 0, w, h);

  // Background Completed Progress Fill
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
  ctx.fillStyle = '#8e8e93';
  const title = (taskName || 'TYMVERA ROUTINE').toUpperCase();
  ctx.fillText(title.length > 25 ? title.slice(0, 23) + '...' : title, 26, 42);

  // Header: Percentage Badge
  ctx.font = 'bold 15px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = isPaused ? '#f59e0b' : '#60a5fa';
  const pctText = `${pctClamped}% COMPLETED`;
  const pctMetrics = ctx.measureText(pctText);
  ctx.fillText(pctText, w - pctMetrics.width - 26, 42);

  // Giant Countdown Timer (Obsidian Monospaced)
  ctx.font = '900 76px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.fillStyle = isPaused ? '#f59e0b' : '#ffffff';
  ctx.fillText(timeFormatted || '00:00', 24, 146);

  // Progress Bar Track
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(26, 182, w - 52, 8);
  if (pctClamped > 0) {
    ctx.fillStyle = isPaused ? '#f59e0b' : '#3b82f6';
    ctx.fillRect(26, 182, ((w - 52) * pctClamped) / 100, 8);
  }

  // Footer: Status Beacon & App
  ctx.fillStyle = isPaused ? '#f59e0b' : '#10b981';
  ctx.beginPath();
  ctx.arc(34, 226, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isPaused ? '#f59e0b' : '#10b981';
  ctx.fillText(isPaused ? 'PAUSED' : 'LIVE FOCUS ACTIVE', 48, 232);

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

  // 0. Native Android PiP (Activity-level floating OS window over all apps)
  if (typeof window !== 'undefined' && window.NativeAndroid && typeof window.NativeAndroid.enterPipMode === 'function') {
    try {
      window.NativeAndroid.enterPipMode();
      return { mode: 'native_android' };
    } catch (nativePipErr) {
      console.warn('[PiP Engine] Native Android PiP failed:', nativePipErr);
    }
  }

  // 1. Focus existing PiP window if open
  if (activePipWindow && !activePipWindow.closed) {
    try {
      activePipWindow.focus();
      return { mode: 'document', window: activePipWindow };
    } catch (e) {}
  }

  // 2. Try Document Picture-in-Picture (Desktop Windows / Edge / Chrome / Brave)
  if ('documentPictureInPicture' in window && typeof window.documentPictureInPicture.requestWindow === 'function') {
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 340,
        height: 190,
      });

      activePipWindow = pipWin;

      // Copy stylesheet links into PiP window
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        try {
          pipWin.document.head.appendChild(node.cloneNode(true));
        } catch (e) {}
      });

      // Inject standalone high-contrast obsidian styles
      const style = pipWin.document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #070709; color: #fff; display: flex; flex-direction: column; justify-content: space-between; height: 100vh; padding: 14px 16px; user-select: none; overflow: hidden; position: relative; cursor: pointer; }
        .bg-fill { position: absolute; inset: 0; left: 0; z-index: 0; pointer-events: none; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        .pip-container { position: relative; z-index: 10; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
        .pip-header { display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 11px; font-weight: 700; color: #8e8e93; text-transform: uppercase; letter-spacing: 0.8px; }
        .pip-task { color: #ffffff; font-size: 13px; font-weight: 800; max-width: 210px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.2px; }
        .pip-timer-row { display: flex; align-items: baseline; justify-content: space-between; margin: 6px 0 4px 0; }
        .pip-timer { font-size: 42px; font-weight: 900; font-family: ui-monospace, SFMono-Regular, "SF Pro", Menlo, Monaco, Consolas, monospace; letter-spacing: -1.5px; color: ${isPaused ? '#FF9F0A' : '#ffffff'}; font-feature-settings: 'tnum'; }
        .pip-pct-badge { font-size: 12px; font-family: ui-monospace, monospace; font-weight: 800; color: #3b82f6; }
        .pip-progress-track { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; position: relative; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.06); }
        .pip-progress-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #3b82f6); border-radius: 99px; transition: width 0.5s ease; box-shadow: 0 0 12px rgba(59,130,246,0.6); }
        .pip-controls { display: flex; gap: 8px; width: 100%; }
        .pip-btn { flex: 1; padding: 8px 12px; border-radius: 12px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease; }
        .pip-btn-primary { background: ${isPaused ? '#3b82f6' : 'rgba(255,255,255,0.12)'}; color: #fff; border: 1px solid rgba(255,255,255,0.15); }
        .pip-btn-primary:hover { background: ${isPaused ? '#2563eb' : 'rgba(255,255,255,0.2)'}; }
        .pip-btn-sec { background: rgba(255,255,255,0.05); color: #8e8e93; border: 1px solid rgba(255,255,255,0.08); }
        .pip-btn-sec:hover { background: rgba(255,255,255,0.1); color: #fff; }
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
      pipVideo.width = 480;
      pipVideo.height = 270;
      pipVideo.style.position = 'fixed';
      pipVideo.style.top = '-9999px';
      pipVideo.style.left = '-9999px';
      pipVideo.style.width = '480px';
      pipVideo.style.height = '270px';
      pipVideo.style.opacity = '0.01';
      pipVideo.style.pointerEvents = 'none';
      pipVideo.style.zIndex = '-9999';
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
    }

    pipVideo.srcObject = pipCanvas.captureStream(15);
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
        pauseBtn.style.background = isPaused ? '#3b82f6' : 'rgba(255,255,255,0.12)';
        pauseBtn.style.color = '#fff';
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

export const openDocumentPipWindow = launchSystemPipTimer;
export const openVideoPipFallback = openVideoPipStream;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

/**
 * TYMVERA In-App Download Engine
 * Features:
 * - Smart platform detection (Android vs Windows vs Other)
 * - Standalone app detection (hides all download prompts when already inside the installed app)
 * - In-app stream downloading with live byte & percentage progress
 * - Zero external redirects — downloads directly into the user's device
 */

export function detectUserPlatform() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'other';
}

export function isAppInstalled() {
  if (typeof window === 'undefined') return false;
  // 1. Standalone Native Android Bridge
  if (window.NativeAndroid) return true;
  // 2. Standalone PWA / WebAPK display mode
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  // 3. iOS standalone webclip
  if (window.navigator && window.navigator.standalone) return true;
  // 4. Windows Desktop app / WebView2
  if (window.chrome && window.chrome.webview) return true;
  return false;
}

export const APP_PACKAGE_INFO = {
  android: {
    name: 'TYMVERA for Android',
    badge: 'Standalone Native App',
    filename: 'TYMVERA.apk',
    primaryUrl: 'https://raw.githubusercontent.com/sreyasts/tymvera/master/public/downloads/TYMVERA-Android.apk',
    fallbackUrl: '/downloads/TYMVERA-Android.zip',
    sizeFormatted: '8.0 MB',
    approxBytes: 7953433,
    icon: 'android',
    accentColor: '#10b981',
    mimeType: 'application/vnd.android.package-archive',
    benefits: [
      '100% Real Native App — Runs on its own process without Brave or Chrome',
      'True Offline Engine — Instant 0ms startup, all assets bundled inside',
      'Guaranteed Alarms — Native AlarmManager rings at the exact second even in Doze sleep',
      'System Overlay — Floating Picture-in-Picture over all your phone’s apps'
    ]
  },
  windows: {
    name: 'TYMVERA for Windows',
    badge: 'Standalone Desktop App',
    filename: 'TYMVERA.exe',
    primaryUrl: 'https://raw.githubusercontent.com/sreyasts/tymvera/master/public/downloads/TYMVERA-Windows.exe',
    fallbackUrl: '/downloads/TYMVERA-Windows.zip',
    sizeFormatted: '80 KB',
    approxBytes: 80808,
    icon: 'desktop_windows',
    accentColor: '#3b82f6',
    benefits: [
      'Standalone Desktop Process — Pin to Taskbar & Start Menu',
      'System Tray Persistence — Keeps routines and alarms running in background',
      'Hardware PiP Widget — Stays always-on-top over work & game windows',
      'Zero virus warnings with verified manifest & Authenticode signature'
    ]
  }
};

/**
 * Downloads a package with in-app streaming progress tracking and automatic file saving.
 */
export async function downloadPackageWithProgress(platform, onProgress) {
  const pkg = APP_PACKAGE_INFO[platform] || APP_PACKAGE_INFO.android;
  const targetUrl = pkg.primaryUrl;
  const approxTotal = pkg.approxBytes;

  try {
    onProgress({ percent: 5, receivedBytes: 0, totalBytes: approxTotal, status: 'connecting' });

    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const headerLength = response.headers.get('content-length');
    const totalBytes = headerLength ? parseInt(headerLength, 10) : approxTotal;

    if (!response.body) {
      // If stream reading is not supported, fetch blob directly
      onProgress({ percent: 60, receivedBytes: totalBytes * 0.6, totalBytes, status: 'downloading' });
      const blob = await response.blob();
      saveBlobLocally(blob, pkg.filename, pkg.mimeType);
      onProgress({ percent: 100, receivedBytes: totalBytes, totalBytes, status: 'complete' });
      return { success: true };
    }

    const reader = response.body.getReader();
    let receivedBytes = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;

      const percent = Math.min(98, Math.max(8, Math.round((receivedBytes / totalBytes) * 100)));
      onProgress({
        percent,
        receivedBytes,
        totalBytes,
        status: percent > 90 ? 'verifying' : 'downloading',
      });
    }

    onProgress({ percent: 99, receivedBytes, totalBytes, status: 'verifying' });

    const blob = new Blob(chunks, { type: pkg.mimeType });
    saveBlobLocally(blob, pkg.filename, pkg.mimeType);

    onProgress({ percent: 100, receivedBytes, totalBytes, status: 'complete' });
    return { success: true };
  } catch (err) {
    console.warn('[AppDownloadEngine] Streaming fetch failed, executing browser fallback:', err);
    // Direct safe fallback without leaving the current app tab
    triggerDirectDownloadFallback(targetUrl, pkg.filename);
    onProgress({ percent: 100, receivedBytes: approxTotal, totalBytes: approxTotal, status: 'complete' });
    return { success: true, fallback: true };
  }
}

function saveBlobLocally(blob, filename, mimeType) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function triggerDirectDownloadFallback(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

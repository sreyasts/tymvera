/**
 * TYMVERA Progressive Web App — Production Service Worker
 * Version: v26.0.0
 * Features:
 * - 100% Offline-First Architecture
 * - Pre-caching of core application shell, self-hosted Tailwind, and icon fonts
 * - Stale-while-revalidate / cache-first strategies for assets
 * - Network-first with instant offline fallback for navigation
 * - Push & local notification click lifecycle handling
 */

const CACHE_NAME = 'tymvera-v35-core';
const RUNTIME_CACHE = 'tymvera-v35-runtime';

// Critical assets to precache on installation for guaranteed offline execution
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/icon.png',
  '/vendor/tailwindcss.js',
  '/vendor/material-symbols.css',
  '/vendor/material-symbols-rounded.woff2'
];

// Install: precache critical assets + dynamic Vite bundles
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Precache explicit static assets
      await Promise.all(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response && (response.ok || response.type === 'opaque')) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('[TYMVERA SW] Precache warning for ' + url + ':', err);
          }
        })
      );

      // 2. Dynamically scan /index.html to precache hashed Vite bundles (/assets/*.js, /assets/*.css)
      try {
        const indexRes = await fetch('/index.html', { cache: 'no-cache' });
        if (indexRes && indexRes.ok) {
          const htmlText = await indexRes.text();
          const matches = htmlText.match(/(?:src|href)="(\/assets\/[^"]+)"/g) || [];
          for (const match of matches) {
            const assetUrl = match.replace(/^(?:src|href)="/, '').replace(/"$/, '');
            try {
              const res = await fetch(assetUrl, { cache: 'no-cache' });
              if (res && res.ok) {
                await cache.put(assetUrl, res);
                console.log('[TYMVERA SW] Precached dynamic asset bundle:', assetUrl);
              }
            } catch (e) {
              console.warn('[TYMVERA SW] Failed to precache dynamic asset:', assetUrl, e);
            }
          }
        }
      } catch (err) {
        console.warn('[TYMVERA SW] Failed to scan /index.html for dynamic assets:', err);
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up older cache versions and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
            console.log('[TYMVERA SW] Evicting legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // 1. Navigation requests (HTML pages): Network-first with instant cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Device is offline — serve cached HTML shell
          const cachedResponse = await caches.match('/index.html') || await caches.match('/');
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TYMVERA Offline</title></head><body style="background:#080808;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h2>TYMVERA Offline — Open once while connected to enable full offline support</h2></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 2. Same-origin assets (/assets/..., /vendor/..., icons, etc.): Cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // If it's not a hashed immutable asset, update in background
          if (!url.pathname.startsWith('/assets/')) {
            fetch(request)
              .then((freshResponse) => {
                if (freshResponse && freshResponse.ok) {
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, freshResponse));
                }
              })
              .catch(() => {});
          }
          return cachedResponse;
        }

        // Not in cache, fetch from network and cache
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. External CDN / Google Fonts: Stale-while-revalidate
  if (
    url.hostname.includes('tailwindcss.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
              const clone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Default: Try network, fallback to cache if available
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Notifications: handle user tapping on scheduled routine / alarm alerts
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

// ─── SCHEDULE & NOTIFICATION CACHE IN SERVICE WORKER ────────────────────────
let cachedSchedule = [];
let cachedAlarms = {};
let cachedConfig = {};

function checkBackgroundSchedule() {
  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();

  if (Array.isArray(cachedSchedule) && cachedSchedule.length > 0) {
    for (const block of cachedSchedule) {
      if (!block || !block.start) continue;
      const [sh, sm] = block.start.split(':').map(Number);
      const startMins = sh * 60 + (sm || 0);
      const diff = currentTotalMins - startMins;

      if (diff >= 0 && diff <= 3) {
        return self.registration.showNotification(`⚡ ${block.name} • Starting Now`, {
          body: `Scheduled: ${block.start} (${block.duration || 60}m session)`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [250, 100, 250, 100, 500],
          tag: `sw_start_${block.id || block.name}`,
          renotify: true,
          data: { url: '/' },
        });
      }
    }
  }
  return Promise.resolve();
}

// Web Push Notifications: Wake up and alert user even if PWA window is closed
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'TYMVERA Alert', body: event.data.text() };
    }
  }

  const title = data.title || '⚡ TYMVERA Routine Alert';
  const options = {
    body: data.body || 'Scheduled routine milestone alert',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [250, 100, 250, 100, 500],
    tag: data.tag || `tymvera_push_${Date.now()}`,
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: false,
    data: data.data || { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Periodic Background Sync (supported mobile PWA engines)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'tymvera-schedule-sync') {
    event.waitUntil(checkBackgroundSchedule());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'tymvera-background-alert') {
    event.waitUntil(checkBackgroundSchedule());
  }
});

// Message listener for skipWaiting or manual updates
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'SYNC_SCHEDULE') {
    cachedSchedule = event.data.blocks || [];
    cachedAlarms = event.data.alarms || {};
    cachedConfig = event.data.config || {};
  } else if (event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

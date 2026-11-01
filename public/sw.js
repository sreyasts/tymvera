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

const CACHE_NAME = 'tymvera-v44-core';
const RUNTIME_CACHE = 'tymvera-v44-runtime';

// Critical assets to precache on installation for guaranteed offline execution
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-96.png?v=4',
  '/favicon-32.png',
  '/icon-192.png',
  '/notification-badge.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/icon.png',
  '/favicon-32.png'
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

// Notifications use the platform template; the app supplies its identity assets.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const date=event.notification.data?.date;
  const path=/^\d{4}-\d{2}-\d{2}$/.test(date||'') ? '/?date='+date : '/';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const client=clients.find(c=>c.url.startsWith(self.location.origin));
    if(client){await client.navigate(path);return client.focus();}
    return self.clients.openWindow(path);
  }));
});
// Ready to receive a real push; no closed-tab scheduler/subscription is configured.
self.addEventListener('push', event => {
  let data={};try{data=event.data?.json()||{};}catch{data={body:event.data?.text()};}
  event.waitUntil(self.registration.showNotification(data.title||'TYMVERA',{
    body:data.body||'Open your plan.', icon:'/icon-192.png?v=4',badge:'/notification-badge.png',
    tag:data.tag||'tymvera-push',renotify:false,data:{date:data.date},actions:[{action:'open',title:'Open plan'}],
  }));
});
self.addEventListener('message', event => {
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

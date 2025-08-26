const CACHE_NAME = 'mindflip-v1';
const ASSETS = [
  './index.html',
  'game.js',
  './manifest.json',
  './assets/logo/favicon.ico',
  './assets/logo/apple-touch-icon.png',
  './assets/logo/mind_flip_dash_192x192.png',
  './assets/logo/mind_flip_dash_512x512.png',
  './assets/logo/mind_flip_dash_logo.png',
  './assets/html/blog.html',
  './assets/html/privacy_policy.html',
  './assets/html/terms_of_service.html',
  './assets/arrows/up.svg',
  './assets/arrows/down.svg',
  './assets/arrows/left.svg',
  './assets/arrows/right.svg',
  './assets/arrows/ne.svg',
  './assets/arrows/nw.svg',
  './assets/arrows/se.svg',
  './assets/arrows/sw.svg',
  './assets/sounds/background.mp3',
  './assets/sounds/fail.mp3',
  './assets/sounds/opening_door.mp3',
  './assets/sounds/success.mp3'
];

// Install Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate (clear old caches)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

// Serve cached assets; for API requests use network-first
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('https://mind-flip-dash.up.railway.app/api/') || url.pathname.startsWith('https://mind-flip-dash.up.railway.app/submit-score') || url.pathname === 'https://mind-flip-dash.up.railway.app/leaderboard') {
    // network-first for API
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(resp => resp || fetch(event.request)));
});
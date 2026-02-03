
const CACHE_NAME = 'seeds-core-v12';
const ASSETS = [
  './',
  './index.html',
  './index.tsx',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;800&display=swap',
  'https://www.seedsschool.edu.pk/wp-content/uploads/2021/09/seeds-logo-green.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(nr => {
      if(nr.status === 200) {
        const c = nr.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
      }
      return nr;
    }).catch(() => caches.match('./index.html')))
  );
});

// PDS Portal Service Worker for PWABuilder & Native App Support
const CACHE_NAME = 'pds-portal-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Forward all network requests directly
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// Static resources are cached on demand; authenticated HTML and APIs stay network-only.
const CACHE_NAME = 'veil-static-v4';
const BOOT_ASSETS = ['/css/styles.css', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(BOOT_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('veil-') && name !== CACHE_NAME).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || request.mode === 'navigate') return;
    if (!/^\/(js|css)\//.test(url.pathname) && !['/favicon.svg', '/manifest.json'].includes(url.pathname)) return;
    event.respondWith(networkFirst(event, request));
});

async function networkFirst(event, request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok && !response.redirected) event.waitUntil(cache.put(request, response.clone()));
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response('Offline: this static resource has not been cached', { status: 503 });
    }
}

// Minimal service worker — required by Chrome/Android as one of the installability
// criteria for the native "Add to Home Screen" prompt. No offline caching yet.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

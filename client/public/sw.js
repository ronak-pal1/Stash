const CACHE = "stash-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/favicon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "Stash", body: "Reminder" };
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, data: payload }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const noteId = event.notification.data?.noteId;
  event.waitUntil(self.clients.openWindow(noteId ? `/app?note=${noteId}` : "/app"));
});

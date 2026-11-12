/* Scoped to the app's base path, including GitHub Pages project paths. */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Matchklart", {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const fallback = new URL("./#mina", self.registration.scope);
  let target;
  try {
    target = new URL(event.notification.data?.url || fallback.href);
  } catch {
    target = fallback;
  }
  if (target.origin !== fallback.origin || !target.pathname.startsWith(fallback.pathname))
    target = fallback;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && "focus" in client) {
          await client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});

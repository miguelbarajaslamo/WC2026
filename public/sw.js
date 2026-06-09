self.addEventListener("push", (event) => {
  const payload = event.data
    ? event.data.json()
    : {
        body: "You have a WORLD CUP PICKS reminder.",
        title: "WORLD CUP PICKS",
        url: "/picks",
      };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "WORLD CUP PICKS", {
      body: payload.body,
      data: { url: payload.url ?? "/picks" },
      icon: "/icon-192.png",
      badge: "/icon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/picks";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    }),
  );
});
